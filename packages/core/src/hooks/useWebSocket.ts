import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '../adapters/types';

export interface UseWebSocketOptions {
  /** Initial reconnect delay in ms. Doubles per attempt, capped at 30 s. Default: 1000. */
  reconnectDelay?: number;
  /** Maximum reconnect attempts before giving up. Default: `Infinity`. */
  maxReconnects?: number;
  /** WebSocket binary frame type. Default: `'arraybuffer'` — raw sensor frames are usually binary. */
  binaryType?: BinaryType;
  /** Fired on every inbound message. Use this for hot-path consumers — `lastMessage` triggers re-renders. */
  onMessage?: (event: MessageEvent) => void;
  /** Fired on every connection-state transition. */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Set false to pause/close the socket. Re-enabling reopens it. Default: true. */
  enabled?: boolean;
  /**
   * Maximum number of incoming messages buffered before the consumer
   * reads them. Older messages drop on overflow. Default: 1000.
   */
  messageQueueSize?: number;
}

export interface UseWebSocketResult {
  /** Send a frame. No-ops while the socket is not OPEN. */
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  /** Live connection state. */
  status: ConnectionStatus;
  /** Most recent inbound message, or `null`. Updates trigger a re-render. */
  lastMessage: MessageEvent | null;
  /** Force a fresh connect — closes the existing socket and resets backoff. */
  reconnect: () => void;
  /** Close the socket and prevent further reconnect attempts until re-enabled. */
  close: () => void;
}

const MAX_BACKOFF_MS = 30_000;

/**
 * Browser WebSocket wrapper with auto-reconnect, exponential backoff, and
 * a bounded message queue. See blueprint §5.3 and §13 ("WebSocket flooding
 * main thread"). The hook never assumes the connection is stable.
 */
export function useWebSocket(url: string, options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    reconnectDelay = 1000,
    maxReconnects = Infinity,
    binaryType = 'arraybuffer',
    onMessage,
    onStatusChange,
    enabled = true,
    messageQueueSize = 1000,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>(enabled ? 'connecting' : 'disconnected');
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageQueueRef = useRef<MessageEvent[]>([]);
  const closedByUserRef = useRef(false);

  // Stable refs for callback options so we can avoid resubscribing on every
  // render while still reaching the latest callbacks.
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateStatus = useCallback((next: ConnectionStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    clearReconnectTimer();
    closedByUserRef.current = false;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      updateStatus('error');
      scheduleReconnect();
      return;
    }
    socket.binaryType = binaryType;
    socketRef.current = socket;
    updateStatus('connecting');

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      updateStatus('connected');
    };

    socket.onmessage = (event) => {
      const queue = messageQueueRef.current;
      queue.push(event);
      if (queue.length > messageQueueSize) {
        queue.splice(0, queue.length - messageQueueSize);
      }
      setLastMessage(event);
      onMessageRef.current?.(event);
    };

    socket.onerror = () => {
      updateStatus('error');
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (closedByUserRef.current) {
        updateStatus('disconnected');
        return;
      }
      updateStatus('disconnected');
      scheduleReconnect();
    };

    function scheduleReconnect() {
      if (reconnectAttemptsRef.current >= maxReconnects) return;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(reconnectDelay * 2 ** attempt, MAX_BACKOFF_MS);
      reconnectAttemptsRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [url, binaryType, reconnectDelay, maxReconnects, messageQueueSize, updateStatus, clearReconnectTimer]);

  const close = useCallback(() => {
    closedByUserRef.current = true;
    clearReconnectTimer();
    const sock = socketRef.current;
    socketRef.current = null;
    if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) {
      sock.close();
    }
    updateStatus('disconnected');
  }, [clearReconnectTimer, updateStatus]);

  const reconnect = useCallback(() => {
    closedByUserRef.current = true;
    clearReconnectTimer();
    const sock = socketRef.current;
    socketRef.current = null;
    if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) {
      sock.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [clearReconnectTimer, connect]);

  const send = useCallback<UseWebSocketResult['send']>((data) => {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(data);
  }, []);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }
    connect();
    return () => {
      closedByUserRef.current = true;
      clearReconnectTimer();
      const sock = socketRef.current;
      socketRef.current = null;
      if (sock && (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING)) {
        sock.close();
      }
    };
  }, [enabled, connect, close, clearReconnectTimer]);

  return { send, status, lastMessage, reconnect, close };
}
