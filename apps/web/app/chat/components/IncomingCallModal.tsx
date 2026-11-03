"use client";

import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Radio } from 'lucide-react';
import { getIncomingRingtoneUrl, routeAudioOutput } from '@/src/lib/ringtone';

interface IncomingCallModalProps {
  incomingCall: {
    callId: string;
    conversationId: string;
    callerUserId: string;
    callerName: string;
    callerAvatar?: string;
    isGroup?: boolean;
    roomUrl?: string;
  } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({
  incomingCall,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const vibrateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!incomingCall) return;

    startIncomingRingtone();
    startVibration();
    startVoiceAnnouncement(incomingCall.callerName);

    return () => {
      stopIncomingRingtone();
      stopVibration();
      stopVoiceAnnouncement();
    };
  }, [incomingCall]);

  const startVoiceAnnouncement = (callerName: string) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Incoming audio call from ${callerName || 'Colleague'}`;

        const speak = () => {
          if (typeof window === 'undefined' || !window.speechSynthesis) return;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.05;
          window.speechSynthesis.speak(utterance);
        };

        const timeout = setTimeout(speak, 800);
        voiceIntervalRef.current = setInterval(speak, 6000);

        return () => clearTimeout(timeout);
      }
    } catch (e) {
      console.warn('SpeechSynthesis voice alert error:', e);
    }
  };

  const stopVoiceAnnouncement = () => {
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
      voiceIntervalRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startVibration = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([500, 300, 500, 300, 800]);
        vibrateIntervalRef.current = setInterval(() => {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([500, 300, 500, 300, 800]);
          }
        }, 2400);
      }
    } catch (e) {
      // ignore
    }
  };

  const stopVibration = () => {
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch (e) {
      // ignore
    }
  };

  const startIncomingRingtone = () => {
    try {
      const ringUrl = getIncomingRingtoneUrl();
      if (!ringAudioRef.current) {
        const audio = new Audio(ringUrl);
        audio.loop = true;
        ringAudioRef.current = audio;
      } else {
        ringAudioRef.current.src = ringUrl;
        ringAudioRef.current.loop = true;
      }

      // Automatically route sound to Bluetooth earbuds if connected
      routeAudioOutput(ringAudioRef.current);

      ringAudioRef.current.play().catch(() => {
        // Unlock on first tap
        const unlock = () => {
          ringAudioRef.current?.play().catch(() => {});
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
      });
    } catch (err) {
      console.warn('Ringtone error:', err);
    }
  };

  const stopIncomingRingtone = () => {
    if (ringAudioRef.current) {
      try {
        ringAudioRef.current.pause();
        ringAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
  };

  if (!incomingCall) return null;

  const callerInitial = (incomingCall.callerName || 'U').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl p-6 text-white flex flex-col items-center relative overflow-hidden">
        
        {/* Animated Rings */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/30 animate-pulse duration-700" />

          {incomingCall.callerAvatar ? (
            <img
              src={incomingCall.callerAvatar}
              alt={incomingCall.callerName}
              className="w-24 h-24 rounded-full object-cover shadow-2xl border-2 border-white/20 z-10"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-3xl font-bold shadow-lg border-2 border-white/20 z-10">
              {callerInitial}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Incoming Audio Call</span>
          </span>
          <h3 className="text-xl font-bold text-white pt-2">{incomingCall.callerName}</h3>
          <p className="text-xs text-slate-400">
            {incomingCall.isGroup ? 'Group voice call in progress' : 'Direct Audio Call'}
          </p>
        </div>

        {/* Action Buttons: Accept / Decline */}
        <div className="flex items-center gap-8 mt-8">
          {/* Decline (Red) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                stopIncomingRingtone();
                onDecline();
              }}
              className="w-14 h-14 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-semibold text-rose-400">Decline</span>
          </div>

          {/* Accept (Green) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                stopIncomingRingtone();
                onAccept();
              }}
              className="w-14 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 animate-bounce"
              title="Accept"
            >
              <Phone className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-semibold text-emerald-400">Accept</span>
          </div>
        </div>

      </div>
    </div>
  );
}
