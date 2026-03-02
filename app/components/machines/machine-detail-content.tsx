"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Monitor, 
  Activity, 
  Terminal, 
  Settings, 
  Loader2, 
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  ExternalLink,
  FolderOpen,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { MachineLayout } from "./machine-layout";
import { SimpleVNCViewer } from "./simple-vnc-viewer";
import { MachineSettings } from "./machine-settings";
import { FileTransfer } from "./file-transfer";
import { SshConnectionPanel } from "./ssh-connection-panel";
import { toast } from "sonner";
import type { UserMachine, MachineSession } from "@/types/machines.types";

interface MachineDetailContentProps {
  machineId: string;
}

export function MachineDetailContent({ machineId }: MachineDetailContentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [machine, setMachine] = useState<UserMachine | null>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchMachineData();
    
    // Poll for updates if machine is in transitional state or desktop is initializing
    const interval = setInterval(() => {
      if (machine && (
        ['creating', 'starting', 'stopping'].includes(machine.status) ||
        machine.settings?.desktopInitStatus === 'installing'
      )) {
        fetchMachineData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [machineId, machine?.status, machine?.settings?.desktopInitStatus]);

  const fetchMachineData = async () => {
    try {
      const response = await fetch(`/api/machines/${machineId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Machine not found");
        } else if (response.status === 401) {
          router.push("/auth");
        } else {
          setError("Failed to load machine");
        }
        return;
      }

      const data = await response.json();
      setMachine(data.machine);
      setUsage(data.usage || []);
    } catch (error) {
      console.error("Error fetching machine:", error);
      setError("Failed to load machine");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "start" | "stop" | "restart" | "delete" | "snapshot") => {
    if (!machine) return;

    // Confirm deletion
    if (action === "delete") {
      if (!confirm("Are you sure you want to delete this machine? This action cannot be undone.")) {
        return;
      }
    }

    setActionLoading(action);

    try {
      const response = await fetch(`/api/machines/${machineId}`, {
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
      if (action === "start" && data.recreated && data.vncPassword) {
        toast.success(
          "Machine recreated with new password. Please use the new password to connect.",
          { duration: 8000 }
        );

        // Update machine with new password
        setMachine(prev => prev ? { ...prev, vncPassword: data.vncPassword } : null);
      } else if (action === "snapshot") {
        toast.success(`Snapshot created successfully (${data.amiId})`, { duration: 5000 });
      } else {
        const message = action === "start" ? "Machine starting..." :
                        action === "stop" ? "Machine stopping..." :
                        action === "restart" ? "Machine restarting..." :
                        "Machine deleted";

        toast.success(message);
      }

      if (action === "delete") {
        router.push("/machines");
      } else {
        // Refresh machine data
        fetchMachineData();
      }
    } catch (error: any) {
      toast.error(error.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };


  if (loading) {
    return (
      <MachineLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MachineLayout>
    );
  }

  if (error || !machine) {
    return (
      <MachineLayout>
        <div className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || "Machine not found"}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => router.push("/machines")}
            className="mt-4"
          >
            Back to Machines
          </Button>
        </div>
      </MachineLayout>
    );
  }


  return (
    <MachineLayout
      machineId={machine.id}
      machineName={machine.displayName}
      machineStatus={machine.status}
    >
      <div className="py-6 space-y-6">
        {/* Machine Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl">{machine.displayName}</CardTitle>
                <CardDescription className="text-sm">
                  Created {new Date(machine.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              {machine.settings?.provider !== 'electron' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={machine.status === "running" ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleAction(machine.status === "running" ? "stop" : "start")}
                    disabled={actionLoading !== null || !["running", "stopped", "error"].includes(machine.status)}
                  >
                    {actionLoading === "start" || actionLoading === "stop" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : machine.status === "running" ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction("restart")}
                    disabled={actionLoading !== null || machine.status !== "running"}
                  >
                    {actionLoading === "restart" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restart
                      </>
                    )}
                  </Button>
                  {machine.settings?.provider === 'aws' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction("snapshot")}
                      disabled={actionLoading !== null || machine.status !== "running"}
                    >
                      {actionLoading === "snapshot" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Snapshot
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction("delete")}
                    disabled={actionLoading !== null || machine.status === "running"}
                  >
                    {actionLoading === "delete" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {machine.settings?.provider === 'electron' ? (
              /* Electron machines — no cloud resource details */
              <div className="text-sm text-muted-foreground">
                <p>This is your local computer connected via the Coasty Desktop App. It does not consume any cloud resources.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Resource Cards */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="h-4 w-4" />
                    <span>CPU</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{machine.cpuCores} vCPU</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MemoryStick className="h-4 w-4" />
                    <span>Memory</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{machine.memoryGb} GB</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    <span>Storage</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{machine.storageGb} GB</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Network className="h-4 w-4" />
                    <span>IP Address</span>
                  </div>
                  <p className="text-xs sm:text-sm font-mono break-all">
                    {machine.publicIpAddress || "Not assigned"}
                  </p>
                </div>
              </div>
            )}

            {/* Status Message */}
            {machine.statusMessage && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{machine.statusMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>


        {/* Main Content Tabs */}
        {machine.settings?.provider === 'electron' ? (
          // Electron (local machine) — settings only
          <Tabs defaultValue="settings" className="space-y-4">
            <TabsList className="grid w-full grid-cols-1 lg:w-auto lg:inline-grid">
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4">
              <MachineSettings
                machine={machine}
                onUpdate={fetchMachineData}
              />
            </TabsContent>
          </Tabs>
        ) : machine.settings?.provider === 'aws' && machine.settings?.desktopEnabled ? (
          // AWS Desktop Machine - Desktop + SSH + Settings
          <Tabs defaultValue="desktop" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
              <TabsTrigger value="ssh" className="gap-2">
                <Terminal className="h-4 w-4" />
                <span className="hidden sm:inline">SSH</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="desktop" className="space-y-4">
              {machine.status !== "running" ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Machine Not Running</h3>
                      <p className="text-muted-foreground mb-4">
                        Start the machine to access the desktop
                      </p>
                      <Button
                        onClick={() => handleAction("start")}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "start" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Start Machine
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : machine.settings?.desktopInitStatus === 'installing' ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Desktop Initializing...</h3>
                      <p className="text-muted-foreground mb-4">
                        Installing desktop environment. This takes 1-3 minutes on first boot.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You can use SSH while the desktop is being set up.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : machine.settings?.desktopInitStatus === 'failed' ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Desktop Setup Failed</h3>
                      <p className="text-muted-foreground mb-4">
                        Check /var/log/desktop-setup.log via SSH for details.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <SimpleVNCViewer machine={machine} session={null} />
              )}
            </TabsContent>

            <TabsContent value="ssh" className="space-y-4">
              <SshConnectionPanel machine={machine} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <MachineSettings
                machine={machine}
                onUpdate={fetchMachineData}
              />
            </TabsContent>
          </Tabs>
        ) : machine.settings?.provider === 'aws' ? (
          // AWS SSH-Only Machine
          <Tabs defaultValue="ssh" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
              <TabsTrigger value="ssh" className="gap-2">
                <Terminal className="h-4 w-4" />
                <span className="hidden sm:inline">SSH</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ssh" className="space-y-4">
              <SshConnectionPanel machine={machine} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <MachineSettings
                machine={machine}
                onUpdate={fetchMachineData}
              />
            </TabsContent>
          </Tabs>
        ) : (
          // Azure / Docker Tabs
          <Tabs defaultValue="desktop" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Desktop</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="desktop" className="space-y-4">
              {machine.status !== "running" ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Machine Not Running</h3>
                      <p className="text-muted-foreground mb-4">
                        Start the machine to access the desktop
                      </p>
                      <Button
                        onClick={() => handleAction("start")}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "start" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Start Machine
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <SimpleVNCViewer machine={machine} session={null} />
              )}
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              {machine.status !== "running" ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Machine Not Running</h3>
                      <p className="text-muted-foreground mb-4">
                        Start the machine to access file transfer
                      </p>
                      <Button
                        onClick={() => handleAction("start")}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === "start" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Start Machine
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <FileTransfer
                  machineId={machine.id}
                  connectionInfo={{
                    publicIpAddress: machine.publicIpAddress,
                    vncPort: machine.vncPort,
                    vncPassword: machine.vncPassword
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <MachineSettings
                machine={machine}
                onUpdate={fetchMachineData}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MachineLayout>
  );
}