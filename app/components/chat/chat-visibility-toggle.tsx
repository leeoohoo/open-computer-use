"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Copy, Check, Globe, Lock, ShareNetwork, TwitterLogo, LinkedinLogo, FacebookLogo, WhatsappLogo, TelegramLogo, RedditLogo } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ChatVisibilityToggleProps {
  chatId: string
  initialPublic?: boolean
  onVisibilityChange?: (isPublic: boolean, shareUrl?: string) => void
}

export function ChatVisibilityToggle({ 
  chatId, 
  initialPublic = false,
  onVisibilityChange 
}: ChatVisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(initialPublic)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [chatTitle, setChatTitle] = useState<string>("")
  const [isCopied, setIsCopied] = useState(false)

  // Fetch initial status when component mounts
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          setIsPublic(data.chat.public || false)
          setShareUrl(data.chat.shareUrl)
          setChatTitle(data.chat.title || "")
        }
      } catch (error) {
        console.error("Failed to fetch initial visibility status:", error)
      }
    }
    
    fetchStatus()
  }, [chatId])

  const handleToggleVisibility = async (newPublicState: boolean) => {
    try {
      setIsLoading(true)
      
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrf_token="))
        ?.split("=")[1]
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf || "",
        },
        body: JSON.stringify({ public: newPublicState }),
      })

      if (!response.ok) {
        throw new Error("Failed to update chat visibility")
      }

      const data = await response.json()
      setIsPublic(newPublicState)
      setShareUrl(data.shareUrl)
      
      if (onVisibilityChange) {
        onVisibilityChange(newPublicState, data.shareUrl)
      }

      toast({
        title: newPublicState ? "Chat is now public!" : "Chat is now private",
        description: newPublicState
          ? "Nice, anyone with the link can see it now."
          : "Back to private, just for your eyes.",
        status: "success",
      })
    } catch (error) {
      toast({
        title: "Failed to update visibility",
        description: error instanceof Error ? error.message : "An error occurred",
        status: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setIsCopied(true)
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
        status: "success",
      })
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    }
  }

  const shareToSocial = (platform: string) => {
    if (!shareUrl) return

    // Create a more specific share message for coasty
    const baseText = chatTitle
      ? `"${chatTitle}" on Coasty`
      : "Check out what I got Coasty to do"

    const text = `${baseText}. I just told an AI what I wanted and it went and did the whole thing on a real computer. No copy pasting, no hand holding.`
    
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedText = encodeURIComponent(text)

    const shareUrls: { [key: string]: string } = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`
    }

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }
  }

  // Fetch current status when dialog opens
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open)
    
    if (open) {
      try {
        const response = await fetch(`/api/chats/${chatId}`)
        if (response.ok) {
          const data = await response.json()
          setIsPublic(data.chat.public)
          setShareUrl(data.chat.shareUrl)
          setChatTitle(data.chat.title || "")
        }
      } catch (error) {
        console.error("Failed to fetch visibility status:", error)
      }
    } else {
      // Reset copied state when dialog closes
      setIsCopied(false)
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full px-3 py-1.5 h-8 font-medium transition-all duration-200 border",
              isPublic
                ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/16 border-blue-500/20 dark:border-blue-400/20 shadow-[0_0_8px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_0_8px_-2px_rgba(96,165,250,0.12)]"
                : "text-foreground bg-foreground/[0.04] hover:bg-foreground/[0.08] border-foreground/10 hover:border-foreground/15 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:border-white/10"
            )}
            onClick={() => handleOpenChange(true)}
          >
            <ShareNetwork className="size-3.5" weight={isPublic ? "fill" : "regular"} />
            <span className="ml-1.5 text-sm">Share</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isPublic ? "Manage sharing" : "Share this chat"}
        </TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Share this session</DialogTitle>
            <DialogDescription className="text-base">
              {isPublic
                ? "Your session is live. Anyone with the link can check it out."
                : "Make this session public so others can see what you built."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between space-x-2 p-3 rounded-lg bg-muted/50">
              <Label htmlFor="public-toggle" className="flex items-center gap-2 cursor-pointer">
                {isPublic ? (
                  <>
                    <Globe size={20} className="text-green-600" />
                    <span className="font-medium">Public Mode ON</span>
                  </>
                ) : (
                  <>
                    <Lock size={20} className="text-orange-600" />
                    <span className="font-medium">Private Mode</span>
                  </>
                )}
              </Label>
              <Switch
                id="public-toggle"
                checked={isPublic}
                onCheckedChange={handleToggleVisibility}
                disabled={isLoading}
                className="data-[state=checked]:bg-green-600"
              />
            </div>

            <p className="text-sm text-muted-foreground px-1">
              {isPublic
                ? "Anyone with the link can see everything that happened in this session."
                : "This session is private right now. Flip the switch to let others see it."}
            </p>

            {isPublic && shareUrl && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-url">Share link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="share-url"
                      value={shareUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={copyShareUrl}
                      className={cn(
                        "transition-all duration-200",
                        isCopied 
                          ? "bg-green-50 text-green-600 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800" 
                          : "hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:hover:bg-green-950 dark:hover:text-green-400 dark:hover:border-green-800"
                      )}
                      disabled={isCopied}
                    >
                      {isCopied ? (
                        <Check size={16} className="animate-in zoom-in duration-200" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Spread the word</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('twitter')}
                      className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                    >
                      <TwitterLogo size={18} className="mr-2" />
                      X
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('linkedin')}
                      className="hover:bg-blue-700 hover:text-white hover:border-blue-700"
                    >
                      <LinkedinLogo size={18} className="mr-2" />
                      LinkedIn
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('facebook')}
                      className="hover:bg-blue-600 hover:text-white hover:border-blue-600"
                    >
                      <FacebookLogo size={18} className="mr-2" />
                      Facebook
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('whatsapp')}
                      className="hover:bg-green-500 hover:text-white hover:border-green-500"
                    >
                      <WhatsappLogo size={18} className="mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('telegram')}
                      className="hover:bg-sky-500 hover:text-white hover:border-sky-500"
                    >
                      <TelegramLogo size={18} className="mr-2" />
                      Telegram
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('reddit')}
                      className="hover:bg-orange-500 hover:text-white hover:border-orange-500"
                    >
                      <RedditLogo size={18} className="mr-2" />
                      Reddit
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">
              {isPublic ? "Done" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}