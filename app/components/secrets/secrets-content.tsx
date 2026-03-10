"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Plus, KeyRound, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, ShieldCheck, LockKeyhole, Globe, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { NoiseBackground } from "@/components/ui/noise-background"
import { toast } from "sonner"
import type { UserSecret } from "@/types/secrets.types"
import { SecretDialog } from "./secret-dialog"

/* ─── SecretCard ─── */

interface SecretCardProps {
  secret: UserSecret
  revealedPassword?: string
  isRevealing: boolean
  onReveal: () => void
  onEdit: () => void
  onDelete: () => void
}

function ServiceAvatar({ domain }: { domain: string }) {
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState(false)
  const coastyLogo = resolvedTheme === "light" ? "/logo_dark.svg" : "/logo_light.svg"
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.06] ring-1 ring-foreground/[0.08] overflow-hidden">
      {!error ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={domain}
          className="h-5 w-5 object-contain"
          onError={() => setError(true)}
        />
      ) : (
        <img
          src={coastyLogo}
          alt=""
          className="h-5 w-5 object-contain"
        />
      )}
    </div>
  )
}

function getDomain(service: string): string | null {
  try {
    const url = service.startsWith("http") ? service : `https://${service}`
    const hostname = new URL(url).hostname
    // Only treat as domain if it has a dot (e.g. "gmail.com", not just "Gmail")
    return hostname.includes(".") ? hostname : null
  } catch {
    // Fall back to raw value if it has a dot
    return service.includes(".") ? service.split("/")[0] : null
  }
}

// Inject @property + keyframes once globally (bypasses styled-jsx compilation)
function useBeamAnimation() {
  useEffect(() => {
    const id = "beam-angle-styles"
    if (document.getElementById(id)) return
    const style = document.createElement("style")
    style.id = id
    style.textContent = `
      @property --beam-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }
      @keyframes rotate-beam {
        from { --beam-angle: 0deg; }
        to { --beam-angle: 360deg; }
      }
    `
    document.head.appendChild(style)
  }, [])
}

