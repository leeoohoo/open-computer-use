"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback, useRef } from "react"

interface CollaborativeRoom {
  id: string
  title: string
  collaborative: boolean
  max_participants: number
  invite_code: string
  room_settings: any
  chat_participants: Array<{
    id: string
    user_id: string
    role: "owner" | "moderator" | "participant"
    joined_at: string
    last_active_at: string
    users: {
      display_name: string | null
      profile_image: string | null
      email: string
    }
  }>
}

interface UseCollaborativeRoomProps {
  roomId: string
  userId: string
}

export function useCollaborativeRoom({ roomId, userId }: UseCollaborativeRoomProps) {
  const [room, setRoom] = useState<CollaborativeRoom | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Refs to prevent duplicate subscriptions and optimize updates
  const subscriptionsRef = useRef<{ participants?: any; activities?: any }>({})
  const lastFetchRef = useRef<Date | null>(null)
  const isRefreshingRef = useRef(false)

  const supabase = createClient()

  // Optimized fetch with debouncing
  const fetchRoom = useCallback(async (force = false) => {
    const now = new Date()
    
    // Prevent excessive API calls (debounce for 1 second)
    if (!force && lastFetchRef.current && (now.getTime() - lastFetchRef.current.getTime()) < 1000) {
      return
    }
    
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    lastFetchRef.current = now

    try {
      const response = await fetch(`/api/collaborative-rooms/${roomId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch room details")
      }
      
      const data = await response.json()
      
      if (data.room) {
        setRoom(prevRoom => {
          // Only update if data actually changed to prevent unnecessary rerenders
          if (JSON.stringify(prevRoom) !== JSON.stringify(data.room)) {
            return data.room
          }
          return prevRoom
        })
      }
    } catch (err) {
      // Error fetching room
      setError(err instanceof Error ? err.message : "Failed to fetch room")
    } finally {
      setIsLoading(false)
      isRefreshingRef.current = false
    }
  }, [roomId])

  // Update user activity
  const updateActivity = useCallback(async (activityType: "viewing" | "joined" | "left") => {
    try {
      await fetch(`/api/collaborative-rooms/${roomId}/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityType,
        }),
      })
    } catch (error) {
      // Error updating activity
    }
  }, [roomId])

  // Remove user activity
  const removeActivity = useCallback(async (activityType: "viewing" | "joined" | "left") => {
    try {
      await fetch(`/api/collaborative-rooms/${roomId}/activity`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityType,
        }),
      })
    } catch (error) {
      // Error removing activity
    }
  }, [roomId])

  // Get current user's role in the room
  const getCurrentUserRole = useCallback(() => {
    if (!room) return "participant"
    const participant = room.chat_participants.find(p => p.user_id === userId)
    return participant?.role || "participant"
  }, [room, userId])

  // Check if current user is owner or moderator
  const canModerateRoom = useCallback(() => {
    const role = getCurrentUserRole()
    return ["owner", "moderator"].includes(role)
  }, [getCurrentUserRole])

  // Set up real-time subscriptions (ONLY for participants and activities, NOT messages)
  useEffect(() => {
    if (!roomId || !userId || !supabase) return

    // Initial fetch
    fetchRoom(true)

    // Create consistent channel names (same for all users in the room)
    const participantsChannelName = `room-${roomId}-participants`
    const activitiesChannelName = `room-${roomId}-activities`

    // Clean up existing subscriptions
    if (subscriptionsRef.current.participants) {
      supabase.removeChannel(subscriptionsRef.current.participants)
    }
    if (subscriptionsRef.current.activities) {
      supabase.removeChannel(subscriptionsRef.current.activities)
    }

    // Set up real-time subscription for participants
    const participantsChannel = supabase
      .channel(participantsChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_participants",
          filter: `chat_id=eq.${roomId}`,
        },
        (payload: any) => {
          // Participant change detected
          // Use a small delay to batch multiple rapid changes
          setTimeout(() => fetchRoom(), 100)
        }
      )
      .subscribe((status: any) => {
        // Participants subscription status changed
        setIsConnected(status === "SUBSCRIBED")
        if (status === "SUBSCRIBED") {
          // User subscribed to participants channel
        }
      })

    // Set up real-time subscription for activities
    const activitiesChannel = supabase
      .channel(activitiesChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_activity",
          filter: `chat_id=eq.${roomId}`,
        },
        (payload: any) => {
          // Activity change detected
          // Activities are handled by the ParticipantsList component
          // Small delay to batch updates
          setTimeout(() => fetchRoom(), 50)
        }
      )
      .subscribe((status: any) => {
        // Activities subscription status changed
        if (status === "SUBSCRIBED") {
          // User subscribed to activities channel
        }
      })

    // Store subscription references (removed messages subscription)
    subscriptionsRef.current = {
      participants: participantsChannel,
      activities: activitiesChannel,
    }

    // Update viewing activity when component mounts
    updateActivity("viewing")

    // Cleanup function
    return () => {
      // Cleaning up subscriptions
      if (supabase) {
        supabase.removeChannel(participantsChannel)
        supabase.removeChannel(activitiesChannel)
      }
      subscriptionsRef.current = {}
    }
  }, [roomId, userId, supabase, fetchRoom, updateActivity])

  // Update activity on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity("viewing")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [updateActivity])

  // Periodic refresh to ensure consistency (fallback)
  useEffect(() => {
    if (!roomId || !userId) return

    const interval = setInterval(() => {
      // Check if we're still connected
      if (!isConnected) {
        // Lost connection, attempting reconnection
        fetchRoom(true)
      } else {
        fetchRoom()
      }
    }, 30000) // Refresh every 30 seconds as fallback

    return () => clearInterval(interval)
  }, [roomId, userId, fetchRoom, isConnected])

  return {
    room,
    isLoading,
    error,
    isConnected,
    updateActivity,
    removeActivity,
    getCurrentUserRole,
    canModerateRoom,
    fetchRoom: () => fetchRoom(true),
  }
} 