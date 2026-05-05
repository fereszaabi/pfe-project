<?php

namespace App\Console\Commands;

use App\Events\TicketUpdated;
use App\Models\Demande;
use Carbon\Carbon;
use Illuminate\Console\Command;

class EnforceTicketSla extends Command
{
    protected $signature = 'tickets:enforce-sla {--dry-run : Report breached tickets without updating them}';

    protected $description = 'Escalate overdue tickets based on their SLA target.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $tickets = Demande::with(['client', 'employee', 'machine'])
            ->whereNotIn('status', ['resolved', 'closed'])
            ->orderBy('created_at', 'asc')
            ->get();

        $breached = $tickets->filter(fn (Demande $ticket) => $ticket->sla_breached);

        if ($breached->isEmpty()) {
            $this->info('No SLA breaches detected.');
            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->line('Breached tickets: ' . $breached->count());
            $breached->each(function (Demande $ticket) {
                $this->line(sprintf(
                    '#%d | %s | %s | due %s',
                    $ticket->id,
                    $ticket->titre,
                    $ticket->priority,
                    optional($ticket->sla_due_at)->toDateTimeString() ?? 'n/a'
                ));
            });

            return self::SUCCESS;
        }

        $updatedCount = 0;

        foreach ($breached as $ticket) {
            if (in_array($ticket->status, ['escalated', 'tech'], true)) {
                continue;
            }

            $ticket->update([
                'status' => 'escalated',
                'escalated_to' => 'SLA Automation',
                'escalated_at' => Carbon::now(),
            ]);

            $updatedTicket = $ticket->fresh()->load(['client', 'employee', 'machine']);
            broadcast(new TicketUpdated($updatedTicket))->toOthers();
            $updatedCount++;
        }

        $this->info(sprintf('Escalated %d overdue ticket(s).', $updatedCount));

        return self::SUCCESS;
    }
}
