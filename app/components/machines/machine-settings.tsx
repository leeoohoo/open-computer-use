"use client";

import { useState } from "react";
import { Save, Loader2, Shield, Clock, Key, Download, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { UserMachine } from "@/types/machines.types";

interface MachineSettingsProps {
  machine: UserMachine;
  onUpdate: () => void;
}

export function MachineSettings({ machine, onUpdate }: MachineSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(machine.displayName);
  const [autoShutdownMinutes, setAutoShutdownMinutes] = useState(
    machine.autoShutdownMinutes || 30
  );
  const [enableAutoShutdown, setEnableAutoShutdown] = useState(
    machine.autoShutdownMinutes !== null
  );

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const response = await fetch(`/api/machines/${machine.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          autoShutdownMinutes: enableAutoShutdown ? autoShutdownMinutes : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      toast.success("Settings updated successfully");
      onUpdate();
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Configure basic machine settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Machine"
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={handleSave}
              disabled={saving || displayName === machine.displayName}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Power Management */}
      <Card>
        <CardHeader>
          <CardTitle>Power Management</CardTitle>
          <CardDescription>
            Configure automatic shutdown to save costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-shutdown" className="text-base">
                Auto Shutdown
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically shut down the machine when idle
              </p>
            </div>
            <Switch
              id="auto-shutdown"
              checked={enableAutoShutdown}
              onCheckedChange={setEnableAutoShutdown}
            />
          </div>

          {enableAutoShutdown && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Idle Timeout</Label>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {autoShutdownMinutes} minutes
                  </span>
                </div>
                <Slider
                  value={[autoShutdownMinutes]}
                  onValueChange={([value]) => setAutoShutdownMinutes(value)}
                  min={5}
                  max={120}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Machine will shut down after {autoShutdownMinutes} minutes of inactivity
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Security and access settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {machine.settings?.provider === 'aws' ? (
            <>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium">SSH Authentication</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Username: <span className="font-mono">{machine.settings?.sshUsername || 'ubuntu'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Key Pair: <span className="font-mono">{machine.settings?.awsKeyPairName || 'N/A'}</span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/machines/${machine.id}/ssh-key`);
                    if (!response.ok) throw new Error("Failed to download key");
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${machine.settings?.awsKeyPairName || 'key'}.pem`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success("SSH key downloaded");
                  } catch {
                    toast.error("Failed to download SSH key");
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download SSH Key
              </Button>
            </>
          ) : (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-medium">VNC Password</p>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {machine.vncPassword}
              </p>
              <p className="text-xs text-muted-foreground">
                This password is required to connect to the machine
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}