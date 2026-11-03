'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { Bell, Volume2, X } from 'lucide-react';

/**
 * Task Manager Alert: High-energy Brass Fanfare ("Ta-Daa / Faaa!")
 * Plays when an employee is assigned a task.
 */
export function playTaskAlertSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Grace note "Ta-"
    const graceOsc = ctx.createOscillator();
    const graceGain = ctx.createGain();
    graceOsc.type = 'triangle';
    graceOsc.frequency.setValueAtTime(349.23 /* F4 */, now);
    graceGain.gain.setValueAtTime(0.35, now);
    graceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    graceOsc.connect(graceGain);
    graceGain.connect(ctx.destination);
    graceOsc.start(now);
    graceOsc.stop(now + 0.08);

    // Main "-Faaa!" Chord (F4, A4, C5, F5)
    const chord = [349.23, 440.0, 523.25, 698.46];
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + 0.08;
      const dur = 0.85;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  } catch (err) {
    console.warn('Task alert sound failed:', err);
  }
}

/**
 * Normal Notification: 3-Second Ambient Cascade
 * Shimmers gently and automatically fades out over 3 seconds.
 */
export function playNormal3SecChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25 /* C5 */, delay: 0.0 },
      { freq: 659.25 /* E5 */, delay: 0.3 },
      { freq: 783.99 /* G5 */, delay: 0.6 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + note.delay;
      const dur = 3.0 - note.delay;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, start);
      gain.gain.setValueAtTime(0.28, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });
  } catch (err) {
    console.warn('Normal chime failed:', err);
  }
}

export const playWhatsAppChime = playTaskAlertSound;

/**
 * Speaks out the urgent task announcement using Web Speech API (SpeechSynthesis).
 */
export function playCriticalVoice(text: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn('Voice synthesis failed:', err);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const { user } = useAuthStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // 1. Only run for internal employees / admins (NEVER for clients)
  const isEmployee = Boolean(user && user.role !== 'CLIENT');

  const [testSent, setTestSent] = useState(false);

  const getVapidKey = async (): Promise<string | null> => {
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    }
    try {
      const { data } = await api.get('/guardian/push/public-key');
      return data?.publicKey || null;
    } catch {
      try {
        const { data: prefData } = await api.get('/guardian/notification-preferences');
        return prefData?.pushPublicKey || null;
      } catch {
        return null;
      }
    }
  };

  const syncSubscriptionWithBackend = async (sub: PushSubscription) => {
    try {
      await api.post('/guardian/push/subscribe', { subscription: sub.toJSON() });
      setSubscribed(true);
    } catch (e) {
      console.warn('Failed to sync push subscription with backend:', e);
    }
  };

  const isPushSupported = () => {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  };

  useEffect(() => {
    if (!isEmployee || typeof window === 'undefined') return;

    if (!isPushSupported()) {
      return;
    }

    let isMounted = true;

    async function initPush() {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();

        if (sub) {
          // Already registered in this browser -> ensure backend database has it
          await syncSubscriptionWithBackend(sub);
          if (isMounted) setSubscribed(true);
        } else if (window.Notification && window.Notification.permission === 'granted') {
          // Permission already granted (e.g. in Chrome PWA / installed iOS PWA) -> auto subscribe!
          const vapidKey = await getVapidKey();
          if (vapidKey) {
            const newSub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            await syncSubscriptionWithBackend(newSub);
            if (isMounted) setSubscribed(true);
          }
        } else if (window.Notification && window.Notification.permission === 'default') {
          const dismissedThisSession = sessionStorage.getItem('neuravolt_push_dismissed');
          if (!dismissedThisSession && isMounted) {
            setTimeout(() => {
              if (isMounted && window.Notification && window.Notification.permission === 'default') {
                setShowPrompt(true);
              }
            }, 1500);
          }
        }
      } catch (err) {
        console.warn('Push init error:', err);
      }
    }

    initPush();

    // Listen for push events relayed from Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CALL_PUSH_RECEIVED') {
        const payload = event.data.payload || {};
        playCriticalVoice(payload.spokenText || `Incoming audio call from ${payload.callerName || 'Colleague'}`);
      } else if (event.data?.type === 'TASK_PUSH_RECEIVED') {
        const payload = event.data.payload || {};
        if (payload.isCritical) {
          playCriticalVoice(payload.spokenText || `Alert! Urgent task assigned: ${payload.title}`);
        } else if (
          payload.url?.includes('/tasks') ||
          payload.title?.toLowerCase().includes('task') ||
          payload.tag?.startsWith('task')
        ) {
          // Task Manager: Play the high-energy "Faaa" Brass Fanfare alert sound
          playTaskAlertSound();
        } else {
          // Normal Notification: Play 3-second gentle ambient chime
          playNormal3SecChime();
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isEmployee]);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      if (!isPushSupported()) {
        alert(
          'iPhone Notification Instructions:\n\n' +
          'iOS Safari requires adding this app to your Home Screen to receive notifications:\n' +
          '1. Tap the Share icon [↑] at the bottom of Safari.\n' +
          '2. Tap "Add to Home Screen".\n' +
          '3. Open NeuraVolt from your Home Screen to enable alerts!'
        );
        setShowPrompt(false);
        return;
      }

      const permission = await window.Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission was not granted. Please check your browser / system settings to allow notifications.');
        setShowPrompt(false);
        return;
      }

      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        throw new Error('VAPID public key not found on server.');
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      await syncSubscriptionWithBackend(sub);
      setShowPrompt(false);
      sessionStorage.removeItem('neuravolt_push_dismissed');
      localStorage.removeItem('neuravolt_push_dismissed');
      
      // Test audio feedback
      playWhatsAppChime();
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      alert(err.message || 'Failed to enable push notifications.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('neuravolt_push_dismissed', 'true');
  };

  const handleSendTestPush = async () => {
    try {
      setTestSent(true);
      playWhatsAppChime();
      await api.post('/guardian/push/test');
      setTimeout(() => setTestSent(false), 4000);
    } catch (err: any) {
      console.error('Test push failed:', err);
      alert('Could not trigger test push: ' + (err?.response?.data?.message || err.message));
      setTestSent(false);
    }
  };

  if (!isEmployee) {
    return null;
  }

  return (
    <>
      {/* Banner prompt when permission is default */}
      {showPrompt && !subscribed && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/60 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Enable Task Audio Alerts</span>
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Get instant desktop & mobile alerts when tasks are assigned to you! Includes WhatsApp chime & priority voice alert.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                >
                  {isSubscribing ? 'Enabling…' : 'Allow Alerts'}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
