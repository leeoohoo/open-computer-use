// Transform database snake_case to TypeScript camelCase for machines
export function transformMachineFromDB(dbMachine: any) {
  if (!dbMachine) return null;
  
  return {
    id: dbMachine.id,
    userId: dbMachine.user_id,
    containerName: dbMachine.container_name,
    displayName: dbMachine.display_name,
    status: dbMachine.status,
    statusMessage: dbMachine.status_message,
    
    // Azure details
    azureResourceGroup: dbMachine.azure_resource_group,
    azureContainerGroup: dbMachine.azure_container_group,
    azureResourceId: dbMachine.azure_resource_id,
    azureLocation: dbMachine.azure_location,
    
    // Connection details
    publicIpAddress: dbMachine.public_ip_address,
    vncPassword: dbMachine.vnc_password,
    vncPort: dbMachine.vnc_port || 5901,
    websocketPort: dbMachine.websocket_port || 6080,
    sshPort: dbMachine.ssh_port || (dbMachine.settings?.provider === 'aws' ? 22 : undefined),
    
    // Resources
    cpuCores: dbMachine.cpu_cores,
    memoryGb: dbMachine.memory_gb,
    storageGb: dbMachine.storage_gb,
    gpuEnabled: dbMachine.gpu_enabled || false,
    
    // Timestamps
    createdAt: dbMachine.created_at,
    startedAt: dbMachine.started_at,
    lastActiveAt: dbMachine.last_active_at,
    autoShutdownAt: dbMachine.auto_shutdown_at,
    autoShutdownMinutes: dbMachine.auto_shutdown_minutes || 30,
    
    // Settings
    settings: dbMachine.settings || {},
  };
}

// Transform TypeScript camelCase to database snake_case for machines
export function transformMachineToDB(machine: any) {
  return {
    id: machine.id,
    user_id: machine.userId,
    container_name: machine.containerName,
    display_name: machine.displayName,
    status: machine.status,
    status_message: machine.statusMessage,
    azure_resource_group: machine.azureResourceGroup,
    azure_container_group: machine.azureContainerGroup,
    azure_resource_id: machine.azureResourceId,
    azure_location: machine.azureLocation,
    public_ip_address: machine.publicIpAddress,
    vnc_password: machine.vncPassword,
    vnc_port: machine.vncPort,
    websocket_port: machine.websocketPort,
    ssh_port: machine.sshPort,
    cpu_cores: machine.cpuCores,
    memory_gb: machine.memoryGb,
    storage_gb: machine.storageGb,
    gpu_enabled: machine.gpuEnabled,
    created_at: machine.createdAt,
    started_at: machine.startedAt,
    last_active_at: machine.lastActiveAt,
    auto_shutdown_at: machine.autoShutdownAt,
    auto_shutdown_minutes: machine.autoShutdownMinutes,
    settings: machine.settings,
  };
}

// Transform database snake_case to TypeScript camelCase for sessions
export function transformSessionFromDB(dbSession: any) {
  if (!dbSession) return null;
  
  return {
    id: dbSession.id,
    machineId: dbSession.machine_id,
    userId: dbSession.user_id,
    sessionType: dbSession.session_type,
    startedAt: dbSession.started_at || new Date().toISOString(),
    endedAt: dbSession.ended_at,
    durationSeconds: dbSession.duration_seconds,
    actionsPerformed: dbSession.actions_performed || [],
    screenshotsCaptured: dbSession.screenshots_captured || 0,
    commandsExecuted: dbSession.commands_executed || 0,
    errorsEncountered: dbSession.errors_encountered || 0,
    aiModel: dbSession.ai_model,
    aiObjective: dbSession.ai_objective,
    aiCompletionStatus: dbSession.ai_completion_status,
  };
}