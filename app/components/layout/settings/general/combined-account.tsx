"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useUser } from "@/lib/user-store/provider"
import { SignOut } from "@phosphor-icons/react"
import { CoastyIcon } from "@/components/icons/coasty"
import { useRouter } from "next/navigation"
import { Building2, Globe, User, Check } from "lucide-react"
import { useState, useEffect } from "react"

export function CombinedAccount() {
  const { user, signOut, updateUser, isLoading } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()
  const router = useRouter()

  const [displayName, setDisplayName] = useState("")
  const [company, setCompany] = useState("")
  const [website, setWebsite] = useState("")
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "")
      setCompany(user.company || "")
      setWebsite(user.website || "")
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const changed =
      displayName !== (user.display_name || "") ||
      company !== (user.company || "") ||
      website !== (user.website || "")
    setHasChanges(changed)
  }, [displayName, company, website, user])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateUser({
        display_name: displayName.trim() || null,
        company: company.trim() || null,
        website: website.trim() || null,
      } as any)
      setHasChanges(false)
      toast({ title: "Profile updated", status: "success" })
    } catch {
      toast({ title: "Failed to update profile", status: "error" })
    } finally {
      setIsSaving(false)
    }
  }

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
        <div className="flex items-center space-x-4 mb-4">
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

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="account-name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
              <Input
                id="account-name"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 rounded-lg bg-background/50 pl-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-company" className="text-xs font-medium text-muted-foreground">
                Company
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
                <Input
                  id="account-company"
                  type="text"
                  placeholder="Your company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-9 rounded-lg bg-background/50 pl-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-website" className="text-xs font-medium text-muted-foreground">
                Website
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
                <Input
                  id="account-website"
                  type="text"
                  placeholder="yoursite.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="h-9 rounded-lg bg-background/50 pl-10 text-sm"
                />
              </div>
            </div>
          </div>

          {hasChanges && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="flex items-center gap-1.5"
              >
                <Check className="size-3.5" />
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          )}
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