function SecretCard({ secret, revealedPassword, isRevealing, onReveal, onEdit, onDelete }: SecretCardProps) {
  const { resolvedTheme } = useTheme()
  const [faviconError, setFaviconError] = useState(false)
  useBeamAnimation()
  const domain = getDomain(secret.service)
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null
  const coastyLogo = resolvedTheme === "light" ? "/logo_dark.svg" : "/logo_light.svg"

  return (
    <div className="group relative overflow-hidden rounded-xl border-0 bg-card shadow-sm hover:shadow-lg transition-all duration-300 h-full">
      {/* Rotating beam border */}
      <div className="absolute -inset-[2px] rounded-xl overflow-hidden">
        <div
          className="absolute w-full h-full dark:brightness-150"
          style={{
            animation: "rotate-beam 4s linear infinite",
            filter: "drop-shadow(0 0 6px rgba(0, 0, 0, 0.2)) drop-shadow(0 0 12px currentColor)",
            background: `conic-gradient(from var(--beam-angle) at 50% 50%,
              transparent 0deg,
              rgba(139, 92, 246, 0.15) 5deg,
              rgba(139, 92, 246, 0.4) 10deg,
              rgba(139, 92, 246, 0.7) 20deg,
              rgba(255, 255, 255, 0.9) 30deg,
              rgba(139, 92, 246, 0.7) 40deg,
              rgba(139, 92, 246, 0.4) 50deg,
              rgba(139, 92, 246, 0.15) 55deg,
              transparent 60deg,
              transparent 360deg)`,
          }}
        />
      </div>
      <div className="absolute inset-[2px] bg-background rounded-[10px] z-[1]" />


      {/* Card content */}
      <div className="relative z-[2] flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex justify-between items-start">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 overflow-hidden">
                {faviconUrl && !faviconError ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    className="h-4.5 w-4.5 object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <img
                    src={coastyLogo}
                    alt=""
                    className="h-4.5 w-4.5 object-contain"
                  />
                )}
              </div>
              <p className="text-base font-semibold truncate">{secret.name}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate pl-[42px]">{secret.service}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Credential fields */}
        <div className="px-6 pb-5 space-y-3 flex-1">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Username</span>
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm font-mono text-foreground truncate flex-1">{secret.username}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Password</span>
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm font-mono text-foreground truncate flex-1">
                {revealedPassword ?? "••••••••••••"}
              </span>
              <button
                onClick={onReveal}
                disabled={isRevealing}
                className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 shrink-0 disabled:opacity-40"
                title={revealedPassword ? "Hide" : "Reveal for 10s"}
              >
                {revealedPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {secret.notes && (
            <p className="text-xs text-muted-foreground leading-relaxed pt-1">{secret.notes}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-6 py-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-xs text-muted-foreground">Encrypted</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main content ─── */

export function SecretsContent() {
  const [secrets, setSecrets] = useState<UserSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSecret, setEditingSecret] = useState<UserSecret | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserSecret | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const hideTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const fetchSecrets = useCallback(async () => {
    try {
      const res = await fetch("/api/secrets")
      const data = await res.json()
      setSecrets(data.secrets ?? [])
    } catch {
      toast.error("Failed to load credentials")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSecrets()
  }, [fetchSecrets])

  useEffect(() => {
    return () => {
      Object.values(hideTimers.current).forEach(clearTimeout)
    }
  }, [])

  async function handleReveal(secret: UserSecret) {
    if (revealedPasswords[secret.id]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev }
        delete next[secret.id]
        return next
      })
      clearTimeout(hideTimers.current[secret.id])
      return
    }

    setRevealingId(secret.id)
    try {
      const res = await fetch(`/api/secrets/${secret.id}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setRevealedPasswords((prev) => ({ ...prev, [secret.id]: data.password }))

      clearTimeout(hideTimers.current[secret.id])
      hideTimers.current[secret.id] = setTimeout(() => {
        setRevealedPasswords((prev) => {
          const next = { ...prev }
          delete next[secret.id]
          return next
        })
      }, 10000)
    } catch {
      toast.error("Failed to reveal password")
    } finally {
      setRevealingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/secrets/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Credential deleted")
      setSecrets((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setRevealedPasswords((prev) => {
        const next = { ...prev }
        delete next[deleteTarget.id]
        return next
      })
    } catch {
      toast.error("Failed to delete credential")
    } finally {
      setDeleteTarget(null)
    }
  }

  function handleEdit(secret: UserSecret) {
    setEditingSecret(secret)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditingSecret(null)
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading credentials...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-invisible relative bg-transparent">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Saved Credentials</h1>
            <p className="text-muted-foreground mt-1">
              Stored securely and used automatically by the AI agent when logging in
            </p>
          </div>
          <NoiseBackground
            containerClassName="w-auto p-[1px] rounded-lg bg-transparent dark:bg-transparent shadow-none"
            className="p-0"
            gradientColors={["rgb(115, 115, 115)", "rgb(163, 163, 163)", "rgb(82, 82, 82)"]}
            noiseIntensity={0.06}
            speed={0.06}
          >
            <button
              onClick={handleAdd}
              className="inline-flex h-10 items-center justify-center rounded-[7px] bg-background/80 px-5 text-sm font-medium text-foreground transition-opacity hover:opacity-80 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Credential
            </button>
          </NoiseBackground>
        </div>

        {/* Security Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-border bg-card px-3 sm:px-4 py-3">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 text-muted-foreground/60 mt-0.5 sm:mt-0">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Credentials are{" "}
              <span className="font-semibold text-foreground">never sent to the AI model</span>{" "}
              and are never exposed in chat — the agent fills them in directly without seeing the values
            </p>
          </div>
        </div>

        {/* Credentials Grid */}
        {secrets.length === 0 ? (
          <div className="relative rounded-2xl border border-border/40 bg-card overflow-hidden">
            {/* Smoke background */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 right-1/4 h-56 w-56 rounded-full bg-foreground/[0.04] blur-3xl" />
              <div className="absolute -bottom-12 left-1/4 h-48 w-48 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-foreground/[0.02] blur-2xl" />
            </div>

            <div className="relative flex flex-col items-center py-14 px-6 text-center">
              {/* Popular service icons row */}
              <div className="flex items-center gap-2.5 mb-8">
                {[
                  "gmail.com", "github.com", "linkedin.com",
                  "notion.so", "figma.com", "shopify.com",
                ].map((domain) => (
                  <ServiceAvatar key={domain} domain={domain} />
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.04] ring-1 ring-border/30">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              </div>

              {/* Headline */}
              <h3 className="text-xl font-bold mb-2">Auto-login, hands-free</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-10">
                Save credentials once — the AI agent logs in automatically and keeps going without ever interrupting you
              </p>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 text-left w-full max-w-xl">
                {[
                  {
                    icon: MousePointerClick,
                    title: "Zero interruptions",
                    desc: "The agent encounters a login form, fills it in, and continues the task — no prompts, no pauses",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Never seen by AI",
                    desc: "Your credentials are injected directly. The AI model never sees the actual values",
                  },
                  {
                    icon: Globe,
                    title: "Any website",
                    desc: "Works with login forms across any site — email, SaaS tools, dashboards, anything",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex flex-col gap-2 rounded-xl bg-foreground/[0.02] ring-1 ring-border/30 p-4"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <Button onClick={handleAdd} size="sm" className="gap-2 px-5">
                <Plus className="h-4 w-4" />
                Add your first credential
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {secrets.map((secret) => (
              <SecretCard
                key={secret.id}
                secret={secret}
                revealedPassword={revealedPasswords[secret.id]}
                isRevealing={revealingId === secret.id}
                onReveal={() => handleReveal(secret)}
                onEdit={() => handleEdit(secret)}
                onDelete={() => setDeleteTarget(secret)}
              />
            ))}
          </div>
        )}
      </div>

      <SecretDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        secret={editingSecret}
        onSaved={fetchSecrets}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credential?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.service}) will be permanently
              deleted. The AI agent will no longer be able to use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
