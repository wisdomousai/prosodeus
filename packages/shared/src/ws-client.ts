type MessageHandler = (data: unknown) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected") => void;

// Browser-style WebSocket surface. This package is typechecked under each
// consumer's globals (workers-types redeclares WebSocket without the onX
// handler properties), so the socket is typed structurally.
interface BrowserWebSocket {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

const WS_CONNECTING = 0;
const WS_OPEN = 1;

/**
 * Platform-agnostic WebSocket client with auto-reconnect and exponential backoff.
 * Uses standard WebSocket API available in browsers and React Native.
 */
export class WSClient {
  private url: string;
  private ws: BrowserWebSocket | null = null;
  private onMessage: MessageHandler;
  private onStatus: StatusHandler;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(url: string, onMessage: MessageHandler, onStatus: StatusHandler) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  connect() {
    if (this.destroyed) return;
    this.onStatus("connecting");

    this.ws = new WebSocket(this.url) as unknown as BrowserWebSocket;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatus("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.onMessage(data);
      } catch {
        // ignore non-JSON messages (pong, etc.)
      }
    };

    this.ws.onclose = () => {
      this.onStatus("disconnected");
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WS_OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WS_CONNECTING) {
        const ws = this.ws;
        ws.onopen = () => ws.close();
      } else if (this.ws.readyState === WS_OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WS_OPEN;
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
