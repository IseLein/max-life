import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "~/env";
import { calendarFunctions } from "~/lib/gemini";

const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const gemini = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

export const geminiRouter = createTRPCRouter({
  generate: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        history: z.array(
          z.object({
            role: z.string(),
            parts: z.array(z.object({ text: z.string() })),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { prompt, history } = input;
      const chat = gemini.startChat({ history });

      const response = await chat.sendMessage(prompt);
      return response;
    }),

  calendarChat: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        history: z
          .array(
            z.object({
              role: z.string(),
              parts: z.array(z.object({ text: z.string() })),
            }),
          )
          .optional(),
        userTimeInfo: z
          .object({
            date: z.string(),
            time: z.string(),
            timezone: z.string(),
            localTime: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { message, userTimeInfo } = input;

      // Use user's time info if available, otherwise use server time
      const currentDate =
        userTimeInfo?.date || new Date().toISOString().split("T")[0];
      const currentTime = userTimeInfo?.time || new Date().toISOString();
      const timezone =
        userTimeInfo?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localTime =
        userTimeInfo?.localTime ||
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });

      // Calculate tomorrow and next week dates
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);

      // Create a dynamic extraction prompt with the user's time information
      const dynamicExtractionPrompt = `
You are a calendar assistant. Extract all calendar events from the following message. 
Today's date is: ${currentDate} (${localTime} in ${timezone}). 
The timezone of the user is: ${timezone}.

For each event, provide:
1. summary (title)
2. description (optional)
3. startDateTime (in ISO format with the correct timezone offset)
4. endDateTime (in ISO format with the correct timezone offset)

IMPORTANT TIME INTERPRETATION RULES:
- Today means ${currentDate}
- Tonight means today evening (after 6:00 PM today)
- Tomorrow means ${tomorrowDate.toLocaleDateString("en-CA")}
- This weekend means the upcoming Saturday and Sunday
- Next week means starting on ${nextWeekDate.toLocaleDateString("en-CA")}

When time is mentioned without a specific date:
- If only time is mentioned (e.g., "at 3pm"), assume it's for today
- If "tonight" is mentioned, set the date to today
- If "tomorrow" is mentioned, set the date to tomorrow
- Always use 24-hour time format in the ISO string
- Make sure to use the user's timezone (${timezone}) when creating the ISO datetime strings

Format your response as a JSON array of events. Only include the JSON array in your response, nothing else.
Example format:
[
  {
    "summary": "Grocery Shopping",
    "description": "Buy fruits, vegetables, and milk",
    "startDateTime": "2025-03-23T18:00:00-04:00",
    "endDateTime": "2025-03-23T19:00:00-04:00"
  }
]

If no events are found, return an empty array: []
`;

      try {
        // Check if this is a deletion request
        const isDeletionRequest =
          /delete|remove|cancel/i.test(message.toLowerCase()) &&
          /event|appointment|meeting|calendar/i.test(message.toLowerCase());

        let deletedEvents = [];

        // Handle deletion requests
        if (isDeletionRequest) {
          // First, determine the date range for deletion
          const isNextWeek = /next week/i.test(message);
          const isToday = /today/i.test(message);
          const isTomorrow = /tomorrow/i.test(message);
          const isAll = /all|every/i.test(message);

          let startDate = new Date(currentDate);
          let endDate = new Date(currentDate);

          if (isNextWeek) {
            startDate = new Date(nextWeekDate.toLocaleDateString("en-CA"));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // End of next week
          } else if (isTomorrow) {
            startDate = new Date(tomorrowDate.toLocaleDateString("en-CA"));
            endDate = new Date(startDate);
          } else if (isToday) {
            // startDate is already today
            // endDate is already today
          } else if (isAll) {
            // For "all events", use a broader range
            endDate.setMonth(endDate.getMonth() + 3); // 3 months from now
          } else {
            // Default to next 7 days if not specified
            endDate.setDate(endDate.getDate() + 7);
          }

          // Get events in the specified date range
          const events = await calendarFunctions.getCalendarEvents(
            { startDate, endDate },
            userId,
          );

          // Delete each event
          for (const event of events) {
            try {
              await calendarFunctions.deleteCalendarEvent(
                { userId: userId, eventId: event.id },
                userId,
              );
              deletedEvents.push({
                summary: event.summary,
                success: true,
                id: event.id,
              });
            } catch (deleteError) {
              console.error("Error deleting event:", deleteError);
              deletedEvents.push({
                summary: event.summary,
                success: false,
                error: (deleteError as Error).message,
              });
            }
          }

          // Generate response about deletion
          let deletionResponse = "";
          if (deletedEvents.length > 0) {
            const successfulDeletions = deletedEvents.filter((e) => e.success);
            const failedDeletions = deletedEvents.filter((e) => !e.success);

            deletionResponse = `I've deleted ${successfulDeletions.length} events from your calendar`;

            if (isNextWeek) {
              deletionResponse += ` for next week (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()})`;
            } else if (isTomorrow) {
              deletionResponse += ` for tomorrow (${startDate.toLocaleDateString()})`;
            } else if (isToday) {
              deletionResponse += ` for today (${startDate.toLocaleDateString()})`;
            } else {
              deletionResponse += ` from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
            }

            if (successfulDeletions.length > 0) {
              deletionResponse += ":\n";
              successfulDeletions.forEach((event) => {
                deletionResponse += `- ${event.summary}\n`;
              });
            }

            if (failedDeletions.length > 0) {
              deletionResponse += `\n\nI couldn't delete ${failedDeletions.length} events:\n`;
              failedDeletions.forEach((event) => {
                deletionResponse += `- ${event.summary}\n`;
              });
            }
          } else {
            deletionResponse =
              "I didn't find any events to delete in the specified time period.";
          }

          return {
            response: deletionResponse,
            events: deletedEvents,
          };
        }

        // If not a deletion request, continue with event extraction
        const extractionPrompt = `${dynamicExtractionPrompt}\n\nMessage: ${message}`;
        const extractionResult = await gemini.generateContent(extractionPrompt);
        const extractionText = extractionResult.response.text();

        let events = [];
        try {
          // Try to parse the JSON response
          const jsonStart = extractionText.indexOf("[");
          const jsonEnd = extractionText.lastIndexOf("]") + 1;

          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonText = extractionText.substring(jsonStart, jsonEnd);
            events = JSON.parse(jsonText);
          }
        } catch (parseError) {
          console.error("Error parsing events JSON:", parseError);
        }

        // If we found events, create them
        const createdEvents = [];
        if (events.length > 0) {
          for (const event of events) {
            try {
              const result = await calendarFunctions.createCalendarEvent(
                event,
                userId,
              );
              createdEvents.push({
                summary: event.summary,
                success: true,
                id: result.id,
              });
            } catch (createError) {
              console.error("Error creating event:", createError);
              createdEvents.push({
                summary: event.summary,
                success: false,
                error: (createError as Error).message,
              });
            }
          }
        }

        // Now generate a response about what we did
        let responsePrompt = message;
        if (createdEvents.length > 0) {
          const successEvents = createdEvents.filter((e) => e.success);
          const failedEvents = createdEvents.filter((e) => !e.success);

          responsePrompt += `\n\nI've added ${successEvents.length} events to your calendar:`;
          successEvents.forEach((event) => {
            responsePrompt += `\n- ${event.summary}`;
          });

          if (failedEvents.length > 0) {
            responsePrompt += `\n\nI couldn't add ${failedEvents.length} events:`;
            failedEvents.forEach((event) => {
              responsePrompt += `\n- ${event.summary}`;
            });
          }
        }

        // Get a natural language response
        const chatModel = genai.getGenerativeModel({
          model: "gemini-2.0-flash",
        });
        const chat = chatModel.startChat({
          history: input.history || [],
        });

        // Add system instructions to inform the model about available functions
        const systemInstructions = `You are a calendar assistant with direct access to the user's calendar. 
You can create, view, update, and delete calendar events through API calls that have already been implemented.
When users ask to view or list events, you should respond as if you have actually listed them (which you have).
When users ask to delete events, you should respond as if you have actually deleted them (which you have).
When users ask to create events, you should respond as if you have actually created them (which you have).
When users ask to update events, you should respond as if you have actually updated them (which you have).
DO NOT say things like "I don't have access to your calendar" because you DO have access through API calls.`;

        // Add the system instructions to the chat
        await chat.sendMessage(systemInstructions);

        const chatResponse = await chat.sendMessage(responsePrompt);

        return {
          response: chatResponse.response.text(),
          events: createdEvents,
        };
      } catch (error) {
        console.error("Error in calendar chat:", error);
        throw error;
      }
    }),

  calendarFunctionCall: protectedProcedure
    .input(
      z.object({
        functionName: z.enum([
          "getCalendarEvents",
          "createCalendarEvent",
          "updateCalendarEvent",
          "deleteCalendarEvent",
        ]),
        args: z.record(z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { functionName, args } = input;

      // Validate that the function exists
      if (!calendarFunctions[functionName]) {
        throw new Error(`Function ${functionName} not found`);
      }

      try {
        // Call the function with the arguments and user ID
        const result = await calendarFunctions[functionName](
          args as any,
          userId,
        );
        return { success: true, data: result };
      } catch (error) {
        console.error(`Error executing ${functionName}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
