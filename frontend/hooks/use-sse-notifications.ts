import { useState, useEffect, useRef, useCallback } from "react";
import { useCurrentUser } from "./use-current-user";
import { apiClient } from "@/lib/api-client";

// API URL from environment
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";

export interface SSENotificationData {
  id: string;
  type: "xp_reward" | "quest_completion" | "level_up" | "heartbeat" | "error";
  timestamp: string;
  user_id: number;
  title: string;
  message: string;
  xp_earned?: number;
  total_xp?: number;
  quest_data?: {
    source_type?: string;
    quest_title?: string;
    quest_id?: number;
    completion_percentage?: number;
    class_id?: number;
    room_id?: number;
  };
  // For level up notifications
  previous_level?: number;
  new_level?: number;
}

export interface SSEConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: Date | null;
}

// Global SSE manager to ensure only one connection per user
class SSEManager {
  private static instance: SSEManager;
  private connections: Map<
    number,
    {
      eventSource: EventSource;
      handlers: Map<string, Set<(data: SSENotificationData) => void>>;
      connectionState: SSEConnectionState;
      subscribers: Set<(state: SSEConnectionState) => void>;
      reconnectAttempts: number;
      reconnectTimeout: NodeJS.Timeout | null;
    }
  > = new Map();

  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000; // Increased to 2 seconds

