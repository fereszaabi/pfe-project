<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\SupportBotSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SupportBotController extends Controller
{
    private function resolveClient(Request $request): ?Client
    {
        $user = $request->user();
        if (!$user || $user->role !== 'client') {
            return null;
        }

        return Client::where('cin', $user->cin)->first();
    }

    /**
     * List support bot history sessions for the authenticated client.
     */
    public function history(Request $request)
    {
        $client = $this->resolveClient($request);
        if (!$client) {
            return response()->json(['message' => 'Client not found'], 404);
        }

        $sessions = SupportBotSession::where('client_id', $client->id)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'sessions' => $sessions->map(function ($session) {
                return [
                    'id' => $session->id,
                    'title' => $session->title,
                    'created_at' => $session->created_at,
                    'messages' => $session->messages,
                ];
            }),
        ]);
    }

    /**
     * Get a single support bot session.
     */
    public function showHistory(Request $request, SupportBotSession $session)
    {
        $client = $this->resolveClient($request);
        if (!$client || $session->client_id !== $client->id) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        return response()->json([
            'session' => [
                'id' => $session->id,
                'title' => $session->title,
                'created_at' => $session->created_at,
                'messages' => $session->messages,
            ],
        ]);
    }

    /**
     * Store a support bot session for the authenticated client.
     */
    public function storeHistory(Request $request)
    {
        $client = $this->resolveClient($request);
        if (!$client) {
            return response()->json(['message' => 'Client not found'], 404);
        }

        $validated = $request->validate([
            'title' => 'nullable|string|max:120',
            'messages' => 'required|array|min:1|max:50',
            'messages.*.role' => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string|max:4000',
        ]);

        $session = SupportBotSession::create([
            'client_id' => $client->id,
            'title' => $validated['title'] ?? null,
            'messages' => $validated['messages'],
        ]);

        return response()->json([
            'session' => [
                'id' => $session->id,
                'title' => $session->title,
                'created_at' => $session->created_at,
                'messages' => $session->messages,
            ],
        ], 201);
    }

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
        $timeoutSeconds = (int) config('services.chatbot.timeout', 8); // Reduced from 20 to 8 seconds
        $apiKey = config('services.chatbot.api_key');

        if (!$chatbotUrl) {
            return response()->json([
                'reply' => 'Quick support assistant is not fully configured yet. Please create a support ticket and our team will help you quickly.',
                'meta' => [
                    'source' => 'fallback',
                    'timeout' => false,
                ],
            ]);
        }

        // Enforce strict timeout (minimum 5s, maximum 8s)
        $http = Http::acceptJson()
            ->timeout(max(5, min($timeoutSeconds, 8)))
            ->connectTimeout(3); // 3 second connection timeout

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
                        : 'AI assistant had trouble responding. Please create a support ticket for faster help.',
                    'meta' => [
                        'source' => 'fallback',
                        'timeout' => false,
                    ],
                ]);
            }

            $data = $response->json();
            $reply = $data['reply'] ?? $data['response'] ?? $data['message'] ?? null;

            if (!is_string($reply) || trim($reply) === '') {
                return response()->json([
                    'reply' => 'AI assistant is having difficulty. Please create a support ticket and our team will help you immediately.',
                    'meta' => [
                        'source' => 'fallback',
                        'timeout' => false,
                    ],
                ]);
            }

            return response()->json([
                'reply' => $reply,
                'meta' => [
                    'source' => 'python-chatbot',
                    'timeout' => false,
                ],
            ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Connection timeout or refused
            return response()->json([
                'reply' => 'AI assistant is temporarily unavailable. Please create a support ticket for immediate assistance.',
                'meta' => [
                    'source' => 'fallback',
                    'timeout' => true,
                    'error_type' => 'connection',
                ],
            ], 503); // Service Unavailable
        } catch (\Illuminate\Http\Client\RequestException $e) {
            // Timeout or HTTP error
            return response()->json([
                'reply' => 'AI assistant took too long to respond. Please create a support ticket for faster help.',
                'meta' => [
                    'source' => 'fallback',
                    'timeout' => true,
                    'error_type' => 'timeout',
                ],
            ], 503);
        } catch (\Throwable $e) {
            $isLocal = app()->isLocal();
            return response()->json([
                'reply' => $isLocal
                    ? 'Quick support bridge error: ' . $e->getMessage()
                    : 'AI assistant is not available right now. Please create a support ticket.',
                'meta' => [
                    'source' => 'fallback',
                    'timeout' => false,
                    'error_type' => 'unknown',
                ],
            ], 500);
        }
    }
}
