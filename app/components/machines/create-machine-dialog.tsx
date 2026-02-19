"use client";

import { useState, useEffect } from "react";
import { Loader2, HardDrive, Info, AlertCircle, Clock, Monitor, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { NoiseBackground } from "@/components/ui/noise-background";
import { useSubscription } from "@/hooks/use-subscription";
import type { UserMachine } from "@/types/machines.types";

interface CreateMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMachineCreated: () => void;
}

interface MachineLimits {
  max_machines: number;
  max_cpu_cores: number;
  max_memory_gb: number;
  max_storage_gb: number;
}

interface MachineApiResponse {
  machines: UserMachine[];
  limits: MachineLimits;
  subscriptionTier?: string | null;
  usage: MachineUsage;
}

interface MachineUsage {
  machines_count: number;
  total_cpu_cores: number;
  total_memory_gb: number;
  total_storage_gb: number;
}

export function CreateMachineDialog({
  open,
  onOpenChange,
  onMachineCreated,
}: CreateMachineDialogProps) {
  const { isFreeTier, loading: subscriptionLoading } = useSubscription();
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [desktopEnabled, setDesktopEnabled] = useState(true);
  const [storageGb, setStorageGb] = useState(16);
  const [limits, setLimits] = useState<MachineLimits | null>(null);
  const [usage, setUsage] = useState<MachineUsage | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLimitsAndUsage();
    }
  }, [open]);

  const fetchLimitsAndUsage = async () => {
    try {
      setLoadingLimits(true);
      const response = await fetch("/api/machines");
      if (response.ok) {
        const data: MachineApiResponse = await response.json();
        console.log("Fetched machine data:", data); // Debug log
        setLimits(data.limits);
        setUsage(data.usage);
        setSubscriptionTier(data.subscriptionTier || null);
      } else {
        console.error("Failed to fetch limits, status:", response.status);
        const errorText = await response.text();
        console.error("Error response:", errorText);
      }
    } catch (error) {
      console.error("Failed to fetch limits and usage:", error);
    } finally {
      setLoadingLimits(false);
    }
  };

  // Check if adding new resources would exceed limits
  const wouldExceedLimit = () => {
    if (!limits || !usage) return false;

    const memoryNeeded = desktopEnabled ? 2 : 0.5;
    return (
      usage.machines_count >= limits.max_machines ||
      usage.total_cpu_cores + 2 > limits.max_cpu_cores ||
      usage.total_memory_gb + memoryNeeded > limits.max_memory_gb ||
      usage.total_storage_gb + storageGb > limits.max_storage_gb
    );
  };

  const getRemainingResources = () => {
    if (!limits || !usage) return null;
    
    return {
      machines: limits.max_machines - usage.machines_count,
      cpu: limits.max_cpu_cores - usage.total_cpu_cores,
      memory: limits.max_memory_gb - usage.total_memory_gb,
      storage: limits.max_storage_gb - usage.total_storage_gb,
    };
  };

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter a machine name");
      return;
    }

    if (displayName.trim().toLowerCase().startsWith("local")) {
      toast.error("Machine name cannot start with 'local'");
      return;
    }

    setCreating(true);

    // Store the values
    const machineConfig = {
      displayName: displayName.trim(),
      provider: 'aws' as const,
      storageGb,
      desktopEnabled,
    };

    try {
      // Start the creation request
      const responsePromise = fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(machineConfig),
      });

      // Show immediate success and close dialog
      toast.success("Machine creation started!", {
        description: desktopEnabled
          ? "Your desktop machine is being launched. Desktop will be ready in 1-3 minutes."
          : "Your cloud machine is being launched. SSH key will be available once ready.",
        duration: 5000,
      });

      // Reset form for next time
      setDisplayName("");
      setDesktopEnabled(true);
      setStorageGb(16);
      setCreating(false);

      // Close dialog immediately
      onOpenChange(false);
      
      // Refresh the machines list immediately to show creating status
      onMachineCreated();
      
      // Handle the response in the background
      responsePromise.then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          toast.error(error.error || "Failed to create machine", {
            description: "Please check your limits and try again.",
          });
          // Refresh list to remove any failed machine
          onMachineCreated();
        } else {
          // Machine created successfully - list will auto-update via polling
          const data = await response.json();
          console.log("Machine created successfully:", data.machine.id);
        }
      }).catch((error) => {
        console.error("Machine creation error:", error);
        toast.error("Network error while creating machine", {
          description: "Please check your connection and try again.",
        });
        // Refresh list to remove any failed machine
        onMachineCreated();
      });
      
    } catch (error: any) {
      // This should rarely happen since we're handling errors in the promise
      toast.error(error.message, {
        description: "Failed to start machine creation.",
      });
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="create-machine-dialog max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Virtual Machine</DialogTitle>
          <DialogDescription>
            Spin up a cloud Linux machine with SSH access
          </DialogDescription>
        </DialogHeader>

        {/* Subscription Tier Display */}
        {subscriptionTier && (
          <div className="flex items-center gap-2 -mt-2 mb-2">
            <span className="text-xs text-muted-foreground">Subscription:</span>
            <Badge variant={subscriptionTier === 'enterprise' ? 'default' : subscriptionTier === 'professional' ? 'secondary' : 'outline'}>
              {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}
            </Badge>
          </div>
        )}

        {/* Free Tier Notice */}
        {!subscriptionLoading && isFreeTier && (
          <NoiseBackground
            containerClassName="w-full p-[1px] rounded-lg bg-transparent dark:bg-transparent shadow-none"
            className="p-0"
            gradientColors={["rgb(139, 92, 246)", "rgb(99, 102, 241)", "rgb(168, 85, 247)"]}
            noiseIntensity={0.06}
            speed={0.06}
          >
            <div className="flex items-center justify-between gap-3 rounded-[7px] bg-background/80 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground truncate">
                  Free machines expire after <span className="font-medium text-foreground">2 hours</span>
                </p>
              </div>
              <a
                href="/account?section=billing"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground hover:opacity-80 transition-opacity"
              >
                Upgrade
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </NoiseBackground>
        )}

        {/* Usage and Limits Display */}
        {loadingLimits ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading limits...</span>
          </div>
        ) : limits && usage ? (
          <div className="space-y-3 py-2">
            {/* Current Usage Alert */}
            <Alert className={wouldExceedLimit() ? "border-destructive" : ""}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Your Current Usage</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Machines</div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(usage.machines_count / limits.max_machines) * 100} 
                          className="h-2 flex-1"
                        />
                        <span className="font-mono">
                          {usage.machines_count}/{limits.max_machines}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">CPU Cores</div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(usage.total_cpu_cores / limits.max_cpu_cores) * 100} 
                          className="h-2 flex-1"
                        />
                        <span className="font-mono">
                          {usage.total_cpu_cores}/{limits.max_cpu_cores}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Memory (GB)</div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(usage.total_memory_gb / limits.max_memory_gb) * 100} 
                          className="h-2 flex-1"
                        />
                        <span className="font-mono">
                          {usage.total_memory_gb}/{limits.max_memory_gb}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Storage (GB)</div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(usage.total_storage_gb / limits.max_storage_gb) * 100} 
                          className="h-2 flex-1"
                        />
                        <span className="font-mono">
                          {usage.total_storage_gb}/{limits.max_storage_gb}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Warning if would exceed limits */}
            {wouldExceedLimit() && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This configuration would exceed your limits. Please reduce resources or stop existing machines.
                </AlertDescription>
              </Alert>
            )}

            {/* Show what resources would be after creation */}
            {!wouldExceedLimit() && getRemainingResources() && (
              <div className="text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  After creation, you'll have remaining: {getRemainingResources()!.cpu} vCPU, 
                  {' '}{getRemainingResources()!.memory}GB RAM, {getRemainingResources()!.storage}GB storage
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4">
            No limits data available. You may not have an active subscription.
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Machine Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Machine Name</Label>
            <Input
              id="name"
              placeholder="My Cloud Server"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={creating}
              className={displayName.trim().toLowerCase().startsWith("local") ? "border-destructive" : ""}
            />
            {displayName.trim().toLowerCase().startsWith("local") && (
              <p className="text-xs text-destructive">
                Machine name cannot start with "local"
              </p>
            )}
          </div>

          {/* Machine Info */}
          <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
            <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">Ubuntu Desktop (2 vCPU, 2 GB RAM)</p>
              <p>Full desktop with VNC access via browser</p>
              <p>Desktop takes 1-3 min to initialize after machine starts</p>
            </div>
          </div>

          {/* Machine Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Storage
                </Label>
                <span className="text-sm font-medium">{storageGb} GB</span>
              </div>
              <Slider
                value={[storageGb]}
                onValueChange={([value]) => setStorageGb(value)}
                min={16}
                max={30}
                step={1}
                disabled={creating}
              />
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={creating || !displayName.trim() || displayName.trim().toLowerCase().startsWith("local") || wouldExceedLimit()}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Machine"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}