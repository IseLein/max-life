// src/lib/gemini/index.ts
import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";

// Import your calendar functions
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "~/server/api/services/googleCalendar";

// Initialize Gemini client
export const initializeGemini = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
  }

  return new GoogleGenerativeAI(apiKey);
};

// Define function declarations for Gemini
export const calendarFunctionDeclarations = [
  {
    name: "getCalendarEvents",
    parameters: {
      type: "OBJECT",
      description: "Get calendar events for a specific date range",
      properties: {
        startDate: {
          type: "STRING",
          description: "Start date in ISO format (YYYY-MM-DD)",
        },
        endDate: {
          type: "STRING",
          description: "End date in ISO format (YYYY-MM-DD)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "createCalendarEvent",
    parameters: {
      type: "OBJECT",
      description: "Create a new calendar event",
      properties: {
        summary: {
          type: "STRING",
          description: "Title or summary of the event",
        },
        description: {
          type: "STRING",
          description: "Description of the event",
        },
        location: {
          type: "STRING",
          description: "Location of the event",
        },
        startDateTime: {
          type: "STRING",
          description: "Start date and time in ISO format",
        },
        endDateTime: {
          type: "STRING",
          description: "End date and time in ISO format",
        },
        timeZone: {
          type: "STRING",
          description: "Time zone for the event (default: user's time zone)",
        },
      },
      required: ["summary", "startDateTime", "endDateTime"],
    },
  },
  {
    name: "updateCalendarEvent",
    parameters: {
      type: "OBJECT",
      description: "Update an existing calendar event",
      properties: {
        eventId: {
          type: "STRING",
          description: "ID of the event to update",
        },
        summary: {
          type: "STRING",
          description: "Updated title or summary of the event",
        },
        description: {
          type: "STRING",
          description: "Updated description of the event",
        },
        location: {
          type: "STRING",
          description: "Updated location of the event",
        },
        startDateTime: {
          type: "STRING",
          description: "Updated start date and time in ISO format",
        },
        endDateTime: {
          type: "STRING",
          description: "Updated end date and time in ISO format",
        },
        timeZone: {
          type: "STRING",
          description: "Updated time zone for the event",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "deleteCalendarEvent",
    parameters: {
      type: "OBJECT",
      description: "Delete a calendar event",
      properties: {
        eventId: {
          type: "STRING",
          description: "ID of the event to delete",
        },
      },
      required: ["eventId"],
    },
  },
];

// Function implementations that will be called
export const calendarFunctions = {
  getCalendarEvents: async ({ startDate, endDate }, userId) => {
    // Convert string dates to Date objects
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    return await getCalendarEvents(userId, startDateObj, endDateObj);
  },

  createCalendarEvent: async (
    { summary, description, location, startDateTime, endDateTime, timeZone },
    userId,
  ) => {
    const eventData = {
      summary,
      description,
      location,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone || "America/Los_Angeles",
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone || "America/Los_Angeles",
      },
    };

    return await createCalendarEvent(userId, eventData);
  },

  updateCalendarEvent: async (
    {
      eventId,
      summary,
      description,
      location,
      startDateTime,
      endDateTime,
      timeZone,
    },
    userId,
  ) => {
    const eventData = {
      summary,
      description,
      location,
    };

    if (startDateTime) {
      eventData.start = {
        dateTime: startDateTime,
        timeZone: timeZone,
      };
    }

    if (endDateTime) {
      eventData.end = {
        dateTime: endDateTime,
        timeZone: timeZone,
      };
    }

    return await updateCalendarEvent(userId, eventId, eventData);
  },

  deleteCalendarEvent: async ({ eventId }, userId) => {
    return await deleteCalendarEvent(userId, eventId);
  },
};

// Create a Gemini chat instance with calendar functions
export const createCalendarAssistant = (userId, customHistory) => {
  const genAI = initializeGemini();

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    tools: {
      functionDeclarations: calendarFunctionDeclarations,
    },
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    },
  });

  // Default history if none is provided
  const defaultHistory = [
    {
      role: "user",
      parts: [{ text: "I need help managing my calendar events." }],
    },
    {
      role: "model",
      parts: [
        {
          text: "I can help you manage your calendar events. You can ask me to view, create, update, or delete events. What would you like to do?",
        },
      ],
    },
  ];

  // Use custom history if provided, otherwise use default
  // Make sure history is not empty to avoid API errors
  const history = customHistory && customHistory.length > 0 ? customHistory : defaultHistory;

  const chat = model.startChat({
    history: history,
  });

  return {
    sendMessage: async (message) => {
      try {
        const result = await chat.sendMessage(message);
        const functionCalls = result.response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];

          try {
            // Call the actual function with the user ID
            const apiResponse = await calendarFunctions[call.name](
              call.args,
              userId,
            );

            // Send the API response back to the model
            const followUpResult = await chat.sendMessage([
              {
                functionResponse: {
                  name: call.name,
                  response: { result: apiResponse },
                },
              },
            ]);

            // Return both the original and follow-up responses
            return {
              initial: result.response.text(),
              functionCall: {
                name: call.name,
                args: call.args,
              },
              apiResponse,
              followUp: followUpResult.response.text(),
            };
          } catch (error) {
            console.error(`Error executing function ${call.name}:`, error);

            // Send error back to model
            const errorResult = await chat.sendMessage([
              {
                functionResponse: {
                  name: call.name,
                  response: { error: error.message },
                },
              },
            ]);

            return {
              initial: result.response.text(),
              functionCall: {
                name: call.name,
                args: call.args,
              },
              error: error.message,
              followUp: errorResult.response.text(),
            };
          }
        }

        // If no function call, just return the text response
        return {
          response: result.response.text(),
        };
      } catch (error) {
        console.error("Error in Gemini chat:", error);
        throw error;
      }
    },
  };
};
