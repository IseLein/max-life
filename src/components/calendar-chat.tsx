"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Send } from "lucide-react";
import { EventSuggestion } from "~/components/event-suggestion";
import { api } from "~/trpc/react";
import { useToast } from "~/components/ui/use-toast";

type Message = {
  id: string;
  content: string;
  sender: "user" | "model";
  timestamp: Date;
};

type Suggestion = {
  id: string;
  title: string;
  description: string;
  date: Date;
  duration: number;
};

export function CalendarChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: `Hi there! I'm your AI calendar assistant. I can help you manage your calendar events. You can ask me to view, create, update, or delete events. Today's date is: ${new Date().toISOString()}`,
      sender: "model",
      timestamp: new Date(),
    },
  ]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const utils = api.useUtils();

  // Use the new calendarChat procedure
  const calendarChatMutation = api.gemini.calendarChat.useMutation({
    onSuccess: async (data) => {
      await utils.invalidate();

      // The response is now a simple text response with events information
      const aiResponse = data.response;

      // Create a message for the AI response
      const aiMessage: Message = {
        id: Date.now().toString(),
        content: aiResponse,
        sender: "model",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // If events were created, generate suggestions for any that failed
      if (data.events && data.events.length > 0) {
        // Create suggestions for events that were successfully added
        const successEvents = data.events.filter((event) => event.success);
        if (successEvents.length > 0) {
          // You could add a visual indicator that events were added successfully
          console.log(`Successfully added ${successEvents.length} events`);
        }
      }

      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Error in calendar chat:", error);

      // Extract meaningful error message
      let errorMessage = "Failed to communicate with the calendar assistant";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  // Legacy Gemini request for backward compatibility
  const makeGeminiRequest = api.gemini.generate.useMutation({
    onSuccess: async (data) => {
      await utils.invalidate();
      console.log(data);
      const ai_responses = data.response.candidates;
      if (!ai_responses || !ai_responses[0]) return;
      const ai_response = ai_responses[0].content?.parts?.[0]?.text || "";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: ai_response,
        sender: "model",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Add a function to get the user's local time information
  const getUserTimeInfo = () => {
    const now = new Date();
    
    // Format the date in user's local timezone
    const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    // Format the time with timezone offset included
    const localTimeWithOffset = now.toISOString();
    
    // Get timezone name
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Get formatted local time for display (e.g., "10:41 PM")
    const localTimeFormatted = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    });
    
    return {
      date: localDate,
      time: localTimeWithOffset,
      timezone: timezone,
      localTime: localTimeFormatted
    };
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Create a new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Use the calendar chat mutation instead of the general Gemini one
    // Convert messages to the format expected by the Gemini model
    let history = [];

    // Only send history if there are previous exchanges
    if (messages.length > 2) {
      history = messages.slice(1).map((msg) => ({
        role: msg.sender,
        parts: [{ text: msg.content }],
      }));
    }

    // Get the user's local time information
    const timeInfo = getUserTimeInfo();

    calendarChatMutation.mutate({
      message: input,
      history: history,
      userTimeInfo: timeInfo, // Pass the user's time info to the server
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddToCalendar = (suggestion: Suggestion) => {
    // Use the calendarFunctionCall to add the event
    setIsLoading(true);

    // Format the event data for the calendar API
    const startDateTime = suggestion.date.toISOString();
    const endDateTime = new Date(
      suggestion.date.getTime() + suggestion.duration * 60000,
    ).toISOString();

    // Call the direct function endpoint
    api.gemini.calendarFunctionCall.mutate(
      {
        functionName: "createCalendarEvent",
        args: {
          summary: suggestion.title,
          description: suggestion.description,
          startDateTime,
          endDateTime,
        },
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            // Remove the suggestion
            setSuggestions((prev) =>
              prev.filter((s) => s.id !== suggestion.id),
            );

            // Add confirmation message
            const confirmationMessage: Message = {
              id: Date.now().toString(),
              content: `Event "${suggestion.title}" has been added to your calendar.`,
              sender: "model",
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, confirmationMessage]);
          } else {
            toast({
              title: "Error",
              description: result.error || "Failed to add event to calendar",
              variant: "destructive",
            });
          }
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error adding event to calendar:", error);
          toast({
            title: "Error",
            description: "Failed to add event to calendar",
            variant: "destructive",
          });
          setIsLoading(false);
        },
      },
    );
  };

  const generateSuggestions = (userInput: string): Suggestion[] => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (
      userInput.toLowerCase().includes("goal") &&
      userInput.toLowerCase().includes("learn")
    ) {
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
      ];
    } else if (
      userInput.toLowerCase().includes("hobby") &&
      userInput.toLowerCase().includes("read")
    ) {
      return [
        {
          id: "s3",
          title: "Reading Time",
          description: "Quiet time to enjoy your book",
          date: new Date(today.setHours(20, 0, 0, 0)),
          duration: 30,
        },
      ];
    } else {
      return [
        {
          id: "s4",
          title: "Planning Session",
          description: "Review and plan your goals",
          date: new Date(today.setHours(9, 0, 0, 0)),
          duration: 30,
        },
      ];
    }
  };

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Chat with your Calendar</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-16rem)] px-4">
          <div className="space-y-4 pt-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"></div>
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="my-4 space-y-2">
                <div className="text-sm font-medium">Suggested Events:</div>
                {suggestions.map((suggestion) => (
                  <EventSuggestion
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAddToCalendar={() => handleAddToCalendar(suggestion)}
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
          disabled={isLoading}
        />
        <Button size="icon" onClick={handleSendMessage} disabled={isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
