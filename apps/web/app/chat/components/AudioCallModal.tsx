"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Radio,
  Users,
  UserPlus,
  Copy,
  Check,
  Video,
  ExternalLink,
  Search,
  X,
  Headphones,
  Smartphone,
} from 'lucide-react';
import { api } from '@/src/lib/api';
import {
  AudioOutputPickerModal,
  AudioOutputType,
} from '@/app/components/AudioOutputPickerModal';
import {
  getOutgoingRingtoneUrl,
  routeAudioOutput,
  switchAudioOutputDevice,
} from '@/src/lib/ringtone';

interface AudioCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: any;
  currentUserName?: string;
  isCaller?: boolean;
  isAccepted?: boolean;
  roomUrl?: string;
  onCallEnded: (durationSeconds: number) => void;
  onInviteMember?: (user: any) => void;
}

export function AudioCallModal({
  isOpen,
  onClose,
  conversation,
  currentUserName,
  isCaller = true,
  isAccepted = false,
  roomUrl,
  onCallEnded,
  onInviteMember,
}: AudioCallModalProps) {
  const [callStatus, setCallStatus] = useState<'RINGING' | 'CONNECTED' | 'ENDED'>(
    isCaller && !isAccepted ? 'RINGING' : 'CONNECTED'
  );
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(20);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [isUsingBluetooth, setIsUsingBluetooth] = useState(false);
  const [activeAudioType, setActiveAudioType] = useState<AudioOutputType>('bluetooth');
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync call status when isAccepted or isCaller changes
  useEffect(() => {
    if (!isOpen) return;

    if (isCaller && !isAccepted) {
      setCallStatus('RINGING');
      setDuration(0);
      startOutgoingRingtone();
    } else {
      stopOutgoingRingtone();
      setCallStatus('CONNECTED');
      startTimer();
    }

    setupMicrophone();

    const handleBeforeUnload = () => {
      cleanupAudio();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupAudio();
    };
  }, [isOpen, isCaller, isAccepted]);

  // Load team users when Add Member drawer is opened
  useEffect(() => {
    if (isAddMemberOpen && teamUsers.length === 0) {
      api
        .get('/users')
        .then((res) => {
          setTeamUsers(res.data?.users || res.data || []);
        })
        .catch(() => {});
    }
  }, [isAddMemberOpen]);

  const outgoingAudioRef = useRef<HTMLAudioElement | null>(null);

  const startOutgoingRingtone = () => {
    try {
      const ringUrl = getOutgoingRingtoneUrl();
      if (!outgoingAudioRef.current) {
        const audio = new Audio(ringUrl);
        audio.loop = true;
        outgoingAudioRef.current = audio;
      } else {
        outgoingAudioRef.current.src = ringUrl;
        outgoingAudioRef.current.loop = true;
      }

      // Automatically route sound to Bluetooth earbuds if connected
      routeAudioOutput(outgoingAudioRef.current);

      outgoingAudioRef.current.play().catch(() => {
        const unlock = () => {
          outgoingAudioRef.current?.play().catch(() => {});
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
      });
    } catch (e) {
      console.warn('Outgoing ringtone error:', e);
    }
  };

  const stopOutgoingRingtone = () => {
    if (outgoingAudioRef.current) {
      try {
        outgoingAudioRef.current.pause();
        outgoingAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
  };

  const setupMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = audioContextRef.current || new AudioCtxClass();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setVolumeLevel(Math.min(100, Math.max(15, Math.round(avg * 1.8))));
          animationFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      }
    } catch (err) {
      console.warn('Microphone permission check:', err);
    }
  };

  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  const toggleAudioOutput = async () => {
    try {
      const nextMode = !isUsingBluetooth;
      const res = await switchAudioOutputDevice(nextMode);
      setIsUsingBluetooth(res.isBluetooth);
    } catch (e) {
      console.warn('Audio switch error:', e);
    }
  };

  const handleEndCall = () => {
    setCallStatus('ENDED');
    stopOutgoingRingtone();
    cleanupAudio();
    onCallEnded(duration);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const cleanupAudio = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://teams.neuravolt.in';
    const link = roomUrl || `${origin}/meet/room/nv-call-${conversation?.id || 'live'}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInviteUser = (targetUser: any) => {
    if (onInviteMember) {
      onInviteMember(targetUser);
    }
    setInvitedUserIds((prev) => new Set([...prev, targetUser.id]));
  };

  if (!isOpen) return null;

  const otherUserName = conversation?.otherUser
    ? `${conversation.otherUser.firstName || ''} ${conversation.otherUser.lastName || ''}`.trim() ||
      conversation.otherUser.email
    : null;

  const targetTitle =
    conversation?.type === 'DIRECT'
      ? otherUserName || conversation?.title || 'Direct Call'
      : `# ${conversation?.title || 'Team Channel'}`;

  const avatarChar = targetTitle.replace('#', '').trim().charAt(0).toUpperCase();

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://teams.neuravolt.in';
  const effectiveRoomUrl =
    roomUrl || `${origin}/meet/room/nv-call-${conversation?.id || 'live'}`;

  const filteredUsers = teamUsers.filter((u) => {
    const q = searchUserQuery.toLowerCase().trim();
    if (!q) return true;
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 rounded-3xl shadow-2xl text-white flex flex-col items-center relative overflow-hidden min-h-[520px] justify-between p-6">
        
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>NeuraVolt Native VoIP</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Route Switch (WhatsApp-Style Picker) */}
            <button
              type="button"
              onClick={() => setIsAudioPickerOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                activeAudioType === 'bluetooth'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Audio Output (Tap to open device selector)"
            >
              {activeAudioType === 'bluetooth' ? (
                <>
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buds</span>
                </>
              ) : activeAudioType === 'speaker' ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                  <span>Speaker</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-slate-300" />
                  <span>Earpiece</span>
                </>
              )}
            </button>

            {/* Copy Invite Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Copy Call Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Add Member Button */}
            <button
              type="button"
              onClick={() => setIsAddMemberOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-colors"
              title="Add Member to Call"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Center Stage: Avatar & Live Status */}
        <div className="flex flex-col items-center my-auto py-4">
          {/* Avatar with Animated Voice Ripples */}
          <div className="relative my-6 flex items-center justify-center">
            {callStatus === 'CONNECTED' ? (
              <>
                <div
                  className="absolute rounded-full bg-emerald-500/15 transition-all duration-300"
                  style={{
                    width: `${96 + volumeLevel * 0.9}px`,
                    height: `${96 + volumeLevel * 0.9}px`,
                  }}
                />
                <div
                  className="absolute rounded-full bg-emerald-500/25 transition-all duration-150"
                  style={{
                    width: `${88 + volumeLevel * 0.5}px`,
                    height: `${88 + volumeLevel * 0.5}px`,
                  }}
                />
              </>
            ) : (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-indigo-500/20 animate-ping duration-1000" />
                <div className="absolute w-28 h-28 rounded-full bg-indigo-500/30 animate-pulse duration-700" />
              </>
            )}

            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-3xl font-bold shadow-2xl border-2 border-white/20 z-10">
              {avatarChar}
            </div>
          </div>

          {/* Contact / Channel Name */}
          <h3 className="text-xl font-bold text-white text-center px-4 tracking-tight">
            {targetTitle}
          </h3>

          {/* Call Status Badge */}
          <div className="mt-2 text-center">
            {callStatus === 'RINGING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold animate-pulse">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>Ringing recipient...</span>
              </span>
            )}
            {callStatus === 'CONNECTED' && (
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-emerald-400 text-sm font-bold tracking-wider">
                  🟢 Connected • {formatDuration(duration)}
                </span>
                <span className="text-[11px] text-slate-400">
                  HD Voice Audio Active
                </span>
              </div>
            )}
            {callStatus === 'ENDED' && (
              <span className="text-rose-400 text-sm font-semibold">Call Ended</span>
            )}
          </div>

          {/* Audio Waveform Meter */}
          {callStatus === 'CONNECTED' && !isMuted && (
            <div className="flex items-center gap-1 mt-4 h-6">
              {[40, 70, 100, 60, 30, 80, 50, 90, 40].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-150"
                  style={{
                    height: `${Math.max(6, Math.min(24, Math.round((volumeLevel / 100) * h)))}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Quick link to Open in Full Meeting Room */}
          <a
            href={effectiveRoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60 hover:bg-slate-800"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Switch to Full Video Meeting</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>
        </div>

        {/* Bottom Call Controls (Like WhatsApp / FaceTime) */}
        <div className="w-full pt-4 border-t border-slate-800/60 flex items-center justify-center gap-4">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call (Red Button) */}
          <button
            type="button"
            onClick={handleEndCall}
            className="w-16 h-13 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95 mx-2"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Audio Output Switch (WhatsApp-Style Picker) */}
          <button
            type="button"
            onClick={() => setIsAudioPickerOpen(true)}
            className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center transition-all ${
              activeAudioType === 'bluetooth'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Select Audio Output (Buds, Speaker, or Phone)"
          >
            {activeAudioType === 'bluetooth' ? (
              <Headphones className="w-5 h-5 text-white" />
            ) : activeAudioType === 'speaker' ? (
              <Volume2 className="w-5 h-5 text-slate-200" />
            ) : (
              <Smartphone className="w-5 h-5 text-slate-200" />
            )}
            <span className="text-[9px] font-bold leading-none mt-0.5">
              {activeAudioType === 'bluetooth' ? 'Buds' : activeAudioType === 'speaker' ? 'Speaker' : 'Earpiece'}
            </span>
          </button>

          {/* Speaker / Deafen */}
          <button
            type="button"
            onClick={toggleDeafen}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all ${
              isDeafened
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isDeafened ? 'Enable Speaker' : 'Mute Speaker'}
          >
            {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Add Participant */}
          <button
            type="button"
            onClick={() => setIsAddMemberOpen(true)}
            className="w-13 h-13 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all"
            title="Add Member to Call"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        {/* ── Slide-up "Add Member" Sheet ── */}
        {isAddMemberOpen && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-5 flex flex-col justify-between animate-in slide-in-from-bottom duration-200 rounded-3xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">Add Member to Live Call</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search User */}
              <div className="relative my-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Search team member..."
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* User List */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.map((u) => {
                  const isInvited = invitedUserIds.has(u.id);
                  const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.role || u.email}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInviteUser(u)}
                        disabled={isInvited}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          isInvited
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                        }`}
                      >
                        {isInvited ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Ringing</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span>Ring</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-500">No members found</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddMemberOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors mt-3"
            >
              Done
            </button>
          </div>
        )}

        {/* WhatsApp-Style Audio Output Picker Modal */}
        <AudioOutputPickerModal
          isOpen={isAudioPickerOpen}
          onClose={() => setIsAudioPickerOpen(false)}
          activeType={activeAudioType}
          onSelect={(type) => {
            setActiveAudioType(type);
            setIsUsingBluetooth(type === 'bluetooth');
          }}
        />

      </div>
    </div>
  );
}
