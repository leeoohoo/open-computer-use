import React from 'react'
import type { ToolInvocation } from '../stores/chat-store'

interface Props {
  invocations: ToolInvocation[]
}

function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    screenshot: 'Taking screenshot',
    terminal_execute: 'Running command',
    terminal_connect: 'Connecting terminal',
    file_read: 'Reading file',
    file_write: 'Writing file',
    file_edit: 'Editing file',
    file_delete: 'Deleting file',
    directory_list: 'Listing directory',
    browser_open: 'Opening browser',
    browser_navigate: 'Navigating to page',
    browser_click: 'Clicking element',
    browser_type: 'Typing text',
    browser_get_dom: 'Reading page DOM',
    browser_get_clickables: 'Finding clickable elements',
    browser_state: 'Checking browser state',
    browser_scroll: 'Scrolling page',
    browser_close: 'Closing browser',
  }
  return labels[toolName] || toolName
}

function ToolCard({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = React.useState(false)
  const isComplete = invocation.state === 'result'

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800/50 transition-colors"
      >
        {isComplete ? (
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <span className="text-sm text-neutral-300 truncate">{getToolLabel(invocation.toolName)}</span>
        <svg
          className={`w-3 h-3 text-neutral-500 ml-auto shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-neutral-800">
          {/* Args */}
          {Object.keys(invocation.args).length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-neutral-500 mb-1">Input</p>
              <pre className="text-xs text-neutral-400 bg-neutral-950 rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(invocation.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {isComplete && invocation.result && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">Result</p>
              <pre className="text-xs text-neutral-400 bg-neutral-950 rounded p-2 overflow-x-auto max-h-32">
                {typeof invocation.result === 'string'
                  ? invocation.result.slice(0, 2000)
                  : JSON.stringify(invocation.result, null, 2).slice(0, 2000)}
              </pre>
            </div>
          )}

          {/* Screenshot */}
          {invocation.frontendScreenshot && (
            <div>
              <p className="text-xs text-neutral-500 mb-1">Screenshot</p>
              <img
                src={invocation.frontendScreenshot}
                alt="Tool result screenshot"
                className="rounded border border-neutral-800 max-w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolInvocationDisplay({ invocations }: Props) {
  // Tool invocations are internal agent mechanics — the CUA section
  // renderer and markdown already surface the important info.
  return null
}
