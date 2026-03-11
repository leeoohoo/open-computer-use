"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { UserSecret, UserSecretWithPassword } from "@/types/secrets.types"
import { Eye, EyeSlash } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface SecretDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  secret?: UserSecret | null
  onSaved: (info?: { name: string; service: string }) => void
  /** Pre-fill the service field when creating a new credential */
  initialService?: string
}

export function SecretDialog({ open, onOpenChange, secret, onSaved, initialService }: SecretDialogProps) {
  const isEditing = !!secret

  const [name, setName] = useState("")
  const [service, setService] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  // Reset form on open
  useEffect(() => {
    if (open) {
      if (secret) {
        setName(secret.name)
        setService(secret.service)
        setUsername(secret.username)
        setPassword("")
        setNotes(secret.notes ?? "")
        // Fetch existing password for edit
        setLoadingPassword(true)
        fetch(`/api/secrets/${secret.id}`)
          .then((r) => r.json())
          .then((data: UserSecretWithPassword) => setPassword(data.password ?? ""))
          .catch(() => {})
          .finally(() => setLoadingPassword(false))
      } else {
        setName(initialService ? initialService.split(".")[0].charAt(0).toUpperCase() + initialService.split(".")[0].slice(1) : "")
        setService(initialService ?? "")
        setUsername("")
        setPassword("")
        setNotes("")
        setShowPassword(false)
      }
    }
  }, [open, secret, initialService])

  async function handleSave() {
    if (!name.trim() || !service.trim() || !username.trim() || !password.trim()) {
      toast.error("Name, service, username, and password are required")
      return
    }

    setSaving(true)
    try {
      const body = { name: name.trim(), service: service.trim(), username: username.trim(), password, notes: notes.trim() }
      const url = isEditing ? `/api/secrets/${secret!.id}` : "/api/secrets"
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to save credential")
        return
      }

      toast.success(isEditing ? "Credential updated" : "Credential saved")
      onOpenChange(false)
      onSaved({ name: name.trim(), service: service.trim() })
    } catch {
      toast.error("Failed to save credential")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Credential" : "Add Credential"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cred-name">Name</Label>
            <Input
              id="cred-name"
              placeholder="Gmail Work"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-service">Service</Label>
            <Input
              id="cred-service"
              placeholder="gmail.com or https://mail.google.com"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-username">Username / Email</Label>
            <Input
              id="cred-username"
              placeholder="user@gmail.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-password">Password</Label>
            <div className="relative">
              <Input
                id="cred-password"
                type={showPassword ? "text" : "password"}
                placeholder={loadingPassword ? "Loading..." : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loadingPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="cred-notes"
              placeholder="e.g. work account, 2FA enabled"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingPassword}>
            {saving ? "Saving…" : isEditing ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
