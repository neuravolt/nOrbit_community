"use client";

import React, { useEffect, useState } from 'react';
import {
  Headphones,
  Volume2,
  Smartphone,
  Check,
  X,
  Radio,
} from 'lucide-react';
import { switchAudioOutputDevice } from '@/src/lib/ringtone';

export type AudioOutputType = 'bluetooth' | 'speaker' | 'phone';

interface AudioOutputPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: AudioOutputType;
  onSelect: (type: AudioOutputType, deviceLabel?: string) => void;
}

interface DetectedOutput {
  id: string;
  label: string;
  type: AudioOutputType;
}

export function AudioOutputPickerModal({
  isOpen,
  onClose,
  activeType,
  onSelect,
}: AudioOutputPickerModalProps) {
  const [detectedDevices, setDetectedDevices] = useState<DetectedOutput[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const scanDevices = async () => {
      setIsDetecting(true);
      if (typeof window !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter((d) => d.kind === 'audiooutput');

          const list: DetectedOutput[] = [];
          outputs.forEach((d) => {
            const lbl = (d.label || '').toLowerCase();
            let type: AudioOutputType = 'speaker';

            if (
              lbl.includes('bluetooth') ||
              lbl.includes('buds') ||
              lbl.includes('airpods') ||
              lbl.includes('headset') ||
              lbl.includes('wireless') ||
              lbl.includes('earphone') ||
              lbl.includes('freebuds') ||
              lbl.includes('realme') ||
              lbl.includes('boat') ||
              lbl.includes('noise')
            ) {
              type = 'bluetooth';
            } else if (
              lbl.includes('earpiece') ||
              lbl.includes('receiver') ||
              lbl.includes('handset') ||
              lbl.includes('phone')
            ) {
              type = 'phone';
            } else {
              type = 'speaker';
            }

            list.push({
              id: d.deviceId,
              label: d.label || (type === 'bluetooth' ? 'Bluetooth Earbuds' : 'Default Speaker'),
              type,
            });
          });

          setDetectedDevices(list);
        } catch (e) {
          console.warn('Could not enumerate audio devices:', e);
        }
      }
      setIsDetecting(false);
    };

    scanDevices();

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', scanDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', scanDevices);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine Bluetooth device label if found
  const btDevice = detectedDevices.find((d) => d.type === 'bluetooth');
  const btLabel = btDevice?.label || 'Bluetooth Earbuds / Buds';

  const handlePick = async (type: AudioOutputType) => {
    try {
      if (type === 'bluetooth') {
        const res = await switchAudioOutputDevice(true);
        onSelect('bluetooth', res.deviceLabel || btLabel);
      } else {
        const res = await switchAudioOutputDevice(false);
        onSelect(type, type === 'speaker' ? 'Phone Loudspeaker' : 'Phone Earpiece');
      }
    } catch (e) {
      onSelect(type);
    }
    onClose();
  };

  const handleSystemPicker = async () => {
    if (
      typeof window !== 'undefined' &&
      navigator.mediaDevices &&
      typeof (navigator.mediaDevices as any).selectAudioOutput === 'function'
    ) {
      try {
        const res = await (navigator.mediaDevices as any).selectAudioOutput();
        if (res && res.deviceId) {
          const lbl = (res.label || '').toLowerCase();
          const isBt =
            lbl.includes('bluetooth') ||
            lbl.includes('buds') ||
            lbl.includes('airpods') ||
            lbl.includes('headset') ||
            lbl.includes('wireless') ||
            lbl.includes('earphone');

          const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
          mediaElements.forEach((el) => {
            if ('setSinkId' in HTMLMediaElement.prototype && typeof (el as any).setSinkId === 'function') {
              (el as any).setSinkId(res.deviceId).catch(() => {});
            }
          });

          onSelect(isBt ? 'bluetooth' : 'speaker', res.label || 'Audio Device');
          onClose();
        }
      } catch (e) {}
    }
  };

  const hasSystemPicker =
    typeof window !== 'undefined' &&
    navigator.mediaDevices &&
    typeof (navigator.mediaDevices as any).selectAudioOutput === 'function';

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#161820] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl text-white animate-in slide-in-from-bottom-5 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle for mobile bottom sheet */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white tracking-wide">
              Select Audio Output
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-2 mb-3">
          Choose where you want to listen to call audio:
        </p>

        {/* WhatsApp-Style Device Options List */}
        <div className="space-y-2">
          {/* Option 1: Bluetooth Buds */}
          <button
            type="button"
            onClick={() => handlePick('bluetooth')}
            className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all border ${
              activeType === 'bluetooth'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeType === 'bluetooth'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-white/[0.08] text-slate-300'
                }`}
              >
                <Headphones className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold truncate text-white">
                  {btLabel}
                </p>
                <p className="text-[11px] text-emerald-400 font-medium">
                  {btDevice ? 'Bluetooth Connected' : 'Wireless Audio Mode'}
                </p>
              </div>
            </div>

            {activeType === 'bluetooth' && (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/50">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </div>
            )}
          </button>

          {/* Option 2: Speaker (Loudspeaker) */}
          <button
            type="button"
            onClick={() => handlePick('speaker')}
            className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all border ${
              activeType === 'speaker'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeType === 'speaker'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-white/[0.08] text-slate-300'
                }`}
              >
                <Volume2 className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-white">Speaker</p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Device Loudspeaker
                </p>
              </div>
            </div>

            {activeType === 'speaker' && (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/50">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </div>
            )}
          </button>

          {/* Option 3: Phone Earpiece */}
          <button
            type="button"
            onClick={() => handlePick('phone')}
            className={`w-full p-3.5 rounded-2xl flex items-center justify-between transition-all border ${
              activeType === 'phone'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  activeType === 'phone'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-white/[0.08] text-slate-300'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-white">Phone Earpiece</p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Private Front Receiver
                </p>
              </div>
            </div>

            {activeType === 'phone' && (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/50">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </div>
            )}
          </button>

          {/* System Audio Picker Prompt (if supported by Android Chrome) */}
          {hasSystemPicker && (
            <button
              type="button"
              onClick={handleSystemPicker}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-dashed border-white/10 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors mt-1"
            >
              <span>More System Devices...</span>
            </button>
          )}
        </div>

        {/* WhatsApp-Style Cancel Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 mt-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-sm font-semibold text-slate-200 hover:text-white transition-colors text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
