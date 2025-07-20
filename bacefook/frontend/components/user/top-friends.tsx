"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, type TopFriend } from "@/lib/api"

export function TopFriends({ username }: { username: string }) {
  const [isLoading, setIsLoading] = useState(true)
  const [friends, setFriends] = useState<TopFriend[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTopFriends = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const topFriends = await api.getTopFriends(username)
        setFriends(topFriends)
      } catch (err) {
        console.error("Failed to fetch top friends:", err)
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError("User not found.")
          } else {
            setError(`Error ${err.status}: ${err.message}`)
          }
        } else {
          setError("Failed to load top friends.")
        }
        setFriends([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTopFriends()
  }, [username])

  const renderSkeleton = () => (
    <ol className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <li key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          <Skeleton className="h-6 w-12 rounded-md" />
        </li>
      ))}
    </ol>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">Top 3 Influential Friends</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {isLoading ? (
          renderSkeleton()
        ) : friends.length > 0 ? (
          <ol className="space-y-4">
            {friends.map((friend, i) => (
              <li key={friend.name} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={`/abstract-geometric-shapes.png?height=40&width=40&query=${friend.name}`} />
                    <AvatarFallback>{friend.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{friend.name}</span>
                </div>
                <Badge className="bg-sky-100 text-sky-800 border-transparent hover:bg-sky-200">{friend.strength}</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-center py-4">No influential friends found.</p>
        )}
      </CardContent>
    </Card>
  )
}
