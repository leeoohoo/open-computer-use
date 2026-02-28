"use client"

import { motion } from "motion/react"
import { Check } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Icon as PhosphorIcon } from "@phosphor-icons/react"

interface QuickStartStepCardProps {
  stepNumber: number
  title: string
  description: string
  icon?: PhosphorIcon
  customIcon?: React.ReactNode
  isActive: boolean
  isCompleted: boolean
  isDisabled: boolean
  index: number
  action?: {
    label: string
    onClick: () => void
  }
}

export function QuickStartStepCard({
  stepNumber,
  title,
  description,
  icon: Icon,
  customIcon,
  isActive,
  isCompleted,
  isDisabled,
  index,
  action,
}: QuickStartStepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "group relative flex-1 min-w-0 cursor-default",
        isDisabled && "opacity-40 pointer-events-none"
      )}
    >
      {/* Vertical layout: number → icon → text */}
      <div className="flex flex-col items-center text-center gap-2 sm:gap-2.5">
        {/* Step indicator */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-medium transition-all duration-500",
            isCompleted
              ? "bg-muted text-foreground"
              : isActive
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground/60"
          )}
        >
          {isCompleted ? (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" weight="bold" />
            </motion.div>
          ) : (
            stepNumber
          )}
        </div>

        {/* Icon */}
        {customIcon ? (
          <div
            className={cn(
              "w-4 h-4 sm:w-5 sm:h-5 transition-opacity duration-300",
              isActive ? "opacity-100" : isCompleted ? "opacity-40" : "opacity-40"
            )}
          >
            {customIcon}
          </div>
        ) : Icon ? (
          <Icon
            className={cn(
              "w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-300",
              isActive
                ? "text-foreground"
                : isCompleted
                  ? "text-foreground/40"
                  : "text-muted-foreground/40"
            )}
            weight={isActive ? "duotone" : "regular"}
          />
        ) : null}

        {/* Title */}
        <h3
          className={cn(
            "text-[12px] sm:text-[13px] font-medium tracking-tight transition-colors duration-300",
            isActive ? "text-foreground" : "text-muted-foreground/60"
          )}
        >
          {title}
        </h3>

        {/* Description — only visible on active step */}
        {isActive && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-[11px] sm:text-xs text-muted-foreground/70 leading-relaxed max-w-[140px] sm:max-w-[200px]"
          >
            {description}
          </motion.p>
        )}

        {/* Action */}
        {action && isActive && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            onClick={action.onClick}
            className="mt-0.5 px-4 py-2 sm:py-1.5 text-xs font-medium rounded-full bg-foreground text-background hover:opacity-90 active:scale-95 transition-all"
          >
            {action.label}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
