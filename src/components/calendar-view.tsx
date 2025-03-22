"use client"

import { useEffect, useState } from "react"
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { api } from "~/trpc/react"
import { EventModal, CalendarEvent } from "~/components/event-modal"
import { useToast } from "~/components/ui/use-toast"

// Helper functions for calendar operations
const getDaysOfWeek = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

interface CalendarViewProps {
  className?: string
}

export function CalendarView({ className }: CalendarViewProps) {
  // State for managing the calendar
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [daysOfWeek, setDaysOfWeek] = useState<Date[]>(getDaysOfWeek(currentDate))
  
  // State for managing the event modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("view")
  
  const { toast } = useToast()

  // Calculate start and end dates for the current week view
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 })
  const endDate = endOfWeek(currentDate, { weekStartsOn: 0 })

  // Fetch calendar events for the current week
  const { 
    data: events = [], 
    isLoading,
    refetch
  } = api.calendar.getEventsForDateRange.useQuery(
    { startDate, endDate },
    { 
      keepPreviousData: true,
      refetchOnWindowFocus: false
    }
  )

  // Mutations for event management
  const createEventMutation = api.calendar.createEvent.useMutation({
    onSuccess: () => {
      toast({
        title: "Event created",
        description: "Your event has been created successfully.",
      })
      void refetch()
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create event: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const updateEventMutation = api.calendar.updateEvent.useMutation({
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      })
      void refetch()
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update event: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  const deleteEventMutation = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully.",
      })
      void refetch()
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete event: ${error.message}`,
        variant: "destructive",
      })
    },
  })

  // Update days of week when current date changes
  useEffect(() => {
    setDaysOfWeek(getDaysOfWeek(currentDate))
  }, [currentDate])

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1))
  }

  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Event handling functions
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvent(null)
    setModalMode("create")
    setIsModalOpen(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setModalMode("view")
    setIsModalOpen(true)
  }

  const handleCreateNewEvent = () => {
    setSelectedEvent(null)
    setModalMode("create")
    setIsModalOpen(true)
  }

  const handleSaveEvent = async (eventData: CalendarEvent) => {
    if (modalMode === "create") {
      await createEventMutation.mutateAsync(eventData)
    } else if (modalMode === "edit" && selectedEvent?.id) {
      await updateEventMutation.mutateAsync({
        id: selectedEvent.id,
        ...eventData,
      })
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEventMutation.mutateAsync({ id: eventId })
  }

  // Helper function to get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      // Handle all-day events
      if (event.start.date) {
        const eventDate = parseISO(event.start.date)
        return isSameDay(day, eventDate)
      }
      
      // Handle time-based events
      if (event.start.dateTime) {
        const eventDate = parseISO(event.start.dateTime)
        return isSameDay(day, eventDate)
      }
      
      return false
    })
  }

  // Render time slots for a day
  const renderTimeSlots = (day: Date) => {
    const dayEvents = getEventsForDay(day)
    
    if (dayEvents.length === 0) {
      return (
        <div 
          className="h-full min-h-[100px] cursor-pointer border-t border-gray-200 p-1"
          onClick={() => handleDateClick(day)}
        />
      )
    }

    return (
      <div className="h-full min-h-[100px] border-t border-gray-200 p-1">
        {dayEvents.map((event) => (
          <div
            key={event.id}
            onClick={() => handleEventClick(event)}
            className="mb-1 cursor-pointer rounded bg-blue-100 p-1 text-xs hover:bg-blue-200"
          >
            <div className="font-medium">{event.summary}</div>
            {event.start.dateTime && (
              <div className="text-gray-600">
                {format(parseISO(event.start.dateTime), "h:mm a")}
              </div>
            )}
          </div>
        ))}
        <div 
          className="mt-1 h-4 w-full cursor-pointer"
          onClick={() => handleDateClick(day)}
        />
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Calendar</CardTitle>
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
            <Button size="sm" onClick={handleCreateNewEvent}>
              <Plus className="mr-1 h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>
        <CardDescription>
          {format(startDate, "MMMM d, yyyy")} - {format(endDate, "MMMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <div className="text-center">
              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-gray-900 mx-auto"></div>
              <p className="text-sm text-gray-500">Loading calendar events...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 border border-gray-200">
            {/* Day headers */}
            {daysOfWeek.map((day, index) => (
              <div
                key={index}
                className="border-b border-r border-gray-200 p-2 text-center"
              >
                <div className="text-sm font-medium">
                  {format(day, "EEE")}
                </div>
                <div className="text-sm">{format(day, "d")}</div>
              </div>
            ))}
            
            {/* Calendar cells */}
            {daysOfWeek.map((day, index) => (
              <div
                key={`cell-${index}`}
                className="h-[200px] border-r border-gray-200 last:border-r-0"
              >
                {renderTimeSlots(day)}
              </div>
            ))}
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
  )
}