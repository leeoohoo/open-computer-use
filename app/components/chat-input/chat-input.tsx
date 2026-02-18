"use client"

import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { VMSelector } from "@/components/common/vm-selector/vm-selector"
import { ArrowUpIcon, StopIcon, WarningCircle, CircleNotch, Desktop } from "@phosphor-icons/react"
import { useCallback, useMemo, useState, useEffect } from "react"
import { PromptSystem } from "../suggestions/prompt-system"
import { AnimatePresence, motion } from "motion/react"
import type { UserMachine } from "@/types/machines.types"
import { themeConfig } from "@/lib/theme-config"
// File upload imports
import { ButtonVMFileUpload } from "./button-vm-file-upload"
import { FileList } from "./file-list"

type ChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  hasMessages?: boolean
  // File upload props
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  onSuggestion: (suggestion: string) => void
  hasSuggestions?: boolean
  selectedVMId: string | null
  setSelectedVMId: (vmId: string | null) => void
  isUserAuthenticated: boolean
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
  onAuthRequired: () => void
}

// Fun startup messages
const startupMessages = [
  // Tech & Geeky
  "Booting up the silicon brain",
  "Awakening the digital consciousness",
  "Initializing neural pathways",
  "Spinning up the quantum cores",
  "Charging the flux capacitor",
  "Activating the mainframe",
  "Powering the computational matrix",
  "Engaging warp drive",
  "Summoning the silicon spirits",
  "Firing up the electron engine",
  "Warming up the transistors",
  "Assembling the bits and bytes",
  "Calibrating the digital synapses",
  "Energizing the CPU crystals",
  "Loading the consciousness protocols",
  
  // Formal & Professional
  "Initializing system resources",
  "Preparing computational environment",
  "Establishing secure connection",
  "Provisioning virtual resources",
  "Configuring system parameters",
  "Launching virtual instance",
  "Activating remote desktop",
  "Deploying cloud resources",
  "Initiating system startup sequence",
  "Preparing execution environment",
  
  // Playful & Fun
  "Waking up the sleepy computer",
  "Poking the digital bear",
  "Brewing some computational coffee",
  "Stretching the digital muscles",
  "Opening the digital eyes",
  "Turning on the think machine",
  "Revving up the brain engine",
  "Unleashing the silicon beast",
  "Summoning your digital assistant",
  "Calling your virtual buddy",
  "Rousing the electronic friend",
  "Tickling the circuits awake",
  "Giving life to the machine",
  "Breathing life into silicon",
  "Sparking the digital flame",
  
  // Space & Sci-Fi
  "Launching the cyber rocket",
  "Igniting the plasma cores",
  "Activating the hyperdrive",
  "Powering the photon processors",
  "Engaging the stellar engine",
  "Charging the antimatter cells",
  "Initializing the holodeck",
  "Booting the starship computer",
  "Activating artificial gravity",
  "Establishing subspace link",
  
  // Magic & Fantasy
  "Casting the startup spell",
  "Summoning the digital daemon",
  "Awakening the silicon oracle",
  "Channeling the electric mana",
  "Invoking the binary spirits",
  "Opening the portal to cyberspace",
  "Enchanting the circuits",
  "Conjuring computational power",
  "Releasing the digital genie",
  "Unlocking the techno-grimoire",
  
  // Nature & Organic
  "Germinating the digital seed",
  "Blooming the silicon flower",
  "Hatching the cyber egg",
  "Growing the computational tree",
  "Nurturing the electric garden",
  "Cultivating processing power",
  "Sprouting digital neurons",
  "Photosynthesizing the data streams",
  
  // Mechanical & Industrial
  "Cranking the digital engine",
  "Oiling the virtual gears",
  "Stoking the computational furnace",
  "Priming the data pumps",
  "Spinning the turbines",
  "Engaging the pistons",
  "Lubricating the logic gates",
  "Tightening the digital bolts",
  "Revving the silicon motor",
  "Igniting the cyber forge",
  
  // Cooking & Kitchen
  "Preheating the digital oven",
  "Marinating the data packets",
  "Seasoning the algorithms",
  "Simmering the code soup",
  "Baking the binary bread",
  "Grilling the graphics card",
  "Stirring the pixel pot",
  "Microwaving the memories",
  
  // Music & Audio
  "Tuning the digital orchestra",
  "Composing the startup symphony",
  "Amplifying the silicon signals",
  "Harmonizing the frequencies",
  "Conducting the electron choir",
  "Playing the boot sequence ballad",
  "Drumming up processing power",
  "Strumming the fiber optic strings",
  
  // Simple & Direct
  "Starting up",
  "Powering on",
  "Coming online",
  "Booting system",
  "Getting ready",
  "Almost there",
  "Preparing workspace",
  "Loading resources",
  "System rising"
]


