const API_BASE_URL = "http://localhost:3000"

export interface NetworkEdge {
  from: string
  to: string
  type: "Referred" | "Friend"
}

export interface LeaderboardEntry {
  name: string
  value: number
}

export interface LeaderboardData {
  startTimestamp: string
  endTimestamp: string
  referralPoints: LeaderboardEntry[]
  networkStrength: LeaderboardEntry[]
}

export interface TopFriend {
  name: string
  strength: number
}

export interface User {
  _id: string
  name: string
  createdAt: string
  friends: string[]
  friendsCount: number
  lastSeq: number
  referralPoints: number
  referrals: string[]
  referralsCount: number
  referredBy: string | null
}

export interface PaginatedFriends {
  page: number
  pageSize: number
  total: number
  results: User[]
}

export interface SnapshotData {
  firstSnapshotTime: string
  lastSnapshotTime: string
}

export interface TotalUsersData {
  totalUsers: number
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)

    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.ok) {
      throw new ApiError(data.code || 500, data.message || "API request failed")
    }

    return data.data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(500, `Network error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export const api = {
  // Analytics endpoints
  getNetworkConnections: (username: string): Promise<NetworkEdge[]> =>
    apiRequest(`/analytics/network?username=${encodeURIComponent(username)}`),

  getLeaderboard: (start: string, end: string, count = 10): Promise<LeaderboardData> =>
    apiRequest(
      `/analytics/leaderboard?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&count=${count}`,
    ),

  // Meta endpoints
  getSnapshots: (): Promise<SnapshotData> => apiRequest("/meta/snapshots"),

  getTotalUsers: (): Promise<TotalUsersData> => apiRequest("/meta/users"),

  // Users endpoints
  getTopFriends: (username: string): Promise<TopFriend[]> =>
    apiRequest(`/users/${encodeURIComponent(username)}/top-friends`),

  getFriends: (username: string, page = 1, pageSize = 10): Promise<PaginatedFriends> =>
    apiRequest(`/users/${encodeURIComponent(username)}/friends?page=${page}&pageSize=${pageSize}`),
}
