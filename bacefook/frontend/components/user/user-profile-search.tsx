"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function UserProfileSearch({ initialUsername }: { initialUsername: string }) {
  const [username, setUsername] = useState(initialUsername || "user00001")
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (username) {
      router.push(`/user/${username}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex items-end gap-4 mb-6">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="profile-search">View Profile for:</Label>
        <Input id="profile-search" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <Button type="submit">Query</Button>
    </form>
  )
}
