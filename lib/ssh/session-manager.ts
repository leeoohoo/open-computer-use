import { Client, type ClientChannel } from "ssh2";

interface SshSession {
  id: string;
  machineId: string;
  userId: string;
  client: Client;
  stream: ClientChannel | null;
  buffer: string[];
  listeners: Set<(data: string) => void>;
  lastActivity: number;
  connected: boolean;
}

class SshSessionManager {
  private sessions = new Map<string, SshSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async createSession(params: {
    machineId: string;
    userId: string;
    host: string;
    username: string;
    privateKey: string;
    cols?: number;
    rows?: number;
  }): Promise<string> {
    const sessionId = crypto.randomUUID();
    const client = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error("SSH connection timed out"));
      }, 30000);

      client.on("ready", () => {
        clearTimeout(timeout);
        client.shell(
          {
            term: "xterm-256color",
            cols: params.cols || 80,
            rows: params.rows || 24,
          },
          (err, stream) => {
            if (err) {
              client.end();
              reject(err);
              return;
            }

            const session: SshSession = {
              id: sessionId,
              machineId: params.machineId,
              userId: params.userId,
              client,
              stream,
              buffer: [],
              listeners: new Set(),
              lastActivity: Date.now(),
              connected: true,
            };

            stream.on("data", (data: Buffer) => {
              const b64 = data.toString("base64");
              session.buffer.push(b64);
              if (session.buffer.length > 1000) {
                session.buffer = session.buffer.slice(-500);
              }
              session.listeners.forEach((fn) => fn(b64));
            });

            stream.stderr.on("data", (data: Buffer) => {
              const b64 = data.toString("base64");
              session.buffer.push(b64);
              session.listeners.forEach((fn) => fn(b64));
            });

            stream.on("close", () => {
              session.connected = false;
              session.listeners.forEach((fn) => fn(""));
              this.sessions.delete(sessionId);
              client.end();
            });

            this.sessions.set(sessionId, session);
            resolve(sessionId);
          }
        );
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.connect({
        host: params.host,
        port: 22,
        username: params.username,
        privateKey: params.privateKey,
        readyTimeout: 20000,
        keepaliveInterval: 10000,
      });
    });
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.stream || !session.connected) return false;

    session.lastActivity = Date.now();
    session.stream.write(Buffer.from(data, "base64"));
    return true;
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.stream || !session.connected) return false;

    session.stream.setWindow(rows, cols, 0, 0);
    return true;
  }

  addListener(
    sessionId: string,
    listener: (data: string) => void
  ): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) return () => {};

    session.listeners.add(listener);
    return () => {
      session.listeners.delete(listener);
    };
  }

  getSession(sessionId: string): SshSession | undefined {
    return this.sessions.get(sessionId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.stream?.close();
    } catch {
      // ignore
    }
    try {
      session.client.end();
    } catch {
      // ignore
    }
    this.sessions.delete(sessionId);
  }

  validateSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!session && session.userId === userId;
  }

  private cleanup(): void {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > timeout) {
        this.closeSession(id);
      }
    }
  }
}

// Singleton
let manager: SshSessionManager | null = null;

export function getSshSessionManager(): SshSessionManager {
  if (!manager) {
    manager = new SshSessionManager();
  }
  return manager;
}
