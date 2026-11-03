import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export interface LiveTelemetryPoint {
  ts: number;
  cpu: number;
  memUsedMB: number;
  memTotalMB: number;
  load1m: number;
  rxBytes?: number;
  txBytes?: number;
  netRxRateKB: number;
  netTxRateKB: number;
  diskReadBytes: number;
  diskWriteBytes: number;
  readIops: number;
  writeIops: number;
}

export interface LiveTelemetryStats {
  cpuPercent: number;
  cpuCores: number;
  cpuLoadAvg: number[];
  ioWaitPercent: number;
  ramTotalMB: number;
  ramUsedMB: number;
  ramFreeMB: number;
  ramPercent: number;
  ramCachedMB: number;
  swapUsedMB: number;
  swapTotalMB: number;
  diskPercent?: number;
  diskUsedGB?: number;
  diskTotalGB?: number;
  diskReadBytesPerSec: number;
  diskWriteBytesPerSec: number;
  diskReadIOPS: number;
  diskWriteIOPS: number;
  diskIoUtilPercent: number;
  pressureCpu: number;
  pressureMemory: number;
  pressureIo: number;
  netRxBytes: number;
  netTxBytes: number;
  netRxRateKB: number;
  netTxRateKB: number;
  uptimeSeconds?: number;
  timestamp?: number;
  [key: string]: any;
}

