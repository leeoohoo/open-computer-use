"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Terminal,
  Globe,
  Monitor,
  Brain,
  ChevronRight,
  Trophy,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCheck,
  XCircle,
  SkipForward,
  FileText,
  BarChart3,
  Activity
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { MessageContent } from "@/components/prompt-kit/message"
import Image from "next/image"
import { useTheme } from "next-themes"

interface TaskData {
  task_id: string
  description: string
  assigned_agent: string
  expected_output: string
  status: string
  summary?: string
  error?: string
}

interface TaskPlanData {
  main_objective: string
  subtasks: TaskData[]
  created_at?: string
}

interface CoastyReport {
  title: string
  timestamp: string
  objective: string
  summary: {
    total_tasks: number
    completed: number
    failed: number
    skipped: number
    success_rate: number
    execution_time: number
  }
  tasks: Array<{
    task_id: string
    description: string
    status: 'completed' | 'failed' | 'skipped'
    agent: string
    summary?: string
    outcome?: string
    error?: string | null
    duration?: number
    execution_time?: number
  }>
  key_achievements: string[]
  issues_encountered: string[]
  recommendations?: string[]
  metadata?: {
    started_at?: string
    completed_at?: string
    report_version?: string
  }
}

interface TaskPlanFormatterProps {
  content: string
  className?: string
  isStreaming?: boolean
}

const agentIcons: Record<string, React.ReactNode> = {
  browser_agent: <Globe className="h-4 w-4" />,
  terminal_agent: <Terminal className="h-4 w-4" />,
  desktop_agent: <Monitor className="h-4 w-4" />,
  planner: <Brain className="h-4 w-4" />
}

const statusIcons = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  skipped: <Circle className="h-4 w-4 text-yellow-500" />
}

const statusColors = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-600",
  completed: "text-green-600",
  failed: "text-red-600",
  skipped: "text-yellow-600"
}

