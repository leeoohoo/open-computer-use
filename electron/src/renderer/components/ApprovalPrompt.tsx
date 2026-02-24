import React from 'react'
import type { PendingApproval } from '../stores/approval-store'
import { useApprovalStore } from '../stores/approval-store'

/** Human-readable label — uses params to describe the actual action */
function getCommandLabel(command: string, params: any): string {
  // Desktop interactions — describe what's actually happening
  if (command === 'click') return `Click at (${params.x}, ${params.y})`
  if (command === 'double_click') return `Double-click at (${params.x}, ${params.y})`
  if (command === 'type') {
    const text = params.text || ''
    return `Type "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`
  }
  if (command === 'key_press') return `Press ${params.key || params.name || 'key'}`
  if (command === 'key_combo') {
    const keys = params.keys || params.combo || params.key || ''
    return `Press ${Array.isArray(keys) ? keys.join(' + ') : keys}`
  }
  if (command === 'scroll') {
    const dir = (params.delta_y || params.amount || 0) > 0 ? 'down' : 'up'
    return `Scroll ${dir}`
  }
  if (command === 'drag') return `Drag from (${params.start_x}, ${params.start_y}) to (${params.end_x}, ${params.end_y})`

  // Terminal
  if (command === 'terminal_execute' || command === 'execute_command') {
    const cmd = params.command || params.cmd || ''
    return cmd ? `Run ${cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd}` : 'Run command'
  }
  if (command === 'terminal_type') {
    const text = params.text || ''
    return `Type in terminal "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`
  }

  // File operations
  if (command === 'file_write') return `Write to ${_filename(params)}`
  if (command === 'file_edit') return `Edit ${_filename(params)}`
  if (command === 'file_append') return `Append to ${_filename(params)}`
  if (command === 'file_delete') return `Delete ${_filename(params)}`
  if (command === 'file_upload') return `Upload ${_filename(params)}`
  if (command === 'directory_delete') return `Delete folder ${params.path || params.dirpath || ''}`

  // Browser
  if (command === 'browser_open') return 'Open browser'
  if (command === 'browser_navigate') return `Go to ${params.url || 'page'}`
  if (command === 'browser_click') return `Click "${params.selector || params.text || 'element'}"`
  if (command === 'browser_type') {
    const text = params.text || ''
    return `Type in browser "${text.length > 30 ? text.slice(0, 30) + '...' : text}"`
  }
  if (command === 'browser_execute') return 'Run browser script'
  if (command === 'browser_open_tab') return 'Open new tab'
  if (command === 'browser_close_tab') return 'Close tab'
  if (command === 'browser_close') return 'Close browser'

  // Window management
  if (command === 'switch_to_window') return `Switch to ${params.window || params.title || 'window'}`
  if (command === 'close_window') return 'Close window'
  if (command === 'minimize_window') return 'Minimize window'
  if (command === 'maximize_window') return 'Maximize window'

  // Safe/read-only commands (shouldn't normally show but just in case)
  if (command === 'screenshot' || command === 'browser_screenshot') return 'Looking at screen'
  if (command === 'file_read') return `Read ${_filename(params)}`
  if (command === 'directory_list') return 'List directory'
  if (command === 'browser_state') return 'Check browser state'

  return command.replace(/_/g, ' ')
}