export function useGuardianLiveStream(agentId: string, enabled: boolean = true) {
  const [stats, setStats] = useState<LiveTelemetryStats | null>(null);
  const [history, setHistory] = useState<LiveTelemetryPoint[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [transport, setTransport] = useState<'connecting' | 'websocket' | 'sse' | 'paused' | 'disconnected'>('disconnected');
  const [tickCount, setTickCount] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [lastTickAt, setLastTickAt] = useState<number>(Date.now());
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastStatsTsRef = useRef<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevNetRef = useRef<{ rx: number; tx: number; ts: number } | null>(null);

  // Normalize point into fixed 60-second sliding schema
  const normalizePoint = useCallback((raw: any, prevPoint?: LiveTelemetryPoint): LiveTelemetryPoint => {
    const rawTs = raw.ts ?? raw.timestamp;
    const ts = typeof rawTs === 'number' ? rawTs : typeof rawTs === 'string' ? Date.parse(rawTs) || Date.now() : Date.now();
    const cpu = typeof raw.cpu === 'number' ? raw.cpu : (raw.cpuPercent || 0);
    const memUsedMB = typeof raw.memUsedMB === 'number' ? raw.memUsedMB : (raw.ramUsedMB || 0);
    const memTotalMB = typeof raw.memTotalMB === 'number' ? raw.memTotalMB : (raw.ramTotalMB || 1024);
    const load1m = typeof raw.load1m === 'number'
      ? raw.load1m
      : (Array.isArray(raw.cpuLoadAvg) ? raw.cpuLoadAvg[0] : (parseFloat(raw.loadAverage || 0) || 0));

    const rxBytes = raw.rxBytes || raw.netRxBytes || 0;
    const txBytes = raw.txBytes || raw.netTxBytes || 0;

    let netRxRateKB = raw.netRxRateKB || 0;
    let netTxRateKB = raw.netTxRateKB || 0;
    if (!netRxRateKB && !netTxRateKB && prevNetRef.current && prevNetRef.current.ts < ts) {
      const dt = Math.max(0.001, (ts - prevNetRef.current.ts) / 1000);
      netRxRateKB = Math.round(Math.max(0, rxBytes - prevNetRef.current.rx) / dt / 1024);
      netTxRateKB = Math.round(Math.max(0, txBytes - prevNetRef.current.tx) / dt / 1024);
    }
    if (rxBytes || txBytes) {
      prevNetRef.current = { rx: rxBytes, tx: txBytes, ts };
    }

    const diskReadBytes = raw.diskReadBytes || raw.diskReadBytesPerSec || 0;
    const diskWriteBytes = raw.diskWriteBytes || raw.diskWriteBytesPerSec || 0;
    const readIops = raw.readIops || raw.diskReadIOPS || 0;
    const writeIops = raw.writeIops || raw.diskWriteIOPS || 0;

    return {
      ts,
      cpu: parseFloat(Number(cpu).toFixed(2)),
      memUsedMB: Math.round(Number(memUsedMB)),
      memTotalMB: Math.round(Number(memTotalMB)),
      load1m: parseFloat(Number(load1m).toFixed(2)),
      rxBytes,
      txBytes,
      netRxRateKB: parseFloat(Number(netRxRateKB).toFixed(1)),
      netTxRateKB: parseFloat(Number(netTxRateKB).toFixed(1)),
      diskReadBytes: Math.round(Number(diskReadBytes)),
      diskWriteBytes: Math.round(Number(diskWriteBytes)),
      readIops: Math.round(Number(readIops)),
      writeIops: Math.round(Number(writeIops)),
    };
  }, []);

  // Process an incoming frame. Only telemetry frames ('telemetry_tick', 'initial_state', SSE ticks)
  // update the charts; control frames (error, registered, unsubscribed, ...) never do — they used
  // to be read as ticks full of zeros, which is why CPU/RAM dropped to 0% and RAM to "1 GB".
  const handleIncomingTick = useCallback((payload: any) => {
    if (isPaused || !payload || typeof payload !== 'object') return;

    if (['error', 'auth_error', 'registration_error'].includes(payload.type)) {
      setStreamError(payload.message || 'Live stream error');
      return;
    }
    const dataStats = payload?.data?.stats || payload?.stats;
    if (!dataStats || typeof dataStats !== 'object' || Object.keys(dataStats).length === 0) return;

    const now = Date.now();
    const rawTs = dataStats.timestamp ?? payload.timestamp;
    const tickTime = typeof rawTs === 'number' ? rawTs : typeof rawTs === 'string' ? Date.parse(rawTs) || now : now;
    setLatencyMs(Math.max(0, now - tickTime));
    setLastTickAt(now);
    setIsConnected(true);
    setStreamError(null);

    const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    setStats((prev) => ({
      ...(prev || {}),
      ...dataStats,
      // keep the last known value when a frame does not carry a field (never reset to 0 / 1 GB)
      cpuPercent: num(dataStats.cpuPercent) ?? num(dataStats.cpuUsage) ?? prev?.cpuPercent ?? 0,
      ramUsedMB: num(dataStats.ramUsedMB) ?? prev?.ramUsedMB ?? 0,
      ramTotalMB: num(dataStats.ramTotalMB) ?? prev?.ramTotalMB ?? 0,
      ramPercent: num(dataStats.ramPercent) ?? num(dataStats.memoryUsage) ?? prev?.ramPercent ?? 0,
      cpuLoadAvg: Array.isArray(dataStats.cpuLoadAvg) ? dataStats.cpuLoadAvg : prev?.cpuLoadAvg ?? [0, 0, 0],
    }));

    if (payload.type === 'initial_state' && Array.isArray(payload.data?.history) && payload.data.history.length > 0) {
      setHistory(payload.data.history.slice(-60).map((p: any) => normalizePoint(p)));
    } else if (lastStatsTsRef.current !== tickTime) {
      // The server re-sends the cached state every second between agent updates: plot each sample once.
      setHistory((prevHistory) => [...prevHistory.slice(-59), normalizePoint({ ...dataStats, ts: tickTime }, prevHistory[prevHistory.length - 1])]);
    }
    lastStatsTsRef.current = tickTime;

    setTickCount((c) => c + 1);
  }, [isPaused, normalizePoint]);

  // Initial REST Hydration (latest snapshot + last 60s ring buffer)
  const hydrateFromRest = useCallback(async () => {
    if (!agentId) return;
    try {
      const { data } = await api.get(`/guardian/agents/${agentId}/live-metrics`);
      if (data && data.stats) {
        setStats(data.stats);
        if (Array.isArray(data.history) && data.history.length > 0) {
          const normalized = data.history.slice(-60).map((p: any) => normalizePoint(p));
          setHistory(normalized);
        }
      }
    } catch {
      // Non-fatal hydration error
    }
  }, [agentId, normalizePoint]);

  // Tear down all stream transports
  const cleanupStreams = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Establish live streaming connection (WebSocket with SSE fallback)
  const connectStream = useCallback(() => {
    if (!enabled || isPaused || !agentId || typeof window === 'undefined') {
      cleanupStreams();
      setTransport(isPaused ? 'paused' : 'disconnected');
      return;
    }

    cleanupStreams();
    setTransport('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const { accessToken } = useAuthStore.getState();
    const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
    const wsUrl = `${protocol}//${host}/api/guardian/live${tokenQuery}`;

    let wsFailed = false;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const wsConnectTimer = setTimeout(() => {
        // If no messages or open within 3s, switch to SSE fallback
        if (ws.readyState !== WebSocket.OPEN) {
          wsFailed = true;
          ws.close();
          startSseFallback();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(wsConnectTimer);
        // "connected" is set when the first telemetry frame arrives, not merely when the socket opens
        setTransport('websocket');
        ws.send(JSON.stringify({ event: 'subscribe', data: { agentId, token: accessToken } }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          handleIncomingTick(parsed);
        } catch {}
      };

      ws.onerror = () => {
        if (!wsFailed) {
          wsFailed = true;
          clearTimeout(wsConnectTimer);
          ws.close();
          startSseFallback();
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        setIsConnected(false);
        if (ev.code === 4003 || ev.code === 4004) {
          // Access denied / no agent: retrying cannot help, show why instead of looping
          setStreamError(ev.code === 4003 ? 'You do not have access to this server\'s live stream.' : 'No Guardian agent is linked to this server.');
          setTransport('disconnected');
          return;
        }
        if (!wsFailed && enabled && !isPaused) {
          // 4001 = expired/invalid login: a REST call refreshes the token before reconnecting
          retryTimeoutRef.current = setTimeout(() => {
            (ev.code === 4001 ? hydrateFromRest() : Promise.resolve()).finally(connectStream);
          }, 3000);
        }
      };
    } catch {
      startSseFallback();
    }

    function startSseFallback() {
      if (!enabled || isPaused || typeof window === 'undefined') return;
      cleanupStreams();
      setTransport('sse');

      try {
        const sse = new EventSource(`/api/guardian/agents/${agentId}/live-stream`);
        sseRef.current = sse;

        sse.onopen = () => {
          setIsConnected(true);
        };

        sse.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            handleIncomingTick(parsed);
          } catch {}
        };

        sse.onerror = () => {
          setIsConnected(false);
          sse.close();
          if (enabled && !isPaused) {
            retryTimeoutRef.current = setTimeout(connectStream, 4000);
          }
        };
      } catch {
        setTransport('disconnected');
      }
    }
  }, [agentId, enabled, isPaused, cleanupStreams, handleIncomingTick, hydrateFromRest]);

  // Initial mount lifecycle & tab visibility listener
  useEffect(() => {
    if (!enabled || !agentId) {
      cleanupStreams();
      return;
    }

    // 1. Instant REST hydration
    hydrateFromRest();

    // 2. Open live stream
    connectStream();

    // 3. Tab visibility awareness
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden: suspend stream to preserve client CPU and bandwidth
        cleanupStreams();
        setTransport('paused');
      } else {
        // Tab visible: resync latest state & reconnect stream
        hydrateFromRest().then(() => {
          connectStream();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanupStreams();
    };
  }, [agentId, enabled, hydrateFromRest, connectStream, cleanupStreams]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        cleanupStreams();
        setTransport('paused');
      } else {
        hydrateFromRest().then(() => {
          connectStream();
        });
      }
      return next;
    });
  }, [cleanupStreams, hydrateFromRest, connectStream]);

  return {
    stats,
    history,
    isConnected,
    isPaused,
    transport,
    tickCount,
    latencyMs,
    lastTickAt,
    streamError,
    togglePause,
    resync: hydrateFromRest,
  };
}
