"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CircleNotch, Cpu, Memory, HardDrives, Lightning, Plus, Desktop, Laptop, WifiHigh, WifiSlash } from "@phosphor-icons/react"
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

type DisplayStatus = UserMachine['status'] | 'initiating' | 'online' | 'offline'

function getStatusStyles(status: DisplayStatus) {
  switch (status) {
    case 'running':
    case 'online':
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
    case 'offline':
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        border: 'border-gray-500/20'
      }
    case 'error':
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
    case 'running': return 'Running'
    case 'online': return 'Online'
    case 'creating': return 'Creating'
    case 'starting': return 'Starting'
    case 'initiating': return 'Initiating Agent'
    case 'stopping': return 'Stopping'
    case 'stopped': return 'Stopped'
    case 'offline': return 'Offline'
    case 'error': return 'Error'
    case 'deleting': return 'Deleting'
    default: return 'Unknown'
  }
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const styles = getStatusStyles(status)
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 border",
      styles.bg, styles.text, styles.border
    )}>
      {getStatusText(status)}
    </span>
  )
}

function getPlatformIcon(platform?: string) {
  // Return appropriate icon based on platform
  switch (platform) {
    case 'darwin': return '🍎'
    case 'win32': return '🪟'
    case 'linux': return '🐧'
    default: return null
  }
}

export function VMSelector({
  selectedVMId,
  setSelectedVMId,
  isUserAuthenticated,
  className,
}: VMSelectorProps) {
  const [allMachines, setAllMachines] = useState<UserMachine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [agentReady, setAgentReady] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isUserAuthenticated) {
      fetchMachines()
      const interval = setInterval(fetchMachines, 10000)
      return () => clearInterval(interval)
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
        setAgentReady(prev => ({ ...prev, [selectedVMId]: false }))
      }
    }

    checkAgentHealth()

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
        setAllMachines(data.machines || [])
      }
    } catch (error) {
      console.error("Failed to fetch machines:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Split machines into Electron (Your Computers) and Cloud
  const { electronMachines, cloudMachines } = useMemo(() => {
    const electron: UserMachine[] = []
    const cloud: UserMachine[] = []

    for (const m of allMachines) {
      if (m.settings?.provider === 'electron') {
        electron.push(m)
      } else if (!m.settings?.isLocal || m.settings?.provider === 'docker') {
        // Show cloud + docker machines if they are in a selectable state
        if (['running', 'creating', 'starting', 'stopped'].includes(m.status)) {
          cloud.push(m)
        }
      }
    }

    return { electronMachines: electron, cloudMachines: cloud }
  }, [allMachines])

  const getDisplayStatus = (machine: UserMachine): DisplayStatus => {
    // Electron machines: show online/offline based on electronConnected flag
    if (machine.settings?.provider === 'electron') {
      return (machine as any).electronConnected ? 'online' : 'offline'
    }
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

  // Find selected machine across both lists
  const selectedMachine = allMachines.find(m => m.id === selectedVMId)
  const isElectronSelected = selectedMachine?.settings?.provider === 'electron'
  const hasAnyMachines = electronMachines.length > 0 || cloudMachines.length > 0

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
        ) : selectedVMId && selectedVMId !== "none" && selectedMachine ? (
          <div className="flex items-center gap-1 sm:gap-2 truncate">
            {isElectronSelected ? (
              <Laptop className="h-4 w-4 shrink-0" weight="duotone" />
            ) : (
              <MacMiniIcon className="h-5 w-5 shrink-0" />
            )}
            <span className="truncate max-w-[60px] sm:max-w-none">
              {selectedMachine.displayName}
            </span>
            <span className="hidden sm:flex">
              <StatusBadge status={getDisplayStatus(selectedMachine)} />
            </span>
          </div>
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

        {/* ── Cloud Machines ── */}
        <SelectGroup>
          {electronMachines.length > 0 && (
            <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5">
              <Desktop className="h-3.5 w-3.5" weight="duotone" />
              Cloud Machines
            </SelectLabel>
          )}
          <SelectItem value="create" id="create-machine-button" className="py-2 mb-1 bg-primary/5 hover:bg-primary/10">
            <div className="flex items-center gap-2 w-full">
              <Plus className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium text-primary">Create Machine</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 bg-primary text-primary-foreground">
                New
              </span>
            </div>
          </SelectItem>
          {cloudMachines.map((machine) => (
            <SelectItem key={machine.id} value={machine.id} className="py-2">
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-2 w-full">
                  <MacMiniIcon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {machine.displayName}
                    {machine.settings?.provider === 'docker' && (
                      <span className="ml-1 text-xs text-blue-500">🐳</span>
                    )}
                  </span>
                  <StatusBadge status={getDisplayStatus(machine)} />
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
        </SelectGroup>

        {/* ── Separator between sections ── */}
        {electronMachines.length > 0 && (
          <div className="my-1 border-t border-border/50" />
        )}

        {/* ── Your Computers (Electron) ── */}
        {electronMachines.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5">
              <Laptop className="h-3.5 w-3.5" weight="duotone" />
              Your Computers
            </SelectLabel>
            {electronMachines.map((machine) => {
              const displayStatus = getDisplayStatus(machine)
              const isOnline = displayStatus === 'online'
              const platformIcon = getPlatformIcon(machine.settings?.platform as string)
              return (
                <SelectItem
                  key={machine.id}
                  value={machine.id}
                  className="py-2"
                  disabled={!isOnline}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative shrink-0">
                      <Laptop className="h-5 w-5" weight="duotone" />
                      {isOnline ? (
                        <WifiHigh className="h-2.5 w-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" weight="bold" />
                      ) : (
                        <WifiSlash className="h-2.5 w-2.5 text-gray-400 absolute -bottom-0.5 -right-0.5" weight="bold" />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm font-medium truncate flex-1",
                      !isOnline && "text-muted-foreground"
                    )}>
                      {machine.displayName}
                      {platformIcon && (
                        <span className="ml-1 text-xs">{platformIcon}</span>
                      )}
                    </span>
                    <StatusBadge status={displayStatus} />
                  </div>
                </SelectItem>
              )
            })}
          </SelectGroup>
        )}

        {!hasAnyMachines && !isLoading && (
          <div className="py-3 px-3 text-xs text-muted-foreground text-center">
            <div className="space-y-1">
              <p>No computers available</p>
              <p className="text-[10px] opacity-70">Install the desktop app or create a cloud machine</p>
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
