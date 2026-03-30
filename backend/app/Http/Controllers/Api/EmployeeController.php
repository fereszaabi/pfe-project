<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Demande;
use App\Models\User;
use Carbon\Carbon;

class EmployeeController extends Controller
{
    /**
     * Display all tickets (assigned + unassigned) with ticket details
     * All employees and admin can see all tickets
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        // Get all tickets with employee and client info
        $allDemandes = Demande::with(['client', 'employee', 'machine'])
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'created_at',
                'assigned_at',
                'completed_at',
                'resolution_hours',
                'client_rating',
                'image',
                'id_client',
                'id_employee',
                'id_machine',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        // Get employee's assigned tickets separately for quick access
        $myDemandes = Demande::where('id_employee', $userId)
            ->with(['client', 'employee', 'machine'])
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'created_at',
                'assigned_at',
                'completed_at',
                'resolution_hours',
                'client_rating',
                'image',
                'id_client',
                'id_employee',
                'id_machine',
            ])
            ->orderBy('assigned_at', 'desc')
            ->paginate(10);

        // Get unassigned tickets for quick claiming
        $unassignedDemandes = Demande::whereNull('id_employee')
            ->with(['client', 'machine'])
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'created_at',
                'image',
                'id_client',
                'id_machine',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json([
            'all_tickets' => $allDemandes,
            'my_tickets' => $myDemandes,
            'unassigned_tickets' => $unassignedDemandes,
        ]);
    }

    /**
     * Claim/Assign a ticket to self
     */
    public function claim(Request $request, Demande $demande)
    {
        // Can only claim unassigned tickets
        if ($demande->id_employee !== null) {
            return response()->json([
                'message' => 'This ticket is already assigned to ' . $demande->employee->name,
            ], 422);
        }

        $demande->update([
            'id_employee' => $request->user()->id,
            'assigned_at' => Carbon::now(),
            'status' => 'in progress', // automatically set to in progress when claimed
        ]);

        // Update employee workload
        $employee = User::find($request->user()->id);
        $employee->increment('current_workload');

        return response()->json($demande->fresh()->load(['client', 'employee', 'machine']));
    }

    /**
     * Unclaim a ticket (release it back to unassigned)
     */
    public function unclaim(Request $request, Demande $demande)
    {
        // Only the assigned employee can unclaim
        if ($demande->id_employee !== $request->user()->id) {
            return response()->json([
                'message' => 'You can only unclaim your own tickets',
            ], 403);
        }

        $demande->update([
            'id_employee' => null,
            'assigned_at' => null,
            'status' => 'submitted', // return to submitted status
        ]);

        // Update employee workload
        $employee = User::find($request->user()->id);
        $employee->decrement('current_workload');

        return response()->json($demande->fresh()->load(['client', 'machine']));
    }

    /**
     * Update ticket status
     */
    public function update(Request $request, Demande $demande)
    {
        // Only the assigned employee can update their tickets
        if ($demande->id_employee !== $request->user()->id) {
            return response()->json([
                'message' => 'You can only update tickets assigned to you',
            ], 403);
        }

        $request->validate([
            'status' => 'required|string|in:submitted,in progress,resolved,closed',
            'employee_note' => 'nullable|string',
        ]);

        $oldStatus = $demande->status;

        $demande->update([
            'status' => $request->status,
            'employee_note' => $request->employee_note ?? $demande->employee_note,
        ]);

        // Handle completion
        if (in_array($request->status, ['resolved', 'closed']) && !$demande->completed_at) {
            $demande->update([
                'completed_at' => Carbon::now(),
            ]);

            // Calculate resolution time
            if ($demande->assigned_at) {
                $hours = $demande->completed_at->diffInMinutes($demande->assigned_at) / 60;
                $demande->update(['resolution_hours' => round($hours, 2)]);
            }

            // Update employee performance
            $employee = User::find($request->user()->id);
            $employee->decrement('current_workload');
            $employee->update(['last_ticket_completed' => Carbon::now()]);
            $employee->recalculatePerformance();
        }

        return response()->json($demande->fresh()->load(['client', 'employee', 'machine']));
    }

    /**
     * Add client rating for a completed ticket
     */
    public function rate(Request $request, Demande $demande)
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
        ]);

        if (!in_array($demande->status, ['resolved', 'closed'])) {
            return response()->json([
                'message' => 'Can only rate completed tickets',
            ], 422);
        }

        $demande->update(['client_rating' => $request->rating]);

        // Recalculate employee performance
        if ($demande->id_employee) {
            User::find($demande->id_employee)->recalculatePerformance();
        }

        return response()->json($demande->fresh()->load(['client', 'employee', 'machine']));
    }

    /**
     * Show detailed view of a single ticket
     */
    public function show(Request $request, Demande $demande)
    {
        return response()->json($demande->load(['client', 'employee', 'machine']));
    }

    /**
     * Get employee performance stats
     */
    public function stats(Request $request)
    {
        $employee = User::find($request->user()->id);
        $employee->recalculatePerformance();

        return response()->json($employee->getPerformanceSummary());
    }

    /**
     * Get leaderboard of top performers
     */
    public function leaderboard(Request $request)
    {
        $limit = $request->get('limit', 10);

        $leaderboard = User::where('role', 'employee')
            ->where('performance_status', 'active')
            ->select([
                'id',
                'name',
                'email',
                'tickets_completed',
                'avg_rating',
                'avg_resolution_hours',
                'current_workload',
                'total_earnings',
            ])
            ->orderByDesc('avg_rating')
            ->orderByDesc('tickets_completed')
            ->limit($limit)
            ->get()
            ->map(function ($emp) {
                return [
                    'id' => $emp->id,
                    'name' => $emp->name,
                    'email' => $emp->email,
                    'tickets_completed' => (int) $emp->tickets_completed,
                    'avg_rating' => (float) $emp->avg_rating,
                    'avg_resolution_hours' => (float) $emp->avg_resolution_hours,
                    'current_workload' => (int) $emp->current_workload,
                    'total_earnings' => (float) $emp->total_earnings,
                ];
            });

        return response()->json(['leaderboard' => $leaderboard]);
    }

    /**
     * Store is not used
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Destroy is not used
     */
    public function destroy(string $id)
    {
        //
    }
}
