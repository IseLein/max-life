"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

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

  // Use useQuery to handle loading and error states
  const query = api.calendar.getCurrentWeekEvents.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Update state based on query status
  useEffect(() => {
    if (query.data) {
      setEvents(query.data);
      setIsLoading(false);
    }
    if (query.error) {
      setError(new Error(query.error.message));
      setIsLoading(false);
    }
    if (!query.isLoading && !query.data && !query.error) {
      setIsLoading(false);
    }
  }, [query.data, query.error, query.isLoading]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Group events by day
  const groupEventsByDay = () => {
    if (!events || events.length === 0) return {};
    
    const grouped: Record<string, CalendarEvent[]> = {};
    
    events.forEach((event: CalendarEvent) => {
      if (!event.start.dateTime) return;
      
      const date = new Date(event.start.dateTime);
      const dayKey = date.toISOString().split('T')[0];
      
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
    return <div className="text-center p-4">Loading your calendar events...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <p>Error loading calendar events</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center p-4">
        <p>No events found for this week</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">This Week's Calendar</h2>
      
      <div className="space-y-4">
        {sortedDays.map((day: string) => (
          <div key={day} className="bg-white/10 p-4 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">
              {new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            
            <div className="space-y-2">
              {groupedEvents[day]?.map((event: CalendarEvent) => (
                <div key={event.id} className="bg-white/5 p-3 rounded">
                  <div className="font-medium">{event.summary}</div>
                  
                  <div className="text-sm opacity-80 mt-1">
                    {formatDate(event.start.dateTime)} - {formatDate(event.end.dateTime)}
                  </div>
                  
                  {event.location && (
                    <div className="text-sm mt-1 opacity-70">
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
