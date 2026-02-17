"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Play,
  Square,
  Trash2,
  MoreVertical,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Crown,
  Terminal,
  Server
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
  const isAws = machine.settings?.provider === 'aws';

  // Update time remaining for free tier users
  useEffect(() => {
    if (!isFreeTier || subscriptionLoading || isLocal) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const remaining = formatTimeRemaining(machine.createdAt);
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimeRemaining();

    // Update every minute
    const interval = setInterval(updateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [isFreeTier, subscriptionLoading, machine.createdAt, isLocal]);

  const handleAction = async (action: "start" | "stop" | "restart" | "delete") => {
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

      // Handle password update if container was recreated
      if ((action === "start" || action === "restart") && data.recreated && data.vncPassword) {
        toast.success(
          `Machine ${action === "restart" ? "restarted" : "recreated"} with new password. Please use the new password to connect.`,
          { duration: 8000 }
        );
        
        // Update machine with new password
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
          // Update machine status locally
          const newStatus = action === "start" ? "starting" :
                           action === "stop" ? "stopping" :
                           action === "restart" ? "stopping" : // restart starts with stopping
                           "starting";
          onUpdate({ ...machine, status: newStatus as any });
        }
      }
      
      // Poll for status updates
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
    if (attempts > 20) return; // Stop after 20 attempts (about 1 minute)

    try {
      const response = await fetch(`/api/machines/${machineId}`);
      if (response.ok) {
        const data = await response.json();
        onUpdate(data.machine);
        
        // Continue polling if still transitioning
        if (["creating", "starting", "stopping"].includes(data.machine.status)) {
          setTimeout(() => pollMachineStatus(machineId, attempts + 1), 3000);
        } else if (data.machine.status === "error") {
          // Check if it's a deallocation error
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
        "relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-0"
      )}>
        {/* Rotating beam effect for active states */}
        {(machine.status === "running" || machine.status === "creating" || machine.status === "stopping") && (
          <>
            {/* Animated border container */}
            <div className="absolute -inset-[2px] rounded-lg overflow-hidden">
              <div
                className="absolute w-full h-full animate-rotate-beam dark:brightness-150"
                style={{
                  filter: "drop-shadow(0 0 6px rgba(0, 0, 0, 0.2)) drop-shadow(0 0 12px currentColor)",
                  background: machine.status === "running" 
                    ? `conic-gradient(from var(--beam-angle) at 50% 50%, 
                        transparent 0deg, 
                        rgba(34, 197, 94, 0.2) 5deg, 
                        rgba(34, 197, 94, 0.5) 10deg, 
                        rgba(34, 197, 94, 0.8) 20deg, 
                        rgba(255, 255, 255, 1) 30deg, 
                        rgba(34, 197, 94, 0.8) 40deg, 
                        rgba(34, 197, 94, 0.5) 50deg, 
                        rgba(34, 197, 94, 0.2) 55deg, 
                        transparent 60deg, 
                        transparent 360deg)`
                    : machine.status === "creating"
                    ? `conic-gradient(from var(--beam-angle) at 50% 50%, 
                        transparent 0deg, 
                        rgba(59, 130, 246, 0.2) 5deg, 
                        rgba(59, 130, 246, 0.5) 10deg, 
                        rgba(59, 130, 246, 0.8) 20deg, 
                        rgba(255, 255, 255, 1) 30deg, 
                        rgba(59, 130, 246, 0.8) 40deg, 
                        rgba(59, 130, 246, 0.5) 50deg, 
                        rgba(59, 130, 246, 0.2) 55deg, 
                        transparent 60deg, 
                        transparent 360deg)`
                    : `conic-gradient(from var(--beam-angle) at 50% 50%, 
                        transparent 0deg, 
                        rgba(249, 115, 22, 0.2) 5deg, 
                        rgba(249, 115, 22, 0.5) 10deg, 
                        rgba(249, 115, 22, 0.8) 20deg, 
                        rgba(255, 255, 255, 1) 30deg, 
                        rgba(249, 115, 22, 0.8) 40deg, 
                        rgba(249, 115, 22, 0.5) 50deg, 
                        rgba(249, 115, 22, 0.2) 55deg, 
                        transparent 60deg, 
                        transparent 360deg)`,
                }}
              />
            </div>
            
            {/* Inner content mask with slight inset for border visibility */}
            <div className="absolute inset-[2px] bg-background rounded-lg z-[1]" />
            
            <style jsx>{`
              @property --beam-angle {
                syntax: '<angle>';
                inherits: false;
                initial-value: 0deg;
              }
              
              @keyframes rotate-beam {
                from {
                  --beam-angle: 0deg;
                }
                to {
                  --beam-angle: 360deg;
                }
              }
              
              .animate-rotate-beam {
                animation: rotate-beam 3s linear infinite;
              }
            `}</style>
          </>
        )}
        
        {/* Error state background */}
        {machine.status === "error" && (
          <div className="absolute inset-0 bg-red-500/5 rounded-lg" />
        )}
        
        {/* Content container with higher z-index */}
        <div className="relative z-[2]">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg truncate pr-2 flex items-center gap-2">
                {machine.displayName}
                {isLocal && <span className="text-blue-500 text-sm">🐳</span>}
                {isAws && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal gap-1">
                    <Server className="h-3 w-3" />
                    SSH
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs truncate pr-2">
                {isLocal ? `Local Docker: ${machine.containerName}` : isAws ? `Cloud Machine - SSH` : machine.containerName}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={handleConnect}
                  disabled={machine.status !== "running" || isTemporary}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Badge 
              variant={machine.status === "running" ? "default" : "secondary"}
              className="gap-1"
            >
              <StatusIcon className={`h-3 w-3 ${isTransitioning ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
            {formatUptime() && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatUptime()}
              </span>
            )}
          </div>

          {/* Resources */}
          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{machine.cpuCores} vCPU</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{machine.storageGb} GB</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <Monitor className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{machine.memoryGb} GB RAM</span>
            </div>
          </div>

          {/* Auto-deletion warning for free tier users */}
          {timeRemaining && isFreeTier && !subscriptionLoading && (
            <div className={`rounded-md p-2 border ${
              timeRemaining.isExpiringSoon
                ? "bg-destructive/10 border-destructive/20"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                  timeRemaining.isExpiringSoon ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${
                    timeRemaining.isExpiringSoon ? "text-destructive" : "text-amber-800 dark:text-amber-200"
                  }`}>
                    {timeRemaining.timeString === "Expired"
                      ? "Machine expired"
                      : `Auto-deletes in ${timeRemaining.timeString}`
                    }
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    timeRemaining.isExpiringSoon
                      ? "text-destructive/80"
                      : "text-amber-700 dark:text-amber-300"
                  }`}>
                    <Crown className="h-3 w-3 inline mr-1" />
                    Upgrade for persistent machines
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {machine.statusMessage && (
            <p className={`text-xs ${machine.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {machine.statusMessage}
            </p>
          )}
          
          {/* Error state info */}
          {machine.status === "error" && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
              <p className="text-xs text-destructive">
                Machine encountered an error. Try starting it again or contact support if the issue persists.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {(machine.status === "stopped" || machine.status === "error") && !isTemporary && (
              <Button
                size="sm"
                onClick={() => handleAction("start")}
                disabled={loading !== null}
                className="flex-1"
              >
                {loading === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
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
                  className="flex-1"
                >
                  {isAws ? (
                    <>
                      <Terminal className="h-4 w-4 mr-1" />
                      Connect
                    </>
                  ) : (
                    <>
                      <Monitor className="h-4 w-4 mr-1" />
                      Open
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("stop")}
                  disabled={loading !== null}
                >
                  {loading === "stop" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            
            {(isTransitioning || (isTemporary && machine.status === "creating")) && (
              <Button size="sm" disabled className="flex-1">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {isTemporary ? "Creating machine..." : `${status.label}...`}
              </Button>
            )}
          </div>
        </CardContent>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Machine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{machine.displayName}"? This action cannot be undone.
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