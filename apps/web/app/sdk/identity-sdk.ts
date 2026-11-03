import { api } from "@/src/lib/api";
import type { LiveCapture, Turn } from "@/src/lib/face-recognition";

export interface IdentityVerifyOptions {
  purpose: "ATTENDANCE" | "LEAVE_APPROVAL" | "PAYROLL_ACCESS" | "PROFILE_CHANGE";
  employeeId: string;
  descriptor: number[];
  capturedPhotoUrl?: string;
  deviceFingerprint?: string;
  liveness?: LiveCapture["liveness"];
}

export interface IdentityVerifyResult {
  verified: boolean;
  identityToken?: string | null;
  matchScore?: number;
  distance?: number;
  reason?: string;
  reEnrollmentRequired?: boolean;
}

export class IdentitySDK {
  private static instance: IdentitySDK;

  private constructor() {}

  public static getInstance(): IdentitySDK {
    if (!IdentitySDK.instance) {
      IdentitySDK.instance = new IdentitySDK();
    }
    return IdentitySDK.instance;
  }

  /**
   * Main Standalone Consumer Method
   * Attendance, Leave, Payroll call this zero-coupling SDK method.
   */
  public async verify(opts: IdentityVerifyOptions): Promise<IdentityVerifyResult> {
    try {
      const res = await api.post("/biometric/face/verify", {
        purpose: opts.purpose,
        descriptor: opts.descriptor,
        capturedPhotoUrl: opts.capturedPhotoUrl,
        deviceFingerprint: opts.deviceFingerprint || "browser-client-v1",
        liveness: opts.liveness,
      });

      return {
        verified: res.data.verified,
        identityToken: res.data.identityToken,
        matchScore: res.data.matchScore,
        distance: res.data.distance,
        reason: res.data.reason,
      };
    } catch (err: any) {
      if (err.response?.data?.code === "BIOMETRIC_RE_ENROLLMENT_REQUIRED" || err.response?.data?.message?.code === "BIOMETRIC_RE_ENROLLMENT_REQUIRED") {
        return {
          verified: false,
          reEnrollmentRequired: true,
          reason: "Biometric Re-Enrollment Required",
        };
      }
      throw err;
    }
  }

  public async getStatus(employeeId: string) {
    const res = await api.get(`/biometric/face/status/${employeeId}`);
    return res.data;
  }

  public async enroll(descriptor: number[], capturedPhotoUrl?: string, purposeConsent: boolean = true, liveness?: LiveCapture["liveness"]) {
    const res = await api.post("/biometric/face/enroll", {
      descriptor,
      capturedPhotoUrl,
      purposeConsent,
      liveness,
    });
    return res.data;
  }

  /** A one-time head-turn challenge from the server (valid about a minute). */
  public async challenge(): Promise<{ challengeId: string; turn: Turn }> {
    const res = await api.post("/biometric/face/challenge");
    return res.data;
  }
}

export const identitySDK = IdentitySDK.getInstance();
