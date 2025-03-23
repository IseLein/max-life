"use client";

import { useEffect, useState, useRef } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  getHours,
  getMinutes,
} from "date-fns";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "~/trpc/react";
import { EventModal, CalendarEvent } from "~/components/event-modal";
import { useToast } from "~/components/ui/use-toast";

// Helper functions for calendar operations
const getDaysOfWeek = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

// Generate time slots for a full 24-hour day (midnight to midnight)
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => i);

interface CalendarViewProps {
  className?: string;
}

export function CalendarView({ className }: CalendarViewProps) {
  // State for managing the calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [daysOfWeek, setDaysOfWeek] = useState<Date[]>(
    getDaysOfWeek(currentDate),
  );

  // State for managing the event modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">(
    "view",
  );

  // Ref for scrolling to current time
  const timeGridRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  // Calculate start and end dates for the current week view
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Fetch calendar events for the current week
  const {
    data: events = [],
    isLoading,
    refetch,
  } = api.calendar.getEventsForDateRange.useQuery(
    { startDate, endDate },
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    },
  );

  // TRPC mutations for event management
  const createEventMutation = api.calendar.createEvent.useMutation({
    onSuccess: () => {
      refetch();
      toast({
        title: "Event created",
        description: "Your event has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = api.calendar.updateEvent.useMutation({
    onSuccess: () => {
      refetch();
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      refetch();
      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update days of week when current date changes
  useEffect(() => {
    setDaysOfWeek(getDaysOfWeek(currentDate));
  }, [currentDate]);

  // Scroll to current time when component loads
  useEffect(() => {
    if (timeGridRef.current) {
      const now = new Date();
      const currentHour = getHours(now);

      // Only scroll if current time is within our display range
      if (currentHour >= 0 && currentHour <= 23) {
        const hourIndex = currentHour; // Adjust for our 0-hour start
        const scrollPosition = hourIndex * 40; // Each hour slot is 40px high

        // Add a small offset to show a bit of context above current time
        const scrollOffset = Math.max(0, scrollPosition - 80);
        timeGridRef.current.scrollTop = scrollOffset;
      }
    }
  }, []);

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());

    // Scroll to current time when clicking Today
    if (timeGridRef.current) {
      const now = new Date();
      const currentHour = getHours(now);

      if (currentHour >= 0 && currentHour <= 23) {
        const hourIndex = currentHour; // Adjust for our 0-hour start
        const scrollPosition = hourIndex * 40; // Each hour slot is 40px high

        // Add a small offset to show a bit of context above current time
        const scrollOffset = Math.max(0, scrollPosition - 80);
        timeGridRef.current.scrollTop = scrollOffset;
      }
    }
  };

  // Event handling functions
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setModalMode("create");
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    try {
      if (modalMode === "create") {
        await createEventMutation.mutateAsync(event);
      } else if (modalMode === "edit") {
        await updateEventMutation.mutateAsync(event);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEventMutation.mutateAsync({ eventId });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  // Helper function to get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      // Handle all-day events
      if (event.start.date) {
        const eventDate = parseISO(event.start.date);
        return isSameDay(eventDate, date);
      }

      // Handle time-based events
      if (event.start.dateTime) {
        const eventDate = parseISO(event.start.dateTime);
        return isSameDay(eventDate, date);
      }

      return false;
    });
  };

  // Helper function to position an event in the time grid
  const getEventPosition = (event: CalendarEvent, eventsForTimeSlot: CalendarEvent[]) => {
    if (event.isAllDay || event.start.date) return null; // All-day events are handled separately

    if (!event.start.dateTime || !event.end.dateTime) return null;

    const eventStart = parseISO(event.start.dateTime);
    const hours = getHours(eventStart);
    const minutes = getMinutes(eventStart);

    // Calculate position from top (in percentage)
    const startHour = hours; // Offset from our 0-hour start
    if (startHour < 0) return null; // Event starts before our display time

    const minutePercentage = minutes / 60;
    const topPosition = (startHour + minutePercentage) * (100 / 24); // 24 hours in our display (0-23)

    // Calculate height based on duration
    const eventEnd = parseISO(event.end.dateTime);
    const durationHours =
      (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
    const heightPercentage = Math.min(durationHours * (100 / 24), 100); // Cap at 100% height

    // Handle overlapping events
    const totalOverlappingEvents = eventsForTimeSlot.length;
    const eventIndex = eventsForTimeSlot.findIndex(e => e.id === event.id);
    
    // Calculate width and left position based on number of overlapping events
    const width = totalOverlappingEvents > 1 ? `${100 / totalOverlappingEvents}%` : '95%';
    const left = totalOverlappingEvents > 1 ? `${(eventIndex * 100) / totalOverlappingEvents}%` : '2.5%';

    return {
      top: `${topPosition}%`,
      height: `${heightPercentage}%`,
      width,
      left,
    };
  };

  // Generate current time indicator position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = getHours(now);
    const minutes = getMinutes(now);

    if (hours < 0 || hours > 23) return null;

    const hourOffset = hours; // Offset from our 0-hour start
    const minutePercentage = minutes / 60;
    const topPosition = (hourOffset + minutePercentage) * (100 / 24); // 24 hours in our display

    return {
      top: `${topPosition}%`,
    };
  };

  const currentTimePosition = getCurrentTimePosition();
  const isToday = daysOfWeek.some((day) => isSameDay(day, new Date()));

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>
            {format(startDate, "MMMM d, yyyy")} -{" "}
            {format(endDate, "MMMM d, yyyy")}
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => handleDayClick(selectedDate)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Event
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[600px] items-center justify-center">
            <p>Loading calendar events...</p>
          </div>
        ) : (
          <div className="grid h-[600px] grid-cols-8 overflow-hidden rounded-md border">
            {/* Day headers row */}
            <div className="sticky top-0 z-20 col-span-8 grid grid-cols-8 border-b bg-white">
              {/* Empty cell for time column */}
              <div className="border-r p-2"></div>

              {/* Day headers */}
              {daysOfWeek.map((day, index) => (
                <div
                  key={index}
                  className={`border-r p-2 text-center font-medium ${
                    isSameDay(day, new Date()) ? "bg-blue-50" : ""
                  }`}
                >
                  <div>{format(day, "EEE")}</div>
                  <div
                    className={`text-lg ${
                      isSameDay(day, new Date())
                        ? "font-bold text-blue-600"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Scrollable time grid */}
            <div
              className="col-span-8 grid h-[540px] grid-cols-8 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              ref={timeGridRef}
            >
              {/* Time labels column */}
              <div className="sticky left-0 z-10 col-span-1 border-r bg-white">
                {TIME_SLOTS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[40px] border-b pr-2 text-right text-sm text-gray-500"
                  >
                    {hour === 0
                      ? "12AM"
                      : hour === 12
                        ? "12PM"
                        : hour > 12
                          ? `${hour - 12}PM`
                          : `${hour}AM`}
                  </div>
                ))}
              </div>

              {/* Days columns */}
              <div className="col-span-7 grid grid-cols-7">
                {/* Time slots for each day */}
                {daysOfWeek.map((day, dayIndex) => (
                  <div key={dayIndex} className="relative border-r">
                    {/* Time slot grid lines */}
                    {TIME_SLOTS.map((hour) => (
                      <div
                        key={hour}
                        className="h-[40px] cursor-pointer border-b hover:bg-gray-50"
                        onClick={() => {
                          // Create event at this specific time
                          const newDate = new Date(day);
                          newDate.setHours(hour, 0, 0, 0);
                          setSelectedDate(newDate);
                          setModalMode("create");
                          setSelectedEvent(null);
                          setIsModalOpen(true);
                        }}
                      />
                    ))}

                    {/* All-day events */}
                    <div className="absolute top-0 right-0 left-0 px-1">
                      {getEventsForDay(day)
                        .filter((event) => event.isAllDay || event.start.date)
                        .map((event, idx) => (
                          <div
                            key={event.id}
                            className="mt-1 mb-1 cursor-pointer truncate rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                          >
                            {event.summary}
                          </div>
                        ))}
                    </div>

                    {/* Time-based events */}
                    {(() => {
                      // Get all time-based events for this day
                      const timeEvents = getEventsForDay(day)
                        .filter(
                          (event) =>
                            !event.isAllDay &&
                            !event.start.date &&
                            event.start.dateTime
                        );
                      
                      // Group events that overlap in time
                      const eventGroups: CalendarEvent[][] = [];
                      
                      timeEvents.forEach(event => {
                        if (!event.start.dateTime || !event.end.dateTime) return;
                        
                        const eventStart = parseISO(event.start.dateTime);
                        const eventEnd = parseISO(event.end.dateTime);
                        
                        // Find a group this event overlaps with
                        let foundGroup = false;
                        
                        for (const group of eventGroups) {
                          // Check if this event overlaps with any event in the group
                          const overlaps = group.some(groupEvent => {
                            if (!groupEvent.start.dateTime || !groupEvent.end.dateTime) return false;
                            
                            const groupEventStart = parseISO(groupEvent.start.dateTime);
                            const groupEventEnd = parseISO(groupEvent.end.dateTime);
                            
                            // Check for overlap
                            return (
                              (eventStart < groupEventEnd && eventEnd > groupEventStart) ||
                              (groupEventStart < eventEnd && groupEventEnd > eventStart)
                            );
                          });
                          
                          if (overlaps) {
                            group.push(event);
                            foundGroup = true;
                            break;
                          }
                        }
                        
                        // If no overlapping group found, create a new group
                        if (!foundGroup) {
                          eventGroups.push([event]);
                        }
                      });
                      
                      // Render all events with their proper positioning
                      return eventGroups.flatMap(group => 
                        group.map((event, idx) => {
                          const position = getEventPosition(event, group);
                          if (!position) return null;

                          return (
                            <div
                              key={event.id}
                              className="absolute cursor-pointer overflow-hidden rounded bg-blue-500 px-1 text-white"
                              style={{
                                top: position.top,
                                height: position.height,
                                width: position.width,
                                left: position.left,
                                zIndex: 10,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                            >
                              <div className="truncate text-xs">
                                {event.summary}
                              </div>
                              {parseFloat(position.height.replace('%', '')) > 5 &&
                                event.start.dateTime && (
                                  <div className="truncate text-xs">
                                    {format(
                                      parseISO(event.start.dateTime),
                                      "h:mm a",
                                    )}
                                  </div>
                                )}
                            </div>
                          );
                        })
                      );
                    })()}
                    
                    {/* Current time indicator */}
                    {isToday &&
                      isSameDay(day, new Date()) &&
                      currentTimePosition && (
                        <div
                          className="absolute right-0 left-0 z-20"
                          style={{ top: currentTimePosition.top }}
                        >
                          <div className="flex items-center">
                            <div className="ml-1 h-2 w-2 rounded-full bg-red-500"></div>
                            <div className="h-[1px] w-full bg-red-500"></div>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
        mode={modalMode}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        setModalMode={setModalMode}
      />
    </Card>
  );
}
