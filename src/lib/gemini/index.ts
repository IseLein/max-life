// src/lib/gemini/index.ts
// import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";

// Import your calendar functions
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "~/server/api/services/googleCalendar";

// // Initialize Gemini client
// export const initializeGemini = () => {
//   const apiKey = process.env.GOOGLE_AI_API_KEY;

//   if (!apiKey) {
//     throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
//   }

//   return new GoogleGenerativeAI(apiKey);
// };

// // Define function declarations for Gemini
// export const calendarFunctionDeclarations = [
//   {
//     name: "getCalendarEvents",
//     parameters: {
//       type: "OBJECT",
//       description: "Get calendar events for a specific date range",
//       properties: {
//         startDate: {
//           type: "STRING",
//           description: "Start date in ISO format (YYYY-MM-DD)",
//         },
//         endDate: {
//           type: "STRING",
//           description: "End date in ISO format (YYYY-MM-DD)",
//         },
//       },
//       required: ["startDate", "endDate"],
//     },
//   },
//   {
//     name: "createCalendarEvent",
//     parameters: {
//       type: "OBJECT",
//       description: "Create a new calendar event",
//       properties: {
//         summary: {
//           type: "STRING",
//           description: "Title or summary of the event",
//         },
//         description: {
//           type: "STRING",
//           description: "Description of the event",
//         },
//         location: {
//           type: "STRING",
//           description: "Location of the event",
//         },
//         startDateTime: {
//           type: "STRING",
//           description: "Start date and time in ISO format",
//         },
//         endDateTime: {
//           type: "STRING",
//           description: "End date and time in ISO format",
//         },
//         timeZone: {
//           type: "STRING",
//           description: "Time zone for the event (default: user's time zone)",
//         },
//       },
//       required: ["summary", "startDateTime", "endDateTime"],
//     },
//   },
//   {
//     name: "updateCalendarEvent",
//     parameters: {
//       type: "OBJECT",
//       description: "Update an existing calendar event",
//       properties: {
//         eventId: {
//           type: "STRING",
//           description: "ID of the event to update",
//         },
//         summary: {
//           type: "STRING",
//           description: "Updated title or summary of the event",
//         },
//         description: {
//           type: "STRING",
//           description: "Updated description of the event",
//         },
//         location: {
//           type: "STRING",
//           description: "Updated location of the event",
//         },
//         startDateTime: {
//           type: "STRING",
//           description: "Updated start date and time in ISO format",
//         },
//         endDateTime: {
//           type: "STRING",
//           description: "Updated end date and time in ISO format",
//         },
//         timeZone: {
//           type: "STRING",
//           description: "Updated time zone for the event",
//         },
//       },
//       required: ["eventId"],
//     },
//   },
//   {
//     name: "deleteCalendarEvent",
//     parameters: {
//       type: "OBJECT",
//       description: "Delete a calendar event",
//       properties: {
//         eventId: {
//           type: "STRING",
//           description: "ID of the event to delete",
//         },
//       },
//       required: ["eventId"],
//     },
//   },
// ];

// // Function implementations that will be called
// export const calendarFunctions = {
//   getCalendarEvents: async ({ startDate, endDate }, userId) => {
//     // Convert string dates to Date objects
//     const startDateObj = new Date(startDate);
//     const endDateObj = new Date(endDate);

//     return await getCalendarEvents(userId, startDateObj, endDateObj);
//   },

//   createCalendarEvent: async (
//     { summary, description, location, startDateTime, endDateTime, timeZone },
//     userId,
//   ) => {
//     const eventData = {
//       summary,
//       description,
//       location,
//       start: {
//         dateTime: startDateTime,
//         timeZone: timeZone || "America/Los_Angeles",
//       },
//       end: {
//         dateTime: endDateTime,
//         timeZone: timeZone || "America/Los_Angeles",
//       },
//     };

//     return await createCalendarEvent(userId, eventData);
//   },

