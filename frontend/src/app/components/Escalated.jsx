import { useState } from 'react';

export function Escalated({ user, tickets, onUpdateTicket, onLogout, onNavigate, activeView }) {
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('escalated'); // 'escalated' | 'onsite'

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    // Tickets escalated to IT/Technical service
    const escalatedTickets = tickets
        .filter(t => t.status === 'escalated')
        .filter(t =>
            searchQuery === '' ||
            t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    // Tickets that require onsite intervention (category: 'technical', not yet resolved)
    const onsiteTickets = tickets
        .filter(t => t.category === 'technical' && t.status !== 'resolved')
        .filter(t =>
            searchQuery === '' ||
            t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    const displayed = activeTab === 'escalated' ? escalatedTickets : onsiteTickets;

    const handleResolve = (ticketId) => {
        onUpdateTicket(ticketId, {
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
        });
        setSelectedTicket(null);
    };

    const priorityBadge = (priority) => {
        switch (priority) {
            case 'urgent': return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
            case 'high':   return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
            case 'low':    return 'bg-green-500/10 text-green-500 border border-green-500/20';
            default:       return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        }
    };

    const priorityDot = (priority) => {
        switch (priority) {
            case 'urgent': return 'bg-rose-500';
            case 'high':   return 'bg-amber-500';
            case 'medium': return 'bg-yellow-500';
            case 'low':    return 'bg-green-500';
            default:       return 'bg-slate-500';
        }
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'escalated':   return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case 'submitted':   return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
            case 'assigned':    return 'bg-purple-500/10 text-purple-500 border border-purple-500/20';
            case 'in-progress': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            default:            return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-display">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar */}
            <aside className="w-72 bg-midnight border-r border-slate-800 flex flex-col shrink-0">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-3xl">confirmation_number</span>
                        </div>
                        <div>
                            <h1 className="text-white text-lg font-bold leading-tight">IDSoft Support</h1>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Agent Portal</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <button
                            onClick={() => onNavigate?.('dashboard')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                activeView === 'dashboard' ? 'bg-surface-dark text-white' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                            }`}
                        >
                            <span className={`material-symbols-outlined ${activeView === 'dashboard' ? 'text-primary' : ''}`}>confirmation_number</span>
                            <span className="font-medium text-sm">My Tickets</span>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                                activeView === 'dashboard' ? 'bg-primary text-white' : 'bg-surface-dark text-slate-400'
                            }`}>
                                {tickets.filter(t => t.assignedTo === user.name).length}
                            </span>
                        </button>
                        <button
                            onClick={() => onNavigate?.('escalated')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                activeView === 'escalated' ? 'bg-surface-dark text-white' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                            }`}
                        >
                            <span className={`material-symbols-outlined ${activeView === 'escalated' ? 'text-primary' : ''}`}>priority_high</span>
                            <span className="font-medium text-sm">Escalated</span>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                                activeView === 'escalated' ? 'bg-primary text-white' : 'bg-surface-dark text-slate-400'
                            }`}>
                                {tickets.filter(t => t.status === 'escalated').length}
                            </span>
                        </button>
                        <button
                            onClick={() => onNavigate?.('history')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                activeView === 'history' ? 'bg-surface-dark text-white' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                            }`}
                        >
                            <span className={`material-symbols-outlined ${activeView === 'history' ? 'text-primary' : ''}`}>history</span>
                            <span className="font-medium text-sm">History</span>
                        </button>
                    </nav>

                    <div className="mt-10 pt-6 border-t border-slate-800">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.1em] px-4 mb-4">Teams</p>
                        <div className="space-y-1">
                            <a className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm" href="#">
                                <span className="size-2 rounded-full bg-green-500"></span> ERP Solutions
                            </a>
                            <a className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm" href="#">
                                <span className="size-2 rounded-full bg-blue-500"></span> CRM Technical
                            </a>
                            <a className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm" href="#">
                                <span className="size-2 rounded-full bg-primary"></span> IT On-site
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-6">
                    <button className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        <span className="text-sm">Create Ticket</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-[#181411] border-b border-slate-200 dark:border-[#3a2f27] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-6 flex-1">
                        <div className="relative w-full max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#bba99b]">search</span>
                            <input
                                className="w-full bg-slate-100 dark:bg-[#3a2f27] border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-[#bba99b]"
                                placeholder="Search by title or client..."
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#3a2f27] text-slate-600 dark:text-[#bba99b] hover:text-primary transition-colors relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 size-2 bg-primary rounded-full border-2 border-white dark:border-[#181411]"></span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 dark:bg-[#3a2f27]"></div>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</p>
                                <p className="text-[10px] text-[#bba99b] font-medium uppercase">Senior Support Agent</p>
                            </div>
                            <div className="size-10 rounded-full bg-[#3a2f27] border border-[#55463a] flex items-center justify-center text-primary font-bold">
                                {user.name.charAt(0)}
                            </div>
                        </div>
                        <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-500 transition-colors" title="Logout">
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-8">

                        {/* Page Title */}
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Escalated &amp; Onsite</h2>
                            <p className="text-sm text-[#bba99b] mt-1">
                                Tickets forwarded to the technical service and cases requiring onsite intervention.
                            </p>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Sent to Technical Service</span>
                                    <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                        <span className="material-symbols-outlined text-lg">escalator_warning</span>
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{tickets.filter(t => t.status === 'escalated').length}</h3>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Awaiting IT resolution</p>
                            </div>

                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Onsite Intervention Required</span>
                                    <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <span className="material-symbols-outlined text-lg">location_on</span>
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {tickets.filter(t => t.category === 'technical' && t.status !== 'resolved').length}
                                </h3>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Technical category — field visit needed</p>
                            </div>

                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Urgent Among These</span>
                                    <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                                        <span className="material-symbols-outlined text-lg">emergency</span>
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {tickets.filter(t =>
                                        t.priority === 'urgent' &&
                                        (t.status === 'escalated' || (t.category === 'technical' && t.status !== 'resolved'))
                                    ).length}
                                </h3>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Requires immediate action</p>
                            </div>
                        </div>

                        {/* Tab Switch */}
                        <div className="bg-white dark:bg-[#1e1a16] rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#3a2f27] flex flex-wrap items-center justify-between gap-4">
                                <div className="flex rounded-lg border border-slate-200 dark:border-[#3a2f27] p-1 bg-slate-50 dark:bg-[#181411] gap-1">
                                    <button
                                        onClick={() => setActiveTab('escalated')}
                                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
                                            activeTab === 'escalated' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-red-500'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">escalator_warning</span>
                                        Sent to Technical Service
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'escalated' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#3a2f27] text-slate-500'}`}>
                                            {escalatedTickets.length}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('onsite')}
                                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
                                            activeTab === 'onsite' ? 'bg-amber-500 text-white shadow' : 'text-slate-500 hover:text-amber-500'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">location_on</span>
                                        Onsite Intervention
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'onsite' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-[#3a2f27] text-slate-500'}`}>
                                            {onsiteTickets.length}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-xs text-[#bba99b]">Sorted by priority — urgent first</p>
                            </div>

                            {/* Context description */}
                            <div className={`px-6 py-3 text-xs font-medium flex items-center gap-2 ${
                                activeTab === 'escalated'
                                    ? 'bg-red-500/5 text-red-500 border-b border-red-500/10'
                                    : 'bg-amber-500/5 text-amber-500 border-b border-amber-500/10'
                            }`}>
                                <span className="material-symbols-outlined text-sm">
                                    {activeTab === 'escalated' ? 'info' : 'info'}
                                </span>
                                {activeTab === 'escalated'
                                    ? 'These tickets have been forwarded to the IT / Technical Service department and are pending their resolution.'
                                    : 'These are technical-category tickets that require a physical onsite visit from a field technician.'}
                            </div>

                            {displayed.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                                    <div className="size-16 rounded-full bg-slate-100 dark:bg-[#3a2f27] flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl text-[#bba99b]">
                                            {activeTab === 'escalated' ? 'escalator_warning' : 'location_on'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-lg">No tickets found</p>
                                        <p className="text-sm text-[#bba99b] mt-1">
                                            {searchQuery ? 'Try a different search query.' : activeTab === 'escalated'
                                                ? 'No tickets have been escalated to technical service.'
                                                : 'No open tickets require onsite intervention.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 dark:bg-[#181411]/50 text-slate-500 dark:text-[#bba99b] text-[11px] font-bold uppercase tracking-wider">
                                                <th className="px-6 py-4">Priority</th>
                                                <th className="px-6 py-4">Client</th>
                                                <th className="px-6 py-4">Issue</th>
                                                <th className="px-6 py-4">Status</th>
                                                {activeTab === 'escalated' && <th className="px-6 py-4">Escalated To</th>}
                                                {activeTab === 'onsite' && <th className="px-6 py-4">Assigned To</th>}
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[#3a2f27] text-sm">
                                            {displayed.map((ticket) => (
                                                <tr
                                                    key={ticket.id}
                                                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                                                        ticket.priority === 'urgent'
                                                            ? activeTab === 'escalated' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-500'
                                                            : ''
                                                    }`}
                                                    onClick={() => setSelectedTicket(ticket)}
                                                >
                                                    <td className="px-6 py-5">
                                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-fit ${priorityBadge(ticket.priority)}`}>
                                                            <span className={`size-1.5 rounded-full ${priorityDot(ticket.priority)}`}></span>
                                                            {ticket.priority?.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-full bg-slate-200 dark:bg-[#3a2f27] flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                                {ticket.clientName?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.clientName}</p>
                                                                <span className="text-[10px] text-[#bba99b] font-bold">#{ticket.id?.slice(0, 8)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <p className="font-semibold text-slate-900 dark:text-white mb-0.5 line-clamp-1">{ticket.title}</p>
                                                        <p className="text-xs text-[#bba99b] line-clamp-1">{ticket.description}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusBadge(ticket.status)}`}>
                                                            {ticket.status}
                                                        </span>
                                                    </td>
                                                    {activeTab === 'escalated' && (
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                                                                <span className="material-symbols-outlined text-sm">business</span>
                                                                {ticket.escalatedTo || 'IT Department'}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {activeTab === 'onsite' && (
                                                        <td className="px-6 py-5">
                                                            {ticket.assignedTo ? (
                                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                                    {ticket.assignedTo}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-[#bba99b] italic">Unassigned</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-5">
                                                        <p className="text-xs text-[#bba99b] whitespace-nowrap">
                                                            {(ticket.escalatedAt || ticket.createdAt)
                                                                ? new Date(ticket.escalatedAt || ticket.createdAt).toLocaleDateString('en-GB', {
                                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                                })
                                                                : '—'}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                                                            className="text-xs font-bold text-[#bba99b] hover:text-primary transition-colors flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="h-14 bg-white dark:bg-[#181411] border-t border-slate-200 dark:border-[#3a2f27] px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Status: Optimal</span>
                        </div>
                        <div className="h-4 w-px bg-slate-200 dark:bg-[#3a2f27]"></div>
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                                <div className="size-5 rounded-full bg-slate-300 dark:bg-[#3a2f27] border border-white dark:border-[#181411] flex items-center justify-center text-[8px] font-bold">M</div>
                                <div className="size-5 rounded-full bg-primary border border-white dark:border-[#181411] flex items-center justify-center text-[8px] text-white font-bold">AM</div>
                                <div className="size-5 rounded-full bg-blue-500 border border-white dark:border-[#181411] flex items-center justify-center text-[8px] text-white font-bold">+2</div>
                            </div>
                            <span className="text-[10px] font-bold text-[#bba99b]">5 AGENTS ONLINE</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium tracking-tight">© 2026 IDSoft Infrastructure Solutions • v4.2.0-stable</p>
                </footer>
            </main>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedTicket(null)}
                >
                    <div
                        className="bg-white dark:bg-[#1e1a16] border border-slate-200 dark:border-[#3a2f27] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-[#3a2f27] flex items-start justify-between sticky top-0 bg-white dark:bg-[#1e1a16] z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                        Ticket #{selectedTicket.id?.slice(0, 8)}
                                    </h3>
                                    <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${priorityBadge(selectedTicket.priority)}`}>
                                        <span className={`size-1.5 rounded-full ${priorityDot(selectedTicket.priority)}`}></span>
                                        {selectedTicket.priority?.toUpperCase()}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge(selectedTicket.status)}`}>
                                        {selectedTicket.status}
                                    </span>
                                    {selectedTicket.category === 'technical' && (
                                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                            <span className="material-symbols-outlined text-xs">location_on</span>
                                            ONSITE
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-[#bba99b]">{selectedTicket.clientName}</p>
                            </div>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-[#3a2f27] rounded-lg transition-colors text-[#bba99b]"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Issue Title</label>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.title}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Category</label>
                                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">
                                        {selectedTicket.category}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Description</label>
                                <div className="bg-slate-50 dark:bg-[#181411] p-4 rounded-lg border border-slate-100 dark:border-[#3a2f27]">
                                    <p className="text-sm text-slate-600 dark:text-[#bba99b] leading-relaxed italic">
                                        "{selectedTicket.description}"
                                    </p>
                                </div>
                            </div>

                            {selectedTicket.status === 'escalated' && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-red-500 text-xl mt-0.5">escalator_warning</span>
                                    <div>
                                        <p className="text-sm font-bold text-red-500">Escalated to Technical Service</p>
                                        <p className="text-xs text-[#bba99b] mt-1">
                                            Forwarded to <span className="text-white font-bold">{selectedTicket.escalatedTo || 'IT Department'}</span>
                                            {selectedTicket.escalatedAt && (
                                                <> on {new Date(selectedTicket.escalatedAt).toLocaleString('en-GB', {
                                                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}</>
                                            )}.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedTicket.category === 'technical' && selectedTicket.status !== 'escalated' && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">location_on</span>
                                    <div>
                                        <p className="text-sm font-bold text-amber-500">Onsite Intervention Required</p>
                                        <p className="text-xs text-[#bba99b] mt-1">This is a technical issue that requires a field technician to visit the client's premises.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                {selectedTicket.assignedTo && (
                                    <div>
                                        <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-1">Assigned Agent</label>
                                        <p className="text-slate-700 dark:text-white font-medium">{selectedTicket.assignedTo}</p>
                                    </div>
                                )}
                                {selectedTicket.createdAt && (
                                    <div>
                                        <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-1">Submitted</label>
                                        <p className="text-slate-700 dark:text-white font-medium">
                                            {new Date(selectedTicket.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {selectedTicket.notes && (
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Agent Notes</label>
                                    <div className="bg-slate-50 dark:bg-[#181411] p-4 rounded-lg border border-slate-100 dark:border-[#3a2f27]">
                                        <p className="text-sm text-slate-600 dark:text-[#bba99b] leading-relaxed">{selectedTicket.notes}</p>
                                    </div>
                                </div>
                            )}

                            {selectedTicket.status !== 'resolved' && (
                                <div className="pt-4 border-t border-slate-100 dark:border-[#3a2f27]">
                                    <button
                                        onClick={() => handleResolve(selectedTicket.id)}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 text-sm"
                                    >
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Mark as Resolved
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
