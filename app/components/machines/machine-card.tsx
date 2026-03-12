"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Play,
  Square,
  Trash2,
  MoreVertical,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Terminal,
  Server,
  Save,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import { formatTimeRemaining } from "@/lib/utils/subscription";
import type { UserMachine, MachineStatus } from "@/types/machines.types";

interface MachineCardProps {
  machine: UserMachine;
  onUpdate: (machine: UserMachine) => void;
  onDelete: (machineId: string) => void;
}

const statusConfig: Record<MachineStatus, { color: string; icon: any; label: string }> = {
  creating: { color: "blue", icon: Loader2, label: "Creating" },
  starting: { color: "blue", icon: Loader2, label: "Starting" },
  running: { color: "green", icon: CheckCircle, label: "Running" },
  stopping: { color: "yellow", icon: Loader2, label: "Stopping" },
  stopped: { color: "gray", icon: Square, label: "Stopped" },
  error: { color: "red", icon: AlertCircle, label: "Error" },
  deleting: { color: "red", icon: Loader2, label: "Deleting" },
};

export function MachineCard({ machine, onUpdate, onDelete }: MachineCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<ReturnType<typeof formatTimeRemaining> | null>(null);
  const { isFreeTier, loading: subscriptionLoading } = useSubscription();

  const status = statusConfig[machine.status];
  const StatusIcon = status.icon;
  const isTemporary = machine.id.startsWith('temp-');
  const isLocal = machine.settings?.isLocal || machine.id.startsWith('local-');
  const isElectron = machine.settings?.provider === 'electron';
  const isAws = machine.settings?.provider === 'aws';

  useEffect(() => {
    if (!isFreeTier || subscriptionLoading || isLocal) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const remaining = formatTimeRemaining(machine.createdAt);
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();

    const interval = setInterval(updateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [isFreeTier, subscriptionLoading, machine.createdAt, isLocal]);

  const handleAction = async (action: "start" | "stop" | "restart" | "delete" | "snapshot") => {
    setLoading(action);

    try {
      const response = await fetch(`/api/machines/${machine.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Action failed");
      }

      const data = await response.json();

      if (action === "snapshot") {
        toast.success("Snapshot created successfully", { duration: 5000 });
        return;
      }

      if ((action === "start" || action === "restart") && data.recreated && data.vncPassword) {
        toast.success(
          `Machine ${action === "restart" ? "restarted" : "recreated"} with new password. Please use the new password to connect.`,
          { duration: 8000 }
        );

        const updatedMachine = {
          ...machine,
          vncPassword: data.vncPassword,
          status: "starting" as "starting"
        };
        onUpdate(updatedMachine);
      } else {
        const message = action === "start" ? "Machine starting..." :
                        action === "stop" ? "Machine stopping..." :
                        action === "restart" ? "Machine restarting..." :
                        "Machine deleted";

        toast.success(message);

        if (action === "delete") {
          onDelete(machine.id);
        } else {
          const newStatus = action === "start" ? "starting" :
                           action === "stop" ? "stopping" :
                           action === "restart" ? "stopping" :
                           "starting";
          onUpdate({ ...machine, status: newStatus as any });
        }
      }

      if (action !== "delete") {
        pollMachineStatus(machine.id);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(null);
      setShowDeleteDialog(false);
    }
  };

  const pollMachineStatus = async (machineId: string, attempts = 0) => {
    if (attempts > 20) return;

    try {
      const response = await fetch(`/api/machines/${machineId}`);
      if (response.ok) {
        const data = await response.json();
        onUpdate(data.machine);

        if (["creating", "starting", "stopping"].includes(data.machine.status)) {
          setTimeout(() => pollMachineStatus(machineId, attempts + 1), 3000);
        } else if (data.machine.status === "error") {
          const statusResponse = await fetch(`/api/machines/${machineId}/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.needsRecreation) {
              toast.error("Machine was deallocated. Please try starting it again.");
            }
          }
        }
      }
    } catch (error) {
      console.error("Error polling machine status:", error);
    }
  };

  const handleConnect = () => {
    if (!isTemporary) {
      router.push(`/machines/${machine.id}`);
    }
  };

  const formatUptime = () => {
    if (!machine.startedAt || machine.status !== "running") return null;

    const start = new Date(machine.startedAt);
    const now = new Date();
    const hours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
    const minutes = Math.floor(((now.getTime() - start.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const isTransitioning = ["creating", "starting", "stopping", "deleting"].includes(machine.status);

  return (
    <>
      <Card className={cn(
        "relative overflow-hidden group transition-all duration-300 h-full",
        "border-border/30 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-border/50 hover:shadow-lg hover:shadow-foreground/[0.02]",
        machine.status === "error" && "border-destructive/20 bg-destructive/[0.02]"
      )}>
        {/* Subtle status indicator line at top */}
        {machine.status === "running" && (
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        )}
        {(machine.status === "creating" || machine.status === "starting") && (
          <div className="absolute top-0 inset-x-0 h-px overflow-hidden">
            <div
              className="h-full w-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)",
                animation: "slide 2s linear infinite",
              }}
            />
          </div>
        )}
        {machine.status === "stopping" && (
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        )}

        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-base font-medium truncate pr-2 flex items-center gap-2">
                {machine.displayName}
                {isElectron && (
                  <span className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-blue-500 dark:text-blue-400">
                    Desktop
                  </span>
                )}
                {isAws && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-foreground/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Server className="h-2.5 w-2.5" />
                    SSH
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs truncate">
                {isElectron ? `Connected via Desktop App` : isLocal ? `Local Docker: ${machine.containerName}` : isAws ? `Cloud Machine - SSH` : machine.containerName}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleConnect}
                  disabled={isTemporary}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {!isElectron && (
                  <>
                    <DropdownMenuSeparator />
                    {isAws && (
                      <DropdownMenuItem
                        onClick={() => handleAction("snapshot")}
                        disabled={machine.status !== "running" || loading !== null || isTemporary}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {loading === "snapshot" ? "Saving..." : "Create Snapshot"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleAction("restart")}
                      disabled={machine.status !== "running" || loading !== null || isTemporary}
                    >
                      Restart
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={machine.status === "running" || loading !== null || isTemporary}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1 flex flex-col pt-0">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              machine.status === "running" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              machine.status === "stopped" && "bg-foreground/[0.05] text-muted-foreground",
              machine.status === "error" && "bg-destructive/10 text-destructive",
              (machine.status === "creating" || machine.status === "starting") && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              machine.status === "stopping" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              machine.status === "deleting" && "bg-destructive/10 text-destructive",
            )}>
              <StatusIcon className={cn("h-3 w-3", isTransitioning && "animate-spin")} />
              {status.label}
            </div>
            {formatUptime() && (
              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {formatUptime()}
              </span>
            )}
          </div>

          {/* Restored from snapshot indicator */}
          {machine.settings?.restoredFromSnapshot && (
            <div className="flex items-center gap-1.5 text-xs text-blue-500/80">
              <History className="h-3 w-3" />
              <span>Restored from snapshot</span>
            </div>
          )}

          {/* Machine type hint */}
          {isElectron && (
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Running on your local computer via the Desktop App.
            </p>
          )}

          {/* Auto-deletion notice for free tier users */}
          {timeRemaining && isFreeTier && !subscriptionLoading && (
            <div className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
              timeRemaining.isExpiringSoon
                ? "border-destructive/20 bg-destructive/[0.04]"
                : "border-border/30 bg-foreground/[0.02]"
            )}>
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground truncate">
                  {timeRemaining.timeString === "Expired"
                    ? <span className="font-medium text-destructive">Machine expired</span>
                    : <>Deletes in <span className="font-medium text-foreground">{timeRemaining.timeString}</span></>
                  }
                </p>
              </div>
              <a
                href="/account?section=billing"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground hover:opacity-70 transition-opacity"
              >
                Upgrade
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Status Message */}
          {machine.statusMessage && (
            <p className={`text-xs ${machine.status === "error" ? "text-destructive" : "text-muted-foreground/70"}`}>
              {machine.statusMessage}
            </p>
          )}

          {/* Error state info */}
          {machine.status === "error" && (
            <div className="rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3 py-2.5">
              <p className="text-xs text-destructive/80">
                Machine encountered an error. Try starting it again or contact support if the issue persists.
              </p>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {isElectron ? (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                onClick={handleConnect}
                className="flex-1 h-9 rounded-xl font-medium"
              >
                <Monitor className="h-4 w-4 mr-1.5" />
                View Details
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              {(machine.status === "stopped" || machine.status === "error") && !isTemporary && (
                <Button
                  size="sm"
                  onClick={() => handleAction("start")}
                  disabled={loading !== null}
                  className="flex-1 h-9 rounded-xl font-medium"
                >
                  {loading === "start" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1.5" />
                      {machine.status === "error" ? "Retry Start" : "Start"}
                    </>
                  )}
                </Button>
              )}

              {machine.status === "running" && !isTemporary && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleConnect}
                    className="flex-1 h-9 rounded-xl font-medium"
                  >
                    {isAws ? (
                      <>
                        <Terminal className="h-4 w-4 mr-1.5" />
                        Connect
                      </>
                    ) : (
                      <>
                        <Monitor className="h-4 w-4 mr-1.5" />
                        Open
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("stop")}
                    disabled={loading !== null}
                    className="h-9 w-9 p-0 rounded-xl border-border/40"
                  >
                    {loading === "stop" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}

              {(isTransitioning || (isTemporary && machine.status === "creating")) && (
                <Button size="sm" disabled className="flex-1 h-9 rounded-xl">
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {isTemporary ? "Creating machine..." : `${status.label}...`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{machine.displayName}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction("delete")}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