//   updateCalendarEvent: async (
//     {
//       eventId,
//       summary,
//       description,
//       location,
//       startDateTime,
//       endDateTime,
//       timeZone,
//     },
//     userId,
//   ) => {
//     const eventData = {
//       summary,
//       description,
//       location,
//     };

//     if (startDateTime) {
//       eventData.start = {
//         dateTime: startDateTime,
//         timeZone: timeZone,
//       };
//     }

//     if (endDateTime) {
//       eventData.end = {
//         dateTime: endDateTime,
//         timeZone: timeZone,
//       };
//     }

//     return await updateCalendarEvent(userId, eventId, eventData);
//   },

//   deleteCalendarEvent: async ({ eventId }, userId) => {
//     console.log(`deleteCalendarEvent called with eventId: ${eventId} for userId: ${userId}`);
//     // Get account with valid token
//     console.log("Getting valid Google account");
//     const userAccount = await getValidGoogleAccount(userId);
//     console.log("Got valid Google account with access token");
//     console.log(`Deleting calendar event: ${eventId}`);
//     // Make request to Google Calendar API
//     console.log("Making DELETE request to Google Calendar API");
//     const response = await fetchWithTokenRefresh(
//       `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
//       {
//         method: "DELETE",
//         headers: {
//           Authorization: `Bearer ${userAccount.access_token}`,
//         },
//       },
//       userAccount,
//       userId
//     );
//     console.log(`Delete request response status: ${response.status}`);
//     // Check if the response was successful
//     if (response.status === 204) {
//       console.log("Successfully deleted calendar event");
//       return true;
//     } else {
//       // For DELETE, a 404 might be acceptable (event already deleted)
//       if (response.status === 404) {
//         console.log("Event not found (may have been already deleted)");
//         return true;
//       }
//       let errorData;
//       try {
//         // Try to parse the response as JSON, but it might not be JSON
//         errorData = await response.json();
//         console.log("Error response data:", JSON.stringify(errorData));
//       } catch (e) {
//         // If parsing fails, create a simple error object with status info
//         console.log("Could not parse error response as JSON:", e);
//         errorData = {
//           status: response.status,
//           statusText: response.statusText,
//         };
//       }
//       console.error("Failed to delete calendar event:", errorData);
//       throw new Error(`Failed to delete calendar event: ${JSON.stringify(errorData)}`);
//     }
//   },
// };

// // Create a Gemini chat instance with calendar functions
// export const createCalendarAssistant = (userId, customHistory) => {
//   const genAI = initializeGemini();

//   const model = genAI.getGenerativeModel({
//     model: "gemini-1.5-pro-latest",
//     tools: {
//       functionDeclarations: calendarFunctionDeclarations,
//     },
//     toolConfig: {
//       functionCallingConfig: {
//         mode: FunctionCallingMode.AUTO,
//       },
//     },
//   });

//   // Default history if none is provided
//   const defaultHistory = [
//     {
//       role: "user",
//       parts: [{ text: "I need help managing my calendar events." }],
//     },
//     {
//       role: "model",
//       parts: [
//         {
//           text: "I can help you manage your calendar events. You can ask me to view, create, update, or delete events. What would you like to do?",
//         },
//       ],
//     },
//   ];

//   // Use custom history if provided, otherwise use default
//   // Make sure history is not empty to avoid API errors
//   const history = customHistory && customHistory.length > 0 ? customHistory : defaultHistory;

//   const chat = model.startChat({
//     history: history,
//   });

//   return {
//     sendMessage: async (message) => {
//       try {
//         const result = await chat.sendMessage(message);
//         const functionCalls = result.response.functionCalls();

//         if (functionCalls && functionCalls.length > 0) {
//           const call = functionCalls[0];

//           try {
//             // Call the actual function with the user ID
//             const apiResponse = await calendarFunctions[call.name](
//               call.args,
//               userId,
//             );

