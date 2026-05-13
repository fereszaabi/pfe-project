<?php

namespace App\Services;

use Illuminate\Support\Facades\File;

class LocalOtpCodeStore
{
    private string $path;

    public function __construct()
    {
        $this->path = storage_path('app/local-otp-codes.json');
    }

    public function record(string $type, string $recipient, int $code, array $context = []): void
    {
        $entries = $this->readEntries();

        $entries[] = array_merge([
            'type' => $type,
            'recipient' => $recipient,
            'code' => (string) $code,
            'created_at' => now()->toIso8601String(),
            'expires_at' => now()->addMinutes(10)->toIso8601String(),
        ], $context);

        File::ensureDirectoryExists(dirname($this->path));
        File::put($this->path, json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    public function latest(int $limit = 20): array
    {
        $entries = array_reverse($this->readEntries());

        return array_slice($entries, 0, max(1, $limit));
    }

    private function readEntries(): array
    {
        if (!File::exists($this->path)) {
            return [];
        }

        $decoded = json_decode(File::get($this->path), true);

        return is_array($decoded) ? $decoded : [];
    }
}