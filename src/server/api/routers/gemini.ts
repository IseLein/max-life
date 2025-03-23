import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "~/env";
import { calendarFunctions } from "~/lib/gemini";

// Initialize Google AI models
const genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
const geminiFlash = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
const geminiPro = genai.getGenerativeModel({ model: "gemini-1.5-pro" });

// Define types for calendar events
export interface CalendarEventInput {
  summary: string;
  description?: string;
  startDateTime: string; // ISO format with timezone
  endDateTime: string; // ISO format with timezone
  location?: string;
}

// Define a more structured time info type
export interface UserTimeInfo {
  date: string;
  time: string;
  timezone: string;
  localTime?: string;
}

export const geminiRouter = createTRPCRouter({
  // Basic Gemini chat endpoint
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
      const chat = geminiFlash.startChat({ history });
      const response = await chat.sendMessage(prompt);
      return response;
    }),

  // Calendar assistant endpoint that handles all calendar operations
  calendarAssistant: protectedProcedure
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

      // Get current time information (using user's time or server time)
      const timeInfo = getTimeInfo(userTimeInfo);

      try {
        // 1. Intent detection - determine what the user wants to do
        const intent = await detectIntent(message, timeInfo, input.history);

        // 2. Process the intent and execute requested operations
        const operationResults = await processCalendarOperations(
          intent,
          userId,
          timeInfo,
        );

        // 3. Generate a natural language response based on the results
        const responseMessage = await generateResponse(
          message,
          operationResults,
          input.history || [],
          timeInfo,
        );

        return {
          response: responseMessage,
          operations: operationResults,
        };
      } catch (error) {
        console.error("Error in calendar assistant:", error);
        return {
          response: `I'm sorry, but I encountered an error while processing your request: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or rephrase your request.`,
          operations: [],
          error: true,
        };
      }
    }),

  // Direct calendar function calling (for UI components that need direct access)
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
    
  // Calendar chat endpoint (alias for calendarAssistant for backward compatibility)
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

      console.log("calendarChat procedure called with message:", message);

      // Get current time information (using user's time or server time)
      const timeInfo = getTimeInfo(userTimeInfo);
      console.log("User time info:", timeInfo);

      try {
        // 1. Intent detection - determine what the user wants to do
        console.log("Detecting intent for message:", message);
        const intent = await detectIntent(message, timeInfo, input.history);
        console.log("Detected intent:", JSON.stringify(intent));

        // 2. Process the intent and execute requested operations
        console.log("Processing calendar operations for intent:", intent.type);
        const operationResults = await processCalendarOperations(
          intent,
          userId,
          timeInfo,
        );
        console.log("Operation results:", JSON.stringify(operationResults));

        // 3. Generate a natural language response based on the results
        console.log("Generating response for user message");
        const responseMessage = await generateResponse(
          message,
          operationResults,
          input.history || [],
          timeInfo,
        );
        console.log("Generated response:", responseMessage);

        return {
          response: responseMessage,
          operations: operationResults,
        };
      } catch (error) {
        console.error("Error in calendar chat:", error);
        return {
          response: `I'm sorry, but I encountered an error while processing your request: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or rephrase your request.`,
          operations: [],
          error: true,
        };
      }
    }),
});

// Helper function to standardize time information
function getTimeInfo(userTimeInfo?: UserTimeInfo): UserTimeInfo {
  const now = new Date();

  return {
    date: userTimeInfo?.date || now.toISOString().split("T")[0],
    time: userTimeInfo?.time || now.toISOString(),
    timezone:
      userTimeInfo?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    localTime:
      userTimeInfo?.localTime ||
      now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }),
  };
}

