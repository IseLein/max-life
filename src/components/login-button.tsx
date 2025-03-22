"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function LoginButton({ className = "" }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setIsLoading(true)
    // In a real app, this would authenticate with Google
    // and request calendar permissions
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1000)
  }

  return (
    <Button onClick={handleLogin} className={className} disabled={isLoading}>
      {isLoading ? "Connecting..." : "Sign in with Google"}
    </Button>
  )
}