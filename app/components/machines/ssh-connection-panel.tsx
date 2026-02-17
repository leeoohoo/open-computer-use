"use client";

import { useState } from "react";
import { Copy, Download, Check, Terminal, Key, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SshTerminal } from "./ssh-terminal";
import type { UserMachine } from "@/types/machines.types";

interface SshConnectionPanelProps {
  machine: UserMachine;
}

export function SshConnectionPanel({ machine }: SshConnectionPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const ip = machine.publicIpAddress;
  const username = machine.settings?.sshUsername || "ubuntu";
  const keyPairName = machine.settings?.awsKeyPairName || "key";
  const sshCommand = ip ? `ssh -i ${keyPairName}.pem ${username}@${ip}` : "";

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownloadKey = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/machines/${machine.id}/ssh-key`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download key");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${keyPairName}.pem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("SSH key downloaded", {
        description: "Remember to set permissions: chmod 400 " + keyPairName + ".pem",
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  if (machine.status !== "running") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">Machine Not Running</p>
            <p className="text-sm text-muted-foreground">
              Start the machine to connect via SSH.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ip) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <p className="text-lg font-medium">Waiting for IP Address</p>
            <p className="text-sm text-muted-foreground">
              The machine is starting up. An IP address will be assigned shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Web Terminal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Terminal
          </CardTitle>
          <CardDescription>
            SSH into your machine directly from the browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SshTerminal machineId={machine.id} />
        </CardContent>
      </Card>

      {/* Collapsible Connection Details */}
      <Card>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Key className="h-4 w-4" />
                Connection Details & SSH Key
              </CardTitle>
              {showDetails ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </button>

        {showDetails && (
          <CardContent className="space-y-4 pt-0">
            {/* SSH Command */}
            <div className="space-y-2">
              <label className="text-sm font-medium">SSH Command</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">
                  {sshCommand}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(sshCommand, "ssh")}
                >
                  {copiedField === "ssh" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Connection Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Host</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{ip}</code>
                  <button
                    onClick={() => copyToClipboard(ip, "host")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === "host" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Port</label>
                <code className="text-sm font-mono block">22</code>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Username</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{username}</code>
                  <button
                    onClick={() => copyToClipboard(username, "user")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === "user" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Auth</label>
                <Badge variant="outline" className="gap-1">
                  <Key className="h-3 w-3" />
                  SSH Key
                </Badge>
              </div>
            </div>

            {/* SSH Key Download */}
            <div className="border-t pt-4 space-y-3">
              <Button onClick={handleDownloadKey} disabled={downloading} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                {downloading ? "Downloading..." : `Download ${keyPairName}.pem`}
              </Button>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-1.5 rounded-md text-xs font-mono">
                  chmod 400 {keyPairName}.pem
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(`chmod 400 ${keyPairName}.pem`, "chmod")}
                >
                  {copiedField === "chmod" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
