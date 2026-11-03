"use client";

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ToastProvider } from '../src/components/ToastProvider';
import { PushNotificationManager } from '../src/components/notifications/PushNotificationManager';
import { api } from '../src/lib/api';

// Keep reference to original console functions at module level
let originalLog: any = null;
let originalWarn: any = null;
let originalError: any = null;
let originalInfo: any = null;

if (typeof window !== 'undefined') {
  originalLog = window.console.log;
  originalWarn = window.console.warn;
  originalError = window.console.error;
  originalInfo = window.console.info;
}

function ConsoleSuppressor() {
  const { data } = useQuery({
    queryKey: ['global-configs'],
    queryFn: async () => {
      const { data } = await api.get('/launchpad/config');
      return data;
    },
    refetchInterval: 10000, // Poll config every 10 seconds to keep it dynamic and fast
    staleTime: 5000,
  });

  useEffect(() => {
    if (!data?.configs) return;

    const disableLogs = data.configs.DISABLE_CONSOLE_LOGS;
    const shouldDisable = disableLogs === 'true' || disableLogs === true;

    if (shouldDisable) {
      window.console.log = () => {};
      window.console.warn = () => {};
      window.console.error = () => {};
      window.console.info = () => {};
    } else {
      if (originalLog) window.console.log = originalLog;
      if (originalWarn) window.console.warn = originalWarn;
      if (originalError) window.console.error = originalError;
      if (originalInfo) window.console.info = originalInfo;
    }
  }, [data]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const handleChunkError = (event: any) => {
      const error = event?.reason || event?.error || event;
      const msg = String(error?.message || error || '');
      const name = String(error?.name || '');
      if (name === 'ChunkLoadError' || msg.includes('Failed to load chunk') || msg.includes('Loading chunk')) {
        console.warn('New deployment detected! Auto-refreshing to load latest application assets...');
        window.location.reload();
      }
    };

    window.addEventListener('unhandledrejection', handleChunkError);
    window.addEventListener('error', handleChunkError);

    return () => {
      window.removeEventListener('unhandledrejection', handleChunkError);
      window.removeEventListener('error', handleChunkError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConsoleSuppressor />
      <ToastProvider>
        <PushNotificationManager />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
