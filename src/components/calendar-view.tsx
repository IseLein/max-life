"use client"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Mock calendar data
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Mock events
const EVENTS = [
  { id: 1, title: "Team Meeting", date: new Date(2025, 2, 22, 10, 0), duration: 60 },
  { id: 2, title: "Gym Workout", date: new Date(2025, 2, 23, 17, 0), duration: 90 },
  { id: 3, title: "Project Planning", date: new Date(2025, 2, 24, 14, 0), duration: 120 },
  { id: 4, title: "Reading Time", date: new Date(2025, 2, 19, 20, 0), duration: 60 },
  { id: 5, title: "Coffee with Alex", date: new Date(2025, 2, 17, 11, 0), duration: 45 },
  { id: 6, title: "Coding Session", date: new Date(2025, 2, 12, 13, 0), duration: 180 },
]

export function CalendarView() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Get the first day of the week (Sunday) for the current week
  const getFirstDayOfWeek = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 for Sunday, 1 for Monday, etc.
    d.setDate(d.getDate() - day) // Go back to the first day of the week (Sunday)
    return d
  }

  // Get array of dates for the current week
  const getWeekDates = () => {
    const firstDay = getFirstDayOfWeek(currentWeek)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(firstDay)
      date.setDate(firstDay.getDate() + i)
      return date
    })
  }

  const weekDates = getWeekDates()

  const handlePrevWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeek(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeek(newDate)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  // Format date as "Month Day" (e.g., "Jun 15")
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Format time as "HH:MM AM/PM"
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Check if a date is the selected date
  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  // Get events for a specific day and hour
  const getEventsForTimeSlot = (date: Date, hour: number) => {
    return EVENTS.filter((event) => {
      const eventDate = event.date
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getHours() === hour
      )
    })
  }

  // Get all events for a specific day
  const getDayEvents = () => {
    return EVENTS.filter((event) => {
      const eventDate = event.date
      return (
        eventDate.getDate() === selectedDate.getDate() &&
        eventDate.getMonth() === selectedDate.getMonth() &&
        eventDate.getFullYear() === selectedDate.getFullYear()
      )
    })
  }

  // Format week range for header (e.g., "June 12 - June 18, 2023")
  const formatWeekRange = () => {
    const firstDay = weekDates[0]
    const lastDay = weekDates[6]

    const firstMonth = firstDay?.toLocaleDateString("en-US", { month: "long" })
    const lastMonth = lastDay?.toLocaleDateString("en-US", { month: "long" })

    const firstDate = firstDay?.getDate()
    const lastDate = lastDay?.getDate()

    const year = lastDay?.getFullYear()

    if (firstMonth === lastMonth) {
      return `${firstMonth} ${firstDate} - ${lastDate}, ${year}`
    } else {
      return `${firstMonth} ${firstDate} - ${lastMonth} ${lastDate}, ${year}`
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Weekly Calendar</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{formatWeekRange()}</span>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 text-center text-sm font-medium text-muted-foreground border-r">Time</div>
            {weekDates.map((date, index) => (
              <div
                key={index}
                className={`p-2 text-center cursor-pointer ${isToday(date) ? "bg-primary/10" : ""} ${isSelected(date) ? "bg-primary/20" : ""}`}
                onClick={() => handleDateClick(date)}
              >
                <div className="text-sm font-medium">{DAYS[date.getDay()]}</div>
                <div className={`text-sm ${isToday(date) ? "font-bold" : ""}`}>{formatDate(date)}</div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="divide-y">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[60px]">
                <div className="p-2 text-center text-sm text-muted-foreground border-r">
                  {hour % 12 === 0 ? 12 : hour % 12}
                  {hour >= 12 ? "pm" : "am"}
                </div>
                {weekDates.map((date, index) => {
                  const events = getEventsForTimeSlot(date, hour)
                  return (
                    <div key={index} className="p-1 border-r relative">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className="bg-primary/80 text-primary-foreground rounded p-1 text-xs mb-1 cursor-pointer"
                          style={{
                            height: `${Math.min(event.duration / 15, 4) * 15}px`,
                            overflow: "hidden",
                          }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="truncate">
                            {formatTime(event.date)} -{" "}
                            {formatTime(new Date(event.date.getTime() + event.duration * 60000))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}