/** Extract just the filename from a path param */
function _filename(params: any): string {
  const p = params.path || params.filepath || ''
  if (!p) return 'file'
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

/** Optional detail line — shows the full path, URL, or command when label is truncated */
function getDetail(command: string, params: any): string {
  if (command === 'terminal_execute' || command === 'execute_command') {
    const cmd = params.command || params.cmd || ''
    return cmd.length > 40 ? cmd : ''
  }
  if (['file_write', 'file_edit', 'file_append', 'file_delete', 'file_upload'].includes(command)) {
    const p = params.path || params.filepath || ''
    return p.includes('/') || p.includes('\\') ? p : ''
  }
  if (command === 'browser_navigate') {
    const url = params.url || ''
    return url.length > 40 ? url : ''
  }
  if (command === 'type' || command === 'browser_type' || command === 'terminal_type') {
    const text = params.text || ''
    return text.length > 30 ? text : ''
  }
  return ''
}

/** Risk accent color (dot) */
function getRiskDot(command: string): string {
  if (['file_delete', 'directory_delete', 'close_window', 'browser_close'].includes(command)) {
    return 'bg-red-400'
  }
  if (['terminal_execute', 'execute_command', 'browser_execute'].includes(command)) {
    return 'bg-amber-400'
  }
  return 'bg-blue-400'
}

/** Small icon per command category */
function CommandIcon({ command }: { command: string }) {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  // Terminal
  if (['terminal_execute', 'execute_command', 'terminal_type'].includes(command)) {
    return <svg {...s}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
  }
  // File operations
  if (['file_write', 'file_edit', 'file_append', 'file_delete', 'file_upload', 'file_read', 'directory_delete', 'directory_list'].includes(command)) {
    return <svg {...s}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  }
  // Browser
  if (command.startsWith('browser_')) {
    return <svg {...s}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
  }
  // Window management
  if (['switch_to_window', 'close_window', 'minimize_window', 'maximize_window'].includes(command)) {
    return <svg {...s}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
  }
  // Keyboard
  if (['key_press', 'key_combo'].includes(command)) {
    return <svg {...s}><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="6" y1="8" x2="6.01" y2="8" /><line x1="10" y1="8" x2="10.01" y2="8" /><line x1="14" y1="8" x2="14.01" y2="8" /><line x1="18" y1="8" x2="18.01" y2="8" /><line x1="6" y1="12" x2="6.01" y2="12" /><line x1="18" y1="12" x2="18.01" y2="12" /><line x1="9" y1="16" x2="15" y2="16" /></svg>
  }
  // Screenshot
  if (command === 'screenshot' || command === 'browser_screenshot') {
    return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
  }
  // Desktop interactions (click, type, scroll, drag)
  return <svg {...s}><path d="M4 4l7.07 17 2.51-7.39L21 11.07z" /><line x1="15" y1="15" x2="23" y2="23" /></svg>
}

export function ApprovalPrompt({ approval }: { approval: PendingApproval }) {
  const { approve, deny } = useApprovalStore()
  const label = getCommandLabel(approval.command, approval.parameters)
  const detail = getDetail(approval.command, approval.parameters)
  const [isDenying, setIsDenying] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isDenying) inputRef.current?.focus()
  }, [isDenying])

  const submitDeny = () => {
    deny(approval.id, reason.trim() || undefined)
  }

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-900/50 overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        {/* Risk dot + icon */}
        <div className="relative flex-shrink-0">
          <div className="text-neutral-400">
            <CommandIcon command={approval.command} />
          </div>
          <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${getRiskDot(approval.command)}`} />
        </div>

        {/* Label + detail */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-neutral-200 leading-tight">
            {label}
          </div>
          {detail && (
            <div className="mt-1 text-[10px] text-neutral-500 bg-neutral-950/60 rounded-md px-2 py-1 font-mono truncate">
              {detail}
            </div>
          )}
        </div>

        {isDenying ? (
          /* Deny reason input */
          <div className="flex items-center gap-1 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitDeny() }}
              placeholder="Why?"
              className="w-28 px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] placeholder-neutral-500 outline-none focus:border-neutral-600"
            />
            <button
              onClick={submitDeny}
              className="px-2 py-1 rounded-lg bg-red-600/80 text-white text-[11px] font-medium hover:bg-red-500 transition-colors"
            >
              Send
            </button>
          </div>
        ) : (
          /* Inline action buttons */
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsDenying(true)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-400 text-[11px] font-medium hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={() => approve(approval.id)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/80 text-white text-[11px] font-medium hover:bg-emerald-500 transition-colors"
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
