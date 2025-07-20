"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import Image from "next/image"
import { api, ApiError } from "@/lib/api"

export function Header() {
  const pathname = usePathname()
  const [totalUsers, setTotalUsers] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTotalUsers = async () => {
      try {
        const data = await api.getTotalUsers()
        setTotalUsers(data.totalUsers)
        setError(null)
      } catch (err) {
        console.error("Failed to fetch total users:", err)
        setError(err instanceof ApiError ? err.message : "Failed to load user count")
        // Fallback to a default value
        setTotalUsers(0)
      }
    }

    // Initial fetch
    fetchTotalUsers()

    // Set up interval to fetch every 5 seconds
    const interval = setInterval(fetchTotalUsers, 5000)

    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [])

  const navLinks = [
    { href: "/", label: "Analytics" },
    { href: "/user/user00001", label: "User Profile" },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background border-b flex items-center justify-between px-6 md:px-8">
      <nav className="flex items-center gap-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/bacefook-logo.jpg"
            alt="Bacefook Logo"
            width={120}
            height={36}
            priority
            className="object-contain"
          />
        </Link>
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              asChild
              className={cn(
                "hover:bg-accent hover:text-accent-foreground",
                pathname === link.href ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </nav>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {totalUsers !== null ? (
          <>
            <Users className="h-4 w-4" />
            <span>Total Users: {totalUsers.toLocaleString()}</span>
          </>
        ) : error ? (
          <span className="text-red-500 text-xs">Failed to load user count</span>
        ) : (
          <div className="h-5 w-32 bg-muted rounded-md animate-pulse" />
        )}
      </div>
    </header>
  )
}
