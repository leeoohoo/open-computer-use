"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Desktop, CursorClick, CaretDown } from "@phosphor-icons/react"
import { Caveat } from "next/font/google"
import { cn } from "@/lib/utils"
import { CoastyIcon } from "@/components/icons/coasty"
import { QuickStartStepCard } from "./quick-start-step-card"
import { QuickStartExampleTasks } from "./quick-start-example-tasks"
import { CreateMachineDialog } from "@/app/components/machines/create-machine-dialog"
import type { UserMachine } from "@/types/machines.types"

const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["600"],
})

interface QuickStartGuideProps {
  userName?: string
  selectedVMId: string | null
  setSelectedVMId: (vmId: string | null) => void
  onFillInput: (text: string) => void
  isUserAuthenticated: boolean
}

export function QuickStartGuide({
  userName,
  selectedVMId,
  onFillInput,
  isUserAuthenticated,
}: QuickStartGuideProps) {
  const [machines, setMachines] = useState<UserMachine[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchMachines = useCallback(async () => {
    if (!isUserAuthenticated) return
    try {
      const response = await fetch("/api/machines")
      if (response.ok) {
        const data = await response.json()
        const cloudMachines = (data.machines || []).filter(
          (m: UserMachine) =>
            m.settings?.provider !== "electron" && !m.settings?.isLocal
        )
        setMachines(cloudMachines)
      }
    } catch {
      // Silently fail
    }
  }, [isUserAuthenticated])

  useEffect(() => {
    fetchMachines()
    const interval = setInterval(fetchMachines, 10000)
    return () => clearInterval(interval)
  }, [fetchMachines])

  const currentStep = useMemo(() => {
    if (machines.length === 0) return 0
    if (!selectedVMId) return 1
    return 2
  }, [machines.length, selectedVMId])

  const steps = [
    {
      title: "Create a machine",
      description: "Spin up a virtual computer for your AI agent.",
      icon: Desktop,
      action: {
        label: "Create",
        onClick: () => setShowCreateDialog(true),
      },
    },
    {
      title: "Select it",
      description: "Pick which machine to use below.",
      icon: CursorClick,
    },
    {
      title: "Make it work",
      description: "Tell the AI what to do.",
      customIcon: <CoastyIcon className="size-6" />,
    },
  ]

  return (
    <>
      <div className="mx-auto max-w-[36rem] w-full px-3 sm:px-4">
        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className={cn(
            "text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1",
            handwriting.className
          )}
        >
          <span className="text-primary/90">
            {userName ? `Hello, ${userName}!` : "Welcome!"}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-center text-xs sm:text-sm text-muted-foreground/60 mb-6 sm:mb-8"
        >
          Get started in three steps
        </motion.p>

        {/* Steps — horizontal row with connecting lines */}
        <div className="relative flex items-start justify-center gap-2 sm:gap-0 mb-8 px-2 sm:px-4">
          {/* Connecting line behind step indicators — hidden on tiny screens where cards are tight */}
          <div className="hidden sm:block absolute top-4 left-1/2 -translate-x-1/2 w-[55%] h-px bg-border/60" />

          {steps.map((step, index) => (
            <QuickStartStepCard
              key={index}
              stepNumber={index + 1}
              title={step.title}
              description={step.description}
              icon={"icon" in step ? step.icon : undefined}
              customIcon={"customIcon" in step ? step.customIcon : undefined}
              isActive={currentStep === index}
              isCompleted={currentStep > index}
              isDisabled={currentStep < index}
              index={index}
              action={"action" in step ? step.action : undefined}
            />
          ))}
        </div>

        {/* Contextual hint for step 2 */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="hint-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center mb-4 sm:mb-6"
            >
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1 text-xs text-muted-foreground/50"
              >
                <CaretDown className="w-3 h-3" weight="bold" />
                <span>Use the selector below</span>
              </motion.div>
            </motion.div>
          )}

          {/* Example tasks for step 3 */}
          {currentStep === 2 && (
            <motion.div key="tasks" className="mb-4 sm:mb-6">
              <QuickStartExampleTasks
                onSelectTask={onFillInput}
                isDisabled={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateMachineDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onMachineCreated={fetchMachines}
      />
    </>
  )
}
