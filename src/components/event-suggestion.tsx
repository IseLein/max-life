"use client"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Check, X, Plus, Edit, Trash2 } from "lucide-react"
import type { Suggestion, AddSuggestion, EditSuggestion, DeleteSuggestion } from "~/lib/calendar-utils"

interface EventSuggestionProps {
  suggestion: Suggestion
  onAddToCalendar: () => void
}

export function EventSuggestion({ suggestion, onAddToCalendar }: EventSuggestionProps) {
  // Render the appropriate component based on the suggestion type
  switch (suggestion.action) {
    case "add":
      return <AddEventSuggestion suggestion={suggestion as AddSuggestion} onAddToCalendar={onAddToCalendar} />
    case "edit":
      return <EditEventSuggestion suggestion={suggestion as EditSuggestion} onAddToCalendar={onAddToCalendar} />
    case "delete":
      return <DeleteEventSuggestion suggestion={suggestion as DeleteSuggestion} onAddToCalendar={onAddToCalendar} />
    default:
      return null
  }
}

const formatDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day)
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

const formatTime = (time: Number) => {
  const hours = Math.floor(Number(time))
  const minutes = Math.round((Number(time) - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function AddEventSuggestion({ suggestion, onAddToCalendar }: { suggestion: AddSuggestion, onAddToCalendar: () => void }) {
  return (
    <Card className="border border-green-200 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center">
          <Plus className="h-4 w-4 text-green-500 mr-2" />
          <div className="font-medium">{suggestion.title}</div>
        </div>
        {suggestion.description && (
          <div className="text-sm text-muted-foreground">{suggestion.description}</div>
        )}
        <div className="text-sm mt-1">
          {formatDate(suggestion.year, suggestion.month, suggestion.day)} • {formatTime(suggestion.startTime)} - {formatTime(suggestion.endTime)}
        </div>
      </CardContent>
      <CardFooter className="p-2 flex justify-end space-x-2 bg-green-50">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {}}>
          <X className="h-4 w-4" />
        </Button>
        <Button variant="default" size="sm" className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600" onClick={onAddToCalendar}>
          <Check className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function EditEventSuggestion({ suggestion, onAddToCalendar }: { suggestion: EditSuggestion, onAddToCalendar: () => void }) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center">
          <Edit className="h-4 w-4 text-gray-500 mr-2" />
          <div className="font-medium">Edit: {suggestion.changes.title || "Event"}</div>
        </div>
        <div className="text-sm text-muted-foreground">Event ID: {suggestion.eventId}</div>
        {suggestion.changes.year && suggestion.changes.month && suggestion.changes.day && (
          <div className="text-sm mt-1">
            Date: {formatDate(suggestion.changes.year, suggestion.changes.month, suggestion.changes.day)}
          </div>
        )}
        {suggestion.changes.startTime && suggestion.changes.endTime && (
          <div className="text-sm">
            Time: {formatTime(suggestion.changes.startTime)} - {formatTime(suggestion.changes.endTime)}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-2 flex justify-end space-x-2 bg-gray-50">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {}}>
          <X className="h-4 w-4" />
        </Button>
        <Button variant="default" size="sm" className="h-8 w-8 p-0 bg-gray-500 hover:bg-gray-600" onClick={onAddToCalendar}>
          <Check className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function DeleteEventSuggestion({ suggestion, onAddToCalendar }: { suggestion: DeleteSuggestion, onAddToCalendar: () => void }) {
  return (
    <Card className="border border-red-200 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center">
          <Trash2 className="h-4 w-4 text-red-500 mr-2" />
          <div className="font-medium">Delete: {suggestion.title}</div>
        </div>
        {suggestion.description && (
          <div className="text-sm text-muted-foreground">{suggestion.description}</div>
        )}
        <div className="text-sm mt-1">
          {formatDate(suggestion.year, suggestion.month, suggestion.day)} • {formatTime(suggestion.startTime)} - {formatTime(suggestion.endTime)}
        </div>
        <div className="text-sm text-muted-foreground mt-1">Event ID: {suggestion.eventId}</div>
      </CardContent>
      <CardFooter className="p-2 flex justify-end space-x-2 bg-red-50">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {}}>
          <X className="h-4 w-4" />
        </Button>
        <Button variant="default" size="sm" className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600" onClick={onAddToCalendar}>
          <Check className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}