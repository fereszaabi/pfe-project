import { useState, useEffect } from 'react';
import { Ticket, Users, Clock, CheckCircle, AlertTriangle, LogOut, User, Filter, Search } from 'lucide-react';
import { getEmployeeTickets, assignTicket, updateEmployeeTicket } from '../../services/api';

export function EmployeeDashboard({ user, onLogout, onNavigate, activeView }) {
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [notes, setNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [tickets, setTickets] = useState([]);
    const [newDemandes, setNewDemandes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTickets = () => {
        setLoading(true);
        getEmployeeTickets()
            .then((data) => {
                setTickets(data.demandes?.data ?? data.demandes ?? []);
                setNewDemandes(data.new_demandes?.data ?? data.new_demandes ?? []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleAssignTicket = async (ticketId) => {
        try {
            await assignTicket(ticketId);
            fetchTickets();
        } catch (_) {}
    };

    const handleStartWork = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'in progress' });
            fetchTickets();
        } catch (_) {}
    };

    const handleResolve = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'resolved', employee_note: notes });
            setNotes('');
            setSelectedTicket(null);
            fetchTickets();
        } catch (_) {}
    };

    const handleEscalate = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'tech', employee_note: notes });
            setNotes('');
            setSelectedTicket(null);
            fetchTickets();
        } catch (_) {}
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'submitted':
                return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
            case 'assigned':
                return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
            case 'in-progress':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
            case 'resolved':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
            case 'escalated':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent':
                return 'text-red-600 dark:text-red-400';
            case 'high':
                return 'text-orange-600 dark:text-orange-400';
            case 'medium':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'low':
                return 'text-green-600 dark:text-green-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    };

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    const filteredTickets = [...newDemandes, ...tickets]
        .filter(t => filterStatus === 'all' || t.status === filterStatus)
        .filter(t => searchQuery === '' ||
            t.titre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    const allTickets = [...tickets, ...newDemandes];
    const stats = {
        total: allTickets.length,
        submitted: newDemandes.length,
        inProgress: tickets.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length
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
                {tickets.length}
                            </span>
                        </button>
                        <button
                            onClick={() => onNavigate?.('escalated')}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-surface-dark/50 hover:text-white transition-colors group"
                        >
                            <span className="material-symbols-outlined">priority_high</span>
                            <span className="font-medium text-sm">Escalated</span>
                        </button>
                        <button
                            onClick={() => onNavigate?.('history')}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-surface-dark/50 hover:text-white transition-colors group"
                        >
                            <span className="material-symbols-outlined">history</span>
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
                                placeholder="Search tickets, clients or software..."
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
                        <button
                            onClick={onLogout}
                            className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                            title="Logout"
                        >
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Total Active</span>
                                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-lg">confirmation_number</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{allTickets.filter(t => t.status !== 'resolved').length}</h3>
                                    <span className="text-emerald-500 text-xs font-bold mb-1 flex items-center gap-0.5">
                                        <span className="material-symbols-outlined text-xs">trending_up</span> +2%
                                    </span>
                                </div>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Live queue volume</p>
                            </div>

                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Urgent Priority</span>
                                    <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                                        <span className="material-symbols-outlined text-lg">priority_high</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{allTickets.filter(t => t.priority === 'urgent').length}</h3>
                                    <span className="text-rose-500 text-xs font-bold mb-1 flex items-center gap-0.5">
                                        <span className="material-symbols-outlined text-xs">warning</span> High
                                    </span>
                                </div>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Requires immediate action</p>
                            </div>

                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Awaiting Client</span>
                                    <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <span className="material-symbols-outlined text-lg">hourglass_empty</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{newDemandes.length}</h3>
                                    <span className="text-slate-400 text-xs font-bold mb-1">Stable</span>
                                </div>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Pending information</p>
                            </div>
                        </div>

                        {/* Ticket Management Table */}
                        <div className="bg-white dark:bg-[#1e1a16] rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm overflow-hidden flex flex-col">
                            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#3a2f27] flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Ticket Management</h3>
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Queue</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex rounded-lg border border-slate-200 dark:border-[#3a2f27] p-1 bg-slate-50 dark:bg-[#181411]">
                                        <button
                                            onClick={() => setFilterStatus('all')}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterStatus === 'all' ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setFilterStatus('submitted')}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterStatus === 'submitted' ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}
                                        >
                                            New
                                        </button>
                                        <button
                                            onClick={() => setFilterStatus('assigned')}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterStatus === 'assigned' ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}
                                        >
                                            Active
                                        </button>
                                    </div>
                                    <select className="bg-slate-100 dark:bg-[#181411] border-none rounded-lg text-xs font-bold px-3 py-2 pr-8 focus:ring-0 text-slate-900 dark:text-[#bba99b]">
                                        <option>Software Type</option>
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-[#181411]/50 text-slate-500 dark:text-[#bba99b] text-[11px] font-bold uppercase tracking-wider">
                                            <th className="px-6 py-4">Client Information</th>
                                            <th className="px-6 py-4">Software Type</th>
                                            <th className="px-6 py-4">Issue Summary</th>
                                            <th className="px-6 py-4">Priority & Flags</th>
                                            <th className="px-6 py-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[#3a2f27] text-sm">
                                        {filteredTickets.map((ticket, idx) => (
                                            <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group" onClick={() => setSelectedTicket(ticket)}>
                                                <td className={`px-6 py-5 ${idx === 0 ? 'border-l-4 border-primary' : ''}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-full bg-slate-200 dark:bg-[#3a2f27] flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                            {(ticket.client?.nom || ticket.id_client || '?').toString().charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.client?.nom || `Client #${ticket.id_client}`}</p>
                                                            <span className="text-[10px] text-[#bba99b] font-bold">ID #{String(ticket.id).slice(0, 8)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary`}>
                                                        {ticket.priority?.toUpperCase() || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="font-semibold text-slate-900 dark:text-white mb-0.5 line-clamp-1">{ticket.titre || `Ticket #${ticket.id}`}</p>
                                                    <p className="text-xs text-[#bba99b] line-clamp-1">{ticket.description}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${ticket.priority === 'urgent' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                            <span className={`size-1.5 rounded-full ${ticket.priority === 'urgent' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                                            {ticket.priority.toUpperCase()}
                                                        </span>
                                                        {ticket.category === 'technical' && (
                                                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold ml-1">
                                                                <span className="material-symbols-outlined text-[12px]">location_on</span> ONSITE
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleStartWork(ticket.id); }}
                                                            className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded font-bold text-xs transition-all shadow-sm"
                                                        >
                                                            Process
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEscalate(ticket.id); }}
                                                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">warning</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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

            {/* Ticket Detail Modal (Restored logic) */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-white dark:bg-[#1e1a16] border border-slate-200 dark:border-[#3a2f27] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-[#3a2f27] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1a16] z-10">
                            <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ticket #{String(selectedTicket.id).slice(0, 8)}</h3>
                                <p className="text-sm text-[#bba99b] mt-0.5">{selectedTicket.client?.nom || `Client #${selectedTicket.id_client}`}</p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#3a2f27] rounded-lg transition-colors text-[#bba99b]">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Issue Title</label>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.titre || `Ticket #${selectedTicket.id}`}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Software Category</label>
                                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">{selectedTicket.category}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Full Description</label>
                                <div className="bg-slate-50 dark:bg-[#181411] p-4 rounded-lg border border-slate-100 dark:border-[#3a2f27]">
                                    <p className="text-sm text-slate-600 dark:text-[#bba99b] leading-relaxed italic">"{selectedTicket.description}"</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-[#3a2f27] space-y-6">
                                <div>
                                    <label className="text-sm font-bold text-slate-900 dark:text-white mb-3 block">Resolution Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#181411] border border-slate-200 dark:border-[#3a2f27] rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-slate-400 min-h-[120px]"
                                        placeholder="Enter technical resolution steps or update client status..."
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleResolve(selectedTicket.id)}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                                    >
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Resolve Ticket
                                    </button>
                                    <button
                                        onClick={() => handleEscalate(selectedTicket.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                                    >
                                        <span className="material-symbols-outlined text-lg">warning</span>
                                        Escalate to IT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
