/**
 * NeuraConnect Native Ringtone & Bluetooth Audio Routing Engine
 * Provides crystal-clear procedural WAV audio and automatic Bluetooth/Speaker routing
 */

let cachedIncomingUrl: string | null = null;
let cachedOutgoingUrl: string | null = null;

/**
 * Generates a loud, melodious incoming call ringtone (Marimba/Bell Chord)
 */
export function getIncomingRingtoneUrl(): string {
  if (cachedIncomingUrl) return cachedIncomingUrl;
  if (typeof window === 'undefined') return '';

  const sampleRate = 22050;
  const totalSeconds = 2.8;
  const numSamples = Math.floor(sampleRate * totalSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // PCM Chunk size
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true);

  // Modern Melodious Chime Sequence
  const notes = [
    { freq: 587.33, start: 0.0, dur: 0.22 },  // D5
    { freq: 880.00, start: 0.18, dur: 0.25 },  // A5
    { freq: 659.25, start: 0.40, dur: 0.22 },  // E5
    { freq: 1046.50, start: 0.58, dur: 0.55 }, // C6
    { freq: 880.00, start: 1.25, dur: 0.22 },  // A5
    { freq: 1174.66, start: 1.45, dur: 0.70 }, // D6
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const n of notes) {
      if (t >= n.start && t < n.start + n.dur) {
        const localT = t - n.start;
        const env = Math.exp(-localT * 6.5);
        // Rich harmonic synthesis
        const s =
          Math.sin(2 * Math.PI * n.freq * t) +
          0.3 * Math.sin(4 * Math.PI * n.freq * t);
        sample += s * env * 0.45;
      }
    }
    const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    view.setInt16(44 + i * 2, intSample, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  cachedIncomingUrl = URL.createObjectURL(blob);
  return cachedIncomingUrl;
}

/**
 * Generates an authentic European/International outgoing ringing tone (Tring... Tring...)
 */
export function getOutgoingRingtoneUrl(): string {
  if (cachedOutgoingUrl) return cachedOutgoingUrl;
  if (typeof window === 'undefined') return '';

  const sampleRate = 22050;
  const totalSeconds = 2.6;
  const numSamples = Math.floor(sampleRate * totalSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Header
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, numSamples * 2, true);

  // Classic Dual Pulse: 440Hz + 480Hz
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    const inPulse1 = t >= 0.05 && t <= 0.45;
    const inPulse2 = t >= 0.65 && t <= 1.05;

    if (inPulse1 || inPulse2) {
      const pTime = inPulse1 ? t - 0.05 : t - 0.65;
      const env = Math.sin((pTime / 0.4) * Math.PI);
      const s1 = Math.sin(2 * Math.PI * 440 * t);
      const s2 = Math.sin(2 * Math.PI * 480 * t);
      sample = 0.42 * env * (s1 + s2);
    }

    const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    view.setInt16(44 + i * 2, intSample, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  cachedOutgoingUrl = URL.createObjectURL(blob);
  return cachedOutgoingUrl;
}

export interface AudioOutputDeviceInfo {
  deviceId: string;
  label: string;
  isBluetooth: boolean;
}

/**
 * Automatically routes an HTMLMediaElement to connected Bluetooth buds/headset or selected sink
 */
export async function routeAudioOutput(
  mediaEl: HTMLMediaElement | null,
  forceSinkId?: string
): Promise<AudioOutputDeviceInfo[]> {
  if (!mediaEl || typeof window === 'undefined') return [];

  const results: AudioOutputDeviceInfo[] = [];

  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      audioOutputs.forEach((d) => {
        const lbl = (d.label || '').toLowerCase();
        const isBt =
          lbl.includes('bluetooth') ||
          lbl.includes('buds') ||
          lbl.includes('airpods') ||
          lbl.includes('headset') ||
          lbl.includes('wireless') ||
          lbl.includes('earphone');

        results.push({
          deviceId: d.deviceId,
          label: d.label || (isBt ? 'Bluetooth Earbuds' : 'Default Speaker'),
          isBluetooth: isBt,
        });
      });

      if ('setSinkId' in HTMLMediaElement.prototype && typeof (mediaEl as any).setSinkId === 'function') {
        if (forceSinkId) {
          await (mediaEl as any).setSinkId(forceSinkId);
        } else {
          // Auto-select Bluetooth device if one is connected!
          const btDevice = results.find((r) => r.isBluetooth);
          if (btDevice && btDevice.deviceId) {
            await (mediaEl as any).setSinkId(btDevice.deviceId);
          } else if (audioOutputs.length > 0) {
            await (mediaEl as any).setSinkId('default');
          }
        }
      }
    } catch (e) {
      // Permission or setSinkId not supported on device, fallback to default routing
    }
  }

  return results;
}