export function TaskPlanFormatter({ content, className, isStreaming = false }: TaskPlanFormatterProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [metadataExpanded, setMetadataExpanded] = useState(false)
  const { resolvedTheme } = useTheme()

  // Debug content changes
  useEffect(() => {
    if (content.includes('[Coasty_REPORT_END]')) {
      const reportEndIndex = content.lastIndexOf('[Coasty_REPORT_END]')
      const afterReportEnd = reportEndIndex + '[Coasty_REPORT_END]'.length
      const remainingContent = content.substring(afterReportEnd)
      console.log('[TaskPlanFormatter] Content update:', {
        hasReportEnd: true,
        contentAfterEnd: remainingContent.length,
        preview: remainingContent.substring(0, 200),
        isStreaming
      })
    }
  }, [content, isStreaming])

  // Parse the content to extract task plan, report, and status updates
  // Re-parse on every content change to catch streaming updates
  const { taskPlan, report, reportDetails, formattedContent, hasUpdates } = useMemo(() => {
    let plan: TaskPlanData | null = null
    let report: CoastyReport | null = null
    let cleanContent = content
    let updates: Record<string, { status?: string; summary?: string }> = {}
    
    // Extract Coasty report and everything after the START tag
    let reportDetails = ''
    const reportStartIndex = content.indexOf('[Coasty_REPORT_START]')

    if (reportStartIndex !== -1) {
      // Find the complete JSON report if END tag exists
      const reportMatch = content.match(/\[Coasty_REPORT_START\]([\s\S]*?)\[Coasty_REPORT_END\]/)

      if (reportMatch) {
        // We have a complete report with END tag
        try {
          report = JSON.parse(reportMatch[1])
          // Remove just the JSON markers from content
          cleanContent = cleanContent.replace(reportMatch[0], '')
        } catch (e) {
          console.error('Failed to parse Coasty report:', e)
        }
      }

      // Get everything after Coasty_REPORT_START (including the JSON and detailed report)
      // This will work even while streaming
      const afterStartTag = reportStartIndex + '[Coasty_REPORT_START]'.length
      let allContentAfterStart = content.substring(afterStartTag)

      // If we have the END tag, extract everything after it as the detailed report
      const endTagInRemaining = allContentAfterStart.indexOf('[Coasty_REPORT_END]')
      if (endTagInRemaining !== -1) {
        // Get content after the END tag
        const afterEndTag = endTagInRemaining + '[Coasty_REPORT_END]'.length
        reportDetails = allContentAfterStart.substring(afterEndTag).trim()
      } else if (isStreaming) {
        // While streaming and no END tag yet, show everything we have
        // Try multiple strategies to extract content

        // Strategy 1: Look for "## Detailed Report" or similar headers
        const detailedReportHeader = /##\s*Detailed Report|##\s*Summary|##\s*Analysis|##\s*Results/i
        const headerMatch = allContentAfterStart.search(detailedReportHeader)
        if (headerMatch !== -1) {
          reportDetails = allContentAfterStart.substring(headerMatch).trim()
        } else {
          // Strategy 2: Look for the end of a JSON object (likely the report JSON)
          // Find the last closing brace that might be the JSON end
          let braceCount = 0
          let jsonEndIndex = -1

          for (let i = 0; i < allContentAfterStart.length; i++) {
            if (allContentAfterStart[i] === '{') braceCount++
            if (allContentAfterStart[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                jsonEndIndex = i
                break
              }
            }
          }

          if (jsonEndIndex > 0 && jsonEndIndex < allContentAfterStart.length - 1) {
            // Show everything after the JSON object
            reportDetails = allContentAfterStart.substring(jsonEndIndex + 1).trim()
          } else {
            // Strategy 3: If we can't find JSON end, just show everything
            // This ensures content appears immediately
            reportDetails = allContentAfterStart.trim()
          }
        }
      }

      // Debug logging
      console.log('[TaskPlanFormatter] Report parsing:', {
        hasReport: !!report,
        reportDetailsLength: reportDetails.length,
        reportDetailsPreview: reportDetails.substring(0, 100),
        isStreaming
      })

      // Clean up the report details from clean content
      if (reportDetails.length > 0) {
        cleanContent = cleanContent.replace(reportDetails, '').trim()
      }
    }
    
    // Extract task plan
    const planMatch = content.match(/\[TASK_PLAN_START\]([\s\S]*?)\[TASK_PLAN_END\]/)
    if (planMatch) {
      try {
        plan = JSON.parse(planMatch[1])
        // Remove the task plan markers from content
        cleanContent = cleanContent.replace(planMatch[0], '')
      } catch (e) {
        console.error('Failed to parse task plan:', e)
      }
    }
    
    // Extract status updates
    const statusMatches = content.matchAll(/\[TASK_STATUS:([^:]+):([^\]]+)\]/g)
    for (const match of statusMatches) {
      const [fullMatch, taskId, status] = match
      if (!updates[taskId]) updates[taskId] = {}
      updates[taskId].status = status
      cleanContent = cleanContent.replace(fullMatch, '')
    }
    
    // Extract summary updates
    const summaryMatches = content.matchAll(/\[TASK_SUMMARY:([^:]+):([^\]]+)\]/g)
    for (const match of summaryMatches) {
      const [fullMatch, taskId, summary] = match
      if (!updates[taskId]) updates[taskId] = {}
      updates[taskId].summary = summary
      cleanContent = cleanContent.replace(fullMatch, '')
    }
    
    // Apply updates to task plan
    if (plan && Object.keys(updates).length > 0) {
      plan.subtasks = plan.subtasks.map(task => ({
        ...task,
        status: updates[task.task_id]?.status || task.status,
        summary: updates[task.task_id]?.summary || task.summary
      }))
    }
    
    // Clean up extra whitespace and remove duplicate content
    cleanContent = cleanContent.trim().replace(/\n{3,}/g, '\n\n')
    
    // If we have a task plan, remove any lines that look like task descriptions that are already in the plan
    if (plan) {
      // Remove lines that start with "Task X:" or similar patterns
      cleanContent = cleanContent.replace(/^Task \d+:.*$/gm, '')
      cleanContent = cleanContent.replace(/^(Starting|Executing|Completing) task.*$/gmi, '')
      cleanContent = cleanContent.replace(/^\*\*Task \d+.*\*\*.*$/gm, '')
      
      // Remove execution plan header variations
      cleanContent = cleanContent.replace(/^#{1,3}\s*(Execution Plan|Task Plan|Plan).*$/gmi, '')
      cleanContent = cleanContent.replace(/^Creating execution plan.*$/gmi, '')
      
      // Clean up resulting whitespace
      cleanContent = cleanContent.trim().replace(/\n{3,}/g, '\n\n')
    }
    
    const result = {
      taskPlan: plan,
      report: report,
      reportDetails: reportDetails,
      formattedContent: cleanContent,
      hasUpdates: Object.keys(updates).length > 0
    }

    // Debug what we're returning
    if (report) {
      console.log('[TaskPlanFormatter] Parsed result:', {
        hasReport: !!report,
        reportDetailsLength: reportDetails.length,
        reportDetailsPreview: reportDetails.substring(0, 100),
        isStreaming
      })
    }

    return result
  }, [content, isStreaming])
  
  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }
  
  // Calculate progress
  const progress = useMemo(() => {
    if (!taskPlan) return { completed: 0, total: 0, percentage: 0 }
    const completed = taskPlan.subtasks.filter(t => 
      t.status === 'completed' || t.status === 'skipped'
    ).length
    return {
      completed,
      total: taskPlan.subtasks.length,
      percentage: taskPlan.subtasks.length > 0 ? (completed / taskPlan.subtasks.length) * 100 : 0
    }
  }, [taskPlan])
  
  if (!taskPlan && !report) {
    // No task plan or report found, return original content
    return <div className={className}>{content}</div>
  }
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Combined Task Plan and Report Display */}
      {(taskPlan || report) && (
        <div className="bg-muted rounded-3xl px-5 py-4 space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Image
                src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                alt="coasty"
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="font-medium">
                {report ? 'Task Execution Summary' : 'Execution Plan'}
              </span>
              <Badge variant="outline" className="text-xs">
                {report ? (
                  report.summary.completed === report.summary.total_tasks ? 'Completed' : 'In Progress'
                ) : (
                  `${taskPlan?.subtasks.length || 0} tasks`
                )}
              </Badge>
            </div>
            
            {/* Main Objective or Summary */}
            <p className="text-sm text-muted-foreground pl-6">
              {report ? (
                `Task execution completed with ${report.summary.success_rate}% success rate in ${report.summary.execution_time} seconds`
              ) : (
                taskPlan?.main_objective
              )}
            </p>
            
            {/* Task List Overview - Show from plan or report */}
            {taskPlan && (
              <div className="pl-6 space-y-1">
                {taskPlan.subtasks.map((task, index) => {
                  const StatusIcon = statusIcons[task.status as keyof typeof statusIcons] || statusIcons.pending
                  return (
                    <div key={task.task_id} className="flex items-center gap-2 text-sm">
                      {StatusIcon}
                      <span className={cn(
                        task.status === 'completed' && "text-muted-foreground"
                      )}>
                        {index + 1}. {task.description}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            
            {/* Progress or Report Metrics */}
            {report ? (
              // Report Summary Metrics
              <div className="pl-6 flex items-center gap-4 text-sm pt-2">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{report.summary.completed} completed</span>
                </div>
                {report.summary.failed > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{report.summary.failed} failed</span>
                  </div>
                )}
                {report.summary.skipped > 0 && (
                  <div className="flex items-center gap-1">
                    <SkipForward className="h-4 w-4 text-yellow-500" />
                    <span>{report.summary.skipped} skipped</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{report.summary.execution_time}s</span>
                </div>
              </div>
            ) : progress.total > 0 ? (
              // Task Plan Progress
              <div className="pl-6 pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{progress.completed} of {progress.total} completed</span>
                  <span>•</span>
                  <span>{Math.round(progress.percentage)}%</span>
                </div>
              </div>
            ) : null}
          </div>
        
        {/* Divider */}
        <div className="border-t border-border/30"></div>
        
        {/* Task Details with Timeline Style */}
        <div className="relative pl-8">
          {/* Vertical dashed line */}
          <div className="absolute left-3 top-3 bottom-3 w-px border-l-2 border-dashed border-border/50"></div>
          
          {taskPlan?.subtasks?.map((task, index) => {
            const isExpanded = expandedTasks.has(task.task_id)
            const Icon = agentIcons[task.assigned_agent] || <Brain className="h-4 w-4" />
            const StatusIcon = statusIcons[task.status as keyof typeof statusIcons] || statusIcons.pending
            const isLast = index === (taskPlan?.subtasks?.length || 0) - 1
            
            return (
              <div
                key={task.task_id}
                className="relative"
              >
                {/* Point/Circle on the timeline */}
                <div className={cn(
                  "absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center bg-background",
                  task.status === 'completed' && "bg-green-500/20",
                  task.status === 'in_progress' && "bg-blue-500/20",
                  task.status === 'failed' && "bg-red-500/20",
                  task.status === 'pending' && "bg-muted"
                )}>
                  <div className="scale-75">
                    {StatusIcon}
                  </div>
                </div>
                
                {/* Task content */}
                <div className={cn("pb-6", isLast && "pb-0")}>
                  <button
                    onClick={() => toggleTask(task.task_id)}
                    className="w-full text-left hover:bg-background/50 rounded-lg p-2 -ml-2 transition-colors flex items-start gap-2 group"
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 text-muted-foreground transition-transform shrink-0 mt-0.5",
                      isExpanded && "rotate-90"
                    )} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">Task {index + 1}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {Icon}
                          <span>{task.assigned_agent.replace('_agent', '')}</span>
                        </div>
                        {task.status !== 'pending' && (
                          <Badge variant={
                            task.status === 'completed' ? 'default' :
                            task.status === 'in_progress' ? 'secondary' :
                            task.status === 'failed' ? 'destructive' : 'outline'
                          } className="text-xs">
                            {task.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.description}
                      </p>
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-5 mt-2"
                      >
                        <div className="pl-4 space-y-3 text-sm border-l-2 border-dotted border-border/30">
                          <div>
                            <span className="text-xs text-muted-foreground">Expected Output:</span>
                            <p className="mt-0.5">{task.expected_output}</p>
                          </div>
                          
                          {task.summary && (
                            <div>
                              <span className="text-xs text-muted-foreground">
                                {task.status === 'completed' ? 'Result:' : 'Current Status:'}
                              </span>
                              <p className="mt-0.5">{task.summary}</p>
                            </div>
                          )}
                          
                          {task.error && (
                            <div className="rounded-md bg-red-500/10 p-2">
                              <span className="text-xs text-red-600">Error:</span>
                              <p className="text-red-600/90 mt-0.5">{task.error}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Report Results Section - Achievements and Issues */}
        {report && (
          <>
            <div className="border-t border-border/30"></div>
            {report.key_achievements && report.key_achievements.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Image
                  src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                  alt="coasty"
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="font-medium">Key Achievements</span>
              </div>
              <div className="pl-6 space-y-1">
                {report.key_achievements.map((achievement, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="break-words">{achievement}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {report.issues_encountered && report.issues_encountered.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Image
                  src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                  alt="coasty"
                  width={24}
                  height={24}
                  className="shrink-0"
                />
                <span className="font-medium">Issues Encountered</span>
              </div>
              <div className="pl-6 space-y-1">
                {report.issues_encountered.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <span className="break-words">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Task Results with Timeline Style - Similar to Execution Plan */}
          {report.tasks && report.tasks.length > 0 && (
            <>
              <div className="border-t border-border/30"></div>
              <div className="relative pl-8 pr-2 overflow-hidden">
                {/* Vertical dashed line */}
                <div className="absolute left-3 top-3 bottom-3 w-px border-l-2 border-dashed border-border/50"></div>
                
                {report.tasks.map((task, index) => {
                  const Icon = agentIcons[task.agent] || <Brain className="h-4 w-4" />
                  const StatusIcon = task.status === 'completed' ? statusIcons.completed :
                                    task.status === 'failed' ? statusIcons.failed :
                                    statusIcons.skipped
                  const isLast = index === report.tasks.length - 1
                  
                  return (
                    <div key={task.task_id} className="relative">
                      {/* Point/Circle on the timeline */}
                      <div className={cn(
                        "absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center bg-background",
                        task.status === 'completed' && "bg-green-500/20",
                        task.status === 'failed' && "bg-red-500/20",
                        task.status === 'skipped' && "bg-yellow-500/20"
                      )}>
                        <div className="scale-75">
                          {StatusIcon}
                        </div>
                      </div>
                      
                      {/* Task result content */}
                      <div className={cn("pb-4", isLast && "pb-0")}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="font-medium">Task {index + 1}</span>
                            <span className={cn(
                              "text-xs",
                              task.status === 'completed' && "text-green-600",
                              task.status === 'failed' && "text-red-600",
                              task.status === 'skipped' && "text-yellow-600"
                            )}>
                              {task.status}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {Icon}
                              <span>{task.agent.replace('_agent', '')}</span>
                              {(task.duration || task.execution_time) && (
                                <>
                                  <span>•</span>
                                  <span>{task.duration || task.execution_time}s</span>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-words overflow-hidden">
                            {task.description}
                          </p>
                          {(task.summary || task.outcome) && (
                            <div className="mt-2 pl-4 border-l-2 border-border/30 overflow-hidden">
                              <p className="text-sm break-words">{task.summary || task.outcome}</p>
                            </div>
                          )}
                          {task.error && task.error !== null && (
                            <div className="rounded-md bg-red-500/10 p-2 mt-2 overflow-hidden">
                              <p className="text-sm text-red-600 break-words">{task.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          
          {/* Recommendations if available */}
          {report.recommendations && report.recommendations.length > 0 && (
            <>
              <div className="border-t border-border/30"></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Image
                    src={resolvedTheme === "dark" ? "/logo_light.svg" : "/logo_dark.svg"}
                    alt="coasty"
                    width={24}
                    height={24}
                    className="shrink-0"
                  />
                  <span className="font-medium">Recommendations</span>
                </div>
                <div className="pl-6 space-y-1">
                  {report.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground break-words">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Metadata Section if available - Collapsible */}
          {report.metadata && (report.metadata.started_at || report.metadata.completed_at || report.metadata.report_version) && (
            <>
              <div className="border-t border-border/30"></div>
              <div className="pl-6">
                <button
                  onClick={() => setMetadataExpanded(!metadataExpanded)}
                  className="w-full text-left hover:bg-background/50 rounded-lg p-2 -ml-2 transition-colors flex items-center gap-2 group"
                >
                  <ChevronRight className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                    metadataExpanded && "rotate-90"
                  )} />
                  <p className="text-sm font-medium">Report Metadata</p>
                </button>
                <AnimatePresence>
                  {metadataExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pl-5 mt-1"
                    >
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {report.metadata.started_at && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Started: {new Date(report.metadata.started_at).toLocaleString()}</span>
                          </div>
                        )}
                        {report.metadata.completed_at && (
                          <div className="flex items-center gap-2">
                            <CheckCheck className="h-4 w-4" />
                            <span>Completed: {new Date(report.metadata.completed_at).toLocaleString()}</span>
                          </div>
                        )}
                        {report.metadata.report_version && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            <span>Version: {report.metadata.report_version}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
          
            {/* Detailed Report Content if available or loading */}
            {/* Show as soon as we detect Coasty_REPORT_START in content */}
            {(content.includes('[Coasty_REPORT_START]') || report) && (
              <>
                <div className="border-t border-border/20 mt-6"></div>
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Summary
                      {isStreaming && (!reportDetails || !reportDetails.trim()) && (
                        <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />
                      )}
                    </span>
                  </div>
                  <div className="pl-4">
                  {reportDetails && reportDetails.trim() ? (
                    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                      {reportDetails.trim().split('\n').map((line, index) => {
                        // Handle horizontal rules (---, ***, ___)
                        if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
                          return <hr key={index} className="border-t border-border/30 my-4" />
                        }

                        // Handle all heading levels
                        if (line.startsWith('# ')) {
                          return (
                            <h2 key={index} className="text-lg font-semibold text-foreground mt-6 mb-3 first:mt-0">
                              {line.replace('# ', '')}
                            </h2>
                          )
                        }
                        if (line.startsWith('## ')) {
                          return (
                            <h3 key={index} className="text-base font-medium text-foreground mt-4 mb-2 first:mt-0">
                              {line.replace('## ', '')}
                            </h3>
                          )
                        }
                        if (line.startsWith('### ')) {
                          return (
                            <h4 key={index} className="font-medium text-foreground mt-3 mb-1 first:mt-0">
                              {line.replace('### ', '')}
                            </h4>
                          )
                        }
                        if (line.startsWith('#### ')) {
                          return (
                            <h5 key={index} className="text-sm font-medium text-foreground/90 mt-2 first:mt-0">
                              {line.replace('#### ', '')}
                            </h5>
                          )
                        }

                        // Handle blockquotes
                        if (line.startsWith('>')) {
                          return (
                            <blockquote key={index} className="border-l-2 border-muted-foreground/20 pl-3 italic text-muted-foreground/80">
                              {line.replace(/^>\s*/, '')}
                            </blockquote>
                          )
                        }

                        // Handle code blocks (indented or ```)
                        if (line.startsWith('```')) {
                          return null // Skip fence markers
                        }
                        if (line.startsWith('    ') || line.startsWith('\t')) {
                          return (
                            <code key={index} className="block bg-muted/50 rounded px-2 py-1 text-xs font-mono">
                              {line.trim()}
                            </code>
                          )
                        }

                        // Handle unordered lists (-, *, +)
                        if (line.trim().match(/^[-*+]\s+/)) {
                          return (
                            <div key={index} className="flex gap-2 ml-2">
                              <span className="text-muted-foreground/40 mt-0.5">•</span>
                              <span className="flex-1">{renderInlineFormatting(line.replace(/^[-*+]\s+/, ''))}</span>
                            </div>
                          )
                        }

                        // Handle ordered lists
                        const orderedMatch = line.match(/^(\d+)\.\s+(.*)/)
                        if (orderedMatch) {
                          return (
                            <div key={index} className="flex gap-2 ml-2">
                              <span className="text-muted-foreground/60 text-xs mt-0.5">{orderedMatch[1]}.</span>
                              <span className="flex-1">{renderInlineFormatting(orderedMatch[2])}</span>
                            </div>
                          )
                        }

                        // Handle task lists
                        const taskMatch = line.match(/^[-*+]\s+\[([ x])\]\s+(.*)/)
                        if (taskMatch) {
                          const isChecked = taskMatch[1] === 'x'
                          return (
                            <div key={index} className="flex gap-2 ml-2">
                              <span className={cn("text-xs mt-0.5", isChecked ? "text-green-600" : "text-muted-foreground/40")}>
                                {isChecked ? '☑' : '☐'}
                              </span>
                              <span className={cn("flex-1", isChecked && "line-through opacity-60")}>
                                {renderInlineFormatting(taskMatch[2])}
                              </span>
                            </div>
                          )
                        }

                        // Handle tables (simple detection)
                        if (line.includes('|')) {
                          const cells = line.split('|').map(cell => cell.trim()).filter(Boolean)
                          return (
                            <div key={index} className="flex divide-x divide-border/20">
                              {cells.map((cell, i) => (
                                <div key={i} className="px-2 py-1 text-xs flex-1">
                                  {renderInlineFormatting(cell)}
                                </div>
                              ))}
                            </div>
                          )
                        }

                        // Enhanced inline formatting function
                        function renderInlineFormatting(text: string): React.ReactNode {
                          if (!text) return text

                          // Complex regex to handle multiple inline formats
                          const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g
                          const parts = text.split(regex)

                          return parts.map((part, i) => {
                            // Bold (**text** or __text__)
                            if ((part.startsWith('**') && part.endsWith('**')) ||
                                (part.startsWith('__') && part.endsWith('__'))) {
                              return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                            }
                            // Italic (*text* or _text_)
                            if ((part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) ||
                                (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__'))) {
                              return <em key={i} className="italic">{part.slice(1, -1)}</em>
                            }
                            // Code (`text`)
                            if (part.startsWith('`') && part.endsWith('`')) {
                              return <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>
                            }
                            // Strikethrough (~~text~~)
                            if (part.startsWith('~~') && part.endsWith('~~')) {
                              return <span key={i} className="line-through opacity-60">{part.slice(2, -2)}</span>
                            }
                            // Links ([text](url))
                            const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/)
                            if (linkMatch) {
                              return (
                                <a key={i} href={linkMatch[2]} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                                  {linkMatch[1]}
                                </a>
                              )
                            }
                            return part
                          })
                        }

                        // Handle empty lines
                        if (line.trim() === '') {
                          return <div key={index} className="h-2" />
                        }

                        // Regular paragraphs with inline formatting
                        return (
                          <div key={index}>
                            {renderInlineFormatting(line)}
                          </div>
                        )
                      })}
                      {isStreaming && (
                        <Loader2 className="h-3 w-3 animate-spin opacity-50 mt-2" />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground/60 italic">
                      {isStreaming ? "Generating summary..." : "No summary available"}
                    </div>
                  )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      )}
      
      {/* Remaining Content - only show if there's meaningful content */}
      {formattedContent && formattedContent.length > 0 && (
        <MessageContent
          className={cn(
            "prose dark:prose-invert relative bg-muted rounded-3xl px-5 py-2.5 max-w-none mt-4",
            "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
          )}
          markdown={true}
        >
          {formattedContent}
        </MessageContent>
      )}
    </div>
  )
}