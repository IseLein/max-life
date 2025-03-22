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

      // Handle token expiration by trying to refresh the token
      if (response.status === 401 && userAccount.refresh_token) {
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          // Retry with the new token
          return getCalendarEventsForCurrentWeek(userId);
        }
      }

      throw new Error(
        `Failed to fetch calendar events: ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
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

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
    }

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

// Create a new calendar event
export async function createCalendarEvent(
  userId: string,
  eventDetails: Omit<CalendarEvent, "id">,
): Promise<CalendarEvent> {
  try {
    const userAccount = await db.query.accounts.findFirst({
      where: (accounts, { eq, and }) =>
        and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
    });

    if (!userAccount || !userAccount.access_token) {
      throw new Error("No Google account found or access token missing");
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventDetails),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401 && userAccount.refresh_token) {
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          return createCalendarEvent(userId, eventDetails);
        }
      }
      throw new Error(
        `Failed to create calendar event: ${JSON.stringify(errorData)}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

// Update an existing calendar event
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  eventDetails: Partial<Omit<CalendarEvent, "id">>,
): Promise<CalendarEvent> {
  try {
    const userAccount = await db.query.accounts.findFirst({
      where: (accounts, { eq, and }) =>
        and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
    });

    if (!userAccount || !userAccount.access_token) {
      throw new Error("No Google account found or access token missing");
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventDetails),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401 && userAccount.refresh_token) {
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          return updateCalendarEvent(userId, eventId, eventDetails);
        }
      }
      throw new Error(
        `Failed to update calendar event: ${JSON.stringify(errorData)}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating calendar event:", error);
    throw error;
  }
}

// Delete a calendar event
export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
): Promise<boolean> {
  try {
    const userAccount = await db.query.accounts.findFirst({
      where: (accounts, { eq, and }) =>
        and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
    });

    if (!userAccount || !userAccount.access_token) {
      throw new Error("No Google account found or access token missing");
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${userAccount.access_token}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 401 && userAccount.refresh_token) {
        const refreshedToken = await refreshAccessToken(userAccount);
        if (refreshedToken) {
          return deleteCalendarEvent(userId, eventId);
        }
      }
      throw new Error(
        `Failed to delete calendar event: ${JSON.stringify(errorData)}`,
      );
    }

    return true;
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    throw error;
  }
}
