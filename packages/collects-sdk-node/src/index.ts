import {
  CollectsClientOptions,
  CreateCheckoutSessionParams,
  CheckoutSessionResponse,
} from './types';
import {
  CollectsAuthenticationError,
  CollectsValidationError,
  CollectsConflictError,
  CollectsApiError,
} from './errors';

// ── BROWSER GUARD ───────────────────────────────────────────────────────────
// Prevent accidental client-side bundling that would expose secret API keys
if (typeof window !== 'undefined') {
  throw new Error(
    'FATAL SECURITY VIOLATION: @neuravolt/collects-sdk must ONLY be used in server-side runtimes. ' +
      'Do NOT bundle or import this SDK into browser, React, Vue, or client-side Next.js code.',
  );
}

import * as crypto from 'crypto';

export class NeuraVoltCollectsClient {
  private readonly appId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly environment: 'TEST' | 'LIVE';
  private readonly timeoutMs: number;

  constructor(options: CollectsClientOptions) {
    if (!options.appId || !options.appId.trim()) {
      throw new CollectsValidationError('appId is required');
    }
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new CollectsValidationError('apiKey is required');
    }

    const key = options.apiKey.trim();
    if (!key.startsWith('nv_test_') && !key.startsWith('nv_live_')) {
      throw new CollectsValidationError(
        'Invalid API key format. Key must start with nv_test_ or nv_live_',
      );
    }

    this.appId = options.appId.trim();
    this.apiKey = key;
    this.baseUrl = (options.baseUrl || 'http://localhost:3001').replace(/\/+$/, '');
    this.environment = options.environment || (key.startsWith('nv_test_') ? 'TEST' : 'LIVE');
    this.timeoutMs = options.timeoutMs || 15000;
  }

  public readonly checkout = {
    createSession: async (
      params: CreateCheckoutSessionParams,
    ): Promise<CheckoutSessionResponse> => {
      this.validateCheckoutParams(params);

      const url = `${this.baseUrl}/v1/collects/checkout/sessions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NeuraVolt-App-Id': this.appId,
            'X-NeuraVolt-Api-Key': this.apiKey,
            'X-NeuraVolt-Environment': this.environment,
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data: any;
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (response.ok) {
          return data as CheckoutSessionResponse;
        }

        if (response.status === 401) {
          throw new CollectsAuthenticationError(data.message || 'Unauthorized API key');
        }

        if (response.status === 409) {
          throw new CollectsConflictError(data.message || 'Order conflict');
        }

        if (response.status === 400) {
          throw new CollectsValidationError(
            Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Bad Request',
          );
        }

        throw new CollectsApiError(
          data.message || `Request failed with status ${response.status}`,
          response.status,
          data,
        );
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new CollectsApiError(`Request timed out after ${this.timeoutMs}ms`, 408);
        }
        if (err instanceof CollectsAuthenticationError ||
            err instanceof CollectsValidationError ||
            err instanceof CollectsConflictError ||
            err instanceof CollectsApiError) {
          throw err;
        }
        throw new CollectsApiError(err.message || 'Network error communicating with NeuraVolt Collects', 500);
      }
    },
  };

  /**
   * Verifies an inbound NeuraVolt merchant webhook signature.
   *
   * @param params.payload - Raw HTTP request body string or Buffer.
   * @param params.signatureHeader - Value of the `X-NeuraVolt-Signature` header (e.g. `t=1697720000,v1=...`).
   * @param params.secret - Merchant webhook secret configured for the CollectApp.
   * @param params.toleranceSeconds - Maximum age of the webhook event in seconds (default: 300 / 5 min).
   * @returns boolean true if signature is valid and within tolerance window, false otherwise.
   */
  public static verifyWebhookSignature(params: {
    payload: string | Buffer;
    signatureHeader: string;
    secret: string;
    toleranceSeconds?: number;
  }): boolean {
    const { payload, signatureHeader, secret, toleranceSeconds = 300 } = params;
    if (!payload || !signatureHeader || !secret) {
      return false;
    }

    const rawPayload = typeof payload === 'string' ? payload : payload.toString('utf8');

    const parts = signatureHeader.split(',');
    let timestampStr: string | null = null;
    let signatureHex: string | null = null;

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key?.trim() === 't') timestampStr = val?.trim();
      if (key?.trim() === 'v1') signatureHex = val?.trim();
    }

    if (!timestampStr || !signatureHex) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    const signedPayload = `${timestamp}.${rawPayload}`;
    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    try {
      const bufExpected = Buffer.from(expectedHex, 'hex');
      const bufReceived = Buffer.from(signatureHex, 'hex');
      if (bufExpected.length !== bufReceived.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufExpected, bufReceived);
    } catch {
      return false;
    }
  }

  private validateCheckoutParams(params: CreateCheckoutSessionParams): void {
    if (!params.orderId || !params.orderId.trim()) {
      throw new CollectsValidationError('orderId is required');
    }
    if (!params.amount || !/^\d+(\.\d{1,2})?$/.test(params.amount)) {
      throw new CollectsValidationError(
        'amount must be a decimal string in INR with at most 2 decimal places (e.g. "999.00")',
      );
    }
    if (params.currency !== 'INR') {
      throw new CollectsValidationError('currency must be "INR"');
    }
    if (!params.customer || !params.customer.phone) {
      throw new CollectsValidationError('customer.phone is required');
    }
    if (params.metadata) {
      const keys = Object.keys(params.metadata);
      if (keys.length > 20) {
        throw new CollectsValidationError('metadata cannot exceed 20 keys');
      }
    }
  }
}

export * from './types';
export * from './errors';
