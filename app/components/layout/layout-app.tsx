"use client"

import { useState, useEffect } from "react"
import { Header } from "@/app/components/layout/header"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { SparklesCore } from "@/components/ui/sparkles"
import { useTheme } from "next-themes"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { ProjectNavigator } from "@/app/components/project/project-navigator"
import { ProjectNavigatorProvider, useProjectNavigator } from "@/lib/project-navigator-store/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useChats } from "@/lib/chat-store/chats/provider"
import { cn } from "@/lib/utils"
import { ChatStreamingProvider } from "@/lib/chat-streaming-store/provider"
import dynamic from "next/dynamic"

// Sparkles background component - matching landing page style
function GridBackground() {
  const { theme } = useTheme()

  return (
    <div className="absolute inset-0 w-full h-full">
      <SparklesCore
        id="chat-sparkles"
        background="transparent"
        minSize={0.4}
        maxSize={1}
        particleDensity={6}
        className="w-full h-full"
        particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
      />
    </div>
  )
}


function LayoutContent({ children }: { children: React.ReactNode }) {
  const { preferences, isLoading } = useUserPreferences()
  const { isOpen: isNavigatorOpen, toggleNavigator, width: navigatorWidth } = useProjectNavigator()
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  const hasSidebar = preferences.layout === "sidebar"
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Check if current chat is a project (collaborative)
  const currentChat = chatId ? getChatById(chatId) : null
  const isProject = currentChat?.collaborative === true
  
  // Enable ProjectNavigator for all chats when there's an active chat
  const showProjectNavigator = !!chatId

  // Check if mobile
  useEffect(() => {
    setMounted(true)
    const checkMobile = () => {
      const mobile = window.innerWidth < 640
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // During hydration, always render the default layout to avoid mismatch
  // The layout will update after preferences are loaded
  return (
    <div className="relative bg-background flex h-dvh w-full overflow-hidden">
      {/* Grid background pattern */}
      <GridBackground />
      
      {mounted && hasSidebar && <AppSidebar />}
      <div 
        className="flex-1 flex transition-all duration-300"
        style={{
          marginRight: showProjectNavigator && isNavigatorOpen && !isMobile ? `${navigatorWidth}%` : 0
        }}
      >
        <main className="@container relative h-dvh w-full">
          <Header 
            hasSidebar={hasSidebar} 
          />
          <div className="relative pt-[var(--spacing-app-header,56px)] h-full overflow-hidden scrollbar-invisible">
            {children}
          </div>
        </main>
      </div>
      
      {/* Project Navigator - show for all active chats */}
      {showProjectNavigator && (
        <ProjectNavigator isOpen={isNavigatorOpen} onToggle={toggleNavigator} disableAutoOpen={true} />
      )}
    </div>
  )
}

import { SidebarProvider } from "@/components/ui/sidebar"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <MessagesProvider>
        <ChatStreamingProvider>
          <ProjectNavigatorProvider>
            <LayoutContent>{children}</LayoutContent>
          </ProjectNavigatorProvider>
        </ChatStreamingProvider>
      </MessagesProvider>
    </SidebarProvider>
  )
}
