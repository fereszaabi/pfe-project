import { useState, useEffect, useRef } from 'react';
import { getClientTickets, createTicket, rateEmployee, getMachines, getUnreadMessages, askSupportBot, getClientProfile } from '../../services/api';

export function ClientDashboard({ user, onViewTicket, onLogout, onNavigate, activeView }) {
    const promptedRatingTicketsRef = useRef(new Set());
    const supportMessagesEndRef = useRef(null);
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [showSupportChat, setShowSupportChat] = useState(false);
    const [supportInput, setSupportInput] = useState('');
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [supportMessages, setSupportMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hi! I am ID Soft AI Quick Support. Tell me what issue you are facing and I will help you troubleshoot it.',
        },
    ]);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [machines, setMachines] = useState([]);
    const [loadingMachines, setLoadingMachines] = useState(false);
    const [createNewMachine, setCreateNewMachine] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [ratingTicket, setRatingTicket] = useState(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [ratingError, setRatingError] = useState('');
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [clientBalance, setClientBalance] = useState(Number(user?.money ?? 0));
    const [showPayLaterConfirm, setShowPayLaterConfirm] = useState(false);
    const [pendingPriority, setPendingPriority] = useState(null);
    const [allowPayLaterSubmit, setAllowPayLaterSubmit] = useState(false);
    const [newTicket, setNewTicket] = useState({
        titre: '',
        description: '',
        machine_id: '',
        code_anydesk: '',
        priority: 'low',
        image: null
    });

    const priorityFees = { low: 10, medium: 20, high: 25, urgent: 30 };

    const getSelectedPriorityCost = (priority) => Number(priorityFees[priority] ?? 0);

    const hasInsufficientFundsForPriority = (priority) => {
        const fee = getSelectedPriorityCost(priority);
        return Number(clientBalance) < fee;
    };

    const handlePriorityChange = (priority) => {
        if (!priority) return;

        if (hasInsufficientFundsForPriority(priority)) {
            setPendingPriority(priority);
            setShowPayLaterConfirm(true);
            return;
        }

        setAllowPayLaterSubmit(false);
        setNewTicket((prev) => ({ ...prev, priority }));
        setSubmitError('');
    };

    useEffect(() => {
        let isMounted = true;

        const fetchTickets = async (showLoader = false) => {
            if (showLoader) {
                setLoadingTickets(true);
            }
            try {
                const data = await getClientTickets();
                if (isMounted) {
                    setTickets(data.demandes?.data ?? data.demandes ?? []);
                }
            } catch (_) {
                if (isMounted) {
                    setTickets([]);
                }
            } finally {
                if (showLoader && isMounted) {
                    setLoadingTickets(false);
                }
            }
        };

        fetchTickets(true);
        const intervalId = setInterval(() => fetchTickets(false), 5000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [supportMessages, showSupportChat]);

    useEffect(() => {
        if (!showSupportChat) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowSupportChat(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showSupportChat]);

    useEffect(() => {
        if (showCreateTicket) {
            setLoadingMachines(true);
            Promise.all([getMachines(), getClientProfile().catch(() => null)])
                .then(([machineData, profileData]) => {
                    setMachines(machineData?.machines ?? []);

                    const balance = Number(profileData?.profile?.money ?? profileData?.money ?? NaN);
                    if (!Number.isNaN(balance)) {
                        setClientBalance(balance);
                    }
                })
                .catch(() => setMachines([]))
                .finally(() => setLoadingMachines(false));
        }
    }, [showCreateTicket]);

    useEffect(() => {
        if (ratingTicket) {
            return;
        }

        const ticketNeedingRating = tickets.find(
            (ticket) =>
                ['resolved', 'closed'].includes(ticket.status) &&
                !ticket.client_rating &&
                !promptedRatingTicketsRef.current.has(ticket.id)
        );

        if (ticketNeedingRating) {
            promptedRatingTicketsRef.current.add(ticketNeedingRating.id);
            setRatingTicket(ticketNeedingRating);
            setRatingValue(0);
            setRatingComment('');
            setRatingError('');
        }
    }, [tickets, ratingTicket]);

    useEffect(() => {
        let isMounted = true;

        const fetchUnread = async () => {
            try {
                const data = await getUnreadMessages();
                if (isMounted) {
                    setUnreadMessagesCount(Number(data?.total_unread ?? 0));
                }
            } catch (_) {}
        };

        fetchUnread();
        const intervalId = setInterval(fetchUnread, 5000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) setNewTicket({ ...newTicket, image: file });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        const selectedPriorityCost = getSelectedPriorityCost(newTicket.priority);
        if (hasInsufficientFundsForPriority(newTicket.priority) && !allowPayLaterSubmit) {
            setPendingPriority(newTicket.priority);
            setShowPayLaterConfirm(true);
            setSubmitError(`Insufficient funds for ${newTicket.priority} priority (${selectedPriorityCost} DT). Confirm pay later to continue.`);
            return;
        }
        
        // Validate machine selection
        if (!createNewMachine && !newTicket.machine_id) {
            setSubmitError('Please select an existing machine or create a new one');
            return;
        }
        if (createNewMachine && !newTicket.code_anydesk.trim()) {
            setSubmitError('Please enter the AnyDesk code for the new machine');
            return;
        }

        const fd = new FormData();
        fd.append('titre', newTicket.titre);
        fd.append('description', newTicket.description);
        if (createNewMachine) {
            fd.append('code_anydesk', newTicket.code_anydesk);
        } else {
            fd.append('machine_id', newTicket.machine_id);
        }
        fd.append('priority', newTicket.priority);
        if (newTicket.image) fd.append('image', newTicket.image);
        try {
            await createTicket(fd);
            const data = await getClientTickets();
            setTickets(data.demandes?.data ?? data.demandes ?? []);
            setNewTicket({ titre: '', description: '', machine_id: '', code_anydesk: '', priority: 'low', image: null });
            setCreateNewMachine(false);
            setShowCreateTicket(false);
            setAllowPayLaterSubmit(false);

            const profileData = await getClientProfile().catch(() => null);
            const refreshedBalance = Number(profileData?.profile?.money ?? profileData?.money ?? NaN);
            if (!Number.isNaN(refreshedBalance)) {
                setClientBalance(refreshedBalance);
            }
        } catch (err) {
            if (err?.message === 'Unauthenticated.') {
                setSubmitError('Session expired. Please sign in again.');
                await onLogout?.();
                return;
            }

            const msg = err?.errors
                ? Object.values(err.errors).flat().join(' ')
                : err?.message || 'Failed to submit ticket.';
            setSubmitError(msg);
        }
    };

    const handleSubmitRating = async () => {
        if (!ratingTicket || ratingValue === 0) return;

        setIsSubmittingRating(true);
        setRatingError('');
        try {
            const response = await rateEmployee(
                ratingTicket.id,
                ratingValue,
                ratingComment.trim()
            );
            const updatedTicket = response?.ticket;

            if (updatedTicket?.id) {
                setTickets((prev) =>
                    prev.map((ticket) =>
                        ticket.id === updatedTicket.id ? { ...ticket, ...updatedTicket } : ticket
                    )
                );
            } else {
                const data = await getClientTickets();
                setTickets(data.demandes?.data ?? data.demandes ?? []);
            }

            setRatingTicket(null);
            setRatingValue(0);
            setRatingComment('');
        } catch (err) {
            const message = err?.message || 'Failed to submit rating.';
            setRatingError(message);
        } finally {
            setIsSubmittingRating(false);
        }
    };

    const handleSendSupportMessage = async () => {
        const trimmed = supportInput.trim();
        if (!trimmed || isBotReplying) return;

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
        };

        setSupportMessages((prev) => [...prev, userMsg]);
        setSupportInput('');
        setIsBotReplying(true);

        try {
            const history = [...supportMessages, userMsg]
                .slice(-12)
                .map((m) => ({ role: m.role, content: m.content }));

            const response = await askSupportBot(trimmed, history);
            const botReply = response?.reply || 'I could not generate a response right now. Please try again.';

            setSupportMessages((prev) => [
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: botReply,
                },
            ]);
        } catch (err) {
            const errorMessage = err?.message || 'ID Soft AI Quick Support is temporarily unavailable. Please try again later.';
            setSupportMessages((prev) => [
                ...prev,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content: errorMessage,
                },
            ]);
        } finally {
            setIsBotReplying(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'submitted':
            case 'open':
                return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
            case 'assigned':
                return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
            case 'in-progress':
                return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
            case 'resolved':
                return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
            case 'escalated':
                return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
        }
    };

    const userTickets = tickets;
    const activeTickets = userTickets.filter(t => ['submitted', 'open', 'assigned', 'in-progress', 'in progress'].includes(t.status)).length;
    const resolvedTickets = userTickets.filter(t => t.status === 'resolved').length;

    return (
        <div className="flex h-screen overflow-hidden">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar */}
            <aside className="w-64 bg-midnight text-slate-300 flex flex-col border-r border-border-dark">
                <div className="p-6 flex items-center gap-3">
                    <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined">shield_person</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-none">IDSoft</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">After-Sales</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <button
                        onClick={() => onNavigate?.('dashboard')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeView === 'dashboard' ? 'bg-surface-dark text-white shadow-sm' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button
                        onClick={() => onNavigate?.('profile')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeView === 'profile' ? 'bg-surface-dark text-white shadow-sm' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">person</span>
                        <span className="text-sm font-medium">Profile</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-rose-900/20 hover:text-rose-400 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark overflow-y-auto">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md z-10">
                    <h2 className="text-lg font-semibold">Support Tickets</h2>
                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadMessagesCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white rounded-full ring-2 ring-white dark:ring-background-dark text-[10px] font-bold leading-[14px] flex items-center justify-center">
                                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                </span>
                            )}
                        </button>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
                        <div className="flex items-center gap-3 cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold">{user.name}</p>
                                <p className="text-xs text-slate-500">Client Account</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <img alt="User Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRLSpCqomHJlvLCdC7DdVv4DhkByy5UF1rRIynacvm1evNeBwoaKKQrCKDgH6puwDV4-eTMWC6Y5DY3NqGE31WVNeAo-AUDmHVsfXEq7khNZq1dchYKuOmKTNy0rZBQmpFshJ0Dka44QcbMAIPhH7E6yUHMNKdt4nwU7VarURIg0oyf_uHK9uxKFI-PLDcVpP9yRYPsm3uwt3fppPk-UT1ljHR8YDzBIGtKjW2J2CkrxTfz5nw9Ld4s9mRasZtZ48YxQGb5_5kkmg" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full">
                    {/* Welcome Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Dashboard Overview</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back, {user.name}. Here's what's happening today.</p>
                        </div>
                        <button
                            onClick={() => setShowCreateTicket(!showCreateTicket)}
                            className="bg-primary hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
                        >
                            <span className="material-symbols-outlined">add_circle</span>
                            Create New Ticket
                        </button>
                    </div>

                    {/* High-Level Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                <span className="material-symbols-outlined text-3xl">confirmation_number</span>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Tickets</p>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{activeTickets}</h3>
                                <p className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                                    <span className="material-symbols-outlined text-xs">trending_up</span> This week
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                                <span className="material-symbols-outlined text-3xl">check_circle</span>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Resolved</p>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{resolvedTickets}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">All time</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-primary to-orange-600 p-6 rounded-xl relative overflow-hidden shadow-lg shadow-primary/20">
                            <div className="relative z-10 flex flex-col justify-between h-full">
                                <div>
                                    <p className="text-white/80 text-sm font-medium">Need Help?</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">ID Soft AI Quick Support</h3>
                                </div>
                                <button
                                    onClick={() => setShowSupportChat(true)}
                                    className="mt-4 w-full py-2 bg-white text-primary font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Start AI Chat
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Create Ticket Form */}
                    {showCreateTicket && (
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-8">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">edit_note</span>
                                    <h3 className="font-bold text-lg">Create New Ticket</h3>
                                </div>
                                <button
                                    onClick={() => setShowCreateTicket(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {submitError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                        {submitError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Ticket Title
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newTicket.titre}
                                        onChange={(e) => setNewTicket({ ...newTicket, titre: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                        placeholder="Brief description of your issue"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        required
                                        rows="4"
                                        value={newTicket.description}
                                        onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                        placeholder="Provide detailed information about your issue..."
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Machine
                                        </label>
                                        {createNewMachine ? (
                                            <input
                                                type="text"
                                                required
                                                value={newTicket.code_anydesk}
                                                onChange={(e) => setNewTicket({ ...newTicket, code_anydesk: e.target.value })}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                placeholder="Enter AnyDesk code"
                                            />
                                        ) : (
                                            <select
                                                required={!createNewMachine}
                                                value={newTicket.machine_id}
                                                onChange={(e) => setNewTicket({ ...newTicket, machine_id: e.target.value })}
                                                disabled={loadingMachines}
                                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white disabled:opacity-50"
                                            >
                                                <option value="">Select a registered machine...</option>
                                                {machines.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.code_anydesk || m.nom_poste}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCreateNewMachine(!createNewMachine);
                                                setNewTicket({ ...newTicket, machine_id: '', code_anydesk: '' });
                                            }}
                                            className="mt-2 text-sm text-primary hover:text-orange-600 font-medium flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-sm">
                                                {createNewMachine ? 'arrow_back' : 'add'}
                                            </span>
                                            {createNewMachine ? 'Select Existing Machine' : 'Add New Machine'}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Priority
                                        </label>
                                        <select
                                            value={newTicket.priority}
                                            onChange={(e) => handlePriorityChange(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                        >
                                            <option value="low">Low — 10 DT</option>
                                            <option value="medium">Medium — 20 DT</option>
                                            <option value="high">High — 25 DT</option>
                                            <option value="urgent">Urgent — 30 DT</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Photo Upload */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Attach Photo <span className="text-slate-400 font-normal">(optional)</span>
                                    </label>
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageChange}
                                        />
                                        {newTicket.image ? (
                                            <div className="flex items-center gap-3 text-primary">
                                                <span className="material-symbols-outlined text-3xl">image</span>
                                                <div>
                                                    <p className="text-sm font-semibold">{newTicket.image.name}</p>
                                                    <p className="text-xs text-slate-500">{(newTicket.image.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <span
                                                    onClick={(e) => { e.preventDefault(); setNewTicket({ ...newTicket, image: null }); }}
                                                    className="material-symbols-outlined text-slate-400 hover:text-red-500 cursor-pointer ml-2"
                                                >close</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                                                <p className="text-sm font-medium">Click to upload a photo</p>
                                                <p className="text-xs">PNG, JPG, WEBP up to 10MB</p>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {hasInsufficientFundsForPriority(newTicket.priority) && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                                        Insufficient funds for this priority ({getSelectedPriorityCost(newTicket.priority)} DT). You can continue now and pay later after admin review.
                                    </div>
                                )}

                                {/* Fee Summary */}
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">payments</span>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Service Fee</p>
                                            <p className="text-xs text-slate-500">Based on selected priority level</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-primary">{priorityFees[newTicket.priority]} <span className="text-sm font-semibold">DT</span></p>
                                        <p className="text-xs text-slate-500 capitalize">{newTicket.priority} priority</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateTicket(false)}
                                        className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                                    >
                                        Submit Ticket
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Recent Tickets Table */}
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">My Support Tickets</h3>
                            {userTickets.length > 0 && (
                                <span className="text-sm text-slate-500">{userTickets.length} total</span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            {userTickets.length === 0 ? (
                                <div className="p-12 text-center">
                                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4 block">
                                        confirmation_number
                                    </span>
                                    <p className="text-slate-500 dark:text-slate-400 mb-4">No tickets yet</p>
                                    <button
                                        onClick={() => setShowCreateTicket(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Create Your First Ticket
                                    </button>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold">ID</th>
                                            <th className="px-6 py-4 font-semibold">Title</th>
                                            <th className="px-6 py-4 font-semibold">Status</th>
                                            <th className="px-6 py-4 font-semibold">Priority</th>
                                            <th className="px-6 py-4 font-semibold">Last Update</th>
                                            <th className="px-6 py-4 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {userTickets.map((ticket) => (
                                            <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-300">
                                                    #{ticket.id}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300">
                                                    {ticket.titre || ticket.description?.substring(0, 50)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(ticket.status)}`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm capitalize text-slate-600 dark:text-slate-400">
                                                        {ticket.priority}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(ticket.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                    {ticket.status === 'resolved' && !ticket.client_rating ? (
                                                        <button
                                                            onClick={() => {
                                                                setRatingTicket(ticket);
                                                                setRatingValue(0);
                                                                setRatingComment('');
                                                                setRatingError('');
                                                            }}
                                                            className="text-amber-500 hover:text-amber-600 transition-colors flex items-center gap-1"
                                                            title="Rate this service"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">star</span>
                                                        </button>
                                                    ) : ticket.status === 'resolved' && ticket.client_rating ? (
                                                        <div className="flex items-center gap-1">
                                                            {[...Array(5)].map((_, i) => (
                                                                <span key={i} className="material-symbols-outlined text-sm" style={{ color: i < ticket.client_rating ? '#fbbf24' : '#cbd5e1' }}>
                                                                    star
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => onViewTicket(ticket.id)}
                                                            className="text-slate-500 hover:text-primary transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Rating Modal */}
            {ratingTicket && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setRatingTicket(null); setRatingError(''); }}>
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rate Your Experience</h3>
                            <button onClick={() => { setRatingTicket(null); setRatingError(''); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {ratingError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                    {ratingError}
                                </div>
                            )}

                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">How satisfied are you with the support provided?</p>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setRatingValue(star)}
                                            className="transition-transform hover:scale-110"
                                        >
                                            <span
                                                className="material-symbols-outlined text-4xl cursor-pointer"
                                                style={{
                                                    color: star <= ratingValue ? '#fbbf24' : '#cbd5e1',
                                                    transition: 'color 0.2s'
                                                }}
                                            >
                                                star
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {ratingValue > 0 && (
                                    <p className="text-center mt-2 text-sm font-medium text-slate-900 dark:text-white">
                                        {ratingValue} out of 5 stars
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Additional Comment (optional)
                                </label>
                                <textarea
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    placeholder="Share your feedback..."
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white placeholder-slate-400"
                                    rows="3"
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setRatingTicket(null);
                                        setRatingError('');
                                    }}
                                    className="px-6 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitRating}
                                    disabled={isSubmittingRating || ratingValue === 0}
                                    className="px-6 py-2 bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">star</span>
                                    Submit Rating
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSupportChat && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSupportChat(false)}>
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">ID Soft AI Quick Support</h3>
                                <p className="text-xs text-slate-500">Powered by ID Soft AI assistant</p>
                            </div>
                            <button onClick={() => setShowSupportChat(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="h-[420px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                            {supportMessages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isBotReplying && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-500">
                                        Assistant is typing...
                                    </div>
                                </div>
                            )}
                            <div ref={supportMessagesEndRef} />
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                            <input
                                type="text"
                                value={supportInput}
                                onChange={(e) => setSupportInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendSupportMessage();
                                    }
                                }}
                                placeholder="Describe your issue..."
                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                            />
                            <button
                                onClick={handleSendSupportMessage}
                                disabled={isBotReplying || !supportInput.trim()}
                                className="px-4 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPayLaterConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowPayLaterConfirm(false)}>
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                            <span className="material-symbols-outlined text-amber-500">warning</span>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Insufficient Funds</h3>
                        </div>
                        <div className="p-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                            <p>
                                This priority requires <strong>{getSelectedPriorityCost(pendingPriority || newTicket.priority)} DT</strong>,
                                but your current balance is <strong>{Number(clientBalance).toFixed(3)} DT</strong>.
                            </p>
                            <p>Would you like to continue and pay later?</p>
                        </div>
                        <div className="px-5 pb-5 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowPayLaterConfirm(false);
                                    setPendingPriority(null);
                                    setAllowPayLaterSubmit(false);
                                }}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Choose Different Priority
                            </button>
                            <button
                                onClick={() => {
                                    const nextPriority = pendingPriority || newTicket.priority;
                                    setNewTicket((prev) => ({ ...prev, priority: nextPriority }));
                                    setAllowPayLaterSubmit(true);
                                    setShowPayLaterConfirm(false);
                                    setPendingPriority(null);
                                    setSubmitError('You chose to continue with pay-later. Admin will be notified about your debt status.');
                                }}
                                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                            >
                                Continue & Pay Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}