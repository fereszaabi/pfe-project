import { useState, useEffect } from 'react';
import { getAdminDemandes, getAdminStats, updateDemandeStatus, updateClient, deleteUser, takeMoney, getEmployeeLeaderboard, getAdminTicketDetail, updateClientBalance, getAdminClients, getConversations, getUnreadMessages, getTicketMessages, getInsufficientFundsTickets, getEmployees, assignAdminTicket } from '../../services/api';
import { getStatusBadgeClasses } from '../utils/ticketStyles';

export function AdminDashboard({ user, onLogout, onNavigate, activeView }) {
    const resolvedTab = activeView === 'dashboard' ? 'overview' : activeView;
    const [activeTab, setActiveTab] = useState(resolvedTab || 'overview');
    const [editingBalanceId, setEditingBalanceId] = useState(null);
    const [balanceDraft, setBalanceDraft] = useState('');
    const [balanceOperation, setBalanceOperation] = useState('set'); // 'add', 'subtract', 'set'
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedClientHistory, setSelectedClientHistory] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [clientUsers, setClientUsers] = useState([]);
    const [stats, setStats] = useState({ total: 0, by_status: {} });
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketTotalPages, setTicketTotalPages] = useState(1);
    const [clientSearch, setClientSearch] = useState('');
    const [clientPage, setClientPage] = useState(1);
    const [clientTotalPages, setClientTotalPages] = useState(1);
    const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
    const [ticketDetailLoading, setTicketDetailLoading] = useState(false);
    const [selectedTicketMessages, setSelectedTicketMessages] = useState([]);
    const [ticketMessagesLoading, setTicketMessagesLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTicket, setAssignTicket] = useState(null);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [assigningTicketId, setAssigningTicketId] = useState(null);
    const [assignError, setAssignError] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [insufficientTickets, setInsufficientTickets] = useState([]);
    const [insufficientSummary, setInsufficientSummary] = useState({ pending_count: 0, total_amount_needed: 0 });
    const ticketPerPage = 10;
    const clientPerPage = 20;

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            getAdminDemandes({
                per_page: ticketPerPage,
                page: ticketPage,
                search: ticketSearch.trim(),
            }),
            getAdminStats(),
            getEmployeeLeaderboard(10),
            getAdminClients({
                per_page: clientPerPage,
                page: clientPage,
                search: clientSearch.trim(),
            }),
            getInsufficientFundsTickets(),
        ])
            .then(([demandesData, statsData, leaderboardData, clientsData, insufficientData]) => {
                const demandesPayload = Array.isArray(demandesData)
                    ? demandesData
                    : demandesData.data ?? demandesData.demandes ?? [];
                const demandesPages = demandesData?.pagination?.total_pages ?? 1;
                setTickets(demandesPayload);
                setTicketTotalPages(demandesPages);
                setStats(statsData);
                setLeaderboard(leaderboardData?.leaderboard ?? []);
                console.log('Clients data received:', clientsData);
                const clientPayload = Array.isArray(clientsData?.clients) ? clientsData.clients : [];
                const clientPages = clientsData?.pagination?.total_pages ?? 1;
                setClientUsers(clientPayload);
                setClientTotalPages(clientPages);
                setInsufficientTickets(Array.isArray(insufficientData?.tickets) ? insufficientData.tickets : []);
                setInsufficientSummary(insufficientData?.summary ?? { pending_count: 0, total_amount_needed: 0 });
            })
            .catch((err) => {
                console.error('Error fetching admin data:', err);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [ticketPage, ticketSearch, clientPage, clientSearch]);

    useEffect(() => {
        const fetchEmployeeList = async () => {
            setEmployeesLoading(true);
            try {
                const data = await getEmployees();
                setEmployees(Array.isArray(data?.employees) ? data.employees : []);
            } catch (err) {
                console.error('Error loading employees:', err);
                setEmployees([]);
            } finally {
                setEmployeesLoading(false);
            }
        };

        fetchEmployeeList();
    }, []);

    useEffect(() => {
        if (!activeView) return;
        const nextTab = activeView === 'dashboard' ? 'overview' : activeView;
        setActiveTab(nextTab);
    }, [activeView]);

    const handleEditBalance = (client) => {
        setEditingBalanceId(client.id);
        setBalanceDraft('');
        setBalanceOperation('set');
    };

    const handleSaveBalance = async (clientId) => {
        const val = parseFloat(balanceDraft);
        if (!isNaN(val) && balanceDraft.trim() !== '') {
            await updateClientBalance(clientId, val, balanceOperation).catch(() => {});
            fetchData();
        }
        setEditingBalanceId(null);
        setBalanceDraft('');
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

    const fetchTicketMessages = async (ticketId) => {
        setTicketMessagesLoading(true);
        try {
            const response = await getTicketMessages(ticketId);
            const messages = response?.messages || response?.data?.messages || [];
            setSelectedTicketMessages(Array.isArray(messages) ? messages : []);
        } catch (err) {
            console.error('Error loading ticket conversation:', err);
            setSelectedTicketMessages([]);
        } finally {
            setTicketMessagesLoading(false);
        }
    };

    const handleViewTicketDetail = async (ticketId) => {
        setTicketDetailLoading(true);
        setSelectedTicketDetail(null);
        setSelectedTicketMessages([]);

        try {
            const detail = await getAdminTicketDetail(ticketId);
            const ticketDetail = detail?.demande ?? detail;
            setSelectedTicketDetail(ticketDetail);
            await fetchTicketMessages(ticketId);
        } catch (err) {
            console.error('Error loading ticket details:', err);
        } finally {
            setTicketDetailLoading(false);
        }
    };

    const openAssignModal = (ticket) => {
        const nextTicket = ticket || selectedTicketDetail;
        if (!nextTicket) return;

        setAssignTicket(nextTicket);
        setSelectedEmployeeId(String(nextTicket?.employee?.id ?? nextTicket?.id_employee ?? ''));
        setAssignError('');
        setShowAssignModal(true);
    };

    const closeAssignModal = () => {
        setShowAssignModal(false);
        setAssignTicket(null);
        setSelectedEmployeeId('');
        setAssignError('');
    };

    const handleAssignTicket = async () => {
        if (!assignTicket || !selectedEmployeeId) {
            setAssignError('Please choose an employee to assign this ticket.');
            return;
        }

        const ticketId = assignTicket.id;
        setAssigningTicketId(ticketId);
        setAssignError('');

        try {
            await assignAdminTicket(ticketId, Number(selectedEmployeeId));
            closeAssignModal();
            if (selectedTicketDetail?.id === ticketId) {
                await handleViewTicketDetail(ticketId);
            }
            fetchData();
        } catch (err) {
            console.error('Error assigning ticket:', err);
            setAssignError(err?.message || err?.error || 'Unable to assign ticket.');
        } finally {
            setAssigningTicketId(null);
        }
    };

    const loadNotifications = async () => {
        setNotificationsLoading(true);
        try {
            const [summary, conversationsData] = await Promise.all([
                getUnreadMessages(),
                getConversations(),
            ]);
            setUnreadMessagesCount(Number(summary?.total_unread ?? 0));
            setNotifications(Array.isArray(conversationsData?.conversations) ? conversationsData.conversations : []);
        } catch (_) {
            setNotifications([]);
        } finally {
            setNotificationsLoading(false);
        }
    };

    const toggleNotifications = () => {
        const next = !showNotifications;
        setShowNotifications(next);
        if (next) {
            loadNotifications();
        }
    };

    // Calculate statistics
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
    const activeTickets = tickets.filter(t => ['submitted', 'open', 'in progress', 'assigned', 'in-progress'].includes(t.status)).length;
    const escalatedTickets = tickets.filter(t => t.status === 'tech').length;
    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    const respondedTickets = tickets.filter((ticket) => ticket?.created_at && ticket?.assigned_at);
    const avgFirstResponseHours = respondedTickets.length > 0
        ? respondedTickets.reduce((sum, ticket) => {
            const createdAt = new Date(ticket.created_at).getTime();
            const assignedAt = new Date(ticket.assigned_at).getTime();

            if (!Number.isFinite(createdAt) || !Number.isFinite(assignedAt) || assignedAt < createdAt) {
                return sum;
            }

            return sum + (assignedAt - createdAt) / (1000 * 60 * 60);
        }, 0) / respondedTickets.length
        : null;

    const formattedAvgFirstResponse = avgFirstResponseHours === null
        ? '--'
        : avgFirstResponseHours < 1
            ? `${Math.max(1, Math.round(avgFirstResponseHours * 60))}m`
            : `${avgFirstResponseHours.toFixed(1)}h`;

    // priority breakdown chart data
    const getPriorityBreakdownData = () => {
        return [
            { name: 'Urgent', value: tickets.filter(t => t.priority === 'urgent').length },
            { name: 'High', value: tickets.filter(t => t.priority === 'high').length },
            { name: 'Medium', value: tickets.filter(t => t.priority === 'medium').length },
            { name: 'Low', value: tickets.filter(t => t.priority === 'low').length }
        ].filter(item => item.value > 0);
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
                        onClick={() => onNavigate?.('escalated')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-surface-dark/50 hover:text-white rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">priority_high</span>
                        <span className="text-sm font-medium">Escalated Queue</span>
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
                    <button
                        onClick={() => onNavigate?.('settings')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-surface-dark/50 hover:text-white rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">manage_accounts</span>
                        <span className="text-sm font-medium">Employee Management</span>
                    </button>
                    <button
                        onClick={() => onNavigate?.('analytics')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-surface-dark/50 hover:text-white rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">trending_up</span>
                        <span className="text-sm font-medium">Analytics & Reports</span>
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
                            <button
                                onClick={toggleNotifications}
                                className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-midnight-accent text-slate-600 dark:text-slate-200 hover:text-primary transition-colors relative"
                                title="Notifications"
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                {unreadMessagesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white rounded-full border-2 border-white dark:border-background-dark text-[10px] font-bold leading-[14px] flex items-center justify-center">
                                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-midnight-accent rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 z-50 max-h-96 overflow-y-auto">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-midnight-accent">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                            {unreadMessagesCount > 0 && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded">
                                                    {unreadMessagesCount} new
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {notificationsLoading && (
                                            <div className="p-4 text-sm text-slate-500">Loading notifications...</div>
                                        )}
                                        {!notificationsLoading && notifications.length === 0 && (
                                            <div className="p-8 text-center">
                                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl block mb-2">notifications_none</span>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
                                            </div>
                                        )}
                                        {!notificationsLoading && notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                onClick={() => setShowNotifications(false)}
                                                className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${notif.unread_count > 0 ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 mt-1">
                                                        <span className="material-symbols-outlined text-blue-500 text-xl">chat</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                                                {notif.other_participant?.name || 'Conversation'}
                                                            </p>
                                                            {notif.unread_count > 0 && (
                                                                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2"></div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                                            {notif.last_message?.message || 'No messages yet.'}
                                                        </p>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                                            {notif.updated_at ? new Date(notif.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:text-primary hover:border-primary/40 transition-colors"
                        >
                            Refresh Data
                        </button>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
                    {activeTab === 'overview' && (
                        <>
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg shadow-orange-500/20">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/70 font-bold">Approval Queue</p>
                                        <h3 className="text-2xl font-black mt-1">Tickets waiting for insufficient-funds review</h3>
                                        <p className="text-sm text-white/80 mt-1">These requests are ready to be highlighted and processed without blocking the client.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/15 rounded-xl p-4 min-w-[160px]">
                                            <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Pending Requests</p>
                                            <p className="text-3xl font-black mt-1">{insufficientSummary.pending_count}</p>
                                        </div>
                                        <div className="bg-white/15 rounded-xl p-4 min-w-[160px]">
                                            <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Amount Needed</p>
                                            <p className="text-3xl font-black mt-1">{Number(insufficientSummary.total_amount_needed ?? 0).toFixed(2)} DT</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Executive Summary */}
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
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg First Response</span>
                                        <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <span className="material-symbols-outlined text-xl">avg_time</span>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                                        <h3 className="text-3xl font-bold">{formattedAvgFirstResponse}</h3>
                                        <span className="text-slate-400 text-xs font-bold mb-1">
                                            {respondedTickets.length} tickets
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
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Priority Mix</h3>
                                    <div className="space-y-3">
                                        {getPriorityBreakdownData().length === 0 && (
                                            <p className="text-xs text-slate-400">No ticket data yet.</p>
                                        )}
                                        {getPriorityBreakdownData().map((item) => (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.name}</span>
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Top Performing Employees</h3>
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
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Activity</h3>
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 tracking-wider">LATEST 5</span>
                                    </div>
                                    <button
                                        onClick={fetchData}
                                        className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
                                    >
                                        <span className="material-symbols-outlined text-slate-500">refresh</span>
                                    </button>
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

                            <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Requests Needing Attention</h3>
                                        <p className="text-xs text-slate-500">Highlighted tickets and clients with insufficient funds.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
                                        {insufficientTickets.length} pending
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {insufficientTickets.length === 0 ? (
                                        <div className="p-10 text-center text-sm text-slate-500">No outstanding approvals right now.</div>
                                    ) : insufficientTickets.map((ticket) => (
                                        <div key={ticket.id} className="p-5 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors">
                                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined">priority_high</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-bold text-slate-900 dark:text-white">{ticket.titre}</p>
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                                                                Needs approval
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                            Client: {ticket.client?.nom || ticket.client?.name || `Client #${ticket.id_client}`} · Ticket #{ticket.id}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Balance: {Number(ticket.client?.money ?? 0).toFixed(2)} DT · Priority: {ticket.priority || 'normal'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleViewTicketDetail(ticket.id)}
                                                        className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-colors"
                                                    >
                                                        Review Ticket
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'tickets' && (
                        <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-bold text-lg">Ticket Management Queue</h3>
                                    <p className="text-xs text-slate-500">Search by title, status, or client.</p>
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                    <input
                                        value={ticketSearch}
                                        onChange={(e) => {
                                            setTicketSearch(e.target.value);
                                            setTicketPage(1);
                                        }}
                                        placeholder="Search tickets..."
                                        className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                            {insufficientTickets.length > 0 && (
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/10">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">Clients in debt</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">These clients have outstanding ticket requests and require balance attention.</p>
                                    <div className="grid gap-3">
                                        {insufficientTickets.map((ticket) => (
                                            <div key={ticket.id} className="rounded-2xl border border-amber-200 dark:border-amber-800 p-4 bg-white dark:bg-midnight shadow-sm">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{ticket.client?.nom || `Client #${ticket.id_client}`}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Ticket: {ticket.titre || ticket.description?.substring(0, 40) || 'No title'}</p>
                                                <p className="text-xs text-amber-600 dark:text-amber-300">Balance: {Number(ticket.client?.money ?? 0).toFixed(2)} DT</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                {loading ? (
                                    <div className="p-8 space-y-4">
                                        {[...Array(4)].map((_, idx) => (
                                            <div key={`ticket-skeleton-${idx}`} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : tickets.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3 block">inbox</span>
                                        <p className="text-slate-500">No tickets match this search.</p>
                                    </div>
                                ) : (
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-midnight">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ticket ID</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Client</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Title</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Created</th>
                                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {tickets.map((ticket) => (
                                                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">#{String(ticket.id).slice(0, 8)}</td>
                                                    <td className="px-6 py-4 text-sm font-semibold">{ticket.client?.nom || `Client #${ticket.id_client}`}</td>
                                                    <td className="px-6 py-4 text-sm font-medium">{ticket.titre || ticket.description?.substring(0, 40)}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClasses(ticket.status)}`}>
                                                            {ticket.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">{new Date(ticket.created_at).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button 
                                                                onClick={() => handleViewTicketDetail(ticket.id)}
                                                                className="text-[10px] font-black uppercase text-slate-500 hover:underline hover:text-slate-800 dark:hover:text-white tracking-widest transition-all"
                                                            >
                                                                VIEW
                                                            </button>
                                                            <button 
                                                                onClick={() => openAssignModal(ticket)}
                                                                className="text-[10px] font-black uppercase text-primary hover:underline hover:text-primary/80 tracking-widest transition-all"
                                                            >
                                                                ASSIGN
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {ticketTotalPages > 1 && (
                                <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Page {ticketPage} of {ticketTotalPages}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTicketPage((prev) => Math.max(1, prev - 1))}
                                            disabled={ticketPage === 1}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            onClick={() => setTicketPage((prev) => Math.min(ticketTotalPages, prev + 1))}
                                            disabled={ticketPage >= ticketTotalPages}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
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

                            <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Client Directory</p>
                                    <p className="text-xs text-slate-500">Search by name, email, or CIN.</p>
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                    <input
                                        value={clientSearch}
                                        onChange={(e) => {
                                            setClientSearch(e.target.value);
                                            setClientPage(1);
                                        }}
                                        placeholder="Search clients..."
                                        className="w-full sm:w-64 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Client profile cards */}
                            {loading && clientUsers.length === 0 && (
                                <div className="grid grid-cols-1 gap-4">
                                    {[...Array(3)].map((_, idx) => (
                                        <div key={`client-skeleton-${idx}`} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
                                    ))}
                                </div>
                            )}

                            {!loading && clientUsers.map(client => {
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
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    value={balanceOperation}
                                                                    onChange={e => setBalanceOperation(e.target.value)}
                                                                    className="px-2 py-1.5 text-sm font-bold border border-primary rounded-lg focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white dark:bg-midnight bg-white"
                                                                >
                                                                    <option value="set">Set to</option>
                                                                    <option value="add">Add</option>
                                                                    <option value="subtract">Subtract</option>
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={balanceDraft}
                                                                    onChange={e => setBalanceDraft(e.target.value)}
                                                                    placeholder="0.00"
                                                                    className="w-20 px-3 py-1.5 text-sm font-bold border border-primary rounded-lg focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white dark:bg-midnight bg-white"
                                                                    autoFocus
                                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBalance(client.id); if (e.key === 'Escape') setEditingBalanceId(null); }}
                                                                />
                                                                <span className="text-sm text-slate-500 font-bold">DT</span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <button onClick={() => handleSaveBalance(client.id)} className="flex-1 size-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-colors">
                                                                    <span className="material-symbols-outlined text-lg">check</span>
                                                                </button>
                                                                <button onClick={() => setEditingBalanceId(null)} className="flex-1 size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                                                                    <span className="material-symbols-outlined text-lg">close</span>
                                                                </button>
                                                            </div>
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{openCount} OPEN</span>
                                                            {clientTickets.length > 0 && (
                                                                <button
                                                                    onClick={() => setSelectedClientHistory(client)}
                                                                    className="text-[10px] font-bold px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">history</span>
                                                                    View All History
                                                                </button>
                                                            )}
                                                        </div>
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
                                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadgeClasses(t.status)}`}>{t.status}</span>
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

                            {!loading && clientUsers.length === 0 && (
                                <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
                                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">group_off</span>
                                    <p className="text-slate-400 mt-4 font-medium">No clients registered yet.</p>
                                </div>
                            )}

                            {clientTotalPages > 1 && (
                                <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Page {clientPage} of {clientTotalPages}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setClientPage((prev) => Math.max(1, prev - 1))}
                                            disabled={clientPage === 1}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            onClick={() => setClientPage((prev) => Math.min(clientTotalPages, prev + 1))}
                                            disabled={clientPage >= clientTotalPages}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
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
                                {loading ? (
                                    <div className="p-8 space-y-4">
                                        {[...Array(4)].map((_, idx) => (
                                            <div key={`log-skeleton-${idx}`} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : tickets.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3 block">history</span>
                                        <p className="text-slate-500">No logs recorded yet.</p>
                                    </div>
                                ) : (
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
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Ticket Detail Modal */}
            {selectedTicketDetail && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-midnight-accent rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight-accent flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">confirmation_number</span>
                                Ticket Details - #{String(selectedTicketDetail.id).slice(0, 8)}
                            </h2>
                            <button
                                onClick={() => setSelectedTicketDetail(null)}
                                className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        {ticketDetailLoading ? (
                            <div className="p-8 text-center">
                                <span className="material-symbols-outlined text-4xl animate-spin mx-auto block mb-3 text-primary">settings</span>
                                <p className="text-slate-500">Loading ticket details...</p>
                            </div>
                        ) : (
                            <div className="p-6 space-y-6">
                                {/* Basic Information */}
                                <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">info</span>
                                        Basic Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Ticket ID</p>
                                            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">#{selectedTicketDetail.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${getStatusBadgeClasses(selectedTicketDetail.status)}`}>
                                                {selectedTicketDetail.status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Title</p>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTicketDetail.titre || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Priority</p>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{selectedTicketDetail.priority || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">description</span>
                                        Description
                                    </h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedTicketDetail.description || 'No description provided'}</p>
                                </div>

                                {selectedTicketDetail.image && (
                                    <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">image</span>
                                            Uploaded Image
                                        </h3>
                                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/5">
                                            <img
                                                src={selectedTicketDetail.image}
                                                alt={`Attachment for ticket #${selectedTicketDetail.id}`}
                                                className="w-full max-h-80 object-contain bg-slate-100 dark:bg-slate-900"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">This attachment was uploaded by the client when the ticket was created.</p>
                                    </div>
                                )}

                                <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">chat_bubble</span>
                                        Conversation
                                    </h3>
                                    {ticketMessagesLoading ? (
                                        <div className="text-sm text-slate-500">Loading conversation...</div>
                                    ) : selectedTicketMessages.length === 0 ? (
                                        <div className="text-sm text-slate-500">No conversation found yet for this ticket.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedTicketMessages.map((msg) => (
                                                <div key={msg.id} className={`rounded-2xl p-4 ${msg.sender_type === 'client' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10 dark:bg-primary/20'} `}>
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{msg.sender?.name || msg.sender_type}</p>
                                                        <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{msg.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Client Information */}
                                {selectedTicketDetail.client && (
                                    <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">person</span>
                                            Client Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Company</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTicketDetail.client.nom || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.client.mail || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">CIN</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.client.cin || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Code Fiscal</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.client.code_fiscal || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Employee Assignment */}
                                <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                    <div className="flex items-center justify-between gap-3 mb-4">
                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">engineering</span>
                                            Assigned Employee
                                        </h3>
                                        <button
                                            onClick={() => openAssignModal(selectedTicketDetail)}
                                            className="px-3 py-2 rounded-lg bg-primary hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider transition-colors"
                                        >
                                            Assign / Reassign
                                        </button>
                                    </div>
                                    {selectedTicketDetail.employee ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Employee Name</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTicketDetail.employee.nom || 'Unassigned'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.employee.mail || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Rating</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">⭐ {(Number(selectedTicketDetail.employee.avg_rating) || 0).toFixed(1)}/5</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Avg Resolution Time</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{(Number(selectedTicketDetail.employee.avg_resolution_hours) || 0).toFixed(1)}h</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">This ticket is not assigned yet.</p>
                                    )}
                                </div>

                                {/* Timeline Information */}
                                <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">schedule</span>
                                        Timeline
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Created At</p>
                                            <p className="text-sm text-slate-900 dark:text-white">{new Date(selectedTicketDetail.created_at).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Updated At</p>
                                            <p className="text-sm text-slate-900 dark:text-white">{new Date(selectedTicketDetail.updated_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Machine Information (if available) */}
                                {selectedTicketDetail.machine && (
                                    <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">devices</span>
                                            Machine Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Machine ID</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.machine.id || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Model</p>
                                                <p className="text-sm text-slate-900 dark:text-white">{selectedTicketDetail.machine.model || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rating Information */}
                                {selectedTicketDetail.rating && (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                                        <h3 className="font-bold text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                                            <span className="material-symbols-outlined">star</span>
                                            Client Rating
                                        </h3>
                                        <div className="flex items-center gap-4">
                                            <span className="text-4xl font-black text-emerald-600">⭐ {selectedTicketDetail.rating}</span>
                                            <p className="text-sm text-emerald-700 dark:text-emerald-200">Rated by client</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-midnight/50 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedTicketDetail(null)}
                                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Ticket History Modal */}
            {selectedClientHistory && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-midnight-accent rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight-accent flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">history</span>
                                Ticket History - {selectedClientHistory.nom || selectedClientHistory.name}
                            </h2>
                            <button
                                onClick={() => setSelectedClientHistory(null)}
                                className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            {/* Client Summary */}
                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 mb-6">
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Client Name</p>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedClientHistory.nom || selectedClientHistory.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                                        <p className="text-sm text-slate-900 dark:text-white">{selectedClientHistory.mail || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">CIN</p>
                                        <p className="text-sm text-slate-900 dark:text-white">{selectedClientHistory.cin || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Tickets</p>
                                        <p className="text-2xl font-bold text-primary">{tickets.filter(t => t.id_client === selectedClientHistory.id || t.client?.id === selectedClientHistory.id).length}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tickets Table */}
                            {(() => {
                                const clientTickets = tickets.filter(t => t.id_client === selectedClientHistory.id || t.client?.id === selectedClientHistory.id);
                                return clientTickets.length === 0 ? (
                                    <div className="text-center py-8">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">inbox</span>
                                        <p className="text-slate-400 mt-4 font-medium">No tickets found for this client.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 dark:bg-midnight">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Ticket ID</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Title</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Priority</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Assigned To</th>
                                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Created</th>
                                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {clientTickets.map((ticket) => (
                                                    <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">#{String(ticket.id).slice(0, 8)}</td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{ticket.titre || ticket.description?.substring(0, 40)}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClasses(ticket.status)}`}>
                                                                {ticket.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm capitalize font-medium text-slate-600 dark:text-slate-400">
                                                            {ticket.priority || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                            {ticket.employee?.nom || 'Unassigned'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">{new Date(ticket.created_at).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => {
                                                                    handleViewTicketDetail(ticket.id);
                                                                    setSelectedClientHistory(null);
                                                                }}
                                                                className="text-[10px] font-black uppercase text-primary hover:underline hover:text-primary/80 tracking-widest transition-all"
                                                            >
                                                                VIEW
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-midnight/50 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedClientHistory(null)}
                                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Ticket Modal */}
            {showAssignModal && assignTicket && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-midnight-accent rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight-accent flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">manage_accounts</span>
                                    Assign Ticket
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Ticket #{String(assignTicket.id).slice(0, 8)} · {assignTicket.titre || 'Untitled ticket'}</p>
                            </div>
                            <button
                                onClick={closeAssignModal}
                                className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {assignError && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
                                    {assignError}
                                </div>
                            )}

                            <div className="rounded-xl bg-slate-50 dark:bg-midnight p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Current Assignment</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    {assignTicket.employee?.nom || assignTicket.employee?.name || 'Unassigned'}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">groups</span>
                                    Select Employee
                                </h3>
                                {employeesLoading ? (
                                    <div className="p-6 text-center text-sm text-slate-500">Loading employees...</div>
                                ) : employees.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-slate-500">No employees available to assign.</div>
                                ) : (
                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                        {employees.map((employee) => {
                                            const employeeId = String(employee.id);
                                            const isSelected = selectedEmployeeId === employeeId;
                                            return (
                                                <button
                                                    key={employee.id}
                                                    onClick={() => setSelectedEmployeeId(employeeId)}
                                                    className={`w-full text-left rounded-2xl border p-4 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-bold text-slate-900 dark:text-white">{employee.nom || employee.name || `Employee #${employee.id}`}</p>
                                                                {isSelected && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">Selected</span>}
                                                            </div>
                                                            <p className="text-sm text-slate-500 mt-1">{employee.mail || employee.email || 'No email'}</p>
                                                            <p className="text-xs text-slate-400 mt-1">Workload: {employee.current_workload ?? 0} · Rating: {(Number(employee.avg_rating) || 0).toFixed(1)}/5</p>
                                                        </div>
                                                        <span className={`size-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                                            {isSelected && <span className="size-2.5 rounded-full bg-white"></span>}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-midnight/50 flex justify-end gap-3">
                            <button
                                onClick={closeAssignModal}
                                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignTicket}
                                disabled={!selectedEmployeeId || assigningTicketId === assignTicket.id}
                                className="px-4 py-2 rounded-lg bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                            >
                                {assigningTicketId === assignTicket.id ? 'Assigning...' : 'Assign Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
