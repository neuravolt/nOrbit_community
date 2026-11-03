<?php

namespace NeuraVolt\Collects;

require_once __DIR__ . '/CollectsException.php';

/**
 * NeuraVolt Collects PHP SDK (Server-Side Only)
 * 
 * Secure universal payment gateway client for internal NeuraVolt PHP products
 * (e.g. FoxRun Admin, Laravel APIs, Core PHP services).
 * 
 * NEVER expose API keys in client-side HTML, JavaScript, or public repositories.
 */
class NeuraVoltCollectsClient {
    private string $appId;
    private string $apiKey;
    private string $baseUrl;
    private string $environment;
    private int $timeoutSeconds;

    public function __construct(
        string $appId,
        string $apiKey,
        string $baseUrl = 'http://localhost:3001',
        string $environment = 'LIVE',
        int $timeoutSeconds = 15
    ) {
        $trimmedAppId = trim($appId);
        $trimmedKey = trim($apiKey);

        if (empty($trimmedAppId)) {
            throw new CollectsValidationException('appId is required');
        }
        if (empty($trimmedKey)) {
            throw new CollectsValidationException('apiKey is required');
        }
        if (!str_starts_with($trimmedKey, 'nv_test_') && !str_starts_with($trimmedKey, 'nv_live_')) {
            throw new CollectsValidationException('Invalid API key format. Key must start with nv_test_ or nv_live_');
        }

        $this->appId = $trimmedAppId;
        $this->apiKey = $trimmedKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->environment = strtoupper(trim($environment)) === 'TEST' ? 'TEST' : (str_starts_with($trimmedKey, 'nv_test_') ? 'TEST' : 'LIVE');
        $this->timeoutSeconds = $timeoutSeconds;
    }

    /**
     * Creates or reuses a universal checkout session.
     *
     * @param array{
     *   orderId: string,
     *   amount: string,
     *   currency: string,
     *   customer: array{phone: string, email?: string, name?: string, id?: string},
     *   metadata?: array
     * } $params
     * @return array
     * @throws CollectsException
     */
    public function createCheckoutSession(array $params): array {
        $this->validateCheckoutParams($params);

        $url = $this->baseUrl . '/v1/collects/checkout/sessions';
        $payload = json_encode($params);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-NeuraVolt-App-Id: ' . $this->appId,
                'X-NeuraVolt-Api-Key: ' . $this->apiKey,
                'X-NeuraVolt-Environment: ' . $this->environment,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new CollectsException('cURL error communicating with NeuraVolt Collects: ' . $curlError, 500);
        }

        $data = json_decode($response, true) ?? ['message' => $response];

        if ($httpCode >= 200 && $httpCode < 300) {
            return $data;
        }

        $message = is_array($data['message'] ?? null)
            ? implode(', ', $data['message'])
            : ($data['message'] ?? 'Request failed with status ' . $httpCode);

        if ($httpCode === 401) {
            throw new CollectsAuthenticationException($message, $httpCode, $httpCode, $data);
        }
        if ($httpCode === 409) {
            throw new CollectsConflictException($message, $httpCode, $httpCode, $data);
        }
        if ($httpCode === 400) {
            throw new CollectsValidationException($message, $httpCode, $httpCode, $data);
        }

        throw new CollectsException($message, $httpCode, $httpCode, $data);
    }

    /**
     * Verifies an inbound NeuraVolt merchant webhook signature.
     *
     * @param string $payload Raw request body string.
     * @param string $signatureHeader Value of X-NeuraVolt-Signature header (t=...,v1=...).
     * @param string $secret Webhook secret configured for the CollectApp.
     * @param int $toleranceSeconds Max allowable clock drift/age in seconds (default: 300).
     * @return bool True if valid, false otherwise.
     */
     public static function verifyWebhookSignature(
        string $payload,
        string $signatureHeader,
        string $secret,
        int $toleranceSeconds = 300
    ): bool {
        if (empty($payload) || empty($signatureHeader) || empty($secret)) {
            return false;
        }

        $parts = explode(',', $signatureHeader);
        $timestampStr = null;
        $signatureHex = null;

        foreach ($parts as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) === 2) {
                if ($kv[0] === 't') $timestampStr = $kv[1];
                if ($kv[0] === 'v1') $signatureHex = $kv[1];
            }
        }

        if ($timestampStr === null || $signatureHex === null) {
            return false;
        }

        $timestamp = (int)$timestampStr;
        if ($timestamp <= 0) {
            return false;
        }

        $now = time();
        if (abs($now - $timestamp) > $toleranceSeconds) {
            return false;
        }

        $signedPayload = $timestamp . '.' . $payload;
        $expectedHex = hash_hmac('sha256', $signedPayload, $secret);

        return hash_equals($expectedHex, $signatureHex);
    }

    private function validateCheckoutParams(array $params): void {
        if (empty($params['orderId'])) {
            throw new CollectsValidationException('orderId is required');
        }
        if (empty($params['amount']) || !preg_match('/^\d+(\.\d{1,2})?$/', (string)$params['amount'])) {
            throw new CollectsValidationException('amount must be a decimal string in INR (e.g. "999.00")');
        }
        if (($params['currency'] ?? '') !== 'INR') {
            throw new CollectsValidationException('currency must be "INR"');
        }
        if (empty($params['customer']) || empty($params['customer']['phone'])) {
            throw new CollectsValidationException('customer.phone is required');
        }
        if (!empty($params['metadata']) && is_array($params['metadata']) && count($params['metadata']) > 20) {
            throw new CollectsValidationException('metadata cannot exceed 20 keys');
        }
    }
}
