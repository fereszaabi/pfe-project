<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;

class AuditLogController extends Controller
{
    /**
     * List audit logs with filters
     */
    public function index(Request $request)
    {
        $query = AuditLog::query();

        // Filter by user
        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by model
        if ($request->model) {
            $query->where('model_type', $request->model);
        }

        // Filter by event
        if ($request->event) {
            $query->where('event', $request->event);
        }

        // Filter by model ID
        if ($request->model_id) {
            $query->where('model_id', $request->model_id);
        }

        // Filter by date range
        if ($request->start_date) {
            $query->where('created_at', '>=', Carbon::parse($request->start_date)->startOfDay());
        }

        if ($request->end_date) {
            $query->where('created_at', '<=', Carbon::parse($request->end_date)->endOfDay());
        }

        // Filter by status
        if ($request->status) {
            $query->where('status', $request->status);
        }

        // Search in values
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->orWhere('event', 'like', '%' . $request->search . '%')
                  ->orWhere('http_method', 'like', '%' . $request->search . '%')
                  ->orWhereHas('user', function ($q) use ($request) {
                      $q->where('name', 'like', '%' . $request->search . '%');
                  });
            });
        }

        // Pagination
        $perPage = $request->per_page ?? 50;
        $logs = $query->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($logs);
    }

    /**
     * Get a specific audit log
     */
    public function show(AuditLog $auditLog)
    {
        $auditLog->load('user');
        return response()->json($auditLog);
    }

    /**
     * Get audit log for a specific model
     */
    public function modelHistory(Request $request)
    {
        $request->validate([
            'model' => 'required|string',
            'model_id' => 'required|integer',
        ]);

        $logs = AuditLog::where('model_type', $request->model)
            ->where('model_id', $request->model_id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($logs);
    }

    /**
     * Get audit logs for a user
     */
    public function userActivity(User $user)
    {
        $logs = $user->auditLogs()
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($logs);
    }

    /**
     * Get failed operations
     */
    public function failures(Request $request)
    {
        $query = AuditLog::where('status', 'failed');

        if ($request->start_date) {
            $query->where('created_at', '>=', Carbon::parse($request->start_date)->startOfDay());
        }

        if ($request->end_date) {
            $query->where('created_at', '<=', Carbon::parse($request->end_date)->endOfDay());
        }

        if ($request->model) {
            $query->where('model_type', $request->model);
        }

        $logs = $query->with('user')
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($logs);
    }

    /**
     * Get activity summary
     */
    public function summary(Request $request)
    {
        $start = $request->start_date ? Carbon::parse($request->start_date) : Carbon::now()->subDays(30);
        $end = $request->end_date ? Carbon::parse($request->end_date) : Carbon::now();

        $logs = AuditLog::whereBetween('created_at', [$start, $end]);

        return response()->json([
            'total_events' => $logs->count(),
            'by_event' => $logs->groupBy('event')->map->count(),
            'by_model' => $logs->groupBy('model_type')->map->count(),
            'by_user' => $logs->groupBy('user_id')
                ->map(fn($group) => ['count' => $group->count(), 'user' => $group->first()->user])
                ->values(),
            'failed_count' => $logs->where('status', 'failed')->count(),
            'date_range' => [
                'start' => $start,
                'end' => $end,
            ],
        ]);
    }

    /**
     * Get recent activity
     */
    public function recent()
    {
        $logs = AuditLog::with('user')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json($logs);
    }

    /**
     * Export audit logs
     */
    public function export(Request $request)
    {
        $query = AuditLog::query();

        if ($request->start_date) {
            $query->where('created_at', '>=', Carbon::parse($request->start_date)->startOfDay());
        }

        if ($request->end_date) {
            $query->where('created_at', '<=', Carbon::parse($request->end_date)->endOfDay());
        }

        if ($request->model) {
            $query->where('model_type', $request->model);
        }

        $logs = $query->with('user')->orderBy('created_at', 'desc')->get();

        // Prepare CSV data
        $csv = "Timestamp,Event,Model,User,IP Address,HTTP Method,Status\n";
        foreach ($logs as $log) {
            $csv .= implode(',', [
                $log->created_at,
                $log->event,
                $log->model_type,
                $log->user?->name ?? 'System',
                $log->ip_address,
                $log->http_method,
                $log->status,
            ]) . "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    }

    /**
     * Get available filters
     */
    public function getFilters()
    {
        return response()->json([
            'events' => AuditLog::distinct('event')->pluck('event'),
            'models' => AuditLog::distinct('model_type')->pluck('model_type'),
            'users' => User::where('role', '!=', 'client')->pluck('name', 'id'),
        ]);
    }
}
