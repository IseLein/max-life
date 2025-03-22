"use client"

import Link from "next/link"
import { Button } from "./ui/button";

export function LoginButton({ loggedIn, className = "" }: { loggedIn: boolean; className?: string }) {
  return (
    <Link className="cursor-pointer" href={loggedIn ? "/api/auth/signout" : "/api/auth/signin"}>
      <Button className={className}>{loggedIn ? "Sign out" : "Sign in"}</Button>
    </Link>
  )
}