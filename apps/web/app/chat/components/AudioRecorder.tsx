"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { api } from '@/src/lib/api';

interface AudioRecorderProps {
  onSendVoiceNote: (audioUrl: string, durationSeconds: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSendVoiceNote, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access is required to record voice notes.');
      onCancel();
    }
  };

  const stopAndUpload = async () => {
    if (!mediaRecorderRef.current) return;
    setIsUploading(true);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, `voice-note-${Date.now()}.webm`);

        const res = await api.post('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const url = res.data?.url || res.data?.attachment?.url;
        if (url) {
          onSendVoiceNote(url, duration);
        }
      } catch (err) {
        console.error('Failed to upload voice note:', err);
        alert('Failed to upload voice message.');
      } finally {
        setIsUploading(false);
        cleanup();
      }
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl text-rose-800 animate-in fade-in w-full">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
        <Mic className="w-4 h-4 text-rose-600" />
        <span className="font-mono text-sm font-semibold">{formatTime(duration)}</span>
      </div>

      <div className="flex-1 text-xs text-rose-600/80 font-medium truncate">
        Recording voice note...
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            cleanup();
            onCancel();
          }}
          disabled={isUploading}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100 transition-colors"
          title="Discard recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={stopAndUpload}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
