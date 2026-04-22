<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SupportBotController extends Controller
{
    /**
     * Forward client quick-support prompts to the Python chatbot service.
     */
    public function ask(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|min:1|max:4000',
            'history' => 'nullable|array|max:20',
            'history.*.role' => 'required_with:history|string|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:4000',
        ]);

        $chatbotUrl = config('services.chatbot.url');
        $timeoutSeconds = (int) config('services.chatbot.timeout', 20);
        $apiKey = config('services.chatbot.api_key');

        if (!$chatbotUrl) {
            return response()->json([
                'reply' => 'Quick support assistant is not fully configured yet. Please create a support ticket and our team will help you quickly.',
                'meta' => [
                    'source' => 'fallback',
                ],
            ]);
        }

        $http = Http::acceptJson()->timeout(max(5, $timeoutSeconds));

        if (!empty($apiKey)) {
            $http = $http->withToken($apiKey);
        }

        $payload = [
            'message' => $validated['message'],
            'history' => $validated['history'] ?? [],
            'user' => [
                'id' => $request->user()->id,
                'role' => $request->user()->role,
                'name' => $request->user()->name,
                'email' => $request->user()->email,
            ],
        ];

        try {
            $response = $http->post($chatbotUrl, $payload);

            if (!$response->successful()) {
                $details = $response->json('detail')
                    ?? $response->json('message')
                    ?? $response->body();

                return response()->json([
                    'reply' => is_string($details) && trim($details) !== ''
                        ? $details
                        : 'Quick support assistant is temporarily unavailable. Please create a support ticket.',
                    'meta' => [
                        'source' => 'fallback',
                    ],
                ]);
            }

            $data = $response->json();
            $reply = $data['reply'] ?? $data['response'] ?? $data['message'] ?? null;

            if (!is_string($reply) || trim($reply) === '') {
                return response()->json([
                    'reply' => 'Quick support assistant returned an empty response. Please create a support ticket.',
                    'meta' => [
                        'source' => 'fallback',
                    ],
                ]);
            }

            return response()->json([
                'reply' => $reply,
                'meta' => [
                    'source' => 'python-chatbot',
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'reply' => app()->isLocal()
                    ? 'Quick support bridge error: ' . $e->getMessage()
                    : 'Quick support assistant is unavailable. Please create a support ticket.',
                'meta' => [
                    'source' => 'fallback',
                ],
            ]);
        }
    }
}
