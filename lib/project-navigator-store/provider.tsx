"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useChats } from "@/lib/chat-store/chats/provider"

interface ProjectNavigatorContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggleNavigator: () => void
  width: number
  setWidth: (width: number) => void
  selectedVMId: string | null
  setSelectedVMId: (vmId: string | null) => void
}

const ProjectNavigatorContext = createContext<ProjectNavigatorContextType | undefined>(undefined)

export function ProjectNavigatorProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedVMId, setSelectedVMId] = useState<string | null>(null)
  const [width, setWidth] = useState(() => {
    // Load saved width from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('project-navigator-width')
      return saved ? parseInt(saved, 10) : 50
    }
    return 50
  })
  const { chatId } = useChatSession()
  const { getChatById } = useChats()
  
  // Auto-open navigator when entering a collaborative room/project
  useEffect(() => {
    if (chatId) {
      const chat = getChatById(chatId)
      if (chat?.collaborative) {
        setIsOpen(true)
      }
    }
  }, [chatId, getChatById])

  const toggleNavigator = () => {
    setIsOpen(prev => !prev)
  }

  // Save width to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('project-navigator-width', width.toString())
    }
  }, [width])

  return (
    <ProjectNavigatorContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      toggleNavigator, 
      width, 
      setWidth,
      selectedVMId,
      setSelectedVMId
    }}>
      {children}
    </ProjectNavigatorContext.Provider>
  )
}

export function useProjectNavigator() {
  const context = useContext(ProjectNavigatorContext)
  if (!context) {
    throw new Error("useProjectNavigator must be used within ProjectNavigatorProvider")
  }
  return context
}