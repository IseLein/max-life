"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Send } from "lucide-react"
import { EventSuggestion } from "~/components/event-suggestion"
import { api } from "~/trpc/react"
import type { Message, Suggestion, AddSuggestion, EditSuggestion, DeleteSuggestion, SuggestionResponse } from "~/lib/calendar-utils"
import { parseGeminiResponse } from "~/lib/calendar-utils"
import type { Part } from "@google/generative-ai"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"


type History = {
  role: string
  parts: Array<string | Part>
}[]

type Personality = "strict" | "lenient" | "friendly" | "motivating"

export function CalendarChat() {
  const [input, setInput] = useState("")
  const [personality, setPersonality] = useState<Personality>("friendly")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hi there! I'm your AI calendar assistant. Tell me about your goals, hobbies, or what you'd like to plan.",
      sender: "model",
      timestamp: new Date(),
    },
  ])
  const [history, setHistory] = useState<History>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionResponses, setSuggestionResponses] = useState<SuggestionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const utils = api.useUtils()
  const makeGeminiRequest = api.gemini.generate.useMutation({
    onSuccess: async (data) => {
      await utils.invalidate()
      console.log(data)
      const parsedResponse = parseGeminiResponse(data)
      if (!parsedResponse) return
      const { message, suggestions, parts, getEventArgs } = parsedResponse

      setHistory((prev) => [...prev, { role: "model", parts }])

      if (message != "") {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: message,
          sender: "model",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMessage])
      }

      if (getEventArgs) {
        const { startDate, endDate } = getEventArgs
        fetchCalendarEvents(startDate, endDate)
      } else {
        setSuggestions(suggestions)
      }
      setIsLoading(false)
    },
  })

  // Add TRPC mutations for calendar operations
  const createEventMutation = api.calendar.createEvent.useMutation({
    onSuccess: (data) => {
      console.log("Event created successfully:", data)
    },
    onError: (error) => {
      console.error("Error creating event:", error)
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Failed to create event: ${error.message}`,
        sender: "info",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  })

  const updateEventMutation = api.calendar.updateEvent.useMutation({
    onSuccess: (data) => {
      console.log("Event updated successfully:", data)
    },
    onError: (error) => {
      console.error("Error updating event:", error)
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Failed to update event: ${error.message}`,
        sender: "info",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  })

  const deleteEventMutation = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      console.log("Event deleted successfully")
    },
    onError: (error) => {
      console.error("Error deleting event:", error)
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Failed to delete event: ${error.message}`,
        sender: "info",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  })

  const fetchCalendarEvents = async (startDate: Date, endDate: Date) => {
    try {
      // Use the trpc client directly to fetch events
      const events = await utils.calendar.getEventsForDateRange.fetch({ startDate, endDate })
      const message: Message = {
        id: (Date.now() + 1).toString(),
        content: `recieved ${events.length} events`,
        sender: "info",
        timestamp: new Date(),
      }
      const functionResponse = {
        name: "getCalendarEvents",
        response: {
          name: "getCalendarEvents",
          content: { events }
        }
      }
      makeGeminiRequest.mutate({ prompt: "", history, personality, functionResponses: [functionResponse] })
      console.log(history)
      setHistory((prev) => [...prev, { role: "function", parts: [{ functionResponse }] }])
      setMessages((prev) => {
        if (prev[prev.length - 1]?.content !== message.content) {
          return [...prev, message]
        } else {
          return prev
        }
      })
    } catch (error) {
      console.error("Error fetching events:", error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    makeGeminiRequest.mutate({ prompt: input, history, personality })
    setHistory((prev) => [...prev, { role: "user", parts: [{ text: input }] }])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const sendFunctionResponse = () => {
    if (suggestionResponses.length == 0) return
    // After successful modification, update model history with function response
    console.log(suggestionResponses)
    const functionResponses = suggestionResponses.map((s) => ({
      name: s.name,
      response: s
    }))
    
    // Convert the functionResponses to the expected Part format
    const functionResponseParts = functionResponses.map(resp => ({ 
      functionResponse: resp 
    } as Part))
    
    // Refresh the conversation with the AI to acknowledge the action
    makeGeminiRequest.mutate({ 
      prompt: "", 
      history, 
      personality, 
      functionResponses 
    })
    
    setSuggestionResponses([]);
    setHistory((prev) => [...prev, { role: "function", parts: functionResponseParts }])
  }

  // Add useEffect to detect when all suggestions have been handled
  useEffect(() => {
    // If we had suggestions before but now they're all handled, send the function response
    if (suggestions.length === 0 && suggestionResponses.length > 0) {
      sendFunctionResponse();
    }
  }, [suggestions, suggestionResponses]);

  const handleAcceptSuggestion = async (suggestionId: string) => {
    // Find the suggestion
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return
    

    // Define function names for Gemini
    const names = {
      "add": "addEventToCalendar",
      "edit": "editEventInCalendar",
      "delete": "deleteEventFromCalendar"
    }

    let success = false
    let errorMessage = ""

    try {
      // Process the suggestion based on action type
      if (suggestion.action === "add") {
        const addSuggestion = suggestion as AddSuggestion
        
        // Format date and time for Google Calendar API
        const startDate = new Date(
          addSuggestion.year, 
          addSuggestion.month, 
          addSuggestion.day, 
          Number(addSuggestion.startTime), 
          0, 0
        )
        const endDate = new Date(
          addSuggestion.year, 
          addSuggestion.month, 
          addSuggestion.day, 
          Number(addSuggestion.endTime), 
          0, 0
        )
        
        // Create the event using TRPC
        await createEventMutation.mutateAsync({
          summary: addSuggestion.title,
          description: addSuggestion.description || "",
          start: {
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        })
        
        success = true
      } 
      else if (suggestion.action === "edit") {
        const editSuggestion = suggestion as EditSuggestion
        
        // Prepare update data
        const updateData: any = {
          id: editSuggestion.eventId,
        }
        
        // Add fields that need to be updated
        const { changes } = editSuggestion
        if (changes.title) {
          updateData.summary = changes.title
        }
        
        // If date or time is changing, update start and end
        if (changes.year || changes.month || changes.day || changes.startTime || changes.endTime) {
          // Fetch the current event to get current values
          const events = await utils.calendar.getEventsForDateRange.fetch({
            startDate: new Date(new Date().getFullYear() - 1, 0, 1), // A year ago 
            endDate: new Date(new Date().getFullYear() + 1, 11, 31), // A year from now
          })
          
          const currentEvent = events.find(e => e.id === editSuggestion.eventId)
          if (!currentEvent) {
            throw new Error("Event not found")
          }
          
          // Parse current dates
          const currentStart = new Date(currentEvent.start.dateTime)
          const currentEnd = new Date(currentEvent.end.dateTime)
          
          // Create new dates based on changes
          const newYear = changes.year !== undefined ? changes.year : currentStart.getFullYear()
          const newMonth = changes.month !== undefined ? changes.month : currentStart.getMonth()
          const newDay = changes.day !== undefined ? changes.day : currentStart.getDate()
          const newStartTime = changes.startTime !== undefined ? Number(changes.startTime) : currentStart.getHours()
          const newEndTime = changes.endTime !== undefined ? Number(changes.endTime) : currentEnd.getHours()
          
          // Create new date objects
          const newStartDate = new Date(newYear, newMonth, newDay, newStartTime, currentStart.getMinutes())
          const newEndDate = new Date(newYear, newMonth, newDay, newEndTime, currentEnd.getMinutes())
          
          // Add to update data
          updateData.start = {
            dateTime: newStartDate.toISOString(),
            timeZone: currentEvent.start.timeZone,
          }
          updateData.end = {
            dateTime: newEndDate.toISOString(),
            timeZone: currentEvent.end.timeZone,
          }
        }
        
        // Update the event
        await updateEventMutation.mutateAsync(updateData)
        success = true
      } 
      else if (suggestion.action === "delete") {
        const deleteSuggestion = suggestion as DeleteSuggestion
        
        // Delete the event
        await deleteEventMutation.mutateAsync({
          id: deleteSuggestion.eventId
        })
        success = true
      }
    } catch (error) {
      if (error instanceof Error) {
        errorMessage = error.message
      } else {
        errorMessage = "An unknown error occurred"
      }
      console.error("Error processing calendar action:", error)
      success = false
    }

    // Create the response for Gemini
    const response = {
      name: names[suggestion.action],
      input: suggestion,
      response: {
        success,
        errorMessage
      }
    }
    setSuggestionResponses((prev) => [...prev, response])

    // Add confirmation or error message
    const messageContent = success 
      ? suggestion.action === "add" 
        ? "Event added to your calendar!" 
        : suggestion.action === "edit"
        ? "Event updated in your calendar!"
        : "Event deleted from your calendar!"
      : `Failed to ${suggestion.action} event: ${errorMessage}`
      
    const confirmationMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      sender: "info",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, confirmationMessage])

    // Remove the suggestion from the UI
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  const handleRejectSuggestion = (suggestionId: string) => {
    const suggestion = suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) return

    // Define function names for Gemini
    const names = {
      "add": "addEventToCalendar",
      "edit": "editEventInCalendar",
      "delete": "deleteEventFromCalendar"
    }

    const response = {
      name: names[suggestion.action],
      input: suggestion,
      response: {
        content: {
          success: false,
          error: 'rejected by user'
        }
      }
    }
    setSuggestionResponses((prev) => [...prev, response])

    const confirmationMessage: Message = {
      id: Date.now().toString(),
      content: "Suggestion discarded.",
      sender: "info",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, confirmationMessage])

    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Chat with your Calendar</CardTitle>
        <Select value={personality} onValueChange={(value) => setPersonality(value as Personality)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select personality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strict">Strict</SelectItem>
            <SelectItem value="lenient">Lenient</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="motivating">Motivating</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-16rem)] px-4">
          <div className="space-y-4 pt-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-muted">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"></div>
                    <div
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="space-y-2 my-4">
                <div className="text-sm font-medium">Suggested Events:</div>
                <div className="flex justify-between space-x-2">
                  <Button variant="ghost" onClick={() => {
                    suggestions.forEach((suggestion) => {
                      handleAcceptSuggestion(suggestion.id)
                    })
                  }}>
                    accept all
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    suggestions.forEach((suggestion) => {
                      handleRejectSuggestion(suggestion.id)
                    })
                  }}>
                    reject all
                  </Button>
                </div>
                {suggestions.map((suggestion) => (
                  <EventSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={() => handleAcceptSuggestion(suggestion.id)}
                    onReject={() => handleRejectSuggestion(suggestion.id)}
                  />
                ))}
                <div className="flex justify-between space-x-2">
                  <Button variant="ghost" onClick={() => {
                    suggestions.forEach((suggestion) => {
                      handleAcceptSuggestion(suggestion.id)
                    })
                  }}>
                    accept all
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    suggestions.forEach((suggestion) => {
                      handleRejectSuggestion(suggestion.id)
                    })
                  }}>
                    reject all
                  </Button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <div className="flex w-full justify-between space-x-2">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || (suggestions.length > 0)}
        />
        <Button size="icon" onClick={handleSendMessage} disabled={isLoading || (suggestions.length > 0)}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}