//             // Send the API response back to the model
//             const followUpResult = await chat.sendMessage([
//               {
//                 functionResponse: {
//                   name: call.name,
//                   response: { result: apiResponse },
//                 },
//               },
//             ]);

//             // Return both the original and follow-up responses
//             return {
//               initial: result.response.text(),
//               functionCall: {
//                 name: call.name,
//                 args: call.args,
//               },
//               apiResponse,
//               followUp: followUpResult.response.text(),
//             };
//           } catch (error) {
//             console.error(`Error executing function ${call.name}:`, error);

//             // Send error back to model
//             const errorResult = await chat.sendMessage([
//               {
//                 functionResponse: {
//                   name: call.name,
//                   response: { error: error.message },
//                 },
//               },
//             ]);

//             return {
//               initial: result.response.text(),
//               functionCall: {
//                 name: call.name,
//                 args: call.args,
//               },
//               error: error.message,
//               followUp: errorResult.response.text(),
//             };
//           }
//         }

//         // If no function call, just return the text response
//         return {
//           response: result.response.text(),
//         };
//       } catch (error) {
//         console.error("Error in Gemini chat:", error);
//         throw error;
//       }
//     },
//   };
// };
// This file would be placed at ~/lib/gemini.ts

import { accounts } from "~/server/db/schema";
import { db } from "~/server/db";
import { eq, and } from "drizzle-orm";

// Define a type for the account object we'll be working with
type AccountType = {
  userId: string;
  provider: string;
  providerAccountId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at?: number | null;
};

// Define calendar event interfaces
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: string;
}

interface GetEventsParams {
  startDate: Date;
  endDate: Date;
}

interface CreateEventParams {
  summary: string;
  description?: string;
  startDateTime: string; // ISO format with timezone
  endDateTime: string; // ISO format with timezone
  location?: string;
}

interface UpdateEventParams {
  userId: string;
  eventId: string; 
  eventData: {
    summary?: string;
    description?: string;
    location?: string;
    start?: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    end?: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
  };
}

interface DeleteEventParams {
  userId: string;
  eventId: string;
}

/**
 * A collection of functions for interacting with Google Calendar
 */
