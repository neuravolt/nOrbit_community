"use client";

import React, { useEffect, useRef, useState, use } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Copy,
  Check,
  Users,
  X,
  UserPlus,
  Search,
  Headphones,
  Volume2,
  Smartphone,
} from 'lucide-react';
import { useAuthStore } from '@/src/store/auth';
import { api } from '@/src/lib/api';
import { useRouter } from 'next/navigation';
import {
  AudioOutputPickerModal,
  AudioOutputType,
} from '@/app/components/AudioOutputPickerModal';
import {
  getOutgoingRingtoneUrl,
  routeAudioOutput,
  switchAudioOutputDevice,
  AudioOutputDeviceInfo,
} from '@/src/lib/ringtone';

interface RemotePeer {
  userId: string;
  userName: string;
  stream: MediaStream;
}

/**
 * Robust Remote Video Tile
 * Solves autoplay blocking, WebRTC track detection, and clean UI avatar fallback.
 */
function RemoteVideoTile({
  peer,
  isPresenter = false,
}: {
  peer: RemotePeer;
  isPresenter?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!peer.stream) return;

    if (el) {
      el.srcObject = peer.stream;
      routeAudioOutput(el);
    }

    const checkTrackState = () => {
      const vTracks = peer.stream.getVideoTracks();
      const active = vTracks.length > 0 && vTracks.some((t) => t.enabled && t.readyState === 'live');
      setHasVideo(active);
    };

    checkTrackState();

    peer.stream.getVideoTracks().forEach((track) => {
      track.onmute = checkTrackState;
      track.onunmute = checkTrackState;
      track.onended = checkTrackState;
    });

    const attemptPlay = async () => {
      try {
        if (el) await el.play();
      } catch (err) {
        // Fallback: unlock audio/video playback on user touch/click
        const unlock = () => {
          if (el) el.play().catch(() => {});
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
      }
    };

    if (el) el.onloadedmetadata = attemptPlay;
    attemptPlay();

    const interval = setInterval(() => {
      if (el && el.paused && peer.stream.active) {
        el.play().catch(() => {});
      }
      checkTrackState();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [peer.stream]);

  const initials =
    peer.userName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'P';

  return (
    <div
      className={`relative rounded-2xl bg-[#161820] border border-white/[0.08] overflow-hidden flex items-center justify-center shadow-xl group transition-all w-full h-full min-h-[200px]`}
    >
      {/* Video Element - UNMUTED so Android WebRTC routes voice audio directly to Bluetooth Buds */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full ${
          isPresenter ? 'object-contain' : 'object-cover'
        } transition-opacity duration-300 ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback Avatar when camera is off */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#161820]">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/10 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-2xl">
            {initials}
          </div>
          <span className="text-sm font-medium text-slate-300 mt-3">{peer.userName}</span>
          <span className="text-xs text-slate-500 mt-0.5">Camera off</span>
        </div>
      )}

      {/* Clean Bottom Overlay Badge */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-xs font-medium text-white flex items-center gap-2 shadow-sm border border-white/5">
        <span className="truncate max-w-[140px] sm:max-w-none">{peer.userName}</span>
      </div>
    </div>
  );
}

/**
 * Local Camera Video Tile with Mirrored View
 */
function LocalVideoTile({
  stream,
  userName,
  isVideoDisabled,
  isAudioMuted,
}: {
  stream: MediaStream | null;
  userName: string;
  isVideoDisabled: boolean;
  isAudioMuted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  const initials =
    userName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';

  return (
    <div className="relative rounded-2xl bg-[#161820] border border-white/[0.08] overflow-hidden flex items-center justify-center shadow-xl group transition-all w-full h-full min-h-[200px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isVideoDisabled ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {isVideoDisabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#161820]">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-indigo-950 to-slate-800 border border-white/10 text-white font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-2xl">
            {initials}
          </div>
          <span className="text-sm font-medium text-slate-300 mt-3">{userName} (You)</span>
          <span className="text-xs text-slate-500 mt-0.5">Camera off</span>
        </div>
      )}

      {/* Local Badge */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-xs font-medium text-white flex items-center gap-2 shadow-sm border border-white/5">
        <span>{userName} (You)</span>
        {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
      </div>
    </div>
  );
}

export default function InHouseMeetingRoomPage({
  params: paramsPromise,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(paramsPromise);
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Presenter State (Syncs across devices)
  const [presenter, setPresenter] = useState<{
    userId: string;
    userName: string;
    isLocal: boolean;
  } | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Team Invite Drawer State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());

  // Audio Output Routing & Ringing State
  const [isUsingBluetooth, setIsUsingBluetooth] = useState(false);
  const [activeAudioType, setActiveAudioType] = useState<AudioOutputType>('bluetooth');
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputDeviceInfo[]>([]);
  const ringingAudioRef = useRef<HTMLAudioElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: [
          'turn:187.127.148.197:3478?transport=udp',
          'turn:187.127.148.197:3478?transport=tcp',
        ],
        username: 'neuraconnect',
        credential: 'nv2026turnsecure',
      },
    ],
  };

  useEffect(() => {
    let unmounted = false;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
        });

        if (unmounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        connectSignaling(stream);
      } catch (err: any) {
        console.warn('Camera/Mic permission fallback to audio only:', err);
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          });
          if (unmounted) {
            audioOnly.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = audioOnly;
          setLocalStream(audioOnly);
          setIsVideoDisabled(true);
          connectSignaling(audioOnly);
        } catch (audioErr: any) {
          setErrorMsg('Camera and Microphone access denied. Please grant permission in browser settings.');
        }
      }
    }

    initMedia();

    const fullCleanup = () => {
      unmounted = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {}
        });
        localStreamRef.current = null;
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {}
        });
      }
      peerConnectionsRef.current.forEach((pc) => {
        try {
          pc.close();
        } catch (e) {}
      });
      peerConnectionsRef.current.clear();
      if (socketRef.current) {
        try {
          if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ event: 'leave_room', data: { roomId } }));
          }
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
    };

    // Only clean up on actual window navigation/tab close, NOT when switching mobile apps
    window.addEventListener('beforeunload', fullCleanup);

    return () => {
      window.removeEventListener('beforeunload', fullCleanup);
      fullCleanup();
    };
  }, [roomId]);

  // Detect Bluetooth Buds and Audio Outputs
  useEffect(() => {
    const detectDevices = async () => {
      if (typeof window !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs: AudioOutputDeviceInfo[] = [];
          devices
            .filter((d) => d.kind === 'audiooutput')
            .forEach((d) => {
              const lbl = d.label.toLowerCase();
              const isBt =
                lbl.includes('bluetooth') ||
                lbl.includes('buds') ||
                lbl.includes('airpods') ||
                lbl.includes('headset') ||
                lbl.includes('wireless') ||
                lbl.includes('earphone');
              outputs.push({
                deviceId: d.deviceId,
                label: d.label || (isBt ? 'Bluetooth Earbuds' : 'Default Speaker'),
                isBluetooth: isBt,
              });
            });
          setAudioOutputs(outputs);
          const hasBt = outputs.some((o) => o.isBluetooth);
          setIsUsingBluetooth(hasBt);
        } catch (e) {}
      }
    };

    detectDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', detectDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', detectDevices);
      };
    }
  }, []);

  const toggleAudioOutput = async () => {
    try {
      const nextMode = !isUsingBluetooth;
      const res = await switchAudioOutputDevice(nextMode);
      setIsUsingBluetooth(res.isBluetooth);
    } catch (err) {
      console.warn('Audio switch failed:', err);
    }
  };

  const startRoomOutgoingRing = () => {
    try {
      const ringUrl = getOutgoingRingtoneUrl();
      if (!ringingAudioRef.current) {
        const audio = new Audio(ringUrl);
        audio.loop = true;
        ringingAudioRef.current = audio;
      } else {
        ringingAudioRef.current.src = ringUrl;
        ringingAudioRef.current.loop = true;
      }
      routeAudioOutput(ringingAudioRef.current);
      ringingAudioRef.current.play().catch(() => {});
    } catch (e) {}
  };

  const stopRoomOutgoingRing = () => {
    if (ringingAudioRef.current) {
      try {
        ringingAudioRef.current.pause();
        ringingAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
  };

  // Keep screen video ref bound when presenter is local
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, presenter]);

  const connectSignaling = (mediaStream: MediaStream) => {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss:' : 'ws:';
    const host =
      typeof window !== 'undefined' && window.location.port === '3000'
        ? `${window.location.hostname}:3001`
        : typeof window !== 'undefined'
        ? window.location.host
        : 'teams.neuravolt.in';

    let guestId = '';
    let guestName = '';
    if (typeof window !== 'undefined') {
      guestId = sessionStorage.getItem('nv_guest_id') || `guest_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('nv_guest_id', guestId);
      guestName = sessionStorage.getItem('nv_guest_name') || 'Guest Participant';
    }
    const currentUserId = user?.id || guestId;

    const tokenParam = accessToken
      ? `token=${accessToken}`
      : `token=guest-access&guestId=${guestId}&guestName=${encodeURIComponent(guestName)}`;

    const ws = new WebSocket(`${protocol}//${host}/api/chat?${tokenParam}`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'join_room', data: { roomId } }));
    };

    ws.onmessage = async (event) => {
      try {
        const { event: ev, data } = JSON.parse(event.data);

        switch (ev) {
          case 'room_peers':
            if (Array.isArray(data?.peers)) {
              data.peers.forEach((peer: any) => {
                if (peer?.userId && peer.userId !== currentUserId) {
                  createPeerConnection(peer.userId, peer.userName || 'Participant', true, mediaStream);
                }
              });
            }
            break;

          case 'peer_joined':
            stopRoomOutgoingRing();
            if (data?.userId && data.userId !== currentUserId) {
              createPeerConnection(data.userId, data.userName || 'Participant', false, mediaStream);
            }
            break;

          case 'peer_left':
            if (data?.userId) {
              closePeerConnection(data.userId);
            }
            break;

          case 'webrtc_signal':
            if (data?.senderUserId && data.senderUserId !== currentUserId) {
              handleIncomingSignal(data, mediaStream);
            }
            break;
        }
      } catch (e) {
        // ignore non-json
      }
    };
  };

  const createPeerConnection = async (
    targetUserId: string,
    targetUserName: string,
    isInitiator: boolean,
    stream: MediaStream
  ) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId)!;
    }

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current.set(targetUserId, pc);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      let remoteStream = event.streams[0];
      if (!remoteStream) {
        remoteStream = new MediaStream([event.track]);
      }
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetUserId);
        if (existing) {
          const tracks = existing.stream.getTracks();
          if (!tracks.some((t) => t.id === event.track.id)) {
            existing.stream.addTrack(event.track);
          }
          const updatedStream = new MediaStream(existing.stream.getTracks());
          next.set(targetUserId, {
            ...existing,
            stream: updatedStream,
          });
          return next;
        } else {
          next.set(targetUserId, {
            userId: targetUserId,
            userName: targetUserName,
            stream: remoteStream,
          });
          return next;
        }
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            event: 'webrtc_signal',
            data: {
              roomId,
              targetUserId,
              signal: { type: 'candidate', candidate: event.candidate },
            },
          })
        );
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              event: 'webrtc_signal',
              data: {
                roomId,
                targetUserId,
                signal: { type: 'offer', sdp: offer },
              },
            })
          );
        }
      } catch (err) {
        console.error('Failed to create offer:', err);
      }
    }

    return pc;
  };

  const handleIncomingSignal = async (data: any, stream: MediaStream) => {
    const { senderUserId, senderName, signal } = data;

    // Handle Screen Sharing presentation sync across devices
    if (signal?.type === 'screen_share_status') {
      if (signal.isSharing) {
        setPresenter({
          userId: senderUserId,
          userName: signal.presenterName || senderName || 'Presenter',
          isLocal: false,
        });
      } else {
        setPresenter(null);
      }
      return;
    }

    let pc = peerConnectionsRef.current.get(senderUserId);

    if (!pc) {
      pc = await createPeerConnection(senderUserId, senderName || 'Participant', false, stream);
    }

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

      // Flush any queued ICE candidates that arrived before remote description
      const queued = iceCandidatesQueue.current.get(senderUserId);
      if (queued && queued.length > 0) {
        for (const c of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (e) {}
        }
        iceCandidatesQueue.current.delete(senderUserId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            event: 'webrtc_signal',
            data: {
              roomId,
              targetUserId: senderUserId,
              signal: { type: 'answer', sdp: answer },
            },
          })
        );
      }
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

      // Flush queued candidates
      const queued = iceCandidatesQueue.current.get(senderUserId);
      if (queued && queued.length > 0) {
        for (const c of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (e) {}
        }
        iceCandidatesQueue.current.delete(senderUserId);
      }
    } else if (signal.type === 'candidate' && signal.candidate) {
      if (!pc.remoteDescription) {
        // Queue candidates until remote description is set
        if (!iceCandidatesQueue.current.has(senderUserId)) {
          iceCandidatesQueue.current.set(senderUserId, []);
        }
        iceCandidatesQueue.current.get(senderUserId)!.push(signal.candidate);
      } else {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    }
  };

  const closePeerConnection = (userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    setRemotePeers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
    if (presenter?.userId === userId) {
      setPresenter(null);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = isAudioMuted;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => {
        t.enabled = isVideoDisabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  const toggleScreenShare = async () => {
    if (presenter?.isLocal) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      setScreenStream(displayStream);
      setPresenter({
        userId: user?.id || 'self',
        userName: `${user?.firstName || 'You'}`,
        isLocal: true,
      });

      // Replace track on all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Broadcast screen share started event to all peers in the room
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            event: 'webrtc_signal',
            data: {
              roomId,
              signal: {
                type: 'screen_share_status',
                isSharing: true,
                presenterUserId: user?.id,
                presenterName: `${user?.firstName || 'Host'} ${user?.lastName || ''}`.trim(),
              },
            },
          })
        );
      }

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn('Screen share canceled or denied:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    setPresenter(null);

    // Revert to camera track on peers
    if (localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && camTrack) sender.replaceTrack(camTrack);
      });
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'webrtc_signal',
          data: {
            roomId,
            signal: {
              type: 'screen_share_status',
              isSharing: false,
              presenterUserId: user?.id,
            },
          },
        })
      );
    }
  };

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenAddMember = () => {
    setIsAddMemberOpen(true);
    if (teamUsers.length === 0) {
      api
        .get('/users')
        .then((res) => {
          setTeamUsers(res.data?.users || res.data || []);
        })
        .catch(() => {});
    }
  };

  const handleRingMember = (targetUser: any) => {
    startRoomOutgoingRing();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'call_initiate',
          data: {
            callId: roomId,
            targetUserId: targetUser.id,
            callerName: `${user?.firstName || 'Host'} ${user?.lastName || ''}`.trim(),
            callerAvatar: (user as any)?.avatarUrl,
            isGroup: true,
            roomUrl: typeof window !== 'undefined' ? window.location.href : '',
          },
        })
      );
    }
    setInvitedUserIds((prev) => new Set([...prev, targetUser.id]));
  };

  const handleLeave = () => {
    stopRoomOutgoingRing();
    // 1. Immediately kill hardware camera/mic tracks so mobile camera/mic indicator shuts off instantly
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
      });
      localStreamRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
      });
    }
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current.clear();
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ event: 'leave_room', data: { roomId } }));
        }
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/chat');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0e1015] text-white overflow-hidden select-none">
      {/* ── Top Bar (Minimalist & Dynamic Island Safe-Area Aware) ── */}
      <header className="pt-10 md:pt-3 pb-3 px-4 sm:px-6 flex items-center justify-between bg-[#121316] border-b border-white/[0.06] z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse shrink-0" />
          <h1 className="text-xs sm:text-sm font-semibold tracking-wide text-white truncate">
            NeuraConnect
          </h1>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline truncate max-w-[150px]">
            #{roomId.slice(0, 10)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Output Route Switch (WhatsApp-Style Picker) */}
          <button
            type="button"
            onClick={() => setIsAudioPickerOpen(true)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm border ${
              activeAudioType === 'bluetooth'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-white/[0.08] text-slate-200 border-white/[0.12] hover:bg-white/[0.14]'
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

          {/* Quick Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Invite'}</span>
          </button>

          {/* Participants Toggle Pill */}
          <button
            type="button"
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              isParticipantsOpen
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border-white/[0.08]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{remotePeers.size + 1}</span>
          </button>
        </div>
      </header>

      {/* ── Main Stage Area ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {errorMsg ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm max-w-md text-center">
              {errorMsg}
            </div>
          </div>
        ) : presenter ? (
          /* ── Full Stage Presentation Mode ── */
          <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden">
            {/* Main Stage Screen */}
            <div className="flex-1 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center shadow-2xl">
              <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-xs font-medium text-white flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span>{presenter.isLocal ? 'You are presenting' : `${presenter.userName} is presenting`}</span>
                {presenter.isLocal && (
                  <button
                    onClick={stopScreenShare}
                    className="ml-2 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white transition-colors"
                  >
                    Stop
                  </button>
                )}
              </div>

              {presenter.isLocal ? (
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain max-h-[calc(100vh-160px)]"
                />
              ) : remotePeers.get(presenter.userId) ? (
                <RemoteVideoTile
                  peer={remotePeers.get(presenter.userId)!}
                  isPresenter={true}
                />
              ) : (
                <div className="text-slate-400 text-sm">Receiving presentation...</div>
              )}
            </div>

            {/* Side / Bottom Thumbnails Strip */}
            <div className="w-full md:w-56 h-36 md:h-full flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto shrink-0 py-1">
              <div className="w-48 md:w-full h-full md:h-36 shrink-0">
                <LocalVideoTile
                  stream={localStream}
                  userName={user?.firstName || 'You'}
                  isVideoDisabled={isVideoDisabled}
                  isAudioMuted={isAudioMuted}
                />
              </div>

              {Array.from(remotePeers.values())
                .filter((p) => p.userId !== presenter.userId)
                .map((peer) => (
                  <div key={peer.userId} className="w-48 md:w-full h-full md:h-36 shrink-0">
                    <RemoteVideoTile peer={peer} />
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* ── Minimalist Adaptive Video Grid ── */
          <div className="flex-1 p-3 sm:p-4 flex items-center justify-center overflow-hidden">
            <div
              className={`w-full h-full flex flex-col md:grid gap-3 sm:gap-4 items-center justify-center max-w-6xl ${
                remotePeers.size === 0
                  ? 'max-w-2xl md:grid-cols-1'
                  : 'md:grid-cols-2'
              }`}
            >
              {/* Local Video Tile */}
              <LocalVideoTile
                stream={localStream}
                userName={user?.firstName || 'You'}
                isVideoDisabled={isVideoDisabled}
                isAudioMuted={isAudioMuted}
              />

              {/* Remote Peer Video Tiles */}
              {Array.from(remotePeers.values()).map((peer) => (
                <RemoteVideoTile key={peer.userId} peer={peer} />
              ))}
            </div>
          </div>
        )}

        {/* ── Slide-Over Participants Drawer ── */}
        {isParticipantsOpen && (
          <div className="w-80 h-full bg-[#14161d]/98 backdrop-blur-xl border-l border-white/[0.08] flex flex-col z-30 animate-in slide-in-from-right duration-200 shrink-0 shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm text-white">Participants ({remotePeers.size + 1})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsParticipantsOpen(false)}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-white/[0.08] space-y-2">
              <button
                type="button"
                onClick={handleOpenAddMember}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Ring & Add Member</span>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Host */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {user?.firstName?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.firstName || 'You'} {user?.lastName || ''} (Host)
                    </p>
                    <p className="text-[10px] text-emerald-400">Connected</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  {isAudioMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  {isVideoDisabled ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              </div>

              {/* Remotes */}
              {Array.from(remotePeers.values()).map((peer) => (
                <div
                  key={peer.userId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {peer.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{peer.userName}</p>
                      <p className="text-[10px] text-emerald-400">Connected</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <Video className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Ring & Add Member Modal ── */}
        {isAddMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-sm bg-[#161820] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-semibold text-white">Ring & Add Team Member</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative my-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Search member..."
                  className="w-full text-xs pl-8 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {teamUsers
                  .filter((u) => {
                    const q = searchUserQuery.toLowerCase().trim();
                    if (!q) return true;
                    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
                    const email = (u.email || '').toLowerCase();
                    return name.includes(q) || email.includes(q);
                  })
                  .map((u) => {
                    const isInvited = invitedUserIds.has(u.id);
                    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{fullName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{u.role || u.email}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRingMember(u)}
                          disabled={isInvited}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                            isInvited
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
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
              </div>

              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white transition-colors mt-3"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Capsule Control Bar (Google Meet Style) ── */}
      <div className="pb-6 pt-3 px-4 flex items-center justify-center bg-gradient-to-t from-[#0e1015] to-transparent z-20 shrink-0">
        <div className="bg-[#1b1d24]/95 backdrop-blur-xl border border-white/[0.1] px-4 py-2 rounded-full shadow-2xl flex items-center gap-3">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isAudioMuted
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isVideoDisabled
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Audio Output Route Toggle (WhatsApp-Style Picker) */}
          <button
            type="button"
            onClick={() => setIsAudioPickerOpen(true)}
            className={`px-3.5 h-11 rounded-2xl flex items-center gap-1.5 transition-all ${
              activeAudioType === 'bluetooth'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Audio Output (Tap to select Buds, Speaker, or Phone)"
          >
            {activeAudioType === 'bluetooth' ? (
              <Headphones className="w-5 h-5 text-white" />
            ) : activeAudioType === 'speaker' ? (
              <Volume2 className="w-5 h-5 text-slate-200" />
            ) : (
              <Smartphone className="w-5 h-5 text-slate-200" />
            )}
            <span className="text-xs font-semibold">
              {activeAudioType === 'bluetooth' ? 'Buds' : activeAudioType === 'speaker' ? 'Speaker' : 'Earpiece'}
            </span>
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              presenter?.isLocal
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={presenter?.isLocal ? 'Stop Presenting' : 'Share Screen'}
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Participants Button */}
          <button
            type="button"
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all relative ${
              isParticipantsOpen
                ? 'bg-white/25 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Participants"
          >
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
              {remotePeers.size + 1}
            </span>
          </button>

          {/* Leave Call (Red Pill) */}
          <button
            type="button"
            onClick={handleLeave}
            className="w-14 h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95 ml-1"
            title="Leave Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

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
  );
}