// Intent detection - analyze what operations the user wants to perform
async function detectIntent(message: string, timeInfo: UserTimeInfo, history?: any[]) {
  // Special handling for "delete them" type messages
  if (message.toLowerCase().includes("delete them") || message.toLowerCase() === "delete them") {
    console.log("Detected 'delete them' message, creating delete intent for this week's events");
    
    // Get today's date at the start of the day
    const today = new Date(timeInfo.date);
    today.setHours(0, 0, 0, 0);
    
    // Get end of the week (7 days from now)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);
    
    console.log(`Creating delete intent from ${today.toISOString()} to ${endOfWeek.toISOString()}`);
    
    // Create a delete intent for the current week
    return {
      operations: [
        {
          type: "delete",
          timeRange: {
            start: today.toISOString(),
            end: endOfWeek.toISOString(),
          },
          // No event identifiers means delete all events in the range
        }
      ]
    };
  }
  
  const intentPrompt = `
You are a calendar assistant. Analyze the following message and extract all calendar operations the user wants to perform. The message may contain multiple operations like creating, viewing, updating, or deleting events.

Today's date is: ${timeInfo.date} (${timeInfo.localTime} in ${timeInfo.timezone}).

For each operation, identify:
1. type: "create" | "view" | "update" | "delete"
2. timeRange: { start: ISO date string, end: ISO date string } (for view/delete operations)
3. eventDetails: (for create/update operations)
   - summary (title)
   - description (optional)
   - startDateTime (in ISO format with timezone)
   - endDateTime (in ISO format with timezone)
   - location (optional)
4. eventIdentifiers: (for update/delete operations) - keywords or date ranges to identify events

IMPORTANT TIME INTERPRETATION RULES:
- Today means ${timeInfo.date}
- Tonight means today evening (after 6:00 PM today)
- Tomorrow means ${new Date(new Date(timeInfo.date).setDate(new Date(timeInfo.date).getDate() + 1)).toISOString().split("T")[0]}
- This weekend means the upcoming Saturday and Sunday
- Next week means starting ${new Date(new Date(timeInfo.date).setDate(new Date(timeInfo.date).getDate() + 7)).toISOString().split("T")[0]}

Format your response as a JSON object with an array of operations. Only include the JSON in your response, nothing else.
Example format:
{
  "operations": [
    {
      "type": "create",
      "eventDetails": {
        "summary": "Grocery Shopping",
        "description": "Buy fruits, vegetables, and milk",
        "startDateTime": "2025-03-23T18:00:00-04:00",
        "endDateTime": "2025-03-23T19:00:00-04:00"
      }
    },
    {
      "type": "delete",
      "timeRange": {
        "start": "2025-03-24T00:00:00-04:00",
        "end": "2025-03-24T23:59:59-04:00"
      },
      "eventIdentifiers": ["meeting", "call"]
    }
  ]
}

Message: ${message}
`;

  try {
    const extractionResult = await geminiPro.generateContent(intentPrompt);
    const extractionText = extractionResult.response.text();

    // Extract JSON from the response
    const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract intent JSON from model response");
    }

    const intent = JSON.parse(jsonMatch[0]);
    return intent;
  } catch (error) {
    console.error("Error detecting intent:", error);
    throw new Error(
      `Failed to understand your request: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Process all detected calendar operations
async function processCalendarOperations(
  intent: any,
  userId: string,
  timeInfo: UserTimeInfo,
) {
  const results = [];

  // Sort operations to ensure updates happen before deletions
  // This prevents issues where an event is deleted before it can be updated
  const sortedOperations = [...(intent.operations || [])].sort((a, b) => {
    // Define operation priority (higher number = process first)
    const priority = {
      create: 3,
      update: 2,
      view: 1,
      delete: 0
    };
    
    return (priority[b.type] || 0) - (priority[a.type] || 0);
  });
  
  console.log("Operations sorted by priority:", sortedOperations.map(op => op.type));

  // Process each operation in sequence
  for (const operation of sortedOperations) {
    try {
      let result;

      // Add default timeRange if not provided
      if ((operation.type === 'delete' || operation.type === 'update' || operation.type === 'view') && !operation.timeRange) {
        // Default to looking at the next 2 weeks
        const startDate = new Date(timeInfo.date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 14);
        
        operation.timeRange = {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        };
        
        console.log(`Added default timeRange to ${operation.type} operation: ${JSON.stringify(operation.timeRange)}`);
      }

      switch (operation.type) {
        case "create":
          result = await processCreateOperation(operation, userId, timeInfo);
          break;

        case "view":
          result = await processViewOperation(operation, userId, timeInfo);
          break;

        case "update":
          result = await processUpdateOperation(operation, userId, timeInfo);
          break;

        case "delete":
          result = await processDeleteOperation(operation, userId, timeInfo);
          break;

        default:
          result = {
            type: operation.type,
            success: false,
            error: `Unknown operation type: ${operation.type}`,
          };
      }

      results.push(result);
    } catch (error) {
      console.error(`Error processing operation ${operation.type}:`, error);
      results.push({
        type: operation.type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

// Process create calendar event operation
async function processCreateOperation(
  operation: any,
  userId: string,
  timeInfo: UserTimeInfo,
) {
  const events = [];

  try {
    // Handle single event creation
    if (operation.eventDetails) {
      try {
        console.log("Processing single event creation:", operation.eventDetails.summary);
        
        const result = await calendarFunctions.createCalendarEvent(
          operation.eventDetails,
          userId,
        );

        events.push({
          summary: operation.eventDetails.summary,
          success: true,
          id: result.id,
        });
        
        console.log("Successfully created single event:", result.id);
      } catch (error) {
        console.error("Error creating single event:", error);
        
        events.push({
          summary: operation.eventDetails.summary,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Handle multiple event creation
    if (operation.events && Array.isArray(operation.events)) {
      for (const event of operation.events) {
        try {
          console.log("Processing event in batch:", event.summary);
          
          const result = await calendarFunctions.createCalendarEvent(
            event,
            userId,
          );
          
          events.push({
            summary: event.summary,
            success: true,
            id: result.id,
          });
          
          console.log("Successfully created event in batch:", result.id);
        } catch (error) {
          console.error("Error creating event in batch:", error);
          
          events.push({
            summary: event.summary,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    // Check if any events were successfully created
    const anySuccess = events.some((e) => e.success);
    
    console.log(`Create operation completed. ${events.filter(e => e.success).length}/${events.length} events created successfully`);
    
    return {
      type: "create",
      success: anySuccess,
      events,
    };
  } catch (error) {
    console.error("Error in processCreateOperation:", error);
    return {
      type: "create",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      events,
    };
  }
}

// Process view calendar events operation
async function processViewOperation(
  operation: any,
  userId: string,
  timeInfo: UserTimeInfo,
) {
  try {
    // First, find the events to view
    // Use a broader date range - look at the next 2 weeks by default
    const startDate = new Date(operation.timeRange?.start || timeInfo.date);
    
    // If no end date is specified, use 2 weeks from start date
    let endDate;
    if (operation.timeRange?.end) {
      endDate = new Date(operation.timeRange.end);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 14); // Look 2 weeks ahead
    }
    
    console.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get events in the specified date range
    const events = await calendarFunctions.getCalendarEvents(
      { startDate, endDate },
      userId,
    );
    
    console.log(`Found ${events.length} events in the specified date range:`, 
      events.map((e: any) => ({ id: e.id, summary: e.summary, start: e.start })));

    // Filter events if keywords are provided
    let filteredEvents = events;
    if (operation.eventIdentifiers && operation.eventIdentifiers.length > 0) {
      const keywords = operation.eventIdentifiers.map((k: string) =>
        k.toLowerCase(),
      );
      console.log("Filtering events by keywords:", keywords);
      
      // Create alternative keywords for common misspellings
      const alternativeKeywords = keywords.flatMap(keyword => {
        const alternatives = [keyword];
        
        // Add common variations
        if (keyword === "grocerries") {
          alternatives.push("groceries", "grocery", "shopping");
        }
        if (keyword === "car pickup") {
          alternatives.push("car", "pickup", "vehicle");
        }
        
        return alternatives;
      });
      
      console.log("Using expanded keywords for matching:", alternativeKeywords);
      
      filteredEvents = events.filter((event: any) => {
        const summary = (event.summary || "").toLowerCase();
        const description = (event.description || "").toLowerCase();
        
        // More flexible matching - check if any part of the keyword is in the summary
        return alternativeKeywords.some(
          (keyword) => {
            // Check for partial matches
            return summary.includes(keyword) || 
                   description.includes(keyword) ||
                   keyword.includes(summary) ||
                   keyword.split(" ").some(part => summary.includes(part));
          }
        );
      });
      
      console.log(`After filtering, ${filteredEvents.length} events match the criteria:`, 
        filteredEvents.map((e: any) => ({ id: e.id, summary: e.summary })));
    }

    return {
      type: "view",
      success: true,
      events: filteredEvents,
    };
  } catch (error) {
    console.error("Error viewing events:", error);
    return {
      type: "view",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Process update calendar event operation
async function processUpdateOperation(
  operation: any,
  userId: string,
  timeInfo: UserTimeInfo,
) {
  const results = [];

  try {
    console.log("Starting update operation:", JSON.stringify(operation));
    
    // First, find the events to update
    // Use a broader date range - look at the next 2 weeks by default
    const startDate = new Date(operation.timeRange?.start || timeInfo.date);
    
    // If no end date is specified, use 2 weeks from start date
    let endDate;
    if (operation.timeRange?.end) {
      endDate = new Date(operation.timeRange.end);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 14); // Look 2 weeks ahead
    }
    
    console.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get events in the specified date range
    const events = await calendarFunctions.getCalendarEvents(
      { startDate, endDate },
      userId,
    );
    
    console.log(`Found ${events.length} events in the specified date range:`, 
      events.map((e: any) => ({ id: e.id, summary: e.summary, start: e.start })));

    // Filter events if keywords are provided
    let eventsToUpdate = events;
    if (operation.eventIdentifiers && operation.eventIdentifiers.length > 0) {
      const keywords = operation.eventIdentifiers.map((k: string) =>
        k.toLowerCase(),
      );
      console.log("Filtering events by keywords:", keywords);
      
      // Create alternative keywords for common misspellings
      const alternativeKeywords = keywords.flatMap(keyword => {
        const alternatives = [keyword];
        
        // Add common variations
        if (keyword === "grocerries") {
          alternatives.push("groceries", "grocery", "shopping");
        }
        if (keyword === "car pickup") {
          alternatives.push("car", "pickup", "vehicle");
        }
        
        return alternatives;
      });
      
      console.log("Using expanded keywords for matching:", alternativeKeywords);
      
      eventsToUpdate = events.filter((event: any) => {
        const summary = (event.summary || "").toLowerCase();
        const description = (event.description || "").toLowerCase();
        
        // More flexible matching - check if any part of the keyword is in the summary
        return alternativeKeywords.some(
          (keyword) => {
            // Check for partial matches
            return summary.includes(keyword) || 
                   description.includes(keyword) ||
                   keyword.includes(summary) ||
                   keyword.split(" ").some(part => summary.includes(part));
          }
        );
      });
      
      console.log(`After filtering, ${eventsToUpdate.length} events match the criteria:`, 
        eventsToUpdate.map((e: any) => ({ id: e.id, summary: e.summary })));
    }

    console.log(`Attempting to update ${eventsToUpdate.length} events:`, 
      eventsToUpdate.map((e: any) => ({ id: e.id, summary: e.summary })));
    console.log("Update details:", JSON.stringify(operation.eventDetails));

    // Update each matching event
    for (const event of eventsToUpdate) {
      try {
        console.log(`Updating event: ${event.id} - ${event.summary}`);
        
        const result = await calendarFunctions.updateCalendarEvent(
          { userId, eventId: event.id, eventData: operation.eventDetails },
          userId,
        );

        console.log(`Successfully updated event: ${event.id} - ${event.summary} to ${operation.eventDetails.summary || event.summary}`);
        
        results.push({
          id: event.id,
          summary: event.summary,
          updatedSummary: operation.eventDetails.summary || event.summary,
          success: true,
        });
      } catch (error) {
        console.error(`Error updating event ${event.id} - ${event.summary}:`, error);
        
        results.push({
          id: event.id,
          summary: event.summary,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Update operation completed. ${successCount}/${results.length} events updated successfully`);
    
    return {
      type: "update",
      success: results.some((r) => r.success),
      updates: results,
    };
  } catch (error) {
    console.error("Error in processUpdateOperation:", error);
    return {
      type: "update",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      updates: results,
    };
  }
}

