"use client"

import { motion } from "motion/react"
import { ArrowRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface QuickStartExampleTasksProps {
  onSelectTask: (task: string) => void
  isDisabled: boolean
}

const exampleTasks = [
  "Build a Bloomberg terminal with live market data",
  "Browse Wikipedia and answer a question",
]

export function QuickStartExampleTasks({
  onSelectTask,
  isDisabled,
}: QuickStartExampleTasksProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-wrap justify-center gap-1.5 sm:gap-2 px-2 sm:px-0"
    >
      {exampleTasks.map((task, index) => (
        <motion.button
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * index, duration: 0.3 }}
          onClick={() => !isDisabled && onSelectTask(task)}
          disabled={isDisabled}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 sm:px-3.5 sm:py-1.5",
            "text-[11px] sm:text-xs text-muted-foreground/80 transition-all duration-200 text-left",
            isDisabled
              ? "opacity-30 cursor-not-allowed"
              : "hover:text-foreground hover:border-foreground/20 hover:bg-foreground/[0.03] active:scale-[0.98] cursor-pointer"
          )}
        >
          <span className="line-clamp-2 sm:line-clamp-1">{task}</span>
          {!isDisabled && (
            <ArrowRight
              className="w-3 h-3 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200"
              weight="bold"
            />
          )}
        </motion.button>
      ))}
    </motion.div>
  )
}
