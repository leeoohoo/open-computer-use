/**
 * Docker Service - Detects and manages local Docker containers
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  isAIDesktop?: boolean;
}

export interface LocalMachine {
  id: string;
  displayName: string;
  status: 'running' | 'stopped' | 'paused';
  containerName: string;
  image: string;
  ports: {
    vnc?: number;
    websocket?: number;
    agent?: number;
  };
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  gpuEnabled: boolean;
  publicIpAddress: string;
  isLocal: true;
  provider: 'docker';
  createdAt: string;
}

class DockerService {
  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all running Docker containers
   */
  async getContainers(): Promise<DockerContainer[]> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{json .}}"');
      const lines = stdout.trim().split('\n').filter(line => line);
      
      return lines.map(line => {
        const container = JSON.parse(line);
        return {
          id: container.ID,
          name: container.Names,
          image: container.Image,
          status: container.Status,
          ports: container.Ports || '',
          isAIDesktop: this.isAIDesktopContainer(container)
        };
      });
    } catch (error) {
      console.error('Failed to get Docker containers:', error);
      return [];
    }
  }

  /**
   * Check if a container is an AI Desktop container
   */
  private isAIDesktopContainer(container: any): boolean {
    // Check if it's an AI desktop based on image name or exposed ports
    const aiDesktopImages = ['ai-desktop', 'Coasty-ai-desktop', 'vm-desktop', 'ubuntu-desktop'];
    const aiDesktopPorts = [5901, 6080, 8080, 8081, 9222]; // VNC, WebSocket, Agent, Chrome DevTools
    
    // Check image name
    const imageName = container.Image?.toLowerCase() || '';
    if (aiDesktopImages.some(img => imageName.includes(img))) {
      return true;
    }
    
    // Check exposed ports
    const ports = container.Ports || '';
    if (aiDesktopPorts.some(port => ports.includes(`:${port}`))) {
      return true;
    }
    
    // Check container name
    const containerName = container.Names?.toLowerCase() || '';
    if (containerName.includes('desktop') || containerName.includes('ai-') || containerName.includes('vm-')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get container details including resource usage
   */
  async getContainerDetails(containerId: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`docker inspect ${containerId}`);
      const details = JSON.parse(stdout)[0];
      
      // Get stats for resource usage
      const { stdout: statsOut } = await execAsync(`docker stats ${containerId} --no-stream --format "{{json .}}"`);
      const stats = JSON.parse(statsOut);
      
      return {
        ...details,
        stats
      };
    } catch (error) {
      console.error('Failed to get container details:', error);
      return null;
    }
  }

  /**
   * Convert Docker containers to LocalMachine format
   */
  async getLocalMachines(): Promise<LocalMachine[]> {
    if (!await this.isDockerAvailable()) {
      return [];
    }

    const containers = await this.getContainers();
    const localMachines: LocalMachine[] = [];

    for (const container of containers) {
      // Only include AI Desktop containers
      if (!container.isAIDesktop) continue;

      const details = await this.getContainerDetails(container.id);
      
      // Parse ports from the container
      const ports = this.parsePorts(container.ports);
      
      // Estimate resources (can be improved with actual Docker stats)
      const cpuCores = details?.HostConfig?.CpuCount || 
                      details?.HostConfig?.NanoCpus ? Math.ceil(details.HostConfig.NanoCpus / 1000000000) : 2;
      const memoryBytes = details?.HostConfig?.Memory || 0;
      const memoryGb = memoryBytes > 0 ? Math.ceil(memoryBytes / (1024 * 1024 * 1024)) : 4;
      
      const machine: LocalMachine = {
        id: `local-${container.id}`,
        displayName: container.name || `Local Desktop (${container.id.substring(0, 8)})`,
        status: container.status.toLowerCase().includes('up') ? 'running' : 'stopped',
        containerName: container.name,
        image: container.image,
        ports: {
          vnc: ports.vnc,
          websocket: ports.websocket,
          agent: ports.agent
        },
        cpuCores,
        memoryGb,
        storageGb: 20, // Default estimate
        gpuEnabled: false,
        publicIpAddress: 'localhost',
        isLocal: true,
        provider: 'docker',
        createdAt: details?.Created || new Date().toISOString()
      };

      localMachines.push(machine);
    }

    return localMachines;
  }

  /**
   * Parse ports from Docker port string
   */
  private parsePorts(portString: string): { vnc?: number; websocket?: number; agent?: number } {
    const ports: { vnc?: number; websocket?: number; agent?: number } = {};
    
    if (!portString) return ports;
    
    // Parse port mappings like "0.0.0.0:5901->5901/tcp"
    const portMappings = portString.split(',').map(p => p.trim());
    
    for (const mapping of portMappings) {
      // Extract host port from mapping
      const match = mapping.match(/(?:0\.0\.0\.0:|:::)?(\d+)->(\d+)/);
      if (match) {
        const hostPort = parseInt(match[1]);
        const containerPort = parseInt(match[2]);
        
        // Map known ports to their purposes
        if (containerPort === 5901 || containerPort === 5900) {
          ports.vnc = hostPort;
        } else if (containerPort === 6080) {
          ports.websocket = hostPort;
        } else if (containerPort === 8080 || containerPort === 8081) {
          ports.agent = hostPort;
        }
      }
    }
    
    return ports;
  }

  /**
   * Start a Docker container
   */
  async startContainer(containerId: string): Promise<boolean> {
    try {
      await execAsync(`docker start ${containerId}`);
      return true;
    } catch (error) {
      console.error('Failed to start container:', error);
      return false;
    }
  }

  /**
   * Stop a Docker container
   */
  async stopContainer(containerId: string): Promise<boolean> {
    try {
      await execAsync(`docker stop ${containerId}`);
      return true;
    } catch (error) {
      console.error('Failed to stop container:', error);
      return false;
    }
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(containerId: string): Promise<boolean> {
    try {
      await execAsync(`docker restart ${containerId}`);
      return true;
    } catch (error) {
      console.error('Failed to restart container:', error);
      return false;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs ${containerId} --tail ${tail}`);
      return stdout;
    } catch (error) {
      console.error('Failed to get container logs:', error);
      return '';
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();