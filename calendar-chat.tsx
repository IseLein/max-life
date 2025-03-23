"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Send, Clock, CalendarIcon, MapPin, X } from "lucide-react"
import { EventSuggestion } from "~/components/event-suggestion"
import { api } from "~/trpc/react"

// Gemini API Configuration
const GEMINI_API_KEY = "PRIVATE_API" // Replace with your actual Gemini API key

// Example personality descriptions
const EXAMPLE_PERSONALITIES = [
  "Friendly and warm helper who uses emojis frequently",
  "Professional and efficient assistant focused on time management",
  "Motivational coach who encourages and inspires planning",
  "Witty helper with a good sense of humor",
  "Minimalist who values simplicity and clarity"
]

type Message = {
  id: string
  content: string
  sender: "user" | "model"
  timestamp: Date
}

type Suggestion = {
  id: string
  title: string
  description: string
  date: Date
  duration: number
  location?: string
}

type CalendarEvent = {
  id: string
  summary: string
  location?: string
  description?: string
  start: {
    dateTime: string
  }
  end?: {
    dateTime: string
  }
}

type GeminiHistoryItem = {
  role: "user" | "model"
  parts: { text: string }[]
}

export function CalendarChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [selectedOption, setSelectedOption] = useState(EXAMPLE_PERSONALITIES[0])
  const [activePersonality, setActivePersonality] = useState(selectedOption)
  const [customPersonality, setCustomPersonality] = useState("")
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [greetingGenerated, setGreetingGenerated] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  const utils = api.useUtils()
  const makeGeminiRequest = api.gemini.generate.useMutation({
    onMutate: (variables) => {
      // Log the exact data being sent to the API
      console.log("Sending request to Gemini API:", variables);
    },
    onSuccess: async (data) => {
      await utils.invalidate()
      
      // Detailed logging of the successful response
      console.log("Gemini API response successful:", data)
      
      // More robust handling logic to accommodate various response structures
      let ai_response = ""
      
      try {
        // Check if response exists and handle different structures
        if (data && data.response) {
          // Structure 1: Google Gemini API format
          if (data.response.candidates && data.response.candidates[0]?.content?.parts) {
            ai_response = data.response.candidates[0].content.parts
              .filter(part => part.text)
              .map(part => part.text)
              .join("\n")
          } 
          // Structure 2: Simple text response
          else if (typeof data.response === 'string') {
            ai_response = data.response
          }
          // Structure 3: Direct response text field
          else if (data.response.text) {
            ai_response = data.response.text
          }
          // Structure 4: Other possible response formats
          else if (data.response.result) {
            ai_response = typeof data.response.result === 'string' 
              ? data.response.result 
              : JSON.stringify(data.response.result)
          }
        }
      } catch (error) {
        console.error("Error processing response:", error)
      }
      
      // Display error message if response is empty
      if (!ai_response) {
        ai_response = "Sorry, there was a problem processing the response. Please try again."
      }
      
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: ai_response,
        sender: "model",
        timestamp: new Date(),
      }
    
      // Add AI message to conversation
      setMessages(prev => [...prev, aiMessage])
      
      // Extract event suggestions
      extractEventSuggestions(ai_response)
      
      setIsLoading(false)
    },
    onError: (error) => {
      // Enhanced error logging
      console.error("API call failed with error:", error);
      
      // Get detailed error information
      let errorDetails = "";
      if (error.message) {
        errorDetails += ` Message: ${error.message}.`;
      }
      if (error.cause) {
        errorDetails += ` Cause: ${JSON.stringify(error.cause)}.`;
      }
      if (error.data) {
        errorDetails += ` Data: ${JSON.stringify(error.data)}.`;
      }
      
      console.error("Detailed error information:", errorDetails);
      
      // Check specific error types
      if (error.message?.includes("API key")) {
        // API key related errors
        const keyErrorMessage = {
          id: (Date.now() + 1).toString(),
          content: "There seems to be an issue with the API key. Please check your configuration.",
          sender: "model",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, keyErrorMessage])
      } else {
        // General error message
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          content: "Sorry, an error occurred while processing your request. Please try again. (Error: " + 
                   (error.message || "Unknown error") + ")",
          sender: "model",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
      
      setIsLoading(false)
    }
  })

  // Separated JSON extraction and event suggestion parsing
  const extractEventSuggestions = (response) => {
    try {
      // First, try to extract JSON from markdown code blocks
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
      const codeBlockMatch = codeBlockRegex.exec(response);
      
      let jsonData = null;
      
      if (codeBlockMatch && codeBlockMatch[1]) {
        // Try to parse the content inside code blocks
        try {
          console.log("Found JSON in code block:", codeBlockMatch[1]);
          jsonData = JSON.parse(codeBlockMatch[1]);
        } catch (e) {
          console.warn("Failed to parse JSON from code block:", e);
        }
      }
      
      // If code block extraction failed, try the original method as fallback
      if (!jsonData) {
        // Original regex: looking for standalone JSON objects
        const jsonRegex = /\{[\s\S]*?\}(?=\s*$|\s*[\r\n])/g;
        const matches = response.match(jsonRegex);
        
        if (matches && matches.length > 0) {
          try {
            jsonData = JSON.parse(matches[matches.length - 1]);
            console.log("Found JSON using original regex:", jsonData);
          } catch (e) {
            console.warn("Failed to parse JSON using original regex:", e);
          }
        }
      }
      
      // Process the JSON data if found
      if (jsonData && jsonData.events && Array.isArray(jsonData.events)) {
        console.log("Successfully extracted events:", jsonData.events.length);
        
        const newSuggestions = jsonData.events.map((event, index) => {
          // More strict date handling
          let eventDate;
          try {
            // Try ISO format
            if (event.date && event.time) {
              eventDate = new Date(`${event.date}T${event.time}`);
            } else if (event.dateTime) {
              eventDate = new Date(event.dateTime);
            } else {
              // Default to current date
              eventDate = new Date();
              eventDate.setHours(eventDate.getHours() + 1);
              // Set time to the nearest hour
              eventDate.setMinutes(0);
              eventDate.setSeconds(0);
            }
            
            // Check if date is valid
            if (isNaN(eventDate.getTime())) {
              throw new Error("Invalid date");
            }
          } catch (e) {
            console.warn("Failed to parse date:", e);
            eventDate = new Date();
            eventDate.setHours(eventDate.getHours() + 1);
          }
          
          return {
            id: `suggestion-${Date.now()}-${index}`,
            title: event.title || "Untitled Event",
            description: event.description || "",
            date: eventDate,
            duration: event.duration || 60, // Default 1 hour
            location: event.location || ""
          };
        });
        
        if (newSuggestions.length > 0) {
          console.log("Setting new suggestions:", newSuggestions.length);
          setSuggestions(newSuggestions);
        }
      } else {
        console.warn("No valid events found in the response");
      }
    } catch (error) {
      console.error("Failed to extract events from AI response:", error);
    }
  }

  // Generate initial greeting
  useEffect(() => {
    if (!greetingGenerated) {
      const initialGreeting: Message = {
        id: Date.now().toString(),
        content: "Hello! I'm your AI calendar assistant. How can I help you today?",
        sender: "model",
        timestamp: new Date(),
      }
      
      setMessages([initialGreeting])
      setGreetingGenerated(true)
      
      // Load calendar events
      loadCalendarEvents()
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load calendar events function - improved error handling
  const loadCalendarEvents = () => {
    try {
      const savedEvents = localStorage.getItem("calendarEvents")
      if (savedEvents) {
        try {
          const parsedEvents = JSON.parse(savedEvents)
          if (Array.isArray(parsedEvents)) {
            setCalendarEvents(parsedEvents)
          } else {
            console.warn("Saved events is not an array, resetting")
            setCalendarEvents([])
          }
        } catch (e) {
          console.error("Error parsing saved calendar events:", e)
          setCalendarEvents([])
          // Remove corrupted data
          localStorage.removeItem("calendarEvents")
        }
      } else {
        setCalendarEvents([])
      }
    } catch (error) {
      console.error("Error loading calendar events:", error)
      setCalendarEvents([])
    }
  }

  // Save calendar events - added debounce
  useEffect(() => {
    if (calendarEvents.length > 0) {
      const saveTimeout = setTimeout(() => {
        try {
          localStorage.setItem("calendarEvents", JSON.stringify(calendarEvents))
        } catch (error) {
          console.error("Error saving calendar events:", error)
        }
      }, 300) // 300ms debounce
      
      return () => clearTimeout(saveTimeout)
    }
  }, [calendarEvents])

  // Handle personality change
  const handlePersonalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    
    if (value === "custom") {
      setIsCustomMode(true)
    } else {
      setIsCustomMode(false)
      setSelectedOption(value)
      
      if (value !== activePersonality) {
        setActivePersonality(value)
      }
    }
  }

  // Handle custom personality input
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setCustomPersonality(newValue)
  }

  // Handle custom personality keyboard input
  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      
      const newValue = customPersonality.trim()
      if (newValue && newValue !== activePersonality) {
        setActivePersonality(newValue)
        setIsCustomMode(false)
      }
    }
  }

  // Send message handler - optimized prompt
  const handleSendMessage = () => {
    if (!input.trim() || isLoading) return
  
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
  
    // Create a valid history array that always starts with a user message
    let history = [
      {
        role: "user",
        parts: [{ text: input }]
      }
    ];
    
    // Enhanced prompt with stronger emphasis on creating events
    const personalityPrompt = `You are an ${activePersonality} AI calendar assistant. 
      Today's date: ${new Date().toLocaleDateString()}

      Respond naturally and briefly (max 100 words).

      IMPORTANT: For ANY request that involves activities, routines, or schedules (study, exercise, work, leisure, etc.):

      1. Suggest a specific schedule with appropriate days, times, and durations
      2. VARY THE DURATIONS based on activity type and context
      3. ALWAYS include a properly formatted JSON object at the end with events
      4. The JSON must be inside a markdown code block with triple backticks and json syntax highlighting: \`\`\`json
      5. Make sure the JSON follows this exact structure:

      {
        "events": [
          {
            "title": "Event title",
            "description": "Event description",
            "date": "YYYY-MM-DD",
            "time": "HH:MM",
            "duration": minutes (number),
            "location": "location"
          }
        ]
      }

      Guidelines for different activities:
      - For studying: Consider focus periods (25-50 minutes) with short breaks
      - For exercise: Vary by intensity and type (20-60 minutes)
      - For work tasks: Consider appropriate time blocks based on complexity
      - For social/leisure: Schedule realistic durations
      - Include appropriate breaks and rest periods

      The user's request is: ${input}

      If this involves any type of routine, schedule, habit, or activity, create specific calendar events with appropriate and varied durations.`;

      // Use this in the handleSendMessage function
      const requestData = {
        prompt: personalityPrompt,
        history: history
      };
    
    console.log("Sending to API:", requestData);
    
    makeGeminiRequest.mutate(requestData);
  }

  // Handle input keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const exportToGoogleCalendar = (event) => {
    try {
      // Convert to Google Calendar URL format
      const startTime = new Date(event.start.dateTime);
      const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startTime.getTime() + (60 * 60 * 1000));
      
      // Convert date format (to UTC time)
      const formatForGoogle = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
      };
      
      const startTimeStr = formatForGoogle(startTime);
      const endTimeStr = formatForGoogle(endTime);
      
      // Set event details
      const details = encodeURIComponent(event.description || '');
      const location = encodeURIComponent(event.location || '');
      const title = encodeURIComponent(event.summary || 'Untitled Event');
      
      // Create Google Calendar URL
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTimeStr}/${endTimeStr}&details=${details}&location=${location}&sprop=&sprop=name:`;
      
      // Open in new window
      window.open(googleCalendarUrl, '_blank');
      
      // Update confirmation message
      const confirmationMsg = {
        id: Date.now().toString(),
        content: `Event "${event.summary}" has been added to your calendar and opened in Google Calendar. Please confirm and save it there.`,
        sender: "model",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, confirmationMsg]);
      
    } catch (error) {
      console.error("Error exporting to Google Calendar:", error);
      
      // Error message
      const errorMsg = {
        id: Date.now().toString(),
        content: `Sorry, there was a problem exporting to Google Calendar: ${error.message}`,
        sender: "model",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMsg]);
    }
  };
  
  // handleExportToGoogle function is kept as is (for manual export)
  const handleExportToGoogle = (event) => {
    exportToGoogleCalendar(event);
  };

  // Add event to calendar
  const handleAddToCalendar = (suggestionId) => {
    console.log("Adding event to calendar, ID:", suggestionId);
    console.log("Current suggestions:", suggestions);
    
    // Find the suggestion
    const suggestion = suggestions.find(s => s.id === suggestionId);
    
    if (!suggestion) {
      console.error("Suggestion not found with ID:", suggestionId);
      return;
    }
    
    console.log("Found suggestion to add:", suggestion);
    
    try {
      // Calculate end time
      const endTime = new Date(suggestion.date);
      endTime.setMinutes(endTime.getMinutes() + suggestion.duration);
      
      // Create new event object
      const newEvent = {
        id: `event_${Date.now()}`,
        summary: suggestion.title,
        description: suggestion.description,
        location: suggestion.location || "",
        start: {
          dateTime: suggestion.date.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        }
      };
      
      console.log("New calendar event created:", newEvent);
      
      // Update state (using functional update)
      setCalendarEvents(prevEvents => {
        const updatedEvents = [...prevEvents, newEvent];
        console.log("Updated calendar events:", updatedEvents);
        
        // Save to localStorage immediately
        try {
          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
          console.log("Events saved to localStorage");
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }
        
        return updatedEvents;
      });
      
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      
      // Confirmation message
      const confirmationMsg = {
        id: Date.now().toString(),
        content: `Adding event "${suggestion.title}" to your calendar and opening Google Calendar...`,
        sender: "model",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, confirmationMsg]);
      
      // Important change: Export to Google Calendar automatically
      setTimeout(() => {
        // Auto-export to Google Calendar
        exportToGoogleCalendar(newEvent);
      }, 500); // Small delay to allow UI to update first
      
    } catch (error) {
      console.error("Error adding event to calendar:", error);
      
      const errorMsg = {
        id: Date.now().toString(),
        content: `Sorry, there was a problem adding the event to your calendar: ${error.message}`,
        sender: "model",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const CalendarEvents = ({ events, onDelete }) => {
    if (!events || events.length === 0) {
      return (
        <div className="text-center p-4 text-sm text-muted-foreground">
          No events in your calendar yet.
        </div>
      );
    }
  
    // Group events by date
    const groupedEvents = events.reduce((groups, event) => {
      const startDate = event.start?.dateTime ? new Date(event.start.dateTime) : new Date();
      const dateKey = startDate.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
      return groups;
    }, {});
  
    // Convert date to display format
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
  
    // Convert time to display format
    const formatTime = (dateTimeString) => {
      const date = new Date(dateTimeString);
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    };
  
    // Sorted list of dates
    const sortedDates = Object.keys(groupedEvents).sort();
  
    return (
      <div className="space-y-4">
        <h3 className="text-base font-medium">Your Calendar Events</h3>
        {sortedDates.map(dateKey => (
          <div key={dateKey} className="bg-muted/50 rounded-md p-3">
            <h4 className="font-medium text-sm mb-2">{formatDate(dateKey)}</h4>
            <div className="space-y-2">
              {groupedEvents[dateKey].map(event => (
                <div key={event.id} className="bg-background rounded-md p-2 border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-sm">{event.summary}</h5>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                      <div className="flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatTime(event.start.dateTime)}
                          {event.end?.dateTime && ` - ${formatTime(event.end.dateTime)}`}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{event.location}</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => onDelete(event.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Event delete function
  const handleDeleteEvent = (eventId) => {
    console.log("Deleting event:", eventId);
    
    // Remove event from calendar
    setCalendarEvents(prev => {
      const updated = prev.filter(event => event.id !== eventId);
      console.log("Updated calendar after deletion:", updated);
      
      // Save to localStorage
      try {
        localStorage.setItem("calendarEvents", JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving to localStorage after deletion:", e);
      }
      
      return updated;
    });
    
    // Deletion confirmation message
    const confirmationMsg = {
      id: Date.now().toString(),
      content: "Event removed from your calendar.",
      sender: "model",
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, confirmationMsg]);
  };


  return (
    <Card className="h-full w-full">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>AI Calendar Chatbot</span>
          <div className="flex flex-col">
            <select 
              className="border rounded-md px-2 py-1 text-xs"
              value={isCustomMode ? "custom" : selectedOption}
              onChange={handlePersonalityChange}
            >
              {EXAMPLE_PERSONALITIES.map((personality, index) => (
                <option key={index} value={personality}>
                  {personality.length > 30 ? personality.substring(0, 27) + '...' : personality}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            
            {isCustomMode && (
              <Input
                placeholder="Describe the AI's personality..."
                value={customPersonality}
                onChange={handleCustomInputChange}
                onKeyDown={handleCustomKeyDown}
                className="text-xs mt-2"
              />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-0 pb-4 flex flex-col h-[calc(100%-3.5rem)]">
      <ScrollArea className="pr-4 flex-1 overflow-auto mb-4">
        <div className="space-y-4">
          {/* Message area */}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-lg px-3 py-2 max-w-[90%] ${
                  message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
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
          
          {/* Event suggestion area */}
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
          
          {/* Calendar events display area */}
          {calendarEvents.length > 0 && (
            <div className="space-y-2 my-4 border-t pt-4">
              <div className="text-sm font-medium flex justify-between items-center">
                <span>Your Calendar Events:</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => console.log("Debug: Calendar Events", calendarEvents)}
                  className="text-xs"
                >
                  Debug Events
                </Button>
              </div>
              {calendarEvents.map((event) => (
                <div key={event.id} className="bg-background rounded-md p-2 border border-border mb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-sm">{event.summary}</h5>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                      )}
                      <div className="flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {event.end?.dateTime && ` - ${new Date(event.end.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                        </span>
                      </div>
                      <div className="flex items-center mt-1">
                        <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.start.dateTime).toLocaleDateString()}
                        </span>
                      </div>
                      {event.location && (
                        <div className="flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{event.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => handleExportToGoogle(event)}
                      >
                        Export
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => {
                          console.log("Deleting event:", event.id);
                          setCalendarEvents(prev => {
                            const updated = prev.filter(e => e.id !== event.id);
                            // Save to localStorage immediately
                            localStorage.setItem("calendarEvents", JSON.stringify(updated));
                            return updated;
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
        <div className="flex w-full space-x-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={chatInputRef}
            className="flex-1"
            disabled={isLoading}
          />
          <Button size="icon" onClick={handleSendMessage} disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}