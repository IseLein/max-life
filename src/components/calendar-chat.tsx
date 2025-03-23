"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Send } from "lucide-react"
import { EventSuggestion } from "~/components/event-suggestion"
import { api } from "~/trpc/react"
import type { Message, Suggestion, AddSuggestion, EditSuggestion, DeleteSuggestion } from "~/lib/calendar-utils"


export function CalendarChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hi there! I'm your AI calendar assistant. Tell me about your goals, hobbies, or what you'd like to plan.",
      sender: "model",
      timestamp: new Date(),
    },
  ])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const utils = api.useUtils()
  const makeGeminiRequest = api.gemini.generate.useMutation({
    onSuccess: async (data) => {
      await utils.invalidate()
      console.log(data)
      const ai_responses = data.response.candidates
      if (!ai_responses || !ai_responses[0]) return
      const ai_response = ai_responses[0].content?.parts?.[0]?.text || ""

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: ai_response,
        sender: "model",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
      setIsLoading(false)
    },
  })

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
    setSuggestions(generateTestSuggestions(input))
    setIsLoading(true)

    const history = messages.slice(1).map(msg => ({
      role: msg.sender,
      parts: [{ text: msg.content }]
    }))
    makeGeminiRequest.mutate({ prompt: input, history })
  }

  const generateTestSuggestions = (userInput: string): Suggestion[] => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (userInput.toLowerCase().includes("add")) {
      return [
        {
          id: "s1",
          action: "add",
          title: "Study Session",
          description: "Focused learning time for your new skill",
          year: today.getFullYear(),
          month: today.getMonth(),
          day: today.getDate(),
          startTime: 18,
          endTime: 19,
        } as AddSuggestion,
      ]
    } else if (userInput.toLowerCase().includes("edit")) {
      return [
        {
          id: "s3",
          action: "edit",
          eventId: "event1",
          changes: {
            title: "Reading Time",
            description: "Quiet time to enjoy your book",
            year: today.getFullYear(),
            month: today.getMonth(),
            day: today.getDate(),
            startTime: 20,
            endTime: 21,
          },
        } as EditSuggestion,
      ]
    } else {
      return [
        {
          id: "s4",
          action: "delete",
          eventId: "event1",
          title: "Study Session",
          description: "Focused learning time for your new skill",
          year: today.getFullYear(),
          month: today.getMonth(),
          day: today.getDate(),
          startTime: 18,
          endTime: 19,
        } as DeleteSuggestion,
      ]
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleAddToCalendar = (suggestionId: string) => {
    // In a real app, this would add the event to Google Calendar
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))

    // Add confirmation message
    const confirmationMessage: Message = {
      id: Date.now().toString(),
      content: "Event added to your calendar!",
      sender: "model",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, confirmationMessage])
  }


  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Chat with your Calendar</CardTitle>
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
                {suggestions.map((suggestion) => (
                  <EventSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAddToCalendar={() => handleAddToCalendar(suggestion.id)}
                  />
                ))}
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
        />
        <Button size="icon" onClick={handleSendMessage} disabled={isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}