import { useState, useEffect } from 'react';
import { Ticket, Users, Clock, CheckCircle, AlertTriangle, LogOut, User, Filter, Search, Send, Star } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getEmployeeTickets, assignTicket, claimTicket, unclaimTicket, updateEmployeeTicket, sendMessage, startConversation, getEmployeeStats } from '../../services/api';

export function EmployeeDashboard({ user, onLogout, onNavigate, activeView }) {
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [allTickets, setAllTickets] = useState([]);
    const [myTickets, setMyTickets] = useState([]);
    const [unassignedTickets, setUnassignedTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [employeeStats, setEmployeeStats] = useState(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
    const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(false);

    const fetchTickets = () => {
        setLoading(true);
        Promise.all([getEmployeeTickets(), getEmployeeStats()])
            .then(([data, stats]) => {
                console.log('Employee tickets data:', data);
                setAllTickets(data.all_tickets?.data ?? data.all_tickets ?? []);
                setMyTickets(data.my_tickets?.data ?? data.my_tickets ?? []);
                setUnassignedTickets(data.unassigned_tickets?.data ?? data.unassigned_tickets ?? []);
                setEmployeeStats(stats);
            })
            .catch((err) => {
                console.error('Failed to fetch employee tickets:', err);
                setAllTickets([]);
                setMyTickets([]);
                setUnassignedTickets([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTickets(); }, []);

    const handleAssignTicket = async (ticketId) => {
        try {
            await assignTicket(ticketId);
            fetchTickets();
        } catch (_) {}
    };

    const handleClaimTicket = async (ticketId) => {
        try {
            await claimTicket(ticketId);
            fetchTickets();
            setSelectedTicket(null);
        } catch (_) {}
    };

    const handleUnclaimTicket = async (ticketId) => {
        try {
            await unclaimTicket(ticketId);
            fetchTickets();
            setSelectedTicket(null);
        } catch (_) {}
    };

    const handleContactClient = async (ticket) => {
        try {
            if (ticket.client?.id) {
                await startConversation(ticket.client.id);
            }
            setShowMessageModal(true);
        } catch (_) {}
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() || !selectedTicket?.client?.id) return;
        
        setIsSubmittingMessage(true);
        try {
            await sendMessage({
                recipient_id: selectedTicket.client.id,
                message: messageText,
                ticket_id: selectedTicket.id,
            });
            setMessageText('');
            setShowMessageModal(false);
            // Show success message
        } catch (_) {
            // Show error
        } finally {
            setIsSubmittingMessage(false);
        }
    };

    const handleStartWork = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'in progress' });
            fetchTickets();
        } catch (_) {}
    };

    const handleResolve = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'resolved' });
            setSelectedTicket(null);
            fetchTickets();
        } catch (_) {}
    };

    const handleEscalate = async (ticketId) => {
        try {
            await updateEmployeeTicket(ticketId, { status: 'tech' });
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

    const displayedTickets = showOnlyMyTickets ? myTickets : allTickets;
    
    const filteredTickets = displayedTickets
        .filter(t => filterStatus === 'all' || t.status === filterStatus)
        .filter(t => searchQuery === '' ||
            t.titre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    const stats = {
        total: displayedTickets.length,
        submitted: displayedTickets.filter(t => t.status === 'submitted').length,
        inProgress: displayedTickets.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
        resolved: displayedTickets.filter(t => t.status === 'resolved').length
    };

    // performance chart data by grouping resolved tickets by week
    const getPerformanceChartData = () => {
        const resolved = displayedTickets.filter(t => t.status === 'resolved');
        const weekData = {};
        resolved.forEach(ticket => {
            const date = new Date(ticket.completed_at);
            const week = `Week ${Math.ceil(date.getDate() / 7)}`;
            if (!weekData[week]) {
                weekData[week] = { name: week, tickets: 0, avgRating: 0 };
            }
            weekData[week].tickets += 1;
            weekData[week].avgRating = (weekData[week].avgRating + (ticket.client_rating || 0)) / 2;
        });
        return Object.values(weekData).slice(-8); // Last 8 weeks
    };

    //  priority breakdown data
    const getPriorityChartData = () => {
        return [
            { name: 'Urgent', value: allTickets.filter(t => t.priority === 'urgent').length, color: '#dc2626' },
            { name: 'High', value: allTickets.filter(t => t.priority === 'high').length, color: '#f97316' },
            { name: 'Medium', value: allTickets.filter(t => t.priority === 'medium').length, color: '#eab308' },
            { name: 'Low', value: allTickets.filter(t => t.priority === 'low').length, color: '#22c55e' }
        ].filter(item => item.value > 0);
    };

    //  status breakdown chart data
    const getStatusChartData = () => {
        return [
            { name: 'Submitted', value: allTickets.filter(t => t.status === 'submitted').length },
            { name: 'Assigned', value: allTickets.filter(t => t.status === 'assigned').length },
            { name: 'In Progress', value: allTickets.filter(t => ['in-progress', 'in progress'].includes(t.status)).length },
            { name: 'Resolved', value: allTickets.filter(t => t.status === 'resolved').length }
        ].filter(item => item.value > 0);
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
                {myTickets.length}
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
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{unassignedTickets.length}</h3>
                                    <span className="text-slate-400 text-xs font-bold mb-1">Stable</span>
                                </div>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Pending information</p>
                            </div>
                        </div>

                        {/* Performance Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Resolution Performance Chart */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Resolution Performance</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={getPerformanceChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#3a2f27" />
                                        <XAxis dataKey="name" stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e1a16', border: '1px solid #3a2f27', borderRadius: '8px', color: '#fff' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="tickets" stroke="#f96f06" name="Tickets Completed" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Priority Distribution */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Priority Distribution</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={getPriorityChartData()} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                                            {getPriorityChartData().map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Status Distribution */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm lg:col-span-2">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Ticket Status Overview</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={getStatusChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#3a2f27" />
                                        <XAxis dataKey="name" stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e1a16', border: '1px solid #3a2f27', borderRadius: '8px', color: '#fff' }} />
                                        <Bar dataKey="value" fill="#f96f06" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Performance Metrics */}
                            {employeeStats && (
                                <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm lg:col-span-2">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Performance Metrics</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-[#3a2f27]/30 p-4 rounded-lg">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#bba99b] mb-1">Avg Response Time</p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{(employeeStats.avg_resolution_hours ?? 0).toFixed(1)}h</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-[#3a2f27]/30 p-4 rounded-lg">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#bba99b] mb-1">Avg Rating</p>
                                            <p className="text-2xl font-bold text-yellow-500">{(employeeStats.avg_rating ?? 0).toFixed(1)}/5</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-[#3a2f27]/30 p-4 rounded-lg">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#bba99b] mb-1">Tickets Completed</p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{employeeStats.tickets_completed ?? 0}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-[#3a2f27]/30 p-4 rounded-lg">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#bba99b] mb-1">Current Workload</p>
                                            <p className="text-2xl font-bold text-primary">{employeeStats.current_workload ?? 0}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                            onClick={() => setShowOnlyMyTickets(false)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!showOnlyMyTickets ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}
                                        >
                                            All Tickets
                                        </button>
                                        <button
                                            onClick={() => setShowOnlyMyTickets(true)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${showOnlyMyTickets ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary'}`}
                                        >
                                            My Tickets
                                        </button>
                                    </div>
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
                                <p className="text-sm text-[#bba99b] mt-0.5">{selectedTicket.client?.nom || selectedTicket.client?.name || `Client #${selectedTicket.id_client}`}</p>
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
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Status</label>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                        selectedTicket.status === 'resolved' ? 'bg-green-500/10 text-green-500' :
                                        selectedTicket.status === 'in-progress' || selectedTicket.status === 'in progress' ? 'bg-blue-500/10 text-blue-500' :
                                        selectedTicket.status === 'assigned' ? 'bg-purple-500/10 text-purple-500' :
                                        'bg-primary/10 text-primary'
                                    }`}>{selectedTicket.status}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Priority</label>
                                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase inline-block">{selectedTicket.priority}</span>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Assigned To</label>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTicket.employee?.name || selectedTicket.id_employee ? `Employee #${selectedTicket.id_employee}` : 'Unassigned'}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Full Description</label>
                                <div className="bg-slate-50 dark:bg-[#181411] p-4 rounded-lg border border-slate-100 dark:border-[#3a2f27]">
                                    <p className="text-sm text-slate-600 dark:text-[#bba99b] leading-relaxed italic">"{selectedTicket.description}"</p>
                                </div>
                            </div>

                            {selectedTicket.image && (
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Attached Image</label>
                                    <img src={selectedTicket.image} alt="Ticket attachment" className="rounded-lg max-h-48 w-full object-cover" />
                                </div>
                            )}

                            {selectedTicket.employee_note && (
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Employee Notes</label>
                                    <div className="bg-slate-50 dark:bg-[#181411] p-4 rounded-lg border border-slate-100 dark:border-[#3a2f27]">
                                        <p className="text-sm text-slate-600 dark:text-[#bba99b]">{selectedTicket.employee_note}</p>
                                    </div>
                                </div>
                            )}

                            {selectedTicket.client_rating && (
                                <div>
                                    <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block mb-2">Client Rating</label>
                                    <div className="flex items-center gap-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                size={20}
                                                className={i < selectedTicket.client_rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}
                                            />
                                        ))}
                                        <span className="ml-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedTicket.client_rating}/5</span>
                                    </div>
                                </div>
                            )}

                            {selectedTicket.status !== 'resolved' && (
                                <div className="pt-6 border-t border-slate-100 dark:border-[#3a2f27] space-y-6">
                                    <div className="flex flex-col gap-3">
                                        {!selectedTicket.id_employee ? (
                                            <button
                                                onClick={() => handleClaimTicket(selectedTicket.id)}
                                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                                            >
                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                                Claim Ticket
                                            </button>
                                        ) : (
                                            <div className="flex gap-3">
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
                                                <button
                                                    onClick={() => handleContactClient(selectedTicket)}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                                >
                                                    <span className="material-symbols-outlined text-lg">message</span>
                                                    Contact Client
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Message Modal */}
            {showMessageModal && selectedTicket && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowMessageModal(false)}>
                    <div className="bg-white dark:bg-[#1e1a16] border border-slate-200 dark:border-[#3a2f27] rounded-xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-[#3a2f27] flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contact Client</h3>
                                <p className="text-sm text-[#bba99b]">{selectedTicket.client?.nom || selectedTicket.client?.name || 'Client'}</p>
                            </div>
                            <button onClick={() => setShowMessageModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#3a2f27] rounded-lg transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-900 dark:text-white mb-2 block">Message</label>
                                <textarea
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    placeholder="Type your message to the client..."
                                    className="w-full bg-slate-50 dark:bg-[#181411] border border-slate-200 dark:border-[#3a2f27] rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-slate-400 min-h-[120px]"
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowMessageModal(false)}
                                    className="px-6 py-2 border border-slate-200 dark:border-[#3a2f27] rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-[#3a2f27] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isSubmittingMessage || !messageText.trim()}
                                    className="px-6 py-2 bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center gap-2"
                                >
                                    <Send size={16} />
                                    Send Message
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
