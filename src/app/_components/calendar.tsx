"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { signIn } from "next-auth/react";

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

export function WeeklyCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  // Use useQuery to handle loading and error states
  const query = api.calendar.getCurrentWeekEvents.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    onError: (err) => {
      console.error("Calendar query error:", err);
      setError(new Error(err.message));
      // Check if this is an authentication error
      if (
        err.message.includes("authentication") ||
        err.message.includes("credentials") ||
        err.message.includes("UNAUTHENTICATED") ||
        err.message.includes("401")
      ) {
        setIsAuthError(true);
      }
      setIsLoading(false);
    },
  });

  // Update state based on query status
  useEffect(() => {
    if (query.data) {
      setEvents(query.data);
      setIsLoading(false);
    }
    if (!query.isLoading && !query.data && !query.error) {
      setIsLoading(false);
    }
  }, [query.data, query.isLoading]);

  // Handle re-authentication
  const handleReAuthenticate = () => {
    signIn("google", {
      callbackUrl: window.location.href,
      prompt: "consent",
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Group events by day
  const groupEventsByDay = () => {
    if (!events || events.length === 0) return {};

    const grouped: Record<string, CalendarEvent[]> = {};

    events.forEach((event: CalendarEvent) => {
      if (!event.start.dateTime) return;

      const date = new Date(event.start.dateTime);
      const dayKey = date.toISOString().split("T")[0];

      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }

      grouped[dayKey].push(event);
    });

    return grouped;
  };

  const groupedEvents = groupEventsByDay();
  const sortedDays = Object.keys(groupedEvents).sort();

  if (isLoading) {
    return (
      <div className="p-4 text-center">Loading your calendar events...</div>
    );
  }

  if (isAuthError) {
    return (
      <div className="rounded-lg bg-white/5 p-4 text-center">
        <p className="mb-2 font-medium text-amber-400">
          Google Calendar Access Issue
        </p>
        <p className="mb-4">
          We need additional permissions to access your calendar.
        </p>
        <button
          onClick={handleReAuthenticate}
          className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
        >
          Re-authenticate with Google
        </button>
      </div>
    );
  }

  if (error && !isAuthError) {
    return (
      <div className="rounded-lg bg-white/5 p-4 text-center text-red-500">
        <p className="mb-2 font-medium">Error loading calendar events</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 p-4 text-center">
        <p>No events found for this week</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h2 className="mb-4 text-2xl font-bold">This Week's Calendar</h2>

      <div className="space-y-4">
        {sortedDays.map((day: string) => (
          <div key={day} className="rounded-lg bg-white/10 p-4">
            <h3 className="mb-2 text-xl font-semibold">
              {new Date(day).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>

            <div className="space-y-2">
              {groupedEvents[day]?.map((event: CalendarEvent) => (
                <div key={event.id} className="rounded bg-white/5 p-3">
                  <div className="font-medium">{event.summary}</div>

                  <div className="mt-1 text-sm opacity-80">
                    {formatDate(event.start.dateTime)} -{" "}
                    {formatDate(event.end.dateTime)}
                  </div>

                  {event.location && (
                    <div className="mt-1 text-sm opacity-70">
                      📍 {event.location}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
