<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\Client;
use App\Models\ClientPhoneNumber;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

class ClientProfileController extends Controller
{
    /**
     * Get current client's full profile
     */
    public function getProfile(Request $request)
    {
        $user = $request->user();
        
        // Prefer the email-linked Client record, then fall back to CIN/code fiscal.
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        return response()->json(['profile' => $clientRecord->getProfileData()]);
    }

    /**
     * Update client profile information
     */
    public function updateProfile(Request $request)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'nom' => 'sometimes|string|max:255',
            'prenom' => 'sometimes|string|max:255',
            'business_type' => 'sometimes|string|max:255',
            'description' => 'sometimes|string|max:1000',
            'mail' => 'sometimes|email',
            'current_password' => 'sometimes|string',
            'new_password' => 'sometimes|string|min:8|same:confirm_password',
            'confirm_password' => 'sometimes|string',
        ]);

        $user = $request->user();
        
        // Prefer the email-linked Client record, then fall back to CIN/code fiscal.
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        $profileUpdates = array_filter([
            'nom' => $request->input('nom'),
            'prenom' => $request->input('prenom'),
            'business_type' => $request->input('business_type'),
            'description' => $request->input('description'),
            'mail' => $request->input('mail', $request->input('email')),
        ], static fn ($value) => $value !== null);

        if (!empty($profileUpdates)) {
            $clientRecord->update($profileUpdates);
        }

        $userUpdates = array_filter([
            'name' => $request->input('name', $request->input('nom')),
            'email' => $request->input('mail', $request->input('email')),
        ], static fn ($value) => $value !== null);

        if (!empty($userUpdates)) {
            $user->update($userUpdates);
        }

        $profileChanged = $request->filled('nom')
            || $request->filled('prenom')
            || $request->filled('business_type')
            || $request->filled('description')
            || $request->filled('mail');

        $credentialsChanged = false;
        if ($request->filled('new_password')) {
            if (!Hash::check((string) $request->input('current_password'), (string) $clientRecord->password)) {
                return response()->json(['message' => 'Current password is incorrect'], 422);
            }

            $clientRecord->update([
                'password' => $request->input('new_password'),
            ]);

            $user->update([
                'password' => $request->input('new_password'),
            ]);

            $credentialsChanged = true;
        }

        if ($profileChanged || $credentialsChanged) {
            $this->notifyAdminsOfClientChange($clientRecord, $user, $profileChanged, $credentialsChanged);
        }

        return response()->json([
            'message' => 'Profile updated successfully',
            'profile' => $clientRecord->getProfileData(),
        ]);
    }

    private function notifyAdminsOfClientChange(Client $clientRecord, $user, bool $profileChanged, bool $credentialsChanged): void
    {
        $admins = User::where('role', 'admin')->get();
        if ($admins->isEmpty()) {
            return;
        }

        $parts = [];
        if ($profileChanged) {
            $parts[] = 'profile details';
        }
        if ($credentialsChanged) {
            $parts[] = 'credentials';
        }

        $messageText = sprintf(
            'Client %s updated their %s.',
            $clientRecord->nom ?: ($user->name ?? 'account'),
            implode(' and ', $parts)
        );

        foreach ($admins as $admin) {
            try {
                $conversation = Conversation::findOrCreateBetweenWithTypes(
                    (int) $clientRecord->id,
                    'client',
                    (int) $admin->id,
                    'user'
                );

                Message::create([
                    'conversation_id' => $conversation->id,
                    'sender_id' => $clientRecord->id,
                    'sender_type' => 'client',
                    'recipient_id' => $admin->id,
                    'recipient_type' => 'user',
                    'message' => $messageText,
                    'message_type' => 'notification',
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {
                // Do not block the profile update if admin notification fails.
            }
        }
    }

    /**
     * Add a new phone number
     */
    public function addPhoneNumber(Request $request)
    {
        $request->validate([
            'phone_number' => 'required|string|unique:client_phone_numbers',
            'contact_person' => 'nullable|string|max:255',
            'type' => 'sometimes|in:main,secondary,emergency,support',
        ]);

        $user = $request->user();
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        $phoneNumber = $clientRecord->addPhoneNumber(
            $request->phone_number,
            $request->type ?? 'secondary',
            $request->contact_person
        );

        return response()->json([
            'message' => 'Phone number added successfully',
            'phone' => $phoneNumber->formatForResponse(),
        ], 201);
    }

    /**
     * Update a phone number
     */
    public function updatePhoneNumber(Request $request, $phoneNumberId)
    {
        $request->validate([
            'phone_number' => 'sometimes|string|unique:client_phone_numbers,phone_number,' . $phoneNumberId,
            'contact_person' => 'nullable|string|max:255',
            'type' => 'sometimes|in:main,secondary,emergency,support',
        ]);

        $phoneNumber = ClientPhoneNumber::find($phoneNumberId);

        if (!$phoneNumber) {
            return response()->json(['message' => 'Phone number not found'], 404);
        }

        // Verify user owns this phone number
        $user = $request->user();
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if ($phoneNumber->client_id !== $clientRecord->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $phoneNumber->update($request->only(['phone_number', 'contact_person', 'type']));

        return response()->json([
            'message' => 'Phone number updated successfully',
            'phone' => $phoneNumber->formatForResponse(),
        ]);
    }

    /**
     * Delete a phone number
     */
    public function deletePhoneNumber(Request $request, $phoneNumberId)
    {
        $phoneNumber = ClientPhoneNumber::find($phoneNumberId);

        if (!$phoneNumber) {
            return response()->json(['message' => 'Phone number not found'], 404);
        }

        // Verify user owns this phone number
        $user = $request->user();
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if ($phoneNumber->client_id !== $clientRecord->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Don't allow deleting if it's the last phone number
        if ($clientRecord->phoneNumbers()->count() <= 1) {
            return response()->json([
                'message' => 'Cannot delete the only phone number',
            ], 422);
        }

        $phoneNumber->delete();

        return response()->json(['message' => 'Phone number deleted successfully']);
    }

    /**
     * Set a phone number as primary
     */
    public function setPrimaryPhone(Request $request, $phoneNumberId)
    {
        $phoneNumber = ClientPhoneNumber::find($phoneNumberId);

        if (!$phoneNumber) {
            return response()->json(['message' => 'Phone number not found'], 404);
        }

        // Verify user owns this phone number
        $user = $request->user();
        $clientRecord = Client::where('mail', $user->email)->first()
            ?? Client::where('cin', $user->cin)->first()
            ?? Client::where('code_fiscal', $user->code_fiscal)->first();

        if ($phoneNumber->client_id !== $clientRecord->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $clientRecord->setPrimaryPhoneNumber($phoneNumberId);

        return response()->json([
            'message' => 'Primary phone number updated',
            'phone_numbers' => $clientRecord->getAllPhoneNumbers()->map(function ($p) {
                return $p->formatForResponse();
            }),
        ]);
    }

    /**
     * List all phone numbers for client
     */
    public function listPhoneNumbers(Request $request)
    {
        $user = $request->user();
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        $phoneNumbers = $clientRecord->getAllPhoneNumbers()->map(function ($p) {
            return $p->formatForResponse();
        });

        return response()->json(['phone_numbers' => $phoneNumbers]);
    }

    /**
     * Get all machines for ticket creation form
     */
    public function getMachinesForTicket(Request $request)
    {
        $user = $request->user();
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        $machines = $clientRecord->machines()
            ->select('id', 'nom_poste', 'code_anydesk')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($machine) {
                return [
                    'id' => $machine->id,
                    'nom_poste' => $machine->nom_poste,
                    'code_anydesk' => $machine->code_anydesk,
                ];
            });

        return response()->json([
            'machines' => $machines,
            'count' => $machines->count(),
        ]);
    }
}
