import React, { memo } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

function extractLanguage(className?: string): string {
  if (!className) return 'plaintext'
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : 'plaintext'
}

const components: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className="bg-white/10 text-orange-300 rounded px-1.5 py-0.5 font-mono text-[13px]"
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)
    const codeContent = typeof children === 'string' ? children : String(children || '')

    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 my-3 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800">
          <span className="text-xs text-neutral-500 font-mono">{language}</span>
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className="text-[13px] leading-relaxed text-neutral-300 font-mono">
            {codeContent}
          </code>
        </pre>
      </div>
    )
  },

  a: function AComponent({ href, children, ...props }) {
    if (!href) return <span {...props}>{children}</span>
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
        {...props}
      >
        {children}
      </a>
    )
  },

  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

const remarkPlugins = [remarkGfm, remarkBreaks]

function MarkdownComponent({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  )
}

export const Markdown = memo(MarkdownComponent)