  static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  subscribe(
    userId: number,
    onStateChange: (state: SSEConnectionState) => void
  ) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.subscribers.add(onStateChange);
      // Immediately notify with current state
      onStateChange(connection.connectionState);
    } else {
      // Initialize connection if it doesn't exist
      this.initializeConnection(userId);
      const newConnection = this.connections.get(userId);
      if (newConnection) {
        newConnection.subscribers.add(onStateChange);
        onStateChange(newConnection.connectionState);
      }
    }
  }

  unsubscribe(
    userId: number,
    onStateChange: (state: SSEConnectionState) => void
  ) {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.subscribers.delete(onStateChange);

      // If no more subscribers, close the connection after a delay
      if (connection.subscribers.size === 0) {
        setTimeout(() => {
          const stillEmpty =
            this.connections.get(userId)?.subscribers.size === 0;
          if (stillEmpty) {
            this.disconnect(userId);
          }
        }, 10000); // 10 second delay before closing
      }
    }
  }

  addNotificationHandler(
    userId: number,
    type: string,
    handler: (data: SSENotificationData) => void
  ) {
    const connection = this.connections.get(userId);
    if (connection) {
      if (!connection.handlers.has(type)) {
        connection.handlers.set(type, new Set());
      }
      connection.handlers.get(type)!.add(handler);
    }
  }

  removeNotificationHandler(
    userId: number,
    type: string,
    handler?: (data: SSENotificationData) => void
  ) {
    const connection = this.connections.get(userId);
    if (connection && connection.handlers.has(type)) {
      if (handler) {
        connection.handlers.get(type)!.delete(handler);
      } else {
        connection.handlers.delete(type);
      }
    }
  }

  private initializeConnection(userId: number) {
    if (this.connections.has(userId)) {
      return; // Connection already exists
    }

    console.log(`SSE: Initializing connection for user ${userId}`);

    const connectionData = {
      eventSource: null as any,
      handlers: new Map<string, Set<(data: SSENotificationData) => void>>(),
      connectionState: {
        isConnected: false,
        isConnecting: true,
        error: null,
        lastHeartbeat: null,
      } as SSEConnectionState,
      subscribers: new Set<(state: SSEConnectionState) => void>(),
      reconnectAttempts: 0,
      reconnectTimeout: null as NodeJS.Timeout | null,
    };

    this.connections.set(userId, connectionData);
    this.connect(userId);
  }

  private connect(userId: number) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    // Don't reconnect if already connected or connecting
    if (
      connection.connectionState.isConnected ||
      connection.connectionState.isConnecting
    ) {
      return;
    }

    this.updateConnectionState(userId, {
      isConnecting: true,
      error: null,
    });

    try {
      // EventSource can't send an Authorization header, so the access token
      // rides as a query param; the backend validates it and enforces ownership.
      const token = apiClient.getToken();
      const url = `${API_BASE_URL}/notifications/events/${userId}?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);
      connection.eventSource = eventSource;

      eventSource.onopen = () => {
        console.log(`SSE: Connection opened for user ${userId}`);
        connection.reconnectAttempts = 0;
        this.updateConnectionState(userId, {
          isConnected: true,
          isConnecting: false,
          error: null,
          lastHeartbeat: new Date(),
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat quietly
          if (data.type === "heartbeat") {
            this.updateConnectionState(userId, {
              lastHeartbeat: new Date(),
            });
            return;
          }

          // Handle notifications
          if (data.type && connection.handlers.has(data.type)) {
            const handlers = connection.handlers.get(data.type)!;
            handlers.forEach((handler) => {
              try {
                handler(data as SSENotificationData);
              } catch (error) {
                console.error(
                  `SSE: Error in notification handler for ${data.type}:`,
                  error
                );
              }
            });
          }
        } catch (error) {
          console.error("SSE: Error parsing message", error);
        }
      };

      eventSource.onerror = () => {
        this.updateConnectionState(userId, {
          isConnected: false,
          isConnecting: false,
          error: "Connection error",
        });

        // Attempt reconnection if we haven't exceeded max attempts
        if (connection.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.getReconnectDelay(connection.reconnectAttempts);
          console.log(
            `SSE: Reconnecting user ${userId} in ${delay}ms (attempt ${
              connection.reconnectAttempts + 1
            }/${this.maxReconnectAttempts})`
          );

          connection.reconnectTimeout = setTimeout(() => {
            connection.reconnectAttempts++;
            this.connect(userId);
          }, delay);
        } else {
          console.error(
            `SSE: Max reconnection attempts reached for user ${userId}`
          );
          this.updateConnectionState(userId, {
            error: "Max reconnection attempts reached",
          });
        }
      };
    } catch (error) {
      console.error(
        `SSE: Failed to create EventSource for user ${userId}:`,
        error
      );
      this.updateConnectionState(userId, {
        isConnecting: false,
        error: "Failed to create connection",
      });
    }
  }

  private disconnect(userId: number) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.log(`SSE: Disconnecting user ${userId}`);

    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    if (connection.eventSource) {
      connection.eventSource.close();
    }

    this.connections.delete(userId);
  }

  private updateConnectionState(
    userId: number,
    updates: Partial<SSEConnectionState>
  ) {
    const connection = this.connections.get(userId);
    if (!connection) return;

    connection.connectionState = { ...connection.connectionState, ...updates };

    // Notify all subscribers
    connection.subscribers.forEach((subscriber) => {
      try {
        subscriber(connection.connectionState);
      } catch (error) {
        console.error("SSE: Error in state subscriber:", error);
      }
    });
  }

  private getReconnectDelay(attempts: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.baseReconnectDelay * Math.pow(1.5, attempts);
    const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }

  // Force reconnect for a user
  reconnect(userId: number) {
    console.log(`SSE: Force reconnecting user ${userId}`);
    this.disconnect(userId);
    setTimeout(() => this.initializeConnection(userId), 1000);
  }
}

export function useSSENotifications() {
  const { user, isAuthenticated } = useCurrentUser();
  const [connectionState, setConnectionState] = useState<SSEConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastHeartbeat: null,
  });

  const sseManager = SSEManager.getInstance();

  // Subscribe to connection state changes
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    sseManager.subscribe(user.id, setConnectionState);

    return () => {
      sseManager.unsubscribe(user.id, setConnectionState);
    };
  }, [isAuthenticated, user?.id, sseManager]);

  const addNotificationHandler = useCallback(
    (type: string, handler: (data: SSENotificationData) => void) => {
      if (user?.id) {
        sseManager.addNotificationHandler(user.id, type, handler);
      }
    },
    [user?.id, sseManager]
  );

  const removeNotificationHandler = useCallback(
    (type: string, handler?: (data: SSENotificationData) => void) => {
      if (user?.id) {
        sseManager.removeNotificationHandler(user.id, type, handler);
      }
    },
    [user?.id, sseManager]
  );

  const reconnect = useCallback(() => {
    if (user?.id) {
      sseManager.reconnect(user.id);
    }
  }, [user?.id, sseManager]);
  return {
    connectionState,
    addNotificationHandler,
    removeNotificationHandler,
    reconnect,
  };
}
