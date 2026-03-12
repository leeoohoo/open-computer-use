"use client"

import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CircleNotch, Cpu, Memory, HardDrives, Lightning, Plus } from "@phosphor-icons/react"
import { MacMiniIcon } from "@/components/icons/mac-mini"
import { cn } from "@/lib/utils"
import type { UserMachine } from "@/types/machines.types"
import { CreateMachineDialog } from "@/app/components/machines/create-machine-dialog"

interface VMSelectorProps {
  selectedVMId: string | null
  setSelectedVMId: (vmId: string | null) => void
  isUserAuthenticated: boolean
  className?: string
}

type DisplayStatus = UserMachine['status'] | 'initiating'

function getStatusStyles(status: DisplayStatus) {
  switch (status) {
    case 'running':
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-500/20'
      }
    case 'creating':
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-700 dark:text-yellow-400',
        border: 'border-yellow-500/20'
      }
    case 'starting':
    case 'initiating':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/20'
      }
    case 'stopping':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/20'
      }
    case 'stopped':
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        border: 'border-gray-500/20'
      }
    case 'error':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-500/20'
      }
    case 'deleting':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-500/20'
      }
    default:
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        border: 'border-gray-500/20'
      }
  }
}

function getStatusText(status: DisplayStatus) {
  switch (status) {
    case 'running':
      return 'Running'
    case 'creating':
      return 'Creating'
    case 'starting':
      return 'Starting'
    case 'initiating':
      return 'Initiating Agent'
    case 'stopping':
      return 'Stopping'
    case 'stopped':
      return 'Stopped'
    case 'error':
      return 'Error'
    case 'deleting':
      return 'Deleting'
    default:
      return 'Unknown'
  }
}

