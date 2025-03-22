"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Send } from "lucide-react"
import { EventSuggestion } from "~/components/event-suggestion"

type Message = {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
}

type Suggestion = {
  id: string
  title: string
  description: string
  date: Date
  duration: number
}

export function CalendarChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hi there! I'm your AI calendar assistant. Tell me about your goals, hobbies, or what you'd like to plan.",
      sender: "ai",
      timestamp: new Date(),
    },
  ])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getAIResponse(input),
        sender: "ai",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])

      // Generate event suggestions based on user input
      if (input.toLowerCase().includes("goal") || input.toLowerCase().includes("hobby")) {
        const newSuggestions = generateSuggestions(input)
        setSuggestions(newSuggestions)
      }

      setIsLoading(false)
    }, 1000)
  }

  const getAIResponse = (userInput: string): string => {
    if (userInput.toLowerCase().includes("goal")) {
      return "Great! I've analyzed your goals and created some suggested calendar events to help you achieve them. Would you like me to add these to your calendar?"
    } else if (userInput.toLowerCase().includes("hobby")) {
      return "I've created some suggested time blocks for your hobbies that fit well with your existing schedule. Check them out below!"
    } else if (userInput.toLowerCase().includes("work")) {
      return "I've analyzed your work responsibilities and created some focused work blocks. Would you like to see them?"
    } else {
      return "I understand. Based on what you've shared, I've created some suggested calendar events. Would you like to add them to your calendar?"
    }
  }

  const generateSuggestions = (userInput: string): Suggestion[] => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (userInput.toLowerCase().includes("goal") && userInput.toLowerCase().includes("learn")) {
      return [
        {
          id: "s1",
          title: "Study Session",
          description: "Focused learning time for your new skill",
          date: new Date(today.setHours(18, 0, 0, 0)),
          duration: 60,
        },
        {
          id: "s2",
          title: "Practice Session",
          description: "Practice what you've learned",
          date: new Date(tomorrow.setHours(17, 0, 0, 0)),
          duration: 45,
        },
      ]
    } else if (userInput.toLowerCase().includes("hobby") && userInput.toLowerCase().includes("read")) {
      return [
        {
          id: "s3",
          title: "Reading Time",
          description: "Quiet time to enjoy your book",
          date: new Date(today.setHours(20, 0, 0, 0)),
          duration: 30,
        },
      ]
    } else {
      return [
        {
          id: "s4",
          title: "Planning Session",
          description: "Review and plan your goals",
          date: new Date(today.setHours(9, 0, 0, 0)),
          duration: 30,
        },
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
      sender: "ai",
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