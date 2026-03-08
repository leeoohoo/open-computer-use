import { AgentIcon } from "@/components/icons/agent"

type ScheduledRunIndicatorProps = {
  raw: string
}

function parse(raw: string): { datetime: string; task: string } {
  const dateMatch = raw.match(/\[Scheduled execution at ([^\]]+)\]/)
  const taskMatch = raw.match(/Re-running task:\s*([\s\S]*)/)
  return {
    datetime: dateMatch?.[1]?.trim() ?? "",
    task: taskMatch?.[1]?.trim() ?? "",
  }
}

export function ScheduledRunIndicator({ raw }: ScheduledRunIndicatorProps) {
  const { datetime, task } = parse(raw)

  return (
    <div className="flex items-center gap-3 py-3 px-1 my-1">
      <div className="h-px flex-1 bg-border/60" />
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <AgentIcon className="size-3.5 shrink-0" />
          <span className="text-xs font-medium tracking-wide">
            Employee run
            {datetime && (
              <span className="font-normal text-muted-foreground/50">
                {" · "}
                {datetime}
              </span>
            )}
          </span>
        </div>
        {task && (
          <p className="text-[11px] text-muted-foreground/45 max-w-[280px] truncate text-center leading-none">
            {task}
          </p>
        )}
      </div>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}

export function isScheduledRunMarker(content: string): boolean {
  return content.trimStart().startsWith("[Scheduled execution at")
}
