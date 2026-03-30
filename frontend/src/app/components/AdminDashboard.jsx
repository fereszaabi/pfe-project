import { useState, useEffect } from 'react';
import { Shield, Users, Ticket, Activity, TrendingUp, LogOut, User, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAdminDemandes, getAdminStats, updateDemandeStatus, updateClient, deleteUser, takeMoney, getEmployeeLeaderboard } from '../../services/api';

export function AdminDashboard({ user, onLogout, onNavigate, activeView }) {
    const [activeTab, setActiveTab] = useState(activeView || 'overview');
    const [editingBalanceId, setEditingBalanceId] = useState(null);
    const [balanceDraft, setBalanceDraft] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [stats, setStats] = useState({ total: 0, by_status: {} });
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        Promise.all([getAdminDemandes(), getAdminStats(), getEmployeeLeaderboard(10)])
            .then(([demandesData, statsData, leaderboardData]) => {
                setTickets(Array.isArray(demandesData) ? demandesData : demandesData.data ?? []);
                setStats(statsData);
                setLeaderboard(leaderboardData?.leaderboard ?? []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    // Clients are embedded in demandes via eager-loading
    const clientUsers = [...new Map(
        tickets.filter(t => t.client).map(t => [t.client.id, t.client])
    ).values()];

    const handleEditBalance = (client) => {
        setEditingBalanceId(client.id);
        setBalanceDraft(String(client.money ?? 0));
    };

    const handleSaveBalance = async (clientId) => {
        const val = parseFloat(balanceDraft);
        if (!isNaN(val)) {
            await takeMoney(clientId, val).catch(() => {});
            fetchData();
        }
        setEditingBalanceId(null);
    };

    const handleUpdateDemandeStatus = async (demandeId, status) => {
        await updateDemandeStatus(demandeId, { status }).catch(() => {});
        fetchData();
    };

    const handleToggleClientState = async (client) => {
        const newState = client.client_state === 'active' ? 'inactive' : 'active';
        await updateClient(client.id, { client_state: newState }).catch(() => {});
        fetchData();
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Delete this user?')) return;
        await deleteUser(userId).catch(() => {});
        fetchData();
    };

    // Calculate statistics
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
    const activeTickets = tickets.filter(t => ['submitted', 'open', 'in progress', 'assigned', 'in-progress'].includes(t.status)).length;
    const escalatedTickets = tickets.filter(t => t.status === 'tech').length;
    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    // Get top performer from leaderboard
    const topPerformer = leaderboard.length > 0 ? {
        employee: { nom: leaderboard[0].name },
        resolved: leaderboard[0].tickets_completed,
        avg_rating: leaderboard[0].avg_rating
    } : null;

    // Keep mock chart data (no chart endpoint on backend)
    const ticketTrendData = [
        { date: '2/1', submitted: 12, resolved: 8 },
        { date: '2/2', submitted: 15, resolved: 10 },
        { date: '2/3', submitted: 10, resolved: 14 },
        { date: '2/4', submitted: 18, resolved: 12 },
        { date: '2/5', submitted: 14, resolved: 16 },
        { date: '2/6', submitted: 20, resolved: 18 },
        { date: '2/7', submitted: 16, resolved: 15 },
    ];

    // employee response times chart data
    const getEmployeeResponseTimesData = () => {
        return leaderboard.slice(0, 5).map(emp => ({
            name: emp.name.split(' ')[0],
            responseTime: emp.avg_resolution_hours || 0,
            rating: emp.avg_rating || 0
        }));
    };

    // priority breakdown chart data
    const getPriorityBreakdownData = () => {
        return [
            { name: 'Urgent', value: tickets.filter(t => t.priority === 'urgent').length },
            { name: 'High', value: tickets.filter(t => t.priority === 'high').length },
            { name: 'Medium', value: tickets.filter(t => t.priority === 'medium').length },
            { name: 'Low', value: tickets.filter(t => t.priority === 'low').length }
        ].filter(item => item.value > 0);
    };

    //  traffic stats chart data (by status)
    const getTrafficStatsData = () => {
        return [
            { name: 'Submitted', value: tickets.filter(t => t.status === 'submitted').length },
            { name: 'Assigned', value: tickets.filter(t => t.status === 'assigned').length },
            { name: 'In Progress', value: tickets.filter(t => ['in-progress', 'in progress'].includes(t.status)).length },
            { name: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length },
            { name: 'Escalated', value: tickets.filter(t => t.status === 'tech').length }
        ].filter(item => item.value > 0);
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

    const getActionColor = (action) => {
        if (action.includes('created') || action.includes('submitted')) return 'text-blue-600 dark:text-blue-400';
        if (action.includes('assigned')) return 'text-purple-600 dark:text-purple-400';
        if (action.includes('started') || action.includes('in-progress')) return 'text-yellow-600 dark:text-yellow-400';
        if (action.includes('resolved')) return 'text-green-600 dark:text-green-400';
        if (action.includes('escalated')) return 'text-red-600 dark:text-red-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex w-full">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-slate-800 bg-midnight flex flex-col fixed h-full z-20">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-2xl">shield_with_heart</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-tight">IDSoft</h1>
                        <p className="text-slate-400 text-xs leading-none mt-0.5">Admin Command</p>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'tickets' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined">confirmation_number</span>
                        <span className="text-sm font-medium">Ticket Management</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined">group</span>
                        <span className="text-sm font-medium">Client Lists</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'logs' ? "'FILL' 1" : "'FILL' 0" }}>analytics</span>
                        <span className="text-sm font-medium">Interaction Log</span>
                    </button>
                    <div className="pt-4 pb-2 px-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">System</p>
                    </div>
                    <button
                        onClick={() => onNavigate?.('settings')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-surface-dark/50 hover:text-white rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">settings</span>
                        <span className="text-sm font-medium">System Settings</span>
                    </button>
                    <button
                        onClick={() => onNavigate?.('audit')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-surface-dark/50 hover:text-white rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">security</span>
                        <span className="text-sm font-medium">Audit Logs</span>
                    </button>
                </nav>
                <div className="p-4 mt-auto">
                    <div className="bg-surface-dark/30 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-primary font-bold text-xs ring-2 ring-white/10">
                                {user.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs font-bold truncate text-white">{user.name}</p>
                                <p className="text-[10px] text-slate-500">Super Admin</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-full text-xs font-semibold text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 flex flex-col min-h-screen">
                {/* Header */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {activeTab === 'overview' ? 'Admin Dashboard' : activeTab === 'logs' ? 'Interaction Log' : activeTab === 'tickets' ? 'Ticket Management' : 'Client Lists'}
                        </h2>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Live Sync</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                className="w-64 bg-slate-100 dark:bg-midnight-accent border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-slate-500 text-slate-900 dark:text-white"
                                placeholder="Search interactions..."
                                type="text"
                            />
                        </div>
                        <button className="p-2 rounded-lg bg-slate-100 dark:bg-midnight-accent text-slate-500 hover:text-primary transition-colors relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border-2 border-white dark:border-background-dark"></span>
                        </button>
                        <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg">download</span>
                            Export Log
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
                    {activeTab === 'overview' && (
                        <>
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Tickets</span>
                                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined text-xl">confirmation_number</span>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                                        <h3 className="text-3xl font-bold">{totalTickets.toLocaleString()}</h3>
                                        <span className="text-emerald-500 text-xs font-bold mb-1 flex items-center gap-0.5">
                                            <span className="material-symbols-outlined text-xs">trending_up</span> +12%
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Resolved Issues</span>
                                        <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <span className="material-symbols-outlined text-xl">check_circle</span>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                                        <h3 className="text-3xl font-bold">{resolvedTickets.toLocaleString()}</h3>
                                        <span className="text-emerald-500 text-xs font-bold mb-1 flex items-center gap-0.5">
                                            <span className="material-symbols-outlined text-xs">trending_up</span> +5%
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg Response</span>
                                        <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <span className="material-symbols-outlined text-xl">avg_time</span>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                                        <h3 className="text-3xl font-bold">2h 15m</h3>
                                        <span className="text-emerald-500 text-xs font-bold mb-1 flex items-center gap-0.5">
                                            <span className="material-symbols-outlined text-xs">trending_down</span> -8%
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Users</span>
                                        <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                                            <span className="material-symbols-outlined text-xl">person_play</span>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                                        <h3 className="text-3xl font-bold">{leaderboard.length}</h3>
                                        <span className="text-slate-400 text-xs font-bold mb-1">Stable</span>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-slate-900 dark:text-white">Interaction Trends</h3>
                                        <select className="bg-slate-50 dark:bg-midnight-accent border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold px-3 py-1.5 focus:ring-0">
                                            <option>Last 7 Days</option>
                                        </select>
                                    </div>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={ticketTrendData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Line type="monotone" dataKey="submitted" stroke="#f96f06" strokeWidth={3} dot={{ r: 4, fill: '#f96f06', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                                <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="font-bold text-slate-900 dark:text-white">Performance Overview</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Live</span>
                                    </div>

                                    {/* Success rate + top performer */}
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Success Rate</span>
                                            <span className="text-3xl font-black text-emerald-500">{resolutionRate}%</span>
                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${resolutionRate}%` }}></div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1">{resolvedTickets}/{totalTickets} resolved</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Top Performer</span>
                                            {topPerformer ? (
                                                <>
                                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-base mb-1">
                                                        {topPerformer.employee?.nom?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{topPerformer.employee?.nom || 'Unknown'}</span>
                                                    <span className="text-[10px] text-emerald-500 font-bold mt-0.5">{topPerformer.resolved} solved</span>
                                                    <div className="flex items-center gap-1 mt-2">
                                                        <span className="material-symbols-outlined text-sm text-yellow-500">star</span>
                                                        <span className="text-[10px] font-bold text-slate-900 dark:text-white">{(topPerformer.avg_rating ?? 0).toFixed(1)}/5</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">No data yet</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto">
                                        {Object.entries(stats.by_status || {}).length === 0 && (
                                            <p className="text-xs text-slate-400 text-center py-4">No data yet.</p>
                                        )}
                                        {Object.entries(stats.by_status || {}).map(([status, count]) => (
                                            <div key={status} className="flex items-center gap-3">
                                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                    {status.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate capitalize">{status}</span>
                                                        <span className="text-[10px] font-black text-emerald-500 shrink-0 ml-2">{count}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Employee Performance Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                                {/* Employee Response Times */}
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Employee Response Times</h3>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getEmployeeResponseTimesData()}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Legend />
                                                <Bar dataKey="responseTime" fill="#3b82f6" name="Avg Hours" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Traffic Stats by Status */}
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Traffic Stats</h3>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getTrafficStatsData()}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-45} textAnchor="end" height={80} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="value" fill="#f96f06" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Most Common Problems */}
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Most Common Problems (Priority Distribution)</h3>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getPriorityBreakdownData()} layout="vertical" margin={{ left: 80 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[0, 8, 8, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Top Employees Table */}
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Top Performing Employees</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left py-3 px-3 font-bold text-slate-600 dark:text-slate-400">Employee</th>
                                                    <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-400">Tickets</th>
                                                    <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-400">Avg Rating</th>
                                                    <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-400">Response Time</th>
                                                    <th className="text-center py-3 px-3 font-bold text-slate-600 dark:text-slate-400">Workload</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaderboard.slice(0, 5).map((emp, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{emp.name}</td>
                                                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">{emp.tickets_completed}</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold text-xs">
                                                                ⭐ {(emp.avg_rating ?? 0).toFixed(1)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">{(emp.avg_resolution_hours ?? 0).toFixed(1)}h</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${emp.current_workload > 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                                                                {emp.current_workload} tickets
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Interaction Log</h3>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 tracking-wider">LATEST 50</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800">
                                            <span className="material-symbols-outlined text-slate-500">filter_list</span>
                                        </button>
                                        <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800">
                                            <span className="material-symbols-outlined text-slate-500">refresh</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 dark:bg-midnight/50 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                                <th className="px-8 py-4">Actor Details</th>
                                                <th className="px-8 py-4">Interaction Type</th>
                                                <th className="px-8 py-4">Log Summary</th>
                                                <th className="px-8 py-4">Priority Level</th>
                                                <th className="px-8 py-4">Outcome</th>
                                                <th className="px-8 py-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                            {tickets.slice(0, 5).map((log, i) => (
                                                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-xs">
                                                                {(log.client?.nom || String(log.id_client || '?')).charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{log.client?.nom || `Client #${log.id_client}`}</p>
                                                                <span className="text-[10px] text-slate-500 font-bold uppercase">ID #TKT-{log.id}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wide">
                                                            {log.status === 'resolved' ? 'Resolution' : log.status === 'open' || log.status === 'submitted' ? 'Creation' : 'Update'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <p className="font-medium text-slate-900 dark:text-white line-clamp-1">{log.titre || log.description?.substring(0, 40) || `Ticket #${log.id}`}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-fit ${log.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                                                            <span className={`size-1.5 rounded-full ${log.status === 'resolved' ? 'bg-emerald-500' : 'bg-primary'}`}></span>
                                                            {log.priority?.toUpperCase() || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Success</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <button className="text-[10px] font-black uppercase text-primary hover:underline tracking-widest transition-all">VIEW</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'tickets' && (
                        <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-lg">Ticket Management Queue</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-midnight">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ticket ID</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Client</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Title</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {tickets.map((ticket) => (
                                            <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">#{String(ticket.id).slice(0, 8)}</td>
                                                <td className="px-6 py-4 text-sm font-semibold">{ticket.client?.nom || `Client #${ticket.id_client}`}</td>
                                                <td className="px-6 py-4 text-sm font-medium">{ticket.titre || ticket.description?.substring(0, 40)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{new Date(ticket.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            {/* Summary bar */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-midnight-accent p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">group</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Total Clients</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{clientUsers.length}</p>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-midnight-accent p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <span className="material-symbols-outlined">account_balance_wallet</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Total Balance</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {clientUsers.reduce((s, c) => s + (parseFloat(c.money) || 0), 0).toFixed(2)} DT
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-midnight-accent p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <span className="material-symbols-outlined">confirmation_number</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Open Tickets</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {tickets.filter(t => ['submitted','open','in progress','in-progress'].includes(t.status)).length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Client profile cards */}
                            {clientUsers.map(client => {
                                const clientTickets = tickets.filter(t => t.id_client === client.id || t.client?.id === client.id);
                                const openCount = clientTickets.filter(t => ['submitted', 'open', 'in progress', 'in-progress'].includes(t.status)).length;
                                const isExpanded = selectedClient === client.id;
                                const isEditingBal = editingBalanceId === client.id;

                                return (
                                    <div key={client.id} className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        {/* Card header */}
                                        <div className="p-6 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0">
                                                    {(client.nom || client.name || '?').charAt(0)}
                                                </div>
                                                <div>
                                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{client.nom || client.name}</h4>
                                                    <p className="text-sm text-slate-500">{client.code_fiscal || '—'}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">CIN: {client.cin || '—'}</span>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">{client.code_fiscal || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Balance editor */}
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Current Balance</p>
                                                    {isEditingBal ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={balanceDraft}
                                                                onChange={e => setBalanceDraft(e.target.value)}
                                                                className="w-28 px-3 py-1.5 text-sm font-bold border border-primary rounded-lg focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white dark:bg-midnight"
                                                                autoFocus
                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveBalance(client.id); if (e.key === 'Escape') setEditingBalanceId(null); }}
                                                            />
                                                            <span className="text-sm text-slate-500">DT</span>
                                                            <button onClick={() => handleSaveBalance(client.id)} className="size-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-lg">check</span>
                                                            </button>
                                                            <button onClick={() => setEditingBalanceId(null)} className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-lg">close</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-2xl font-black ${(parseFloat(client.money) || 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                {(parseFloat(client.money) || 0).toFixed(2)} DT
                                                            </span>
                                                            <button onClick={() => handleEditBalance(client)} title="Edit balance" className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-400 flex items-center justify-center transition-colors">
                                                                <span className="material-symbols-outlined text-base">edit</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => setSelectedClient(isExpanded ? null : client.id)}
                                                    className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-400 flex items-center justify-center transition-colors"
                                                    title={isExpanded ? 'Collapse' : 'View full profile'}
                                                >
                                                    <span className="material-symbols-outlined text-lg">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded profile details */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 dark:border-slate-800 px-6 pb-6 pt-5">
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                                                    {[
                                                        { icon: 'badge', label: 'CIN', value: client.cin || '—' },
                                                        { icon: 'fingerprint', label: 'Fiscal Code', value: client.code_fiscal || '—' },
                                                        { icon: 'mail', label: 'Email', value: client.mail || '—' },
                                                        { icon: 'phone', label: 'Phone', value: client.numero || '—' },
                                                        { icon: 'person', label: 'First Name', value: client.prenom || '—' },
                                                        { icon: 'account_balance_wallet', label: 'Balance', value: `${(parseFloat(client.money) || 0).toFixed(2)} DT` },
                                                        { icon: 'toggle_on', label: 'Status', value: client.client_state || '—' },
                                                        { icon: 'confirmation_number', label: 'Total Tickets', value: clientTickets.length },
                                                    ].map(({ icon, label, value }) => (
                                                        <div key={label} className="bg-slate-50 dark:bg-midnight p-4 rounded-xl">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="material-symbols-outlined text-slate-400 text-base">{icon}</span>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                                                            </div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Ticket summary for this client */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300">Recent Tickets</h5>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{openCount} OPEN</span>
                                                    </div>
                                                    {clientTickets.length === 0 ? (
                                                        <p className="text-sm text-slate-400 italic">No tickets submitted.</p>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-slate-50 dark:bg-midnight">
                                                                    <tr>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">ID</th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Priority</th>
                                                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Date</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                    {clientTickets.map(t => (
                                                                        <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">#{t.id}</td>
                                                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{t.titre || t.description?.substring(0, 30)}</td>
                                                                            <td className="px-4 py-3">
                                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(t.status)}`}>{t.status}</span>
                                                                            </td>
                                                                            <td className="px-4 py-3 capitalize text-xs font-semibold text-slate-600 dark:text-slate-400">{t.priority}</td>
                                                                            <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {clientUsers.length === 0 && (
                                <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
                                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">group_off</span>
                                    <p className="text-slate-400 mt-4 font-medium">No clients registered yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="font-bold text-lg">Full System Audit Log</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-midnight/50 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                                            <th className="px-8 py-4">Timestamp</th>
                                            <th className="px-8 py-4">Actor</th>
                                            <th className="px-8 py-4">Action</th>
                                            <th className="px-8 py-4">Target</th>
                                            <th className="px-8 py-4">Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                        {tickets.map((log, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-8 py-5 font-mono text-xs text-slate-500">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">account_circle</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{log.client?.nom || `Client #${log.id_client}`}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={getActionColor(log.status)}>Status: {log.status}</span>
                                                </td>
                                                <td className="px-8 py-5 text-slate-500 italic">
                                                    {log.id ? `Ticket #${String(log.id).slice(0, 8)}` : 'System Core'}
                                                </td>
                                                <td className="px-8 py-5 text-emerald-500 font-bold text-xs uppercase tracking-widest">LOGGED</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
