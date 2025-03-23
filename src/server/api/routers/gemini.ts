import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "~/env";
import { calendarFunctions } from "~/lib/gemini";

const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const gemini = genai.getGenerativeModel({ model: "gemini-1.5-pro" });

// Simple event extraction prompt
const EVENT_EXTRACTION_PROMPT = `
You are a calendar assistant. Extract all calendar events from the following message. Today's date is: ${new Date().toISOString().split("T")[0]}. The timezone of the user is: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.

For each event, provide:
1. summary (title)
2. description (optional)
3. startDateTime (in ISO format)
4. endDateTime (in ISO format)

IMPORTANT TIME INTERPRETATION RULES:
- Today means ${new Date().toISOString().split("T")[0]}
- Tonight means today evening
- Tomorrow means ${new Date(Date.now() + 86400000).toISOString().split("T")[0]}
- This weekend means the upcoming Saturday and Sunday
- Next week means starting on ${new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}

When time is mentioned without a specific date:
- If only time is mentioned (e.g., "at 3pm"), assume it's for today
- If "tonight" is mentioned, set the date to today
- If "tomorrow" is mentioned, set the date to tomorrow
- Always use 24-hour time format in the ISO string

Format your response as a JSON array of events. Only include the JSON array in your response, nothing else.
Example format:
[
  {
    "summary": "Grocery Shopping",
    "description": "Buy fruits, vegetables, and milk",
    "startDateTime": "2025-03-23T18:00:00",
    "endDateTime": "2025-03-23T19:00:00"
  }
]

If no events are found, return an empty array: []
`;

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
- Tomorrow means ${new Date(new Date(currentDate).getTime() + 86400000).toLocaleDateString("en-CA")}
- This weekend means the upcoming Saturday and Sunday
- Next week means starting on ${new Date(new Date(currentDate).getTime() + 7 * 86400000).toLocaleDateString("en-CA")}

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
        // First, try to extract events from the message
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
                error: createError.message,
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
        const chatModel = genai.getGenerativeModel({ model: "gemini-1.5-pro" });
        const chat = chatModel.startChat({
          history: input.history || [],
        });

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
        const result = await calendarFunctions[functionName](args, userId);
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
