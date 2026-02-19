import { ContainerInstanceManagementClient } from "@azure/arm-containerinstance";
import { DefaultAzureCredential } from "@azure/identity";
import { v4 as uuidv4 } from "uuid";

export interface ContainerConfig {
  name: string;
  resourceGroup: string;
  location?: string;
  cpu: number;
  memoryGb: number;
  image: string;
  ports?: number[];
  environmentVariables?: Record<string, string>;
  volumeMounts?: VolumeMount[];
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  shareName: string;
}

export interface ContainerStatus {
  state: "creating" | "running" | "stopped" | "failed";
  ipAddress?: string;
  fqdn?: string;
  message?: string;
}

export class AzureContainerService {
  private client: ContainerInstanceManagementClient;
  private subscriptionId: string;

  constructor() {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (!subscriptionId) {
      throw new Error("AZURE_SUBSCRIPTION_ID environment variable is required");
    }

    this.subscriptionId = subscriptionId;
    const credential = new DefaultAzureCredential();
    this.client = new ContainerInstanceManagementClient(credential, subscriptionId);
  }

  /**
   * Create a new container instance with desktop environment
   */
  async createDesktopContainer(
    userId: string,
    config: Partial<ContainerConfig> & { containerName?: string; vncPassword?: string }
  ): Promise<{ containerGroupName: string; resourceId: string; vncPassword: string }> {
    const maxRetries = 3;
    const baseDelay = 2000; // Start with 2 second delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createDesktopContainerWithRetry(userId, config);
      } catch (error: any) {
        const isRetryableError = this.isRetryableError(error);
        const isLastAttempt = attempt === maxRetries;
        
        if (!isRetryableError || isLastAttempt) {
          console.error(`Azure container creation failed after ${attempt} attempts:`, error);
          throw error;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`Azure container creation failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, {
          error: error.message,
          code: error.code,
          statusCode: error.statusCode
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Container creation failed after all retry attempts');
  }
  
  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ENETUNREACH') {
      return true;
    }
    
    // HTTP status codes that are retryable
    if (error.statusCode) {
      // 429 Too Many Requests, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
      return [429, 502, 503, 504].includes(error.statusCode);
    }
    
    // Azure specific retryable errors
    if (error.message && (
        error.message.includes('temporarily unavailable') ||
        error.message.includes('timeout') ||
        error.message.includes('rate limit'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Internal method to create container (called by retry wrapper)
   */
  private async createDesktopContainerWithRetry(
    userId: string,
    config: Partial<ContainerConfig> & { containerName?: string; vncPassword?: string }
  ): Promise<{ containerGroupName: string; resourceId: string; vncPassword: string }> {
    // Use provided container name or generate a new one
    const containerGroupName = config.containerName || `vm-${userId.substring(0, 8)}-${uuidv4().substring(0, 8)}`;
    const resourceGroup = process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    const location = config.location || "eastus";

    // Use provided VNC password or generate a new one
    const vncPassword = config.vncPassword || this.generateSecurePassword();

    const containerGroup = {
      location,
      osType: "Linux" as const,
      restartPolicy: "OnFailure" as const,
      ipAddress: {
        type: "Public" as const,
        ports: [
          { port: 5901, protocol: "TCP" as const }, // VNC
          { port: 6080, protocol: "TCP" as const }, // noVNC WebSocket
          { port: 8080, protocol: "TCP" as const }, // AI Agent WebSocket server
          { port: 22, protocol: "TCP" as const },   // SSH (optional)
        ],
        dnsNameLabel: containerGroupName,
      },
      containers: [
        {
          name: "desktop",
          image: config.image || process.env.AZURE_DESKTOP_IMAGE || "coasty/ai-desktop:latest",
          resources: {
            requests: {
              cpu: config.cpu || 1,
              memoryInGB: config.memoryGb || 2,
            },
          },
          ports: [
            { port: 5901 },
            { port: 6080 },
            { port: 8080 },
            { port: 22 },
          ],
          environmentVariables: [
            { name: "VNC_PASSWORD", value: vncPassword },
            { name: "VNC_PW", value: vncPassword }, // Some VNC servers use VNC_PW
            { name: "VNCPASS", value: vncPassword }, // Alternative env var
            { name: "USER_PASSWORD", value: vncPassword }, // Set desktop user password to match
            { name: "DESKTOP_PASSWORD", value: vncPassword }, // Alternative for desktop password
            { name: "DISPLAY", value: ":1" },
            { name: "USER_ID", value: userId },
            { name: "WEBSOCKET_PORT", value: "6080" },
            { name: "AGENT_HOST", value: "0.0.0.0" },
            { name: "AGENT_PORT", value: "8080" },
            ...(config.environmentVariables
              ? Object.entries(config.environmentVariables).map(([name, value]) => ({
                  name,
                  value,
                }))
              : []),
          ],
          volumeMounts: config.volumeMounts?.map((mount) => ({
            name: mount.name,
            mountPath: mount.mountPath,
          })),
        },
      ],
      volumes: config.volumeMounts?.map((mount) => ({
        name: mount.name,
        azureFile: {
          shareName: mount.shareName,
          storageAccountName: process.env.AZURE_STORAGE_ACCOUNT || "",
          storageAccountKey: process.env.AZURE_STORAGE_KEY || "",
        },
      })),
      // Add registry credentials if using private registry
      ...(process.env.AZURE_CONTAINER_REGISTRY && process.env.AZURE_CONTAINER_REGISTRY_USERNAME && process.env.AZURE_CONTAINER_REGISTRY_PASSWORD ? {
        imageRegistryCredentials: [{
          server: process.env.AZURE_CONTAINER_REGISTRY,
          username: process.env.AZURE_CONTAINER_REGISTRY_USERNAME,
          password: process.env.AZURE_CONTAINER_REGISTRY_PASSWORD,
        }]
      } : {}),
    };

    const response = await this.client.containerGroups.beginCreateOrUpdate(
      resourceGroup,
      containerGroupName,
      containerGroup
    );

    const result = await response.pollUntilDone();

    return {
      containerGroupName,
      resourceId: result.id || "",
      vncPassword,
    };
  }

  /**
   * Get container status and connection details
   */
  async getContainerStatus(
    containerGroupName: string,
    resourceGroup?: string
  ): Promise<ContainerStatus> {
    try {
      const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
      const containerGroup = await this.client.containerGroups.get(
        rg,
        containerGroupName
      );

      const container = containerGroup.containers?.[0];
      const instanceView = container?.instanceView;
      const currentState = instanceView?.currentState;

      let state: ContainerStatus["state"] = "creating";
      if (currentState?.state === "Running") {
        state = "running";
      } else if (currentState?.state === "Terminated") {
        state = "stopped";
      } else if (currentState?.state === "Failed") {
        state = "failed";
      }

      return {
        state,
        ipAddress: containerGroup.ipAddress?.ip,
        fqdn: containerGroup.ipAddress?.fqdn,
        message: currentState?.detailStatus,
      };
    } catch (error) {
      console.error("Error getting container status:", error);
      throw error;
    }
  }

  /**
   * Start a stopped container
   * Returns the VNC password if container was recreated
   */
  async startContainer(
    containerGroupName: string,
    resourceGroup?: string,
    userId?: string
  ): Promise<{ recreated: boolean; vncPassword?: string }> {
    const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    const maxRetries = 3;
    const baseDelay = 2000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.startContainerWithRetry(containerGroupName, rg, userId);
      } catch (error: any) {
        const isRetryableError = this.isRetryableError(error);
        const isLastAttempt = attempt === maxRetries;
        
        if (!isRetryableError || isLastAttempt) {
          console.error(`Azure container start failed after ${attempt} attempts:`, error);
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`Azure container start failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, {
          error: error.message,
          code: error.code
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Container start failed after all retry attempts');
  }
  
  /**
   * Internal method to start container (called by retry wrapper)
   */
  private async startContainerWithRetry(
    containerGroupName: string,
    resourceGroup: string,
    userId?: string
  ): Promise<{ recreated: boolean; vncPassword?: string }> {
    try {
      // First check if the container group exists and its current state
      const containerGroup = await this.client.containerGroups.get(resourceGroup, containerGroupName);
      
      if (!containerGroup) {
        throw new Error("Container group not found");
      }
      
      // Check if container is deallocated
      const currentState = containerGroup.containers?.[0]?.instanceView?.currentState?.state;
      const isTerminated = currentState === "Terminated" || currentState === "Failed";
      const hasNoIP = !containerGroup.ipAddress?.ip;
      
      if (isTerminated || hasNoIP) {
        console.log("Container is deallocated, needs recreation");
        
        // Try to start first (might work in some cases)
        try {
          const response = await this.client.containerGroups.beginStart(resourceGroup, containerGroupName);
          await response.pollUntilDone();
          
          // Check if it actually started and got an IP
          const updatedGroup = await this.client.containerGroups.get(resourceGroup, containerGroupName);
          if (updatedGroup.ipAddress?.ip) {
            return { recreated: false };
          }
        } catch (startError) {
          console.log("Direct start failed, proceeding with recreation");
        }
        
        // If we're here, we need to recreate the container
        if (!userId) {
          throw new Error("User ID required for container recreation");
        }
        
        // Get existing configuration
        const container = containerGroup.containers?.[0];
        const config = {
          cpu: container?.resources?.requests?.cpu || 1,
          memoryGb: container?.resources?.requests?.memoryInGB || 2,
          image: container?.image,
          location: containerGroup.location,
        };
        
        // Delete the existing container
        const deleteResponse = await this.client.containerGroups.beginDelete(resourceGroup, containerGroupName);
        await deleteResponse.pollUntilDone();
        
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Create new container with same name but new password
        const result = await this.createDesktopContainer(userId, config);
        
        return { 
          recreated: true, 
          vncPassword: result.vncPassword 
        };
      } else {
        // Normal start
        const response = await this.client.containerGroups.beginStart(resourceGroup, containerGroupName);
        await response.pollUntilDone();
        return { recreated: false };
      }
    } catch (error: any) {
      console.error("Error starting container:", error);
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  /**
   * Stop a running container
   */
  async stopContainer(
    containerGroupName: string,
    resourceGroup?: string
  ): Promise<void> {
    const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    await this.client.containerGroups.stop(rg, containerGroupName);
  }

  /**
   * Delete a container instance
   */
  async deleteContainer(
    containerGroupName: string,
    resourceGroup?: string
  ): Promise<void> {
    const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    const response = await this.client.containerGroups.beginDelete(
      rg,
      containerGroupName
    );
    await response.pollUntilDone();
  }

  /**
   * List all containers for a resource group
   */
  async listContainers(resourceGroup?: string): Promise<any[]> {
    const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    const containers = [];
    
    for await (const container of this.client.containerGroups.listByResourceGroup(rg)) {
      containers.push(container);
    }
    
    return containers;
  }

  /**
   * Generate a secure password for VNC
   * Note: VNC passwords are limited to 8 characters
   */
  private generateSecurePassword(): string {
    // Use only alphanumeric to avoid special char issues
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    // VNC only uses first 8 characters of password
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Restart a container by recreating it (useful when container is deallocated)
   */
  async recreateContainer(
    containerGroupName: string,
    userId: string,
    resourceGroup?: string
  ): Promise<void> {
    const rg = resourceGroup || process.env.AZURE_RESOURCE_GROUP || "coasty-resources";
    
    try {
      // Get existing container configuration
      const existingContainer = await this.client.containerGroups.get(rg, containerGroupName);
      
      if (!existingContainer) {
        throw new Error("Container group not found");
      }
      
      // Delete the existing container
      const deleteResponse = await this.client.containerGroups.beginDelete(rg, containerGroupName);
      await deleteResponse.pollUntilDone();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Recreate with same configuration
      const container = existingContainer.containers?.[0];
      const config = {
        cpu: container?.resources?.requests?.cpu || 1,
        memoryGb: container?.resources?.requests?.memoryInGB || 2,
        image: container?.image,
        location: existingContainer.location,
      };
      
      // Create new container with same name (password will be regenerated)
      await this.createDesktopContainer(userId, config);
      
    } catch (error) {
      console.error("Error recreating container:", error);
      throw new Error(`Failed to recreate container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimate cost for container usage
   */
  estimateCost(cpu: number, memoryGb: number, hours: number): number {
    // Azure Container Instances pricing (approximate)
    const cpuPricePerHour = 0.0000125; // per vCPU second
    const memoryPricePerHour = 0.0000125; // per GB second
    
    const cpuCost = cpu * hours * 3600 * cpuPricePerHour;
    const memoryCost = memoryGb * hours * 3600 * memoryPricePerHour;
    
    return parseFloat((cpuCost + memoryCost).toFixed(4));
  }
}

// Singleton instance
let azureService: AzureContainerService | null = null;

export function getAzureContainerService(): AzureContainerService {
  if (!azureService) {
    azureService = new AzureContainerService();
  }
  return azureService;
}