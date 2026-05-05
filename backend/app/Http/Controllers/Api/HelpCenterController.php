<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HelpArticle;
use Illuminate\Http\Request;

class HelpCenterController extends Controller
{
    private function fallbackArticles(): array
    {
        return [
            [
                'id' => 'faq-1',
                'title' => 'How do I create a ticket?',
                'slug' => 'how-do-i-create-a-ticket',
                'category' => 'Tickets',
                'summary' => 'Open the dashboard, choose Create Ticket, add a title, description, machine, and optional attachment.',
                'content' => 'From the client dashboard, click Create Ticket, choose the affected machine or create a new one with the AnyDesk code, select a priority, and attach a screenshot if needed.',
                'keywords' => ['ticket', 'create', 'submit', 'issue'],
                'updated_at' => now(),
            ],
            [
                'id' => 'faq-2',
                'title' => 'How can I track my ticket?',
                'slug' => 'how-can-i-track-my-ticket',
                'category' => 'Tickets',
                'summary' => 'Use My Tickets or the Ticket Tracking view to see status, technician updates, and history.',
                'content' => 'Open My Tickets to view your queue. Click the eye icon for a ticket to see its timeline, attached image, technician chat, and resolution status.',
                'keywords' => ['track', 'status', 'timeline', 'history'],
                'updated_at' => now(),
            ],
            [
                'id' => 'faq-3',
                'title' => 'What does the SLA status mean?',
                'slug' => 'what-does-the-sla-status-mean',
                'category' => 'SLA',
                'summary' => 'Urgent and high-priority tickets have shorter target windows and may auto-escalate if overdue.',
                'content' => 'Each ticket gets an SLA target based on priority. If the ticket stays open beyond the target, it becomes breached and can be escalated automatically for faster handling.',
                'keywords' => ['sla', 'escalation', 'priority', 'urgent'],
                'updated_at' => now(),
            ],
            [
                'id' => 'faq-4',
                'title' => 'Can I delete or replace an attachment?',
                'slug' => 'can-i-delete-or-replace-an-attachment',
                'category' => 'Attachments',
                'summary' => 'Yes. Open the ticket detail view to preview the image and delete it if needed.',
                'content' => 'If a screenshot or photo is no longer relevant, open the ticket detail page and use Delete Image. You can then attach a new image when creating a follow-up ticket.',
                'keywords' => ['attachment', 'image', 'screenshot', 'delete'],
                'updated_at' => now(),
            ],
            [
                'id' => 'faq-5',
                'title' => 'How do I contact support quickly?',
                'slug' => 'how-do-i-contact-support-quickly',
                'category' => 'Support',
                'summary' => 'Use the AI Quick Support chat first, then create a ticket if the issue needs a technician.',
                'content' => 'The quick-support chat can answer common questions instantly. If the issue needs hands-on work, open a ticket from the portal so the team can assign and track it.',
                'keywords' => ['support', 'chat', 'help', 'contact'],
                'updated_at' => now(),
            ],
        ];
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => 'nullable|string|max:120',
            'category' => 'nullable|string|max:80',
            'limit' => 'nullable|integer|min:1|max:20',
        ]);

        $search = trim((string) ($validated['search'] ?? ''));
        $category = trim((string) ($validated['category'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 8);

        $query = HelpArticle::where('is_published', true)
            ->orderBy('sort_order')
            ->orderBy('title');

        if ($category !== '') {
            $query->where('category', $category);
        }

        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $nested->where('title', 'like', '%' . $search . '%')
                    ->orWhere('summary', 'like', '%' . $search . '%')
                    ->orWhere('content', 'like', '%' . $search . '%')
                    ->orWhereJsonContains('keywords', $search);
            });
        }

        $articles = $query->limit($limit)->get();

        if ($articles->isEmpty()) {
            $articles = collect($this->fallbackArticles());

            if ($category !== '') {
                $articles = $articles->where('category', $category);
            }

            if ($search !== '') {
                $articles = $articles->filter(function (array $article) use ($search) {
                    $haystack = implode(' ', [
                        $article['title'] ?? '',
                        $article['summary'] ?? '',
                        $article['content'] ?? '',
                        implode(' ', $article['keywords'] ?? []),
                    ]);

                    return stripos($haystack, $search) !== false;
                });
            }

            $articles = $articles->values()->take($limit);
        }

        $categories = HelpArticle::where('is_published', true)
            ->select('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        if ($categories->isEmpty()) {
            $categories = collect($this->fallbackArticles())->pluck('category')->unique()->sort()->values();
        }

        return response()->json([
            'ok' => true,
            'articles' => $articles->map(function ($article) {
                if ($article instanceof HelpArticle) {
                    return [
                        'id' => $article->id,
                        'title' => $article->title,
                        'slug' => $article->slug,
                        'category' => $article->category,
                        'summary' => $article->summary,
                        'keywords' => $article->keywords ?? [],
                        'updated_at' => $article->updated_at,
                    ];
                }

                return [
                    'id' => $article['id'],
                    'title' => $article['title'],
                    'slug' => $article['slug'],
                    'category' => $article['category'],
                    'summary' => $article['summary'],
                    'keywords' => $article['keywords'] ?? [],
                    'updated_at' => $article['updated_at'],
                ];
            }),
            'categories' => $categories,
        ]);
    }

    public function show(HelpArticle $article)
    {
        if (!$article->is_published) {
            return response()->json(['message' => 'Article not found'], 404);
        }

        return response()->json([
            'ok' => true,
            'article' => [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'category' => $article->category,
                'summary' => $article->summary,
                'content' => $article->content,
                'keywords' => $article->keywords ?? [],
                'updated_at' => $article->updated_at,
            ],
        ]);
    }
}