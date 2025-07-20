"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, type LeaderboardData } from "@/lib/api"

// Utility functions for timezone conversion
const convertUTCToUTC7 = (utcDateString: string): string => {
  const utcDate = new Date(utcDateString)
  const utc7Date = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000) // Add 7 hours
  return utc7Date.toISOString().slice(0, 19) // Return YYYY-MM-DDTHH:mm:ss format
}

const convertUTC7ToUTC = (utc7DateString: string): string => {
  // Parse the datetime-local string as UTC+7 time
  const utc7Date = new Date(utc7DateString + "Z") // Add Z to treat as UTC
  const utcDate = new Date(utc7Date.getTime() - 7 * 60 * 60 * 1000) // Subtract 7 hours
  return utcDate.toISOString()
}

export function Leaderboards() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [dates, setDates] = useState({ start: "", end: "" })
  const [originalDates, setOriginalDates] = useState({ start: "", end: "" })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // First fetch snapshot dates
        const snapshotData = await api.getSnapshots()
        const startDateUTC7 = convertUTCToUTC7(snapshotData.firstSnapshotTime)
        const endDateUTC7 = convertUTCToUTC7(snapshotData.lastSnapshotTime)

        setDates({ start: startDateUTC7, end: endDateUTC7 })
        setOriginalDates({ start: startDateUTC7, end: endDateUTC7 })

        // Then fetch leaderboard data
        const leaderboardData = await api.getLeaderboard(snapshotData.firstSnapshotTime, snapshotData.lastSnapshotTime)
        setData(leaderboardData)
      } catch (err) {
        console.error("Failed to fetch initial data:", err)
        if (err instanceof ApiError) {
          setError(`Error ${err.status}: ${err.message}`)
        } else {
          setError("Failed to load leaderboard data. Please check if the API server is running.")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchInitialData()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dates.start || !dates.end) {
      setError("Please select both start and end dates")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const startUTC = convertUTC7ToUTC(dates.start)
      const endUTC = convertUTC7ToUTC(dates.end)

      const leaderboardData = await api.getLeaderboard(startUTC, endUTC)
      setData(leaderboardData)
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err)
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError("Invalid date range provided.")
        } else if (err.status === 404) {
          setError("No data found for the selected date range.")
        } else {
          setError(`Error ${err.status}: ${err.message}`)
        }
      } else {
        setError("Failed to update leaderboard data.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    setDates({ start: originalDates.start, end: originalDates.end })
    setError(null)

    // Automatically query with the original dates
    setIsLoading(true)

    try {
      const startUTC = convertUTC7ToUTC(originalDates.start)
      const endUTC = convertUTC7ToUTC(originalDates.end)

      const leaderboardData = await api.getLeaderboard(startUTC, endUTC)
      setData(leaderboardData)
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err)
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError("Invalid date range provided.")
        } else if (err.status === 404) {
          setError("No data found for the selected date range.")
        } else {
          setError(`Error ${err.status}: ${err.message}`)
        }
      } else {
        setError("Failed to update leaderboard data.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const renderSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-5 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-12 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">Leaderboards</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleUpdate} className="flex flex-wrap items-end gap-4 mb-6">
          <div className="grid items-center gap-1.5">
            <Label htmlFor="start-date">Start Date & Time (UTC+7)</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={dates.start}
              onChange={(e) => setDates({ ...dates, start: e.target.value })}
            />
          </div>
          <div className="grid items-center gap-1.5">
            <Label htmlFor="end-date">End Date & Time (UTC+7)</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={dates.end}
              onChange={(e) => setDates({ ...dates, end: e.target.value })}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update
          </Button>
          <Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
            Reset
          </Button>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-primary">Network Strength</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-sky-50 hover:bg-sky-100/50">
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Strength</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? renderSkeleton()
                  : data?.networkStrength.map((user, i) => (
                      <TableRow key={user.name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.value}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-primary">Referral Points</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-sky-50 hover:bg-sky-100/50">
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? renderSkeleton()
                  : data?.referralPoints.map((user, i) => (
                      <TableRow key={user.name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.value}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
