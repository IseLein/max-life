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

interface CalendarEvent {
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

export async function getCalendarEventsForCurrentWeek(
  userId: string,
): Promise<CalendarEvent[]> {
  try {
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
      const refreshedToken = await refreshAccessToken(userAccount);
      if (!refreshedToken) {
        throw new Error("Failed to refresh expired access token");
      }
      // Update the access token for the current request
      userAccount.access_token = refreshedToken;
    }

    // Calculate current week's start and end dates
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    // Format dates for Google Calendar API
    const timeMin = startOfWeek.toISOString();
    const timeMax = endOfWeek.toISOString();

    console.log(`Fetching calendar events from ${timeMin} to ${timeMax}`);
    console.log(
      `Using access token: ${userAccount.access_token?.substring(0, 10)}...`,
    );

    // Fetch calendar events from Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.log("Calendar API error response:", errorData);

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        console.log("Received 401, attempting to refresh token...");
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Update the access token for retry
          userAccount.access_token = refreshedToken;

          // Create a new function call with the updated token
          return getCalendarEventsForCurrentWeek(userId);
        } else {
          console.log("Token refresh failed");
        }
      }

      throw new Error(
        `Failed to fetch calendar events: ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    console.log(
      `Successfully fetched ${data.items?.length || 0} calendar events`,
    );
    return data.items as CalendarEvent[];
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}

export async function getCalendarEvents(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  try {
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
      const refreshedToken = await refreshAccessToken(userAccount);
      if (!refreshedToken) {
        throw new Error("Failed to refresh expired access token");
      }
      // Update the access token for the current request
      userAccount.access_token = refreshedToken;
    }

    // Calculate current week's start and end dates
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
    endOfWeek.setHours(23, 59, 59, 999);

    // Format dates for Google Calendar API
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    console.log(`Fetching calendar events from ${timeMin} to ${timeMax}`);
    console.log(
      `Using access token: ${userAccount.access_token?.substring(0, 10)}...`,
    );

    // Fetch calendar events from Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.log("Calendar API error response:", errorData);

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        console.log("Received 401, attempting to refresh token...");
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Update the access token for retry
          userAccount.access_token = refreshedToken;

          // Create a new function call with the updated token
          return getCalendarEvents(userId, startDate, endDate);
        } else {
          console.log("Token refresh failed");
        }
      }

      throw new Error(
        `Failed to fetch calendar events: ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    console.log(
      `Successfully fetched ${data.items?.length || 0} calendar events`,
    );
    return data.items as CalendarEvent[];
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}

async function refreshAccessToken(
  account: AccountType,
): Promise<string | null> {
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

export async function createCalendarEvent(
  userId: string,
  eventData: {
    summary: string;
    description?: string;
    location?: string;
    start: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    end: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
  }
): Promise<any> {
  try {
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
      const refreshedToken = await refreshAccessToken(userAccount);
      if (!refreshedToken) {
        throw new Error("Failed to refresh expired access token");
      }
      // Update the access token for the current request
      userAccount.access_token = refreshedToken;
    }

    console.log("Creating calendar event:", eventData.summary);

    // Create calendar event in Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.log("Calendar API error response:", errorData);

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        console.log("Received 401, attempting to refresh token...");
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Update the access token for retry
          userAccount.access_token = refreshedToken;

          // Retry the request with the new token
          return createCalendarEvent(userId, eventData);
        } else {
          console.log("Token refresh failed");
        }
      }

      throw new Error(
        `Failed to create calendar event: ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    console.log("Successfully created calendar event:", data.id);
    return data;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
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
  }
): Promise<any> {
  try {
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
      const refreshedToken = await refreshAccessToken(userAccount);
      if (!refreshedToken) {
        throw new Error("Failed to refresh expired access token");
      }
      // Update the access token for the current request
      userAccount.access_token = refreshedToken;
    }

    console.log(`Updating calendar event ${eventId}:`, eventData.summary);

    // First, get the current event to merge with updates
    const getResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
        },
      }
    );

    if (!getResponse.ok) {
      const errorData = await getResponse.json();
      throw new Error(
        `Failed to fetch event for update: ${JSON.stringify(errorData)}`
      );
    }

    const currentEvent = await getResponse.json();
    
    // Merge the current event with the updates
    const updatedEvent = {
      ...currentEvent,
      ...eventData,
    };

    // Update calendar event in Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedEvent),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.log("Calendar API error response:", errorData);

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        console.log("Received 401, attempting to refresh token...");
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Update the access token for retry
          userAccount.access_token = refreshedToken;

          // Retry the request with the new token
          return updateCalendarEvent(userId, eventId, eventData);
        } else {
          console.log("Token refresh failed");
        }
      }

      throw new Error(
        `Failed to update calendar event: ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    console.log("Successfully updated calendar event:", data.id);
    return data;
  } catch (error) {
    console.error("Error updating calendar event:", error);
    throw error;
  }
}

export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  try {
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
      const refreshedToken = await refreshAccessToken(userAccount);
      if (!refreshedToken) {
        throw new Error("Failed to refresh expired access token");
      }
      // Update the access token for the current request
      userAccount.access_token = refreshedToken;
    }

    console.log(`Deleting calendar event: ${eventId}`);

    // Delete calendar event from Google Calendar API
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
        },
      }
    );

    if (!response.ok) {
      // For DELETE, a 404 might be acceptable (event already deleted)
      if (response.status === 404) {
        console.log("Event not found (may have been already deleted)");
        return true;
      }

      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { status: response.status, statusText: response.statusText };
      }
      
      console.log("Calendar API error response:", errorData);

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        console.log("Received 401, attempting to refresh token...");
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          console.log("Token refreshed successfully, retrying request");
          // Update the access token for retry
          userAccount.access_token = refreshedToken;

          // Retry the request with the new token
          return deleteCalendarEvent(userId, eventId);
        } else {
          console.log("Token refresh failed");
        }
      }

      throw new Error(
        `Failed to delete calendar event: ${JSON.stringify(errorData)}`
      );
    }

    console.log("Successfully deleted calendar event:", eventId);
    return true;
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    throw error;
  }
}
