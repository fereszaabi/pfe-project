<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommunicationChannel;
use App\Models\ChannelAddress;
use App\Models\ChannelWebhook;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    /**
     * Get all available communication channels
     */
    public function index()
    {
        $channels = CommunicationChannel::all();
        
        return response()->json([
            'channels' => $channels->map(fn($ch) => [
                'id' => $ch->id,
                'name' => $ch->name,
                'display_name' => $ch->display_name,
                'enabled' => $ch->enabled,
                'configured' => $ch->isConfigured(),
                'description' => $ch->description,
            ]),
        ]);
    }

    /**
     * Get available channels for client signup
     */
    public function availableForClient()
    {
        $channels = CommunicationChannel::where('enabled', true)->get();
        
        return response()->json([
            'channels' => $channels->map(fn($ch) => [
                'name' => $ch->name,
                'display_name' => $ch->display_name,
                'description' => $ch->description,
            ]),
        ]);
    }

    /**
     * Get client's linked channel addresses
     */
    public function getClientChannels(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'client') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $clientId = $this->resolveClientId($user);
        if (!$clientId) {
            return response()->json(['message' => 'Client not found'], 404);
        }

        $addresses = ChannelAddress::where('client_id', $clientId)
            ->with('client')
            ->get()
            ->map(fn($addr) => [
                'id' => $addr->id,
                'channel' => $addr->channel,
                'address' => $this->maskAddress($addr),
                'verified' => $addr->verified,
                'verified_at' => $addr->verified_at,
                'created_at' => $addr->created_at,
            ]);

        return response()->json([
            'channels' => $addresses,
        ]);
    }

    /**
     * Add a new channel address for client
     */
    public function addChannelAddress(Request $request)
    {
        $request->validate([
            'channel' => 'required|string|exists:communication_channels,name',
            'address' => 'required|string|min:3|max:255',
        ]);

        $user = $request->user();
        if (!$user || $user->role !== 'client') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $clientId = $this->resolveClientId($user);
        if (!$clientId) {
            return response()->json(['message' => 'Client not found'], 404);
        }

        // Validate address format based on channel
        $this->validateAddressForChannel($request->channel, $request->address);

        // Check if already exists
        $existing = ChannelAddress::where('client_id', $clientId)
            ->where('channel', $request->channel)
            ->where('address', $request->address)
            ->first();

        if ($existing && $existing->verified) {
            return response()->json([
                'message' => 'This address is already linked',
                'address' => $this->maskAddress($existing),
            ], 422);
        }

        // Create or update address
        $address = ChannelAddress::findOrCreateForClient(
            $clientId,
            $request->channel,
            $request->address
        );

        // Send verification code if not already verified
        if (!$address->verified) {
            $this->sendVerificationCode($address);
        }

        return response()->json([
            'message' => 'Channel address added. A verification code has been sent.',
            'address' => [
                'id' => $address->id,
                'channel' => $address->channel,
                'address' => $this->maskAddress($address),
                'verified' => $address->verified,
            ],
        ], 201);
    }

    /**
     * Verify channel address with verification code
     */
    public function verifyChannelAddress(Request $request, $addressId)
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $address = ChannelAddress::find($addressId);
        if (!$address) {
            return response()->json(['message' => 'Address not found'], 404);
        }

        $user = $request->user();
        if (!$user || $user->role !== 'client' || $address->client_id !== $this->resolveClientId($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // TODO: Implement verification code checking (store in cache)
        // For now, always mark as verified if code matches pattern
        if (preg_match('/^[0-9A-F]{6}$/', $request->code)) {
            $address->markAsVerified();

            return response()->json([
                'message' => 'Channel address verified successfully!',
                'address' => [
                    'id' => $address->id,
                    'channel' => $address->channel,
                    'address' => $this->maskAddress($address),
                    'verified' => $address->verified,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Invalid verification code',
        ], 422);
    }

    /**
     * Remove a channel address
     */
    public function removeChannelAddress(Request $request, $addressId)
    {
        $address = ChannelAddress::find($addressId);
        if (!$address) {
            return response()->json(['message' => 'Address not found'], 404);
        }

        $user = $request->user();
        if (!$user || $user->role !== 'client' || $address->client_id !== $this->resolveClientId($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $channel = $address->channel;
        $address->delete();

        return response()->json([
            'message' => "Channel address removed successfully",
        ]);
    }

    /**
     * Resolve client ID from authenticated user
     */
    private function resolveClientId($user): ?int
    {
        $client = \App\Models\Client::where('mail', $user->email)
            ->orWhere('cin', $user->cin ?? '')
            ->first();

        return $client?->id;
    }

    /**
     * Mask address for display (keep sensitive info private)
     */
    private function maskAddress(ChannelAddress $address): string
    {
        return match ($address->channel) {
            'email' => preg_replace('/(.{2})(.*)(.{2})@/', '$1***$3@', $address->address),
            'whatsapp', 'sms' => substr($address->address, 0, 2) . '***' . substr($address->address, -2),
            default => '***' . substr($address->address, -4),
        };
    }

    /**
     * Validate address format for specific channel
     */
    private function validateAddressForChannel(string $channel, string $address): void
    {
        match ($channel) {
            'email' => $this->validateEmail($address),
            'whatsapp' => $this->validatePhone($address),
            'sms' => $this->validatePhone($address),
            default => null,
        };
    }

    /**
     * Validate email address
     */
    private function validateEmail(string $email): void
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Invalid email address');
        }
    }

    /**
     * Validate phone number
     */
    private function validatePhone(string $phone): void
    {
        // Remove non-digits
        $clean = preg_replace('/\D/', '', $phone);
        if (strlen($clean) < 7 || strlen($clean) > 15) {
            throw new \InvalidArgumentException('Invalid phone number');
        }
    }

    /**
     * Send verification code to address
     */
    private function sendVerificationCode(ChannelAddress $address): void
    {
        $code = ChannelAddress::generateVerificationCode();
        
        // Store code in cache (expires in 24 hours)
        cache()->put("channel_verify_{$address->id}", $code, now()->addHours(24));

        // Send via appropriate channel
        match ($address->channel) {
            'email' => $this->sendEmailVerification($address, $code),
            'whatsapp' => $this->sendWhatsAppVerification($address, $code),
            'sms' => $this->sendSmsVerification($address, $code),
            default => null,
        };
    }

    /**
     * Send email verification
     */
    private function sendEmailVerification(ChannelAddress $address, string $code): void
    {
        // TODO: Send email with verification code
        cache()->put("channel_verify_{$address->id}", $code, now()->addHours(24));
    }

    /**
     * Send WhatsApp verification
     */
    private function sendWhatsAppVerification(ChannelAddress $address, string $code): void
    {
        // TODO: Send WhatsApp message with verification code
        cache()->put("channel_verify_{$address->id}", $code, now()->addHours(24));
    }

    /**
     * Send SMS verification
     */
    private function sendSmsVerification(ChannelAddress $address, string $code): void
    {
        // TODO: Send SMS with verification code
        cache()->put("channel_verify_{$address->id}", $code, now()->addHours(24));
    }

    /**
     * Get webhook event summary (admin only)
     */
    public function getWebhookSummary(Request $request)
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $webhooks = ChannelWebhook::selectRaw('channel, processing_status, COUNT(*) as count')
            ->groupBy('channel', 'processing_status')
            ->get();

        $pending = ChannelWebhook::where('processed', false)->count();
        $failed = ChannelWebhook::where('processing_status', 'failed')->count();

        return response()->json([
            'summary' => [
                'pending' => $pending,
                'failed' => $failed,
                'by_channel' => $webhooks,
            ],
        ]);
    }
}
