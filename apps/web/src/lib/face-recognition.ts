"use client";

import * as faceapi from "@vladmandic/face-api";

/**
 * Real client-side face recognition, replacing the previous raw-pixel/luminance
 * comparison. Uses face-api.js's pretrained TinyFaceDetector (face localization),
 * FaceLandmark68Net (alignment), and FaceRecognitionNet (128-d descriptor,
 * originally a dlib ResNet) — actual trained networks, not a pixel heuristic.
 *
 * The descriptor is extracted here in the browser (no server-side inference
 * infra to run), but the match/no-match DECISION is made server-side against
 * the reference descriptor stored on the employee's FaceProfile — the client
 * only ever reports raw numbers, never a boolean "verified" claim.
 */

const MODEL_URL = "/models";
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

export interface FaceExtractionResult {
  descriptor: number[];
  detectionScore: number;
  /** The 68 face landmarks [x, y] in image pixels, used for the head-turn liveness check. */
  landmarks: [number, number][];
}

/**
 * Runs detection + landmark alignment + descriptor extraction on a single frame.
 * Returns null if no face (or no confident face) was found — this is a real
 * quality gate, unlike the old code which always produced a "match score"
 * regardless of whether a face was even present.
 */
export async function extractFaceDescriptor(input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<FaceExtractionResult | null> {
  await loadFaceModels();

  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    detectionScore: detection.detection.score,
    landmarks: detection.landmarks.positions.map((p) => [p.x, p.y] as [number, number]),
  };
}

/** Where the nose sits between the outer eye corners: about 0.5 looking straight (same formula as the server). */
export function yawRatio(l: [number, number][]): number {
  const left = l[36][0];
  const right = l[45][0];
  return right > left ? (l[30][0] - left) / (right - left) : NaN;
}

export type Turn = "LEFT" | "RIGHT"; // where the nose moves in the camera image

export interface LiveCapture {
  descriptor: number[];
  liveness: { challengeId: string; straight: [number, number][]; turned: [number, number][]; turnedDescriptor: number[] };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Captures a live face for the server's head-turn challenge: first looking straight, then turned the
 * asked way. `say` shows the instruction to the person. The camera preview is mirrored, so "nose to
 * the image's LEFT" is the person turning to their RIGHT.
 */
export async function captureLiveFace(
  video: HTMLVideoElement,
  challenge: { challengeId: string; turn: Turn },
  say: (text: string) => void,
  timeoutMs = 6000,
): Promise<LiveCapture | null> {
  say("Look straight at the camera");
  let straight: FaceExtractionResult | null = null;
  for (const start = Date.now(); Date.now() - start < timeoutMs; await wait(150)) {
    const f = await extractFaceDescriptor(video);
    const r = f ? yawRatio(f.landmarks) : NaN;
    if (f && r > 0.4 && r < 0.6) { straight = f; break; }
  }
  if (!straight) return null;
  const base = yawRatio(straight.landmarks);
  say(challenge.turn === "LEFT" ? "Now slowly turn your head to your RIGHT" : "Now slowly turn your head to your LEFT");
  for (const start = Date.now(); Date.now() - start < timeoutMs; await wait(120)) {
    const f = await extractFaceDescriptor(video);
    if (!f) continue;
    const moved = challenge.turn === "LEFT" ? base - yawRatio(f.landmarks) : yawRatio(f.landmarks) - base;
    if (moved >= 0.13) {
      say("Hold still…");
      return { descriptor: straight.descriptor, liveness: { challengeId: challenge.challengeId, straight: straight.landmarks, turned: f.landmarks, turnedDescriptor: f.descriptor } };
    }
  }
  return null;
}
