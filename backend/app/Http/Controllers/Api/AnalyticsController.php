<?php

namespace App\Http\Controllers\Api;

use App\Models\Demande;
use App\Models\Employee;
use App\Models\Client;
use Carbon\Carbon;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class AnalyticsController extends Controller
{
    /**
     * Get comprehensive KPI metrics with date filtering
     */
    public function kpiMetrics(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $startDate = $validated['start_date'] ? Carbon::parse($validated['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end_date'] ? Carbon::parse($validated['end_date'])->endOfDay() : Carbon::now()->endOfDay();

        $query = Demande::whereBetween('created_at', [$startDate, $endDate]);
        $allTickets = Demande::whereBetween('created_at', [$startDate, $endDate])->get();

        // First Response Time (average hours from creation to assignment)
        $firstResponseTickets = $allTickets->filter(fn($t) => $t->assigned_at && $t->created_at);
        $avgFirstResponseTime = $firstResponseTickets->isNotEmpty()
            ? $firstResponseTickets->map(fn($t) => $t->created_at->diffInMinutes($t->assigned_at) / 60)->avg()
            : 0;

        // Resolution Time (average hours from assignment to completion)
        $resolvedTickets = $allTickets->filter(fn($t) => $t->status === 'resolved' && $t->completed_at && $t->assigned_at);
        $avgResolutionTime = $resolvedTickets->isNotEmpty()
            ? $resolvedTickets->map(fn($t) => $t->assigned_at->diffInMinutes($t->completed_at) / 60)->avg()
            : 0;

        // CSAT (Customer Satisfaction - average rating)
        $ratedTickets = $allTickets->filter(fn($t) => $t->client_rating);
        $csat = $ratedTickets->isNotEmpty()
            ? $ratedTickets->avg('client_rating')
            : 0;

        // Backlog (tickets still in progress)
        $backlogTickets = $allTickets->filter(fn($t) => !in_array($t->status, ['resolved', 'closed']));
        
        // Backlog Age (average days in backlog)
        $backlogAge = $backlogTickets->isNotEmpty()
            ? $backlogTickets->map(fn($t) => $t->created_at->diffInDays(Carbon::now()))->avg()
            : 0;

        // Ticket counts by status
        $byStatus = $allTickets->groupBy('status')->map->count();

        // Resolution rate
        $totalTickets = $allTickets->count();
        $resolutionRate = $totalTickets > 0 ? (($byStatus['resolved'] ?? 0) / $totalTickets) * 100 : 0;

        // Average priority distribution
        $priorityDistribution = $allTickets->groupBy('priority')->map->count();

        // SLA Compliance (tickets resolved within SLA)
        $slaCompliantTickets = $allTickets->filter(fn($t) => $t->status === 'resolved' && !$t->sla_breached);
        $slaCompliance = $totalTickets > 0 ? ($slaCompliantTickets->count() / $totalTickets) * 100 : 0;

        return response()->json([
            'ok' => true,
            'period' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'kpis' => [
                'first_response_time_hours' => round($avgFirstResponseTime, 2),
                'resolution_time_hours' => round($avgResolutionTime, 2),
                'backlog_age_days' => round($backlogAge, 2),
                'csat_score' => round($csat, 2),
                'resolution_rate_percent' => round($resolutionRate, 2),
                'sla_compliance_percent' => round($slaCompliance, 2),
                'backlog_count' => $backlogTickets->count(),
                'total_tickets' => $totalTickets,
                'resolved_tickets' => $byStatus['resolved'] ?? 0,
            ],
            'status_distribution' => $byStatus->toArray(),
            'priority_distribution' => $priorityDistribution->toArray(),
        ]);
    }

    /**
     * Get trend data for charts
     */
    public function trendData(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'metric' => 'required|in:tickets,resolution_time,first_response,csat,backlog',
        ]);

        $startDate = $validated['start_date'] ? Carbon::parse($validated['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end_date'] ? Carbon::parse($validated['end_date'])->endOfDay() : Carbon::now()->endOfDay();
        $metric = $validated['metric'];

        $data = [];
        $currentDate = $startDate->clone();

        while ($currentDate <= $endDate) {
            $dayStart = $currentDate->clone()->startOfDay();
            $dayEnd = $currentDate->clone()->endOfDay();

            $dayTickets = Demande::whereBetween('created_at', [$dayStart, $dayEnd])->get();

            switch ($metric) {
                case 'tickets':
                    $created = $dayTickets->count();
                    $resolved = $dayTickets->filter(fn($t) => $t->status === 'resolved')->count();
                    $data[] = [
                        'date' => $currentDate->toDateString(),
                        'created' => $created,
                        'resolved' => $resolved,
                    ];
                    break;

                case 'resolution_time':
                    $resolved = $dayTickets->filter(fn($t) => $t->status === 'resolved' && $t->completed_at && $t->assigned_at);
                    $avgTime = $resolved->isNotEmpty()
                        ? $resolved->map(fn($t) => $t->assigned_at->diffInMinutes($t->completed_at) / 60)->avg()
                        : 0;
                    $data[] = [
                        'date' => $currentDate->toDateString(),
                        'avg_resolution_hours' => round($avgTime, 2),
                    ];
                    break;

                case 'first_response':
                    $responded = $dayTickets->filter(fn($t) => $t->assigned_at && $t->created_at);
                    $avgTime = $responded->isNotEmpty()
                        ? $responded->map(fn($t) => $t->created_at->diffInMinutes($t->assigned_at) / 60)->avg()
                        : 0;
                    $data[] = [
                        'date' => $currentDate->toDateString(),
                        'avg_first_response_hours' => round($avgTime, 2),
                    ];
                    break;

                case 'csat':
                    $rated = $dayTickets->filter(fn($t) => $t->client_rating);
                    $avgRating = $rated->isNotEmpty() ? $rated->avg('client_rating') : 0;
                    $data[] = [
                        'date' => $currentDate->toDateString(),
                        'csat_score' => round($avgRating, 2),
                    ];
                    break;

                case 'backlog':
                    $backlog = $dayTickets->filter(fn($t) => !in_array($t->status, ['resolved', 'closed']));
                    $avgAge = $backlog->isNotEmpty()
                        ? $backlog->map(fn($t) => $t->created_at->diffInDays($dayEnd))->avg()
                        : 0;
                    $data[] = [
                        'date' => $currentDate->toDateString(),
                        'backlog_count' => $backlog->count(),
                        'avg_age_days' => round($avgAge, 2),
                    ];
                    break;
            }

            $currentDate->addDay();
        }

        return response()->json([
            'ok' => true,
            'metric' => $metric,
            'data' => $data,
        ]);
    }

    /**
     * Get agent workload and performance metrics
     */
    public function agentWorkload(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $startDate = $validated['start_date'] ? Carbon::parse($validated['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end_date'] ? Carbon::parse($validated['end_date'])->endOfDay() : Carbon::now()->endOfDay();

        $employees = Employee::all();
        $data = [];

        foreach ($employees as $employee) {
            $tickets = Demande::where('id_employee', $employee->id)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->get();

            $resolved = $tickets->filter(fn($t) => $t->status === 'resolved');
            $avgResolutionTime = $resolved->isNotEmpty()
                ? $resolved->map(fn($t) => $t->resolution_hours ?? 0)->avg()
                : 0;

            $avgRating = $resolved->isNotEmpty()
                ? $resolved->filter(fn($t) => $t->client_rating)->avg('client_rating')
                : 0;

            $data[] = [
                'id' => $employee->id,
                'name' => $employee->nom,
                'email' => $employee->mail,
                'total_assigned' => $tickets->count(),
                'resolved' => $resolved->count(),
                'pending' => $tickets->count() - $resolved->count(),
                'avg_resolution_hours' => round($avgResolutionTime, 2),
                'avg_rating' => round($avgRating, 2),
                'current_workload' => $employee->current_workload ?? 0,
                'resolution_rate_percent' => $tickets->count() > 0 ? round(($resolved->count() / $tickets->count()) * 100, 2) : 0,
            ];
        }

        // Sort by assigned tickets (descending)
        usort($data, fn($a, $b) => $b['total_assigned'] <=> $a['total_assigned']);

        return response()->json([
            'ok' => true,
            'period' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'agents' => $data,
        ]);
    }

    /**
     * Get ticket backlog details
     */
    public function backlogDetails(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'priority' => 'nullable|in:low,medium,high,urgent',
        ]);

        $startDate = $validated['start_date'] ? Carbon::parse($validated['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end_date'] ? Carbon::parse($validated['end_date'])->endOfDay() : Carbon::now()->endOfDay();
        $priority = $validated['priority'] ?? null;

        $query = Demande::whereBetween('created_at', [$startDate, $endDate])
            ->whereNotIn('status', ['resolved', 'closed']);

        if ($priority) {
            $query->where('priority', $priority);
        }

        $backlogTickets = $query->with(['client', 'employee'])->orderBy('priority', 'desc')->orderBy('created_at', 'asc')->get();

        $byAge = [
            'under_24h' => 0,
            '1_3_days' => 0,
            '3_7_days' => 0,
            'over_7_days' => 0,
        ];

        $byPriority = [];

        foreach ($backlogTickets as $ticket) {
            $ageInDays = $ticket->created_at->diffInDays(Carbon::now());

            if ($ageInDays < 1) {
                $byAge['under_24h']++;
            } elseif ($ageInDays < 3) {
                $byAge['1_3_days']++;
            } elseif ($ageInDays < 7) {
                $byAge['3_7_days']++;
            } else {
                $byAge['over_7_days']++;
            }

            $p = $ticket->priority ?? 'low';
            $byPriority[$p] = ($byPriority[$p] ?? 0) + 1;
        }

        return response()->json([
            'ok' => true,
            'total_backlog' => $backlogTickets->count(),
            'by_age' => $byAge,
            'by_priority' => $byPriority,
            'oldest_ticket_age_days' => $backlogTickets->isNotEmpty() ? $backlogTickets->first()->created_at->diffInDays(Carbon::now()) : 0,
        ]);
    }

    /**
     * Export report to CSV or JSON
     */
    public function exportReport(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'format' => 'required|in:csv,json',
            'report_type' => 'required|in:kpis,tickets,agents',
        ]);

        $startDate = $validated['start_date'] ? Carbon::parse($validated['start_date'])->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
        $endDate = $validated['end_date'] ? Carbon::parse($validated['end_date'])->endOfDay() : Carbon::now()->endOfDay();
        $format = $validated['format'];
        $reportType = $validated['report_type'];

        $tickets = Demande::whereBetween('created_at', [$startDate, $endDate])
            ->with(['client', 'employee', 'machine'])
            ->get();

        $data = [];

        switch ($reportType) {
            case 'tickets':
                $data = $tickets->map(fn($t) => [
                    'id' => $t->id,
                    'title' => $t->titre,
                    'client' => $t->client?->nom ?? 'N/A',
                    'employee' => $t->employee?->nom ?? 'Unassigned',
                    'status' => $t->status,
                    'priority' => $t->priority,
                    'created_at' => $t->created_at->toDateTimeString(),
                    'assigned_at' => $t->assigned_at?->toDateTimeString() ?? 'N/A',
                    'completed_at' => $t->completed_at?->toDateTimeString() ?? 'N/A',
                    'resolution_hours' => $t->resolution_hours ?? 'N/A',
                    'rating' => $t->client_rating ?? 'N/A',
                ])->toArray();
                break;

            case 'agents':
                $employees = Employee::all();
                $data = $employees->map(function ($emp) use ($tickets) {
                    $empTickets = $tickets->filter(fn($t) => $t->id_employee == $emp->id);
                    $resolved = $empTickets->filter(fn($t) => $t->status === 'resolved');
                    return [
                        'name' => $emp->nom,
                        'email' => $emp->mail,
                        'total_assigned' => $empTickets->count(),
                        'resolved' => $resolved->count(),
                        'pending' => $empTickets->count() - $resolved->count(),
                        'avg_resolution_hours' => $resolved->isNotEmpty() ? round($resolved->avg('resolution_hours'), 2) : 0,
                        'avg_rating' => $resolved->isNotEmpty() ? round($resolved->filter(fn($t) => $t->client_rating)->avg('client_rating'), 2) : 0,
                    ];
                })->toArray();
                break;

            case 'kpis':
            default:
                $firstResponseTickets = $tickets->filter(fn($t) => $t->assigned_at && $t->created_at);
                $avgFirstResponse = $firstResponseTickets->isNotEmpty()
                    ? $firstResponseTickets->map(fn($t) => $t->created_at->diffInMinutes($t->assigned_at))->avg()
                    : 0;

                $resolvedTickets = $tickets->filter(fn($t) => $t->status === 'resolved' && $t->completed_at && $t->assigned_at);
                $avgResolution = $resolvedTickets->isNotEmpty()
                    ? $resolvedTickets->map(fn($t) => $t->assigned_at->diffInMinutes($t->completed_at))->avg()
                    : 0;

                $ratedTickets = $tickets->filter(fn($t) => $t->client_rating);
                $csat = $ratedTickets->isNotEmpty() ? $ratedTickets->avg('client_rating') : 0;

                $data = [[
                    'metric' => 'First Response Time',
                    'value' => round($avgFirstResponse / 60, 2),
                    'unit' => 'hours',
                ]];
                $data[] = [
                    'metric' => 'Resolution Time',
                    'value' => round($avgResolution / 60, 2),
                    'unit' => 'hours',
                ];
                $data[] = [
                    'metric' => 'CSAT Score',
                    'value' => round($csat, 2),
                    'unit' => 'out of 5',
                ];
                $data[] = [
                    'metric' => 'Total Tickets',
                    'value' => $tickets->count(),
                    'unit' => 'count',
                ];
                $data[] = [
                    'metric' => 'Resolved Tickets',
                    'value' => $resolvedTickets->count(),
                    'unit' => 'count',
                ];
                break;
        }

        if ($format === 'json') {
            return response()->json([
                'ok' => true,
                'report_type' => $reportType,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
                'data' => $data,
            ]);
        }

        // CSV Export
        $filename = "report_{$reportType}_" . now()->format('Y-m-d_H-i-s') . '.csv';
        
        $headers = array(
            "Content-type" => "text/csv; charset=UTF-8",
            "Content-Disposition" => "attachment; filename=$filename",
            "Pragma" => "no-cache",
            "Cache-Control" => "must-revalidate, post-check=0, pre-check=0",
            "Expires" => "0"
        );

        $columns = array_keys(reset($data) ?? []);

        $callback = function() use($data, $columns) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $columns);

            foreach ($data as $row) {
                fputcsv($file, $row);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
