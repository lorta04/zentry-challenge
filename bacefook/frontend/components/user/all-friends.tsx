"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError, type PaginatedFriends } from "@/lib/api"

export function AllFriends({ username }: { username: string }) {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PaginatedFriends | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFriends = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const friendsData = await api.getFriends(username, page, 4)
        setData(friendsData)
      } catch (err) {
        console.error("Failed to fetch friends:", err)
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError("User not found.")
          } else if (err.status === 400) {
            setError("Invalid page parameters.")
          } else {
            setError(`Error ${err.status}: ${err.message}`)
          }
        } else {
          setError("Failed to load friends.")
        }
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFriends()
  }, [username, page])

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  const renderSkeleton = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-28 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">All Friends</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        <div className="min-h-[320px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-sky-50 hover:bg-sky-100/50">
                <TableHead>Name</TableHead>
                <TableHead>Friends Count</TableHead>
                <TableHead>Referrals Count</TableHead>
                <TableHead>Referral Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                renderSkeleton()
              ) : data && data.results.length > 0 ? (
                data.results.map((friend) => (
                  <TableRow key={friend._id}>
                    <TableCell>{friend.name}</TableCell>
                    <TableCell>{friend.friendsCount}</TableCell>
                    <TableCell>{friend.referralsCount}</TableCell>
                    <TableCell>{friend.referralPoints}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    This user has no friends yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {data && data.total > 0 && (
          <Pagination className="mt-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(Math.max(1, page - 1))
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === i + 1}
                    onClick={(e) => {
                      e.preventDefault()
                      setPage(i + 1)
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(Math.min(totalPages, page + 1))
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>
    </Card>
  )
}
