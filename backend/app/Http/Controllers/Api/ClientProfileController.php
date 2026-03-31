<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Client;
use App\Models\ClientPhoneNumber;

class ClientProfileController extends Controller
{
    /**
     * Get current client's full profile
     */
    public function getProfile(Request $request)
    {
        $user = $request->user();
        
        // Find the actual Client record by CIN
        $clientRecord = Client::where('cin', $user->cin)->first();

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
            'nom' => 'sometimes|string|max:255',
            'prenom' => 'sometimes|string|max:255',
            'business_type' => 'sometimes|string|max:255',
            'description' => 'sometimes|string|max:1000',
            'mail' => 'sometimes|email',
        ]);

        $user = $request->user();
        
        // Find the actual Client record
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

        if (!$clientRecord) {
            return response()->json(['message' => 'Client record not found'], 404);
        }

        $clientRecord->update($request->only(['nom', 'prenom', 'business_type', 'description', 'mail']));
        $user->update($request->only(['name'])); // Update User record name if provided

        return response()->json([
            'message' => 'Profile updated successfully',
            'profile' => $clientRecord->getProfileData(),
        ]);
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
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

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
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

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
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

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
        $clientRecord = Client::where('id', $user->client_id ?? $user->id)->first() ??
                        Client::where('cin', $user->cin)->first();

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