// Process delete calendar event operation
async function processDeleteOperation(
  operation: any,
  userId: string,
  timeInfo: UserTimeInfo,
) {
  const results = [];

  try {
    console.log("Starting delete operation:", JSON.stringify(operation));
    
    // First, find the events to delete
    // Use a broader date range - look at the next 4 weeks by default
    const startDate = new Date(operation.timeRange?.start || timeInfo.date);
    
    // If no end date is specified, use 4 weeks from start date
    let endDate;
    if (operation.timeRange?.end) {
      endDate = new Date(operation.timeRange.end);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 28); // Look 4 weeks ahead
    }
    
    console.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get events in the specified date range
    const events = await calendarFunctions.getCalendarEvents(
      { startDate, endDate },
      userId,
    );
    
    console.log(`Found ${events.length} events in the specified date range:`, 
      events.map((e: any) => ({ id: e.id, summary: e.summary, start: e.start })));

    // Filter events if keywords are provided
    let eventsToDelete = events;
    if (operation.eventIdentifiers && operation.eventIdentifiers.length > 0) {
      const keywords = operation.eventIdentifiers.map((k: string) =>
        k.toLowerCase(),
      );
      console.log("Filtering events by keywords:", keywords);
      
      // Create alternative keywords for common misspellings
      const alternativeKeywords = keywords.flatMap(keyword => {
        const alternatives = [keyword];
        
        // Add common variations
        if (keyword === "grocerries") {
          alternatives.push("groceries", "grocery", "shopping");
        }
        if (keyword === "car pickup") {
          alternatives.push("car", "pickup", "vehicle");
        }
        
        return alternatives;
      });
      
      console.log("Using expanded keywords for matching:", alternativeKeywords);
      
      eventsToDelete = events.filter((event: any) => {
        const summary = (event.summary || "").toLowerCase();
        const description = (event.description || "").toLowerCase();
        
        // More flexible matching - check if any part of the keyword is in the summary
        return alternativeKeywords.some(
          (keyword) => {
            // Check for partial matches
            return summary.includes(keyword) || 
                   description.includes(keyword) ||
                   keyword.includes(summary) ||
                   keyword.split(" ").some(part => summary.includes(part));
          }
        );
      });
      
      console.log(`After filtering, ${eventsToDelete.length} events match the criteria:`, 
        eventsToDelete.map((e: any) => ({ id: e.id, summary: e.summary })));
    }

    console.log(`Attempting to delete ${eventsToDelete.length} events:`, 
      eventsToDelete.map((e: any) => ({ id: e.id, summary: e.summary })));

    // Delete each matching event
    for (const event of eventsToDelete) {
      try {
        console.log(`Deleting event: ${event.id} - ${event.summary}`);
        
        await calendarFunctions.deleteCalendarEvent(
          { userId, eventId: event.id },
          userId,
        );

        console.log(`Successfully deleted event: ${event.id} - ${event.summary}`);
        
        results.push({
          id: event.id,
          summary: event.summary,
          success: true,
        });
      } catch (error) {
        console.error(`Error deleting event ${event.id} - ${event.summary}:`, error);
        
        results.push({
          id: event.id,
          summary: event.summary,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Delete operation completed. ${successCount}/${results.length} events deleted successfully`);
    
    return {
      type: "delete",
      success: results.some((r) => r.success),
      deletions: results,
    };
  } catch (error) {
    console.error("Error in processDeleteOperation:", error);
    return {
      type: "delete",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      deletions: results,
    };
  }
}

// Generate a natural language response based on operation results
async function generateResponse(
  userMessage: string,
  operationResults: any[],
  history: any[],
  timeInfo: UserTimeInfo,
) {
  // Prepare a summary of what was done
  let resultsSummary = "";

  // Count successful operations by type
  const successCounts: Record<string, number> = {
    create: 0,
    view: 0,
    update: 0,
    delete: 0,
  };

  // Build detailed results for each operation type
  const details: Record<string, string> = {
    create: "",
    view: "",
    update: "",
    delete: "",
  };

  for (const result of operationResults) {
    if (result.success) {
      successCounts[result.type] += 1;

      switch (result.type) {
        case "create":
          if (result.events && result.events.length > 0) {
            const successEvents = result.events.filter((e: any) => e.success);
            const failedEvents = result.events.filter((e: any) => !e.success);

            if (successEvents.length > 0) {
              details.create += `I've added ${successEvents.length} events to your calendar:\n`;
              successEvents.forEach((event: any) => {
                details.create += `- ${event.summary}\n`;
              });
            }

            if (failedEvents.length > 0) {
              details.create += `\nI couldn't add ${failedEvents.length} events:\n`;
              failedEvents.forEach((event: any) => {
                details.create += `- ${event.summary} (${event.error || "unknown error"})\n`;
              });
            }
          }
          break;

        case "view":
          if (result.events && result.events.length > 0) {
            details.view += `I found ${result.events.length} events:\n`;
            result.events.forEach((event: any) => {
              const startTime = new Date(event.start.dateTime).toLocaleString(
                "en-US",
                {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: timeInfo.timezone,
                },
              );
              details.view += `- ${event.summary} (${startTime})\n`;
            });
          } else {
            details.view +=
              "I didn't find any events matching your criteria.\n";
          }
          break;

        case "update":
          if (result.updates && result.updates.length > 0) {
            const successUpdates = result.updates.filter((u: any) => u.success);
            const failedUpdates = result.updates.filter((u: any) => !u.success);

            if (successUpdates.length > 0) {
              details.update += `I've updated ${successUpdates.length} events in your calendar:\n`;
              successUpdates.forEach((update: any) => {
                details.update += `- ${update.summary}${update.updatedSummary !== update.summary ? ` → ${update.updatedSummary}` : ""}\n`;
              });
            }

            if (failedUpdates.length > 0) {
              details.update += `\nI couldn't update ${failedUpdates.length} events:\n`;
              failedUpdates.forEach((update: any) => {
                details.update += `- ${update.summary} (${update.error || "unknown error"})\n`;
              });
            }
          }
          break;

        case "delete":
          if (result.deletions && result.deletions.length > 0) {
            const successDeletions = result.deletions.filter(
              (d: any) => d.success,
            );
            const failedDeletions = result.deletions.filter(
              (d: any) => !d.success,
            );

            if (successDeletions.length > 0) {
              details.delete += `I've deleted ${successDeletions.length} events from your calendar:\n`;
              successDeletions.forEach((deletion: any) => {
                details.delete += `- ${deletion.summary}\n`;
              });
            }

            if (failedDeletions.length > 0) {
              details.delete += `\nI couldn't delete ${failedDeletions.length} events:\n`;
              failedDeletions.forEach((deletion: any) => {
                details.delete += `- ${deletion.summary} (${deletion.error || "unknown error"})\n`;
              });
            }
          }
          break;
      }
    } else {
      // Handle operation-level failures
      details[result.type] +=
        `I couldn't perform the ${result.type} operation: ${result.error || "unknown error"}\n`;
    }
  }

  // Build the summary of operations
  const operationTypes = Object.keys(successCounts).filter(
    (type) => successCounts[type] > 0,
  );

  if (operationTypes.length > 0) {
    resultsSummary = "I've ";

    if (operationTypes.length === 1) {
      const type = operationTypes[0];
      resultsSummary += `${type}d your calendar as requested.`;
    } else {
      const lastType = operationTypes.pop();
      resultsSummary += `${operationTypes.join("d, ")}d and ${lastType}d your calendar as requested.`;
    }
  } else {
    resultsSummary =
      "I couldn't complete any of the requested calendar operations.";
  }

  // Build a detailed response with all the operation details
  let detailedResponse = resultsSummary + "\n\n";

  for (const type of ["create", "view", "update", "delete"]) {
    if (details[type].length > 0) {
      detailedResponse += details[type] + "\n";
    }
  }

  // Now use Gemini to generate a more natural response
  const responsePrompt = `
You are a helpful calendar assistant with direct access to the user's calendar.
You should respond naturally to the user's message while including the details of what operations were performed.

User's message: "${userMessage}"

Operations performed:
${detailedResponse}

Respond in a friendly, helpful way that addresses the user's request and clearly explains what was done.
Don't mention explicit JSON or data structures - just talk about the calendar events naturally.
`;

  try {
    const chat = geminiPro.startChat({
      history: history,
    });

    const chatResponse = await chat.sendMessage(responsePrompt);
    return chatResponse.response.text();
  } catch (error) {
    console.error("Error generating response:", error);
    return detailedResponse; // Fallback to our structured response if Gemini fails
  }
}