// Beautiful VM status bar component
function VMStatusBar({ isVisible, machineName, status }: { isVisible: boolean; machineName?: string; status?: string }) {
  const [messageIndex, setMessageIndex] = useState(() => 
    Math.floor(Math.random() * startupMessages.length)
  )
  
  useEffect(() => {
    if (!isVisible) return
    
    // Change message every 2 seconds
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % startupMessages.length)
    }, 2000)
    
    return () => clearInterval(interval)
  }, [isVisible])
  
  if (!isVisible) return null
  
  const getStatusMessage = () => {
    switch (status) {
      case "creating":
        return `Creating ${machineName || "computer"}...`
      case "starting":
      case "stopped": // When stopped but starting
        return `${startupMessages[messageIndex]}...`
      case "stopping":
        return `Stopping ${machineName || "computer"}...`
      default:
        return `Preparing ${machineName || "computer"}...`
    }
  }
  
  const getStatusColor = () => {
    switch (status) {
      case "creating":
        return `bg-${themeConfig.primary.tw.bg.medium} dark:bg-${themeConfig.primary.tw.bg.strong} text-${themeConfig.primary.tw.dark} dark:text-purple-300`
      case "starting":
        return "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
      case "stopped":
        return "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
      case "stopping":
        return "bg-orange-500/10 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300"
      default:
        return "bg-gray-500/10 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300"
    }
  }
  
  const getIconColor = () => {
    switch (status) {
      case "creating":
        return themeConfig.primary.tw.text.base
      case "starting":
        return "text-blue-600 dark:text-blue-400"
      case "stopped":
        return "text-blue-600 dark:text-blue-400"
      case "stopping":
        return "text-orange-600 dark:text-orange-400"
      default:
        return "text-gray-600 dark:text-gray-400"
    }
  }
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="absolute -top-12 left-0 right-0 z-40"
        >
          <div className="mx-auto max-w-fit">
            <div className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-full shadow-lg ${getStatusColor()}`}>
              <CircleNotch className={`h-4 w-4 animate-spin ${getIconColor()}`} />
              <span className="text-sm font-medium">
                {getStatusMessage()}
              </span>
              <Desktop className={`h-4 w-4 ${getIconColor()}`} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Beautiful VM error dialog component (for other error states)
function VMErrorDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative max-w-md w-full bg-background rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping">
                  <WarningCircle className="h-16 w-16 text-red-500/30" />
                </div>
                <WarningCircle className="h-16 w-16 text-red-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Virtual Machine Error</h3>
                <p className="text-sm text-muted-foreground">
                  The virtual machine is in an error state or is being deleted.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Please check the <span className="font-medium">Machines</span> tab to resolve the issue, or select <span className="font-medium">"No Computer Selected"</span> to use web search only.
                </p>
              </div>
              
              <Button
                onClick={onClose}
                className="mt-2 w-full"
                variant="outline"
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  // File upload props
  files,
  onFileUpload,
  onFileRemove,
  onSuggestion,
  hasSuggestions,
  selectedVMId,
  setSelectedVMId,
  isUserAuthenticated,
  stop,
  status,
  onAuthRequired,
}: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const [machineStatus, setMachineStatus] = useState<UserMachine['status'] | null>(null)
  const [machineName, setMachineName] = useState<string | null>(null)
  const [showVMError, setShowVMError] = useState(false)
  const [showVMStatusBar, setShowVMStatusBar] = useState(false)
  const [currentMachine, setCurrentMachine] = useState<UserMachine | null>(null)
  
  // Fetch machine status when VM is selected
  useEffect(() => {
    if (selectedVMId && selectedVMId !== "none" && isUserAuthenticated) {
      const fetchMachineStatus = async () => {
        try {
          const response = await fetch("/api/machines")
          if (response.ok) {
            const data = await response.json()
            const machine = data.machines.find((m: UserMachine) => m.id === selectedVMId)
            if (machine) {
              setMachineStatus(machine.status)
              setMachineName(machine.displayName)
              setCurrentMachine(machine)
              
              // Show status bar for creating, starting, or stopped (being started) states
              if (machine.status === "creating" || machine.status === "starting") {
                setShowVMStatusBar(true)
              } else if (machine.status === "running") {
                setShowVMStatusBar(false)
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch machine status:", error)
        }
      }
      
      fetchMachineStatus()
      // Poll for status updates every 3 seconds when showing status bar, 10 seconds otherwise
      const interval = setInterval(fetchMachineStatus, showVMStatusBar ? 3000 : 10000)
      return () => clearInterval(interval)
    } else {
      setMachineStatus(null)
      setMachineName(null)
      setCurrentMachine(null)
      setShowVMStatusBar(false)
    }
  }, [selectedVMId, isUserAuthenticated, showVMStatusBar])
  

  // Start VM if it's stopped
  const startVMIfNeeded = async (): Promise<boolean> => {
    if (!selectedVMId || selectedVMId === "none") {
      return false // A machine must be selected to send messages
    }
    
    // If machine status hasn't been loaded yet, wait a moment and fetch it
    if (machineStatus === null) {
      console.log("Machine status not loaded yet, fetching...")
      try {
        const response = await fetch("/api/machines")
        if (response.ok) {
          const data = await response.json()
          const machine = data.machines.find((m: UserMachine) => m.id === selectedVMId)
          if (machine) {
            setMachineStatus(machine.status)
            setMachineName(machine.displayName)
            // Recursively call with the updated status
            return startVMIfNeeded()
          }
        }
      } catch (error) {
        console.error("Failed to fetch machine status:", error)
      }
      return true // Allow proceeding if we can't determine status
    }
    
    console.log(`VM Status Check - ID: ${selectedVMId}, Status: ${machineStatus}`)
    
    if (machineStatus === "running") {
      return true // VM is already running
    }
    
    if (machineStatus === "creating") {
      setShowVMStatusBar(true)
      return false // VM is being created, don't allow message to be sent
    }
    
    if (machineStatus === "starting") {
      setShowVMStatusBar(true)
      return true // VM is already starting, allow message to be sent
    }
    
    if (machineStatus === "stopped") {
      // Start the VM
      console.log(`Attempting to start VM ${selectedVMId}`)
      setShowVMStatusBar(true)
      try {
        const requestBody = JSON.stringify({ action: "start" })
        console.log(`Sending request body: ${requestBody}`)
        
        const response = await fetch(`/api/machines/${selectedVMId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: requestBody
        })
        
        console.log(`Start VM response status: ${response.status}`)
        
        if (response.ok) {
          // VM start initiated, the polling will update the status
          console.log("VM start initiated successfully")
          // Update the local status to starting immediately
          setMachineStatus("starting")
          return true // Allow the message to be sent
        } else {
          let errorMessage = "Failed to start VM"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If response is not JSON, try text
            try {
              errorMessage = await response.text() || errorMessage
            } catch {}
          }
          console.error(`Failed to start VM - Status: ${response.status}, Error: ${errorMessage}`)
          setShowVMStatusBar(false)
          // Don't show error dialog for temporary failures, just prevent sending
          return false
        }
      } catch (error) {
        console.error("Failed to start VM - Network error:", error)
        setShowVMStatusBar(false)
        // Don't show error dialog for network issues, just prevent sending
        return false
      }
    }
    
    if (machineStatus === "stopping") {
      // VM is stopping, wait for it to complete then it will be in stopped state
      setShowVMStatusBar(true)
      return false // Don't allow sending while stopping
    }
    
    // Only show error for truly problematic states
    if (machineStatus === "error" || machineStatus === "deleting") {
      setShowVMError(true)
      return false
    }
    
    // For any other state, allow proceeding
    return true
  }

  // Typing participants removed - no longer collaborative
  const typingParticipants = []

  const handleSend = useCallback(async () => {
    // Allow stopping even if isSubmitting is true
    if (status === "streaming") {
      stop()
      return
    }
    
    if (isSubmitting) {
      return
    }

    // Check authentication before allowing send
    if (!isUserAuthenticated) {
      onAuthRequired()
      return
    }
    
    // Start VM if needed and validate
    const canProceed = await startVMIfNeeded()
    if (!canProceed) {
      return
    }

    // Send message - VM ID is already being sent through use-chat-core
    onSend()

  }, [isSubmitting, onSend, status, stop, isUserAuthenticated, onAuthRequired, selectedVMId, machineStatus, startVMIfNeeded])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitting) {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        
        // If streaming, stop the stream
        if (status === "streaming") {
          stop()
          return
        }
        
        // Otherwise, check if we can send a new message
        if (isOnlyWhitespace(value)) {
          return
        }
        
        // Check authentication before allowing send via Enter key
        if (!isUserAuthenticated) {
          onAuthRequired()
          return
        }
        
        // Don't allow sending without a machine selected or if VM is creating
        if (!selectedVMId || selectedVMId === "none" || machineStatus === "creating") {
          return
        }
        
        // Handle send with async function
        handleSend()
      }
    },
    [isSubmitting, status, value, isUserAuthenticated, onAuthRequired, handleSend, stop, selectedVMId, machineStatus]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      // File upload feature - only when VM is selected
      const items = e.clipboardData?.items
      if (!items) return

      const hasImageContent = Array.from(items).some((item) =>
        item.type.startsWith("image/")
      )

      // Only allow image paste when authenticated and VM is selected
      if (!isUserAuthenticated || !selectedVMId || selectedVMId === "none") {
        if (hasImageContent) {
          e.preventDefault()
        }
        return
      }

      if (hasImageContent) {
        const imageFiles: File[] = []

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              const newFile = new File(
                [file],
                `pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
                { type: file.type }
              )
              imageFiles.push(newFile)
            }
          }
        }

        if (imageFiles.length > 0) {
          onFileUpload(imageFiles)
        }
      }
      // Text pasting will work by default for everyone
    },
    [isUserAuthenticated, onFileUpload, selectedVMId]
  )

  return (
    <>
      <VMErrorDialog isOpen={showVMError} onClose={() => setShowVMError(false)} />
      <div className="relative flex w-full flex-col gap-4">
        <VMStatusBar isVisible={showVMStatusBar} machineName={machineName || undefined} status={machineStatus || undefined} />
      {hasSuggestions && (
        <PromptSystem
          onValueChange={onValueChange}
          onSuggestion={onSuggestion}
          value={value}
        />
      )}
      
      {/* Typing indicators for collaborative rooms - will be implemented with real-time data */}

      <div className="relative order-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput
            className="relative shadow-xl hover:shadow-2xl focus-within:shadow-2xl focus-within:ring-0 !border-0 [&>*]:border-0 transition-all duration-300 z-10 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-border/50"
            maxHeight={200}
            value={value}
            onValueChange={onValueChange}
          >
          {/* File list - only show when VM is selected */}
          {selectedVMId && selectedVMId !== "none" && (
            <FileList files={files} onFileRemove={onFileRemove} />
          )}
          <PromptInputTextarea
            placeholder={
              selectedVMId && selectedVMId !== "none"
                ? "What should your AI worker do?"
                : "Tell your AI what to do on the computer..."
            }
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="min-h-[44px] pt-3 px-4 text-base leading-[1.3] sm:text-base md:text-base"
          />
          <PromptInputActions className="mt-5 w-full justify-between px-2 sm:px-3 pb-3">
            <div className="flex gap-1 sm:gap-2 overflow-hidden">
              <VMSelector
                selectedVMId={selectedVMId}
                setSelectedVMId={setSelectedVMId}
                isUserAuthenticated={isUserAuthenticated}
                className="h-9 min-w-0 flex-shrink"
              />
              {/* File upload feature - only show when VM is selected */}
              {selectedVMId && selectedVMId !== "none" && (
                <ButtonVMFileUpload
                  onFileUpload={onFileUpload}
                  isUserAuthenticated={isUserAuthenticated}
                  vmName={machineName || undefined}
                />
              )}
            </div>
            <PromptInputAction
              tooltip={
                status === "streaming" ? "Stop" :
                (!selectedVMId || selectedVMId === "none") ? "Select a computer to send messages" :
                (machineStatus === "creating") ? "Please wait for VM to be created" :
                "Send"
              }
            >
              <Button
                size="sm"
                className="size-9 rounded-full transition-all duration-300 ease-out"
                disabled={status === "streaming" ? false : (!!(!value || isSubmitting || isOnlyWhitespace(value) || !selectedVMId || selectedVMId === "none" || machineStatus === "creating"))}
                type="button"
                onClick={handleSend}
                aria-label={status === "streaming" ? "Stop" : "Send message"}
              >
                {status === "streaming" ? (
                  <StopIcon className="size-4" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
      </div>
    </>
  )
}
