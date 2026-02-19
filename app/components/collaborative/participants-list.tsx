"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/toast"
import { UserIcon, CrownIcon, ShieldIcon, DotsThreeIcon } from "@phosphor-icons/react"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface Participant {
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
}

interface Activity {
  user_id: string
  activity_type: "viewing" | "joined" | "left"
  created_at: string
  expires_at: string
}

interface ParticipantsListProps {
  participants: Participant[]
  currentUserId: string
  currentUserRole: "owner" | "moderator" | "participant"
  roomId: string
  onRefresh?: () => void
}

export function ParticipantsList({
  participants,
  currentUserId,
  currentUserRole,
  roomId,
  onRefresh,
}: ParticipantsListProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  // Fetch current activities
  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/collaborative-rooms/${roomId}/activity`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      // Error fetching activities
    }
  }, [roomId])

  // Set up real-time subscription for activities
  useEffect(() => {
    if (!roomId || !supabase) return

    fetchActivities()

    const channel = supabase
      .channel(`activities-${roomId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_activity",
          filter: `chat_id=eq.${roomId}`,
        },
        (payload: any) => {
          // Activity update detected
          fetchActivities()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, currentUserId, supabase, fetchActivities])

  // Check if user is online (active in last 5 minutes)
  const isUserOnline = (participant: Participant) => {
    const lastActive = new Date(participant.last_active_at)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return lastActive > fiveMinutesAgo
  }

  const handleRemoveParticipant = async (participantId: string) => {
    if (currentUserRole !== "owner" && currentUserRole !== "moderator") {
      toast({ title: "Permission denied", status: "error" })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/collaborative-rooms/${roomId}/participants`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ participantId }),
      })

      if (response.ok) {
        toast({ title: "Participant removed", status: "success" })
        onRefresh?.()
      } else {
        throw new Error("Failed to remove participant")
      }
    } catch (error) {
      console.error("Error removing participant:", error)
      toast({ title: "Failed to remove participant", status: "error" })
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <CrownIcon className="h-4 w-4 text-amber-500" />
      case "moderator":
        return <ShieldIcon className="h-4 w-4 text-blue-500" />
      default:
        return <UserIcon className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "moderator":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Participants ({participants.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Participants list */}
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={participant.users.profile_image || undefined} />
                    <AvatarFallback className="text-xs">
                      {participant.users.display_name?.charAt(0) || 
                       participant.users.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online status indicator */}
                  {isUserOnline(participant) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {participant.users.display_name || participant.users.email}
                      {participant.user_id === currentUserId && " (You)"}
                    </p>
                    {getRoleIcon(participant.role)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getRoleBadgeColor(participant.role)}`}
                    >
                      {participant.role}
                    </Badge>
                    {isUserOnline(participant) && (
                      <span className="text-xs text-green-600 font-medium">Online</span>
                    )}
                  </div>
                </div>
              </div>
              {(currentUserRole === "owner" || currentUserRole === "moderator") && 
               participant.user_id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveParticipant(participant.id)}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <DotsThreeIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {participants.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No participants yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 