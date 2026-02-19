"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Monitor, Cpu, HardDrive, MemoryStick, MonitorCog, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";

import { toast } from "sonner";
import { NoiseBackground } from "@/components/ui/noise-background";
import { MachineCard } from "@/app/components/machines/machine-card";
import { CreateMachineDialog } from "@/app/components/machines/create-machine-dialog";
import { UsageStats } from "@/app/components/machines/usage-stats";
import type { UserMachine, MachineUsage } from "@/types/machines.types";
import { useSubscription } from "@/hooks/use-subscription";

interface MachinesData {
  machines: UserMachine[];
  limits: {
    max_machines: number;
    max_cpu_cores: number;
    max_memory_gb: number;
    max_storage_gb: number;
  };
  usage: {
    machines_count: number;
    total_cpu_cores: number;
    total_memory_gb: number;
    total_storage_gb: number;
  };
}

export function MachinesContent() {
  const router = useRouter();
  const { isFreeTier, loading: subscriptionLoading } = useSubscription();
  // Remove unused store methods since we're fetching directly from database
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<UserMachine[]>([]);
  const [limits, setLimits] = useState<MachinesData["limits"]>({
    max_machines: 3,
    max_cpu_cores: 4,
    max_memory_gb: 8,
    max_storage_gb: 50,
  });
  const [usage, setUsage] = useState<MachinesData["usage"]>({
    machines_count: 0,
    total_cpu_cores: 0,
    total_memory_gb: 0,
    total_storage_gb: 0,
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusPollingIntervals, setStatusPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fastPollingTimeout, setFastPollingTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchMachines();
  }, []);
  
  useEffect(() => {
    // Start polling for any machines that are in transitioning states
    const transitioningMachines = machines.filter(m => 
      ["creating", "starting", "stopping", "deleting"].includes(m.status)
    );
    
    transitioningMachines.forEach(machine => {
      // Only start polling if we're not already polling this machine
      if (!statusPollingIntervals.has(machine.id)) {
        pollMachineStatus(machine.id);
      }
    });
  }, [machines.length]); // Only re-run when number of machines changes
  
  useEffect(() => {
    // Cleanup intervals on unmount
    return () => {
      statusPollingIntervals.forEach(interval => clearInterval(interval));
      if (fastPollingTimeout) {
        clearTimeout(fastPollingTimeout);
      }
    };
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await fetch("/api/machines");
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth");
          return;
        }
        throw new Error("Failed to fetch machines");
      }

      const data: MachinesData = await response.json();
      
      // Set machines directly from database
      setMachines(data.machines);
      setLimits(data.limits);
      
      // Calculate usage from database machines only
      const totalCpuCores = data.machines.reduce((sum, m) => sum + (m.cpuCores || 0), 0);
      const totalMemoryGb = data.machines.reduce((sum, m) => sum + (m.memoryGb || 0), 0);
      const totalStorageGb = data.machines.reduce((sum, m) => sum + (m.storageGb || 0), 0);
      
      setUsage({
        machines_count: data.machines.length,
        total_cpu_cores: totalCpuCores,
        total_memory_gb: totalMemoryGb,
        total_storage_gb: totalStorageGb,
      });
      
      // Start polling for machines that are in creating/starting state
      data.machines.forEach(machine => {
        if ((machine.status === "creating" || machine.status === "starting") && !statusPollingIntervals.has(machine.id)) {
          pollMachineStatus(machine.id);
        }
      });
    } catch (error) {
      console.error("Error fetching machines:", error);
      toast.error("Failed to load machines");
    } finally {
      setLoading(false);
    }
  };

  const pollMachineStatus = (machineId: string) => {
    // Poll every 5 seconds for creating/starting machines
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/machines");
        if (!response.ok) {
          console.error("Failed to poll machine status");
          return;
        }
        
        const data: MachinesData = await response.json();
        const machine = data.machines.find(m => m.id === machineId);
        
        if (!machine || (machine.status !== "creating" && machine.status !== "starting")) {
          // Machine is no longer in creating/starting state, stop polling
          clearInterval(interval);
          statusPollingIntervals.delete(machineId);
          
          // Update the machines list with latest data
          setMachines(data.machines);
          
          // If machine was in creating/starting state and is now running, show notification
          const machine = data.machines.find(m => m.id === machineId);
          if (machine?.status === "running") {
            clearInterval(interval);
            statusPollingIntervals.delete(machineId);
            toast.success(`${machine.displayName} is now running!`, {
              description: "You can now connect to your machine.",
              action: {
                label: "Open",
                onClick: () => window.location.href = `/machines/${machineId}`,
              },
            });
          } else if (machine?.status === "error") {
            clearInterval(interval);
            statusPollingIntervals.delete(machineId);
            toast.error(`${machine.displayName} encountered an error`, {
              description: "Please try creating the machine again.",
            });
          }
        }
      } catch (error) {
        console.error("Error polling machine status:", error);
      }
    }, 5000);
    
    // Track the interval so we can clean it up
    statusPollingIntervals.set(machineId, interval);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMachines();
    setRefreshing(false);
  };

  const handleMachineCreated = async () => {
    // Immediately refresh to show the creating machine
    await fetchMachines();
    
    // Set up fast polling for 30 seconds to catch the new machine quickly
    if (fastPollingTimeout) {
      clearTimeout(fastPollingTimeout);
    }
    
    let pollCount = 0;
    const fastPoll = async () => {
      pollCount++;
      await fetchMachines();
      
      // Continue fast polling for up to 30 seconds (15 polls at 2 second intervals)
      if (pollCount < 15) {
        const timeout = setTimeout(fastPoll, 2000);
        setFastPollingTimeout(timeout);
      } else {
        setFastPollingTimeout(null);
      }
    };
    
    // Start fast polling after 1 second
    const timeout = setTimeout(fastPoll, 1000);
    setFastPollingTimeout(timeout);
  };
  
  // Removed pollForPendingMachine - we now poll for all creating/starting machines
  // Removed startStatusPolling - now using simpler pollMachineStatus

  const handleMachineUpdated = (updatedMachine: UserMachine) => {
    setMachines(machines.map(m => 
      m.id === updatedMachine.id ? updatedMachine : m
    ));
  };

  const handleMachineDeleted = (machineId: string) => {
    setMachines(machines.filter(m => m.id !== machineId));
    toast.success("Machine deleted successfully");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading machines...</span>
        </div>
      </div>
    );
  }

  const runningMachines = machines.filter(m => m.status === "running").length;
  const creatingMachines = machines.filter(m => m.status === "creating").length;
  const stoppedMachines = machines.filter(m => m.status === "stopped").length;
  const totalMachines = machines.length;

  // Filter machines based on selected status
  const filteredMachines = statusFilter === "all" 
    ? machines 
    : machines.filter(m => m.status === statusFilter);

  const statusFilters = [
    { id: "all", label: "All", count: totalMachines },
    { id: "running", label: "Running", count: runningMachines },
    { id: "creating", label: "Creating", count: creatingMachines },
    { id: "stopped", label: "Stopped", count: stoppedMachines },
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-invisible relative bg-transparent">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Virtual Machines</h1>
            <p className="text-muted-foreground mt-1">
              Manage your AI-controlled desktop environments
            </p>
          </div>
          <NoiseBackground
            containerClassName="w-auto p-[1px] rounded-lg bg-transparent dark:bg-transparent shadow-none"
            className="p-0"
            gradientColors={["rgb(139, 92, 246)", "rgb(99, 102, 241)", "rgb(168, 85, 247)"]}
            noiseIntensity={0.06}
            speed={0.06}
          >
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex h-10 items-center justify-center rounded-[7px] bg-background/80 px-5 text-sm font-medium text-foreground transition-opacity hover:opacity-80 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Machine
            </button>
          </NoiseBackground>
        </div>

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

        {/* Usage Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: "Machines", used: usage.machines_count, max: limits.max_machines, icon: Monitor },
            { label: "CPU Cores", used: usage.total_cpu_cores, max: limits.max_cpu_cores, icon: Cpu },
            { label: "Memory", used: usage.total_memory_gb, max: limits.max_memory_gb, unit: "GB", icon: MemoryStick },
            { label: "Storage", used: usage.total_storage_gb, max: limits.max_storage_gb, unit: "GB", icon: HardDrive },
          ].map((stat) => {
            const pct = stat.max > 0 ? Math.min((stat.used / stat.max) * 100, 100) : 0;
            const r = 20;
            const circ = 2 * Math.PI * r;
            const offset = circ - (pct / 100) * circ;
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative flex items-center gap-3 rounded-xl border bg-card p-3.5 overflow-hidden transition-colors hover:border-foreground/15"
              >
                {/* Subtle usage fill */}
                <div
                  className="absolute inset-y-0 left-0 bg-foreground/[0.03] transition-all duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
                {/* Ring */}
                <div className="relative h-11 w-11 flex-shrink-0">
                  <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
                    <circle
                      cx="22" cy="22" r={r}
                      fill="none" strokeWidth="2.5"
                      className="stroke-muted"
                    />
                    <circle
                      cx="22" cy="22" r={r}
                      fill="none" strokeWidth="2.5" strokeLinecap="round"
                      className="stroke-foreground/70 transition-all duration-700 ease-out"
                      style={{ strokeDasharray: circ, strokeDashoffset: offset }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                {/* Text */}
                <div className="relative min-w-0">
                  <p className="text-sm font-semibold tabular-nums leading-none">
                    {stat.used}
                    <span className="text-muted-foreground font-normal text-xs ml-0.5">/ {stat.max}{stat.unit ? ` ${stat.unit}` : ""}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Filters */}
        {machines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`
                  px-4 py-2 rounded-lg transition-all duration-300
                  ${statusFilter === filter.id 
                    ? 'bg-foreground text-background font-medium' 
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`
                      text-xs px-1.5 py-0.5 rounded-full
                      ${statusFilter === filter.id 
                        ? 'bg-background/20' 
                        : 'bg-foreground/10'
                      }
                    `}>
                      {filter.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Machines Grid */}
        {machines.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MonitorCog className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No machines yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first virtual machine to get started with AI-controlled desktops
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Machine
              </Button>
            </CardContent>
          </Card>
        ) : filteredMachines.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No {statusFilter !== 'all' ? statusFilter : ''} machines</h3>
              <p className="text-muted-foreground text-center">
                {statusFilter === 'all' 
                  ? 'No machines found.' 
                  : `No machines are currently ${statusFilter}.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMachines.map(machine => (
              <MachineCard
                key={machine.id}
                machine={machine}
                onUpdate={handleMachineUpdated}
                onDelete={handleMachineDeleted}
              />
            ))}
          </div>
        )}

        {/* Create Machine Dialog */}
        <CreateMachineDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            // If dialog is being closed (after creation), trigger fast polling
            if (!open && showCreateDialog) {
              handleMachineCreated();
            }
          }}
          onMachineCreated={handleMachineCreated}
        />
      </div>
    </div>
  );
}