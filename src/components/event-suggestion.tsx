"use client"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Check, X } from "lucide-react"

type Suggestion = {
  id: string
  title: string
  description: string
  date: Date
  duration: number
}

interface EventSuggestionProps {
  suggestion: Suggestion
  onAddToCalendar: () => void
}

export function EventSuggestion({ suggestion, onAddToCalendar }: EventSuggestionProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const endTime = new Date(suggestion.date.getTime() + suggestion.duration * 60000)

  return (
    <Card className="border border-muted">
      <CardContent className="p-3">
        <div className="font-medium">{suggestion.title}</div>
        <div className="text-sm text-muted-foreground">{suggestion.description}</div>
        <div className="text-sm mt-1">
          {formatDate(suggestion.date)} • {formatTime(suggestion.date)} - {formatTime(endTime)}
        </div>
      </CardContent>
      <CardFooter className="p-2 flex justify-end space-x-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {}}>
          <X className="h-4 w-4" />
        </Button>
        <Button variant="default" size="sm" className="h-8 w-8 p-0" onClick={onAddToCalendar}>
          <Check className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}