export function VMSelector({
  selectedVMId,
  setSelectedVMId,
  isUserAuthenticated,
  className,
}: VMSelectorProps) {
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [allMachines, setAllMachines] = useState<UserMachine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [agentReady, setAgentReady] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isUserAuthenticated) {
      fetchMachines()

      // Set up polling for creating/starting machines
      const interval = setInterval(() => {
        fetchMachines()
      }, 10000) // Poll every 10 seconds

      setPollInterval(interval)

      return () => {
        if (interval) {
          clearInterval(interval)
        }
      }
    }
  }, [isUserAuthenticated])

  // Check agent health for selected running machine
  useEffect(() => {
    if (!selectedVMId || selectedVMId === "none") return

    const machine = allMachines.find(m => m.id === selectedVMId)
    if (!machine || machine.status !== "running") return

    const checkAgentHealth = async () => {
      try {
        const res = await fetch(`/api/machines/${selectedVMId}/agent-health`)
        if (res.ok) {
          const data = await res.json()
          setAgentReady(prev => ({ ...prev, [selectedVMId]: data.agentReady }))
        }
      } catch {
        // On network error, assume not ready
        setAgentReady(prev => ({ ...prev, [selectedVMId]: false }))
      }
    }

    checkAgentHealth()

    // Poll health every 5 seconds while agent isn't ready
    const isReady = agentReady[selectedVMId]
    if (!isReady) {
      const healthInterval = setInterval(checkAgentHealth, 5000)
      return () => clearInterval(healthInterval)
    }
  }, [selectedVMId, allMachines, agentReady[selectedVMId ?? ""]])

  const fetchMachines = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/machines")

      if (response.ok) {
        const data = await response.json()
        // Store all machines for display (excluding Electron/local — they can't run cloud agents)
        const cloudMachines = data.machines.filter(
          (m: UserMachine) => m.settings?.provider !== 'electron' && !m.settings?.isLocal
        )
        setAllMachines(cloudMachines)
        // Show running, creating, starting, and stopped machines for selection
        const selectableMachines = cloudMachines.filter(
          (m: UserMachine) => m.status === "running" || m.status === "creating" || m.status === "starting" || m.status === "stopped"
        )
        setMachines(selectableMachines)
      }
    } catch (error) {
      console.error("Failed to fetch machines:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get the display status for a machine — overrides "running" to "initiating" when agent isn't ready
  const getDisplayStatus = (machine: UserMachine): DisplayStatus => {
    if (machine.status === "running" && agentReady[machine.id] === false) {
      return 'initiating'
    }
    return machine.status
  }

  if (!isUserAuthenticated) {
    return null
  }

  const handleValueChange = (value: string) => {
    if (value === "create") {
      setShowCreateDialog(true)
    } else {
      setSelectedVMId(value === "none" ? null : value)
    }
  }

  return (
    <>
    <Select
      value={selectedVMId || "none"}
      onValueChange={handleValueChange}
    >
      <SelectTrigger
        id="vm-selector-button"
        className={cn(
          "h-9 w-full max-w-[140px] sm:min-w-[240px] sm:max-w-[320px] text-xs bg-gray-200 hover:bg-gray-300 dark:bg-accent/90 dark:hover:bg-accent/70 transition-colors border border-gray-300 dark:border-0",
          className
        )}
      >
        {isLoading ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin" />
        ) : selectedVMId && selectedVMId !== "none" ? (
          (() => {
            const selectedMachine = machines.find(m => m.id === selectedVMId) || 
                                   allMachines.find(m => m.id === selectedVMId);
            return (
              <div className="flex items-center gap-1 sm:gap-2 truncate">
                <MacMiniIcon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-[60px] sm:max-w-none">
                  {selectedMachine?.displayName || "Unknown VM"}
                </span>
                <span className="hidden sm:flex">
                  {(() => {
                    const displayStatus = selectedMachine ? getDisplayStatus(selectedMachine) : 'stopped';
                    const styles = getStatusStyles(displayStatus);
                    return (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border",
                        styles.bg,
                        styles.text,
                        styles.border
                      )}>
                        {getStatusText(displayStatus)}
                      </span>
                    );
                  })()}
                </span>
              </div>
            );
          })()
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <MacMiniIcon className="h-5 w-5 opacity-50 shrink-0" />
            <span className="hidden sm:inline">Select a Computer</span>
            <span className="sm:hidden text-[11px]">Select</span>
            <span className="hidden sm:inline-flex px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
              Required
            </span>
          </div>
        )}
      </SelectTrigger>
      <SelectContent className="w-[calc(100vw-2rem)] sm:min-w-[280px] sm:max-w-[360px]">
        <SelectItem value="create" id="create-machine-button" className="py-2 mb-1 bg-primary/5 hover:bg-primary/10">
          <div className="flex items-center gap-2 w-full">
            <Plus className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-primary">Create Machine</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 bg-primary text-primary-foreground">
              New
            </span>
          </div>
        </SelectItem>
        {machines.map((machine) => (
          <SelectItem key={machine.id} value={machine.id} className="py-2">
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-2 w-full">
                <MacMiniIcon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium truncate flex-1">
                  {machine.displayName}
                  {machine.settings?.isLocal && (
                    <span className="ml-1 text-xs text-blue-500">🐳</span>
                  )}
                </span>
                {(() => {
                  const displayStatus = getDisplayStatus(machine);
                  const styles = getStatusStyles(displayStatus);
                  return (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border",
                      styles.bg,
                      styles.text,
                      styles.border
                    )}>
                      {getStatusText(displayStatus)}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3 ml-6 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  <span>{machine.cpuCores} vCPU</span>
                </div>
                <div className="flex items-center gap-1">
                  <Memory className="h-3 w-3" />
                  <span>{machine.memoryGb}GB RAM</span>
                </div>
                <div className="flex items-center gap-1">
                  <HardDrives className="h-3 w-3" />
                  <span>{machine.storageGb}GB</span>
                </div>
                {machine.gpuEnabled && (
                  <div className="flex items-center gap-1 text-primary">
                    <Lightning className="h-3 w-3" />
                    <span>GPU</span>
                  </div>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
        {machines.length === 0 && !isLoading && (
          <div className="py-3 px-3 text-xs text-muted-foreground text-center">
            <div className="space-y-1">
              <p>No computers available</p>
              <p className="text-[10px] opacity-70">Start one from the Machines tab to use it here</p>
            </div>
          </div>
        )}
      </SelectContent>
    </Select>
    
    <CreateMachineDialog
      open={showCreateDialog}
      onOpenChange={setShowCreateDialog}
      onMachineCreated={() => {
        fetchMachines()
        setShowCreateDialog(false)
      }}
    />
    </>
  )
}