/**
 * Switches audio output between Bluetooth Earbuds/Headset and Loudspeaker
 * Supports Chromium's native selectAudioOutput() picker on Android/Desktop,
 * or direct setSinkId toggle across all audio and video elements
 */
export async function switchAudioOutputDevice(
  forceBluetooth?: boolean
): Promise<{ isBluetooth: boolean; deviceLabel: string }> {
  if (typeof window === 'undefined') return { isBluetooth: false, deviceLabel: 'Speaker' };

  let chosenDeviceId: string | null = null;
  let chosenLabel = 'Phone Loudspeaker';
  let isBt = false;

  // 1. Try selectAudioOutput (official W3C standard on modern Chromium / Android Chrome)
  if (navigator.mediaDevices && typeof (navigator.mediaDevices as any).selectAudioOutput === 'function') {
    try {
      const selected = await (navigator.mediaDevices as any).selectAudioOutput();
      if (selected && selected.deviceId) {
        chosenDeviceId = selected.deviceId;
        chosenLabel = selected.label || 'Audio Device';
        const lbl = chosenLabel.toLowerCase();
        isBt =
          lbl.includes('bluetooth') ||
          lbl.includes('buds') ||
          lbl.includes('airpods') ||
          lbl.includes('headset') ||
          lbl.includes('wireless') ||
          lbl.includes('earphone');
      }
    } catch (err: any) {
      // User cancelled dialog or not supported
    }
  }

  // 2. Fallback via enumerateDevices
  if (!chosenDeviceId && navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      const bt = outputs.find((d) => {
        const lbl = (d.label || '').toLowerCase();
        return (
          lbl.includes('bluetooth') ||
          lbl.includes('buds') ||
          lbl.includes('airpods') ||
          lbl.includes('headset') ||
          lbl.includes('wireless') ||
          lbl.includes('earphone')
        );
      });

      if (forceBluetooth !== undefined) {
        if (forceBluetooth && bt) {
          chosenDeviceId = bt.deviceId;
          chosenLabel = bt.label || 'Bluetooth Earbuds';
          isBt = true;
        } else {
          chosenDeviceId = 'default';
          chosenLabel = 'Phone Loudspeaker';
          isBt = false;
        }
      } else if (bt) {
        chosenDeviceId = bt.deviceId;
        chosenLabel = bt.label || 'Bluetooth Earbuds';
        isBt = true;
      } else {
        chosenDeviceId = 'default';
        chosenLabel = 'Phone Loudspeaker';
        isBt = false;
      }
    } catch (e) {}
  }

  if (!chosenDeviceId) {
    chosenDeviceId = 'default';
  }

  // 3. Apply sinkId to all media elements (audio & video)
  const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
  mediaElements.forEach((el) => {
    if ('setSinkId' in HTMLMediaElement.prototype && typeof (el as any).setSinkId === 'function') {
      (el as any).setSinkId(chosenDeviceId).catch(() => {});
    }
  });

  return { isBluetooth: isBt, deviceLabel: chosenLabel };
}