export const calendarFunctions = {
  /**
   * Get calendar events between specified dates
   */
  getCalendarEvents: async (params: GetEventsParams, userId: string): Promise<CalendarEvent[]> => {
    try {
      const { startDate, endDate } = params;
      
      // Get account with valid token
      const userAccount = await getValidGoogleAccount(userId);
      
      // Format dates for Google Calendar API
      const timeMin = startDate.toISOString();
      const timeMax = endDate.toISOString();
      
      console.log(`Fetching calendar events from ${timeMin} to ${timeMax}`);
      
      // Make request to Google Calendar API
      const response = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${userAccount.access_token}`,
          },
        },
        userAccount,
        userId
      );
      
      const data = await response.json();
      console.log(`Successfully fetched ${data.items?.length || 0} calendar events`);
      
      return data.items as CalendarEvent[];
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      throw error;
    }
  },
  
  /**
   * Create a new calendar event
   */
  createCalendarEvent: async (eventParams: CreateEventParams, userId: string): Promise<any> => {
    try {
      // Get account with valid token
      const userAccount = await getValidGoogleAccount(userId);
      
      // Ensure the date strings are properly formatted
      const startDateTime = new Date(eventParams.startDateTime);
      const endDateTime = new Date(eventParams.endDateTime);
      
      // Get the timezone from the user's settings or use the local timezone
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Format event data for Google Calendar API
      const eventData = {
        summary: eventParams.summary,
        description: eventParams.description || "",
        location: eventParams.location || "",
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: timeZone,
        },
      };
      
      console.log("Creating calendar event:", eventData.summary);
      console.log("Event data:", JSON.stringify(eventData));
      
      // Make request to Google Calendar API
      const response = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userAccount.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventData),
        },
        userAccount,
        userId
      );
      
      // Check if the response was successful
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error("Error response from Calendar API:", JSON.stringify(errorData));
        } catch (e) {
          errorData = {
            status: response.status,
            statusText: response.statusText,
          };
          console.error("Error response (not JSON):", errorData);
        }
        
        throw new Error(`Failed to create calendar event: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log("Successfully created calendar event:", data.id);
      
      return data;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  },
  
  /**
   * Update an existing calendar event
   */
  updateCalendarEvent: async (params: UpdateEventParams, userId: string): Promise<any> => {
    try {
      const { eventId, eventData } = params;
      
      // Get account with valid token
      const userAccount = await getValidGoogleAccount(userId);
      
      console.log(`Updating calendar event ${eventId}:`, eventData.summary);
      
      // First, get the current event to merge with updates
      const getResponse = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${userAccount.access_token}`,
          },
        },
        userAccount,
        userId
      );
      
      // Check if the get request was successful
      if (!getResponse.ok) {
        let errorData;
        try {
          errorData = await getResponse.json();
          console.error("Error response from Calendar API (get event):", JSON.stringify(errorData));
        } catch (e) {
          errorData = {
            status: getResponse.status,
            statusText: getResponse.statusText,
          };
          console.error("Error response (not JSON):", errorData);
        }
        
        throw new Error(`Failed to get calendar event: ${JSON.stringify(errorData)}`);
      }
      
      const currentEvent = await getResponse.json();
      console.log("Current event data:", JSON.stringify(currentEvent));
      
      // Prepare the updated event data
      // Handle dateTime format conversion if needed
      const updatedEventData = {
        ...currentEvent,
        ...eventData,
        // Properly format start and end if provided
        start: eventData.start ? {
          ...currentEvent.start,
          ...eventData.start,
        } : currentEvent.start,
        end: eventData.end ? {
          ...currentEvent.end,
          ...eventData.end,
        } : currentEvent.end,
      };
      
      console.log("Updated event data to send:", JSON.stringify(updatedEventData));
      
      // Make request to Google Calendar API
      const response = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${userAccount.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedEventData),
        },
        userAccount,
        userId
      );
      
      // Check if the update request was successful
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error("Error response from Calendar API (update event):", JSON.stringify(errorData));
        } catch (e) {
          errorData = {
            status: response.status,
            statusText: response.statusText,
          };
          console.error("Error response (not JSON):", errorData);
        }
        
        throw new Error(`Failed to update calendar event: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log("Successfully updated calendar event:", data.id);
      
      return data;
    } catch (error) {
      console.error("Error updating calendar event:", error);
      throw error;
    }
  },
  
  /**
   * Delete a calendar event
   */
  deleteCalendarEvent: async (params: DeleteEventParams, userId: string): Promise<boolean> => {
    try {
      const { eventId } = params;
      console.log(`deleteCalendarEvent called with eventId: ${eventId} for userId: ${userId}`);
      
      // Get account with valid token
      console.log("Getting valid Google account");
      const userAccount = await getValidGoogleAccount(userId);
      console.log("Got valid Google account with access token");
      
      console.log(`Deleting calendar event: ${eventId}`);
      
      // Make request to Google Calendar API
      console.log("Making DELETE request to Google Calendar API");
      const response = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userAccount.access_token}`,
          },
        },
        userAccount,
        userId
      );
      
      console.log(`Delete response status: ${response.status}`);
      
      if (!response.ok) {
        let errorData;
        try {
          // For DELETE operations, there might not be a response body
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
            console.error("Error response from Calendar API (delete event):", JSON.stringify(errorData));
          } else {
            errorData = {
              status: response.status,
              statusText: response.statusText,
            };
          }
        } catch (e) {
          errorData = {
            status: response.status,
            statusText: response.statusText,
          };
          console.error("Error response (not JSON):", errorData);
        }
        
        throw new Error(`Failed to delete calendar event: ${JSON.stringify(errorData)}`);
      }
      
      console.log(`Successfully deleted calendar event: ${eventId}`);
      return true;
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      throw error;
    }
  },
};

/**
 * Get a valid Google account with access token
 * If the token is expired, it will be refreshed
 */
async function getValidGoogleAccount(userId: string): Promise<AccountType> {
  // Get the user's Google account from the database
  const userAccount = await db.query.accounts.findFirst({
    where: (accounts, { eq, and }) =>
      and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });

  if (!userAccount || !userAccount.access_token) {
    throw new Error("No Google account found or access token missing");
  }

  // Check if token is expired and refresh if needed
  if (
    userAccount.expires_at &&
    userAccount.expires_at < Math.floor(Date.now() / 1000)
  ) {
    console.log("Access token expired, attempting to refresh...");
    await refreshAccessToken(userAccount);
    
    // Get the updated account from the database
    const refreshedAccount = await db.query.accounts.findFirst({
      where: (accounts, { eq, and }) =>
        and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
    });
    
    if (!refreshedAccount || !refreshedAccount.access_token) {
      throw new Error("Failed to refresh expired access token");
    }
    
    return refreshedAccount as AccountType;
  }

  return userAccount as AccountType;
}

/**
 * Fetch with token refresh capability
 * This function will automatically refresh the token if it's expired
 */
async function fetchWithTokenRefresh(
  url: string,
  options: RequestInit,
  userAccount: AccountType,
  userId: string
): Promise<Response> {
  try {
    console.log(`fetchWithTokenRefresh called for URL: ${url}`);
    console.log(`Request method: ${options.method}`);
    
    // Make the initial request with the current token
    console.log("Making initial request with current token");
    const response = await fetch(url, options);
    
    console.log(`Initial response status: ${response.status}`);
    
    // If the request was successful, return the response
    if (response.ok) {
      console.log("Request successful, returning response");
      return response;
    }
    
    // If we got a 401 Unauthorized error, try to refresh the token
    if (response.status === 401 && userAccount.refresh_token) {
      console.log("Received 401, attempting to refresh token...");
      
      // Refresh the token
      await refreshAccessToken(userAccount);
      
      // Get the updated account with the new token
      console.log("Getting refreshed account from database");
      const refreshedAccount = await db.query.accounts.findFirst({
        where: (accounts, { eq, and }) =>
          and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
      });
      
      if (!refreshedAccount || !refreshedAccount.access_token) {
        console.error("Failed to get refreshed account or access token");
        throw new Error("Failed to refresh access token");
      }
      
      console.log("Got refreshed account with new access token");
      
      // Update the Authorization header with the new token
      const newOptions = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${refreshedAccount.access_token}`,
        },
      };
      
      // Retry the request with the new token
      console.log("Token refreshed, retrying request with new token");
      return fetch(url, newOptions);
    }
    
    // If it's not a 401 error or we couldn't refresh the token, return the original response
    console.log(`Non-401 error or couldn't refresh token, returning original response: ${response.status}`);
    return response;
  } catch (error) {
    console.error("Error in fetchWithTokenRefresh:", error);
    throw error;
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(account: AccountType): Promise<string | null> {
  try {
    if (!account.refresh_token) {
      console.error("No refresh token available");
      return null;
    }
    console.log("Refreshing access token using refresh token");

    // Ensure we have the required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error(
        "Missing Google OAuth credentials in environment variables",
      );
      return null;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", data);
      throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
    }

    console.log("Token refresh successful, updating database");

    // Update the account in the database with the new access token
    await db
      .update(accounts)
      .set({
        access_token: data.access_token,
        expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
      })
      .where(
        and(
          eq(accounts.provider, account.provider),
          eq(accounts.providerAccountId, account.providerAccountId),
        ),
      );

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return null;
  }
}