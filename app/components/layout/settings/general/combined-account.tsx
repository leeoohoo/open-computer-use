"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useUser } from "@/lib/user-store/provider"
import { SignOut } from "@phosphor-icons/react"
import { CoastyIcon } from "@/components/icons/coasty"
import { useRouter } from "next/navigation"

export function CombinedAccount() {
  const { user, signOut } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await resetMessages()
      await resetChats()
      await signOut()
      await clearAllIndexedDBStores()
      router.push("/")
    } catch (e) {
      console.error("Sign out failed:", e)
      toast({ title: "Failed to sign out", status: "error" })
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Profile</h3>
        <div className="flex items-center space-x-4">
          <div className="bg-muted flex items-center justify-center overflow-hidden rounded-full">
            {user?.profile_image ? (
              <Avatar className="size-12">
                <AvatarImage src={user.profile_image} className="object-cover" />
                <AvatarFallback className="bg-transparent"><CoastyIcon className="size-6 text-primary" /></AvatarFallback>
              </Avatar>
            ) : (
              <CoastyIcon className="size-8 text-primary" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium">{user?.display_name}</h4>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Account Management Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Account Management</h3>
          <p className="text-muted-foreground text-xs">Log out on this device</p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleSignOut}
        >
          <SignOut className="size-4" />
          <span>Sign out</span>
        </Button>
      </div>
    </div>
  )
}