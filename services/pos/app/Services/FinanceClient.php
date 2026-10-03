<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * HTTP client for Finance Service /internal/* (3s timeout, never throws).
 *
 * The returned `error` is stored in transactions.finance_last_error and shown to cashiers, so it only ever
 * contains a short, user-safe description. Raw exception text (internal hostnames/URLs) and raw response
 * bodies (possible HTML error pages or stack traces) go to the log only.
 */
class FinanceClient
{
    /**
     * @return array{ok: bool, status: ?int, error: ?string, unreachable: bool}
     */
    public function post(array $payload): array
    {
        $context = ['idempotency_key' => $payload['idempotency_key'] ?? null];

        try {
            $response = Http::baseUrl(config('services.finance.url'))
                ->timeout(config('services.http_timeout'))
                ->connectTimeout(config('services.http_timeout'))
                ->acceptJson()
                ->withHeaders(['X-Service-Key' => config('services.internal_key')])
                ->post('/internal/postings', $payload);
        } catch (ConnectionException $e) {
            Log::warning('finance unreachable', [...$context, 'exception' => $e->getMessage()]);

            return $this->failure(null, true, 'Finance Service tidak dapat dihubungi (timeout atau koneksi ditolak)');
        } catch (Throwable $e) {
            Log::error('finance call failed', [...$context, 'exception' => $e::class, 'message' => $e->getMessage()]);

            return $this->failure(null, true, 'Gagal memanggil Finance Service');
        }

        try {
            if ($response->successful()) { // 201 created or 200 duplicate (idempotent)
                return ['ok' => true, 'status' => $response->status(), 'unreachable' => false, 'error' => null];
            }

            return $this->rejected($response, $context);
        } catch (Throwable $e) {
            // Defensive: a malformed response must never turn an already committed payment into a 500.
            Log::error('finance response unreadable', [...$context, 'exception' => $e::class, 'message' => $e->getMessage()]);

            return $this->failure(null, true, 'Respons Finance Service tidak dapat dibaca');
        }
    }

    private function rejected(Response $response, array $context): array
    {
        $status = $response->status();
        Log::warning('finance rejected posting', [...$context, 'status' => $status, 'body' => Str::limit($response->body(), 1000)]);

        if ($response->serverError()) {
            return $this->failure($status, true, "Finance Service sedang bermasalah (HTTP {$status})");
        }

        // 4xx business rejections (e.g. 422 SALE_NOT_FOUND) carry a meaningful, user-facing message: keep it,
        // but only when Finance sent a proper JSON error with string fields, never the raw body.
        $code = $response->json('error.code');
        $message = $response->json('error.message');
        $detail = is_string($message) && $message !== '' ? Str::limit($message, 150) : 'permintaan ditolak';
        $label = is_string($code) && preg_match('/^[A-Z_]{1,40}$/', $code) ? "{$code}: " : '';

        return $this->failure($status, false, "Finance Service menolak (HTTP {$status}): {$label}{$detail}");
    }

    private function failure(?int $status, bool $unreachable, string $error): array
    {
        return ['ok' => false, 'status' => $status, 'unreachable' => $unreachable, 'error' => $error];
    }
}
