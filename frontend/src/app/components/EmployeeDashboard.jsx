import { useState, useEffect, useMemo, useRef } from 'react';
import { Ticket, Users, Clock, CheckCircle, AlertTriangle, LogOut, User, Filter, Search, Send, Star } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getEmployeeTickets, assignTicket, claimTicket, unclaimTicket, updateEmployeeTicket, sendMessage, startConversation, getEmployeeStats, getTicketMessages, getUnreadMessages, getConversations, verifyClaimOtp } from '../../services/api';
import { getEcho } from '../../services/realtime';

export function EmployeeDashboard({ user, onLogout, onNavigate, activeView }) {
    // Derive backend base from Vite env so image URLs work across environments.
    const BACKEND_BASE_URL = (import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketImageError, setTicketImageError] = useState(false);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [allTickets, setAllTickets] = useState([]);
    const [myTickets, setMyTickets] = useState([]);
    const [unassignedTickets, setUnassignedTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ticketsError, setTicketsError] = useState('');
    const [employeeStats, setEmployeeStats] = useState(null);
    const [messageText, setMessageText] = useState('');
    const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
    const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(false);
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketTotalPages, setTicketTotalPages] = useState(1);
    const ticketPerPage = 10;
    const [conversationMessages, setConversationMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [actionLoading, setActionLoading] = useState({});
    const [showClaimOtpModal, setShowClaimOtpModal] = useState(false);
    const [claimOtpCode, setClaimOtpCode] = useState('');
    const [claimOtpId, setClaimOtpId] = useState(null);
    const [claimOtpTicketId, setClaimOtpTicketId] = useState(null);
    const [claimOtpError, setClaimOtpError] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const messagesEndRef = useRef(null);
    const isFetchingMessagesRef = useRef(false);

    const isMessageFromCurrentEmployee = (msg) => {
        return msg?.sender_type === 'employee' || msg?.sender?.email === user?.email;
    };

    const resolveTicketImageUrl = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') {
            return '';
        }

        const normalizedInput = imagePath.trim().replace(/\\/g, '/');

        if (/^https?:\/\//i.test(normalizedInput) || normalizedInput.startsWith('data:') || normalizedInput.startsWith('blob:')) {
            return normalizedInput;
        }

        if (normalizedInput.startsWith('/')) {
            return `${BACKEND_BASE_URL}${normalizedInput}`;
        }

        const normalizedPath = normalizedInput
            .replace(/^\.\//, '')
            .replace(/^storage\/app\/public\//, '')
            .replace(/^public\//, '')
            .replace(/^storage\//, '')
            .replace(/^\/+/, '');

        return `${BACKEND_BASE_URL}/storage/${normalizedPath}`;
    };

    useEffect(() => {
        setTicketImageError(false);
        setIsImagePreviewOpen(false);
    }, [selectedTicket?.id, selectedTicket?.image]);

    const showToast = (type, message) => {
        setToast({ type, message, id: Date.now() });
    };

    const fetchTickets = async (options = {}) => {
        const { silent = false } = options;
        if (!silent) {
            setLoading(true);
        }
        setTicketsError('');
        try {
            const [data, stats] = await Promise.all([
                getEmployeeTickets({
                    per_page: ticketPerPage,
                    page: ticketPage,
                    search: debouncedSearchQuery,
                    status: filterStatus === 'all' ? '' : filterStatus,
                }),
                getEmployeeStats(),
            ]);
            setAllTickets(data.all_tickets?.data ?? data.all_tickets ?? []);
            setMyTickets(data.my_tickets?.data ?? data.my_tickets ?? []);
            setUnassignedTickets(data.unassigned_tickets?.data ?? data.unassigned_tickets ?? []);
            setTicketTotalPages(data.all_tickets?.last_page ?? data.all_tickets?.pagination?.total_pages ?? 1);
            setEmployeeStats(stats);
        } catch (err) {
            console.error('Failed to fetch employee tickets:', err);
            setAllTickets([]);
            setMyTickets([]);
            setUnassignedTickets([]);
            setTicketsError('Failed to load tickets. Please retry.');
            setTicketTotalPages(1);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };

    const setActionPending = (key, isPending) => {
        setActionLoading((prev) => ({ ...prev, [key]: isPending }));
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery.trim().toLowerCase());
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    useEffect(() => {
        if (!toast) return;

        const timeoutId = setTimeout(() => {
            setToast(null);
        }, 3500);

        return () => clearTimeout(timeoutId);
    }, [toast]);

    useEffect(() => { fetchTickets(); }, [ticketPage, debouncedSearchQuery, filterStatus]);

    useEffect(() => {
        setTicketPage(1);
    }, [debouncedSearchQuery, filterStatus]);

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

        if (!user?.id) {
            return () => {
                isMounted = false;
            };
        }

        const echo = getEcho();
        const channels = [`user.user.${user.id}`];
        if (user.role === 'employee') {
            channels.push(`user.employee.${user.id}`);
        }

        channels.forEach((channelName) => {
            const channel = echo.private(channelName);
            channel.listen('.ticket.message.created', (event) => {
                if (!event?.message) return;
                setUnreadMessagesCount((prev) => prev + 1);
            });
        });

        return () => {
            isMounted = false;
            channels.forEach((channelName) => echo.leave(channelName));
        };
    }, [user?.id]);

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversationMessages]);

    const fetchConversationMessages = async (ticket, options = {}) => {
        if (!ticket?.id) return;
        const { silent = false } = options;

        if (isFetchingMessagesRef.current) return;
        isFetchingMessagesRef.current = true;

        if (!silent) {
            setLoadingMessages(true);
        }
        try {
            // Fetch messages for this specific ticket
            const messagesResponse = await getTicketMessages(ticket.id);
            const msgs = messagesResponse?.data?.messages || messagesResponse?.messages || [];
            setConversationMessages(Array.isArray(msgs) ? msgs : []);
        } catch (error) {
            console.error('Failed to fetch ticket messages:', error);
            if (!silent) {
                setConversationMessages([]);
            }
        } finally {
            isFetchingMessagesRef.current = false;
            if (!silent) {
                setLoadingMessages(false);
            }
        }
    };

    useEffect(() => {
        if (!selectedTicket?.id) return;

        fetchConversationMessages(selectedTicket);

        const echo = getEcho();
        const channel = echo.private(`ticket.${selectedTicket.id}`);

        channel.listen('.ticket.message.created', (event) => {
            const incoming = event?.message;
            if (!incoming) return;

            setConversationMessages((prev) => {
                if (prev.some((msg) => msg.id === incoming.id)) {
                    return prev;
                }
                return [...prev, incoming];
            });

            if (!isMessageFromCurrentEmployee(incoming)) {
                showToast('success', 'New message received from client.');
            }
        });

        channel.listen('.ticket.updated', (event) => {
            const updatedTicket = event?.ticket;
            if (!updatedTicket) return;
            if (updatedTicket.id !== selectedTicket.id) return;

            const wasAssigned = Boolean(selectedTicket.id_employee);
            const nowAssigned = Boolean(updatedTicket.id_employee);
            const statusChanged = updatedTicket.status && selectedTicket.status && updatedTicket.status !== selectedTicket.status;

            if (!wasAssigned && nowAssigned) {
                showToast('success', 'This ticket has been claimed. Please continue your work.');
            } else if (statusChanged) {
                showToast('success', `Ticket status updated to ${updatedTicket.status}.`);
            } else {
                showToast('success', 'Ticket details were updated.');
            }

            setSelectedTicket((prev) => (prev ? { ...prev, ...updatedTicket } : updatedTicket));
        });

        return () => {
            echo.leave(`ticket.${selectedTicket.id}`);
        };
    }, [selectedTicket?.id]);

    const handleBellClick = async () => {
        try {
            const unreadData = await getUnreadMessages();
            const unreadCount = Number(unreadData?.total_unread ?? 0);
            setUnreadMessagesCount(unreadCount);

            const bestTicket =
                myTickets.find((ticket) => ticket?.client?.id || ticket?.id_client) ||
                allTickets.find((ticket) => ticket?.id_employee && (ticket?.client?.id || ticket?.id_client));

            if (!bestTicket) {
                showToast('warning', 'No ticket chat available yet. Claim a ticket first.');
                return;
            }

            setSelectedTicket(bestTicket);

            // Open chat quickly even before the polling effect runs.
            await fetchConversationMessages(bestTicket);

            if (unreadCount === 0) {
                console.info('No unread messages. Opened your latest ticket chat.');
            }
        } catch (error) {
            console.error('Failed to open notifications:', error);
            showToast('error', 'Unable to load notifications right now.');
        }
    };

    const handleAssignTicket = async (ticketId) => {
        const actionKey = `assign-${ticketId}`;
        setActionPending(actionKey, true);
        try {
            await assignTicket(ticketId);
            await fetchTickets({ silent: true });
            showToast('success', 'Ticket assigned successfully.');
        } catch (_) {
            showToast('error', 'Failed to assign ticket.');
        } finally {
            setActionPending(actionKey, false);
        }
    };

    const handleClaimTicket = async (ticketId) => {
        const actionKey = `claim-${ticketId}`;
        setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
        try {
            const response = await claimTicket(ticketId);
            
            // Check if OTP is required
            if (response?.requires_otp && response?.otp_id) {
                setClaimOtpId(response.otp_id);
                setClaimOtpTicketId(ticketId);
                setClaimOtpCode('');
                setClaimOtpError('');
                setShowClaimOtpModal(true);
                showToast('info', 'OTP has been sent to the admin. Please enter it to confirm ticket acceptance.');
            } else {
                // Direct assignment (legacy flow)
                const ticketData = response?.data || response;
                if (ticketData && ticketData.id) {
                    setSelectedTicket(ticketData);
                    await fetchTickets({ silent: true });
                    showToast('success', 'Ticket claimed. You can start working now.');
                }
            }
        } catch (error) {
            console.error('Failed to claim ticket:', error);
            showToast('error', error?.message || 'Failed to claim ticket.');
        } finally {
            setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
        }
    };

    const handleVerifyClaimOtp = async () => {
        if (!claimOtpCode.trim() || !claimOtpId || !claimOtpTicketId) {
            setClaimOtpError('Please enter the OTP code');
            return;
        }

        setIsVerifyingOtp(true);
        setClaimOtpError('');

        try {
            const response = await verifyClaimOtp(claimOtpTicketId, claimOtpId, claimOtpCode);
            const ticketData = response?.data || response;
            
            if (ticketData && ticketData.id) {
                setShowClaimOtpModal(false);
                setClaimOtpCode('');
                setClaimOtpId(null);
                setClaimOtpTicketId(null);
                setSelectedTicket(ticketData);
                await fetchTickets({ silent: true });
                showToast('success', 'Ticket claimed successfully!');
            }
        } catch (error) {
            console.error('Failed to verify OTP:', error);
            setClaimOtpError(error?.message || 'Invalid OTP code. Please try again.');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const handleUnclaimTicket = async (ticketId) => {
        const actionKey = `unclaim-${ticketId}`;
        setActionPending(actionKey, true);
        try {
            await unclaimTicket(ticketId);
            await fetchTickets({ silent: true });
            setSelectedTicket(null);
            showToast('success', 'Ticket released back to queue.');
        } catch (_) {
            showToast('error', 'Failed to release ticket.');
        } finally {
            setActionPending(actionKey, false);
        }
    };

    const handleContactClient = async (ticket) => {
        try {
            if (ticket.client?.id) {
                await startConversation(ticket.client.id);
                await fetchConversationMessages(ticket);
            }
        } catch (_) {}
    };

    const handleSendMessage = async () => {
        if (!messageText.trim()) {
            showToast('warning', 'Write a message before sending.');
            return;
        }

        if (!selectedTicket?.id) {
            showToast('error', 'No ticket selected.');
            return;
        }

        const recipientId = selectedTicket?.id_client ?? selectedTicket?.client?.id;
        if (!recipientId) {
            showToast('error', 'This ticket has no linked client.');
            return;
        }

        const pendingText = messageText.trim();
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            message: pendingText,
            created_at: new Date().toISOString(),
            sender_type: 'employee',
            sender: { email: user?.email },
        };

        setIsSubmittingMessage(true);
        setConversationMessages((prev) => [...prev, optimisticMessage]);
        setMessageText('');

        try {
            const payload = {
                recipient_id: recipientId,
                recipient_type: 'client',
                message: pendingText,
                ticket_id: selectedTicket.id,
            };

            await sendMessage(payload);
            await fetchConversationMessages(selectedTicket, { silent: true });
            showToast('success', 'Message sent to the client.');
        } catch (error) {
            console.error('Failed to send message - Full error:', error);
            setConversationMessages((prev) => prev.filter((msg) => msg.id !== tempId));
            setMessageText(pendingText);
            const apiMessage = error?.message || error?.error || 'Message failed to send. Please retry.';
            showToast('error', apiMessage);
        } finally {
            setIsSubmittingMessage(false);
        }
    };

    const handleStartWork = async (ticketId) => {
        const actionKey = `start-${ticketId}`;
        setActionPending(actionKey, true);
        try {
            await updateEmployeeTicket(ticketId, { status: 'in progress' });
            await fetchTickets({ silent: true });
            showToast('success', 'Ticket moved to in progress.');
        } catch (_) {
            showToast('error', 'Failed to update ticket status.');
        } finally {
            setActionPending(actionKey, false);
        }
    };

    const handleResolve = async (ticketId) => {
        const actionKey = `resolve-${ticketId}`;
        setActionPending(actionKey, true);
        try {
            await updateEmployeeTicket(ticketId, { status: 'resolved' });
            setSelectedTicket(null);
            await fetchTickets({ silent: true });
            showToast('success', 'Ticket marked as resolved.');
        } catch (_) {
            showToast('error', 'Failed to resolve ticket.');
        } finally {
            setActionPending(actionKey, false);
        }
    };

    const handleEscalate = async (ticketId) => {
        const actionKey = `escalate-${ticketId}`;
        setActionPending(actionKey, true);
        try {
            await updateEmployeeTicket(ticketId, { status: 'escalated' });
            setSelectedTicket(null);
            await fetchTickets({ silent: true });
            showToast('success', 'Ticket escalated to IT.');
        } catch (_) {
            showToast('error', 'Failed to escalate ticket.');
        } finally {
            setActionPending(actionKey, false);
        }
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

    const displayedTickets = useMemo(
        () => (showOnlyMyTickets ? myTickets : allTickets),
        [showOnlyMyTickets, myTickets, allTickets]
    );

    const filteredTickets = useMemo(() => (
        displayedTickets
            .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4))
    ), [displayedTickets, priorityOrder]);

    const stats = useMemo(() => ({
        total: displayedTickets.length,
        submitted: displayedTickets.filter(t => t.status === 'submitted').length,
        inProgress: displayedTickets.filter(t => t.status === 'in progress' || t.status === 'in-progress').length,
        resolved: displayedTickets.filter(t => t.status === 'resolved').length,
    }), [displayedTickets]);

    const avgFirstResponseHours = useMemo(() => {
        const respondedTickets = allTickets.filter(
            (ticket) => ticket?.created_at && ticket?.assigned_at
        );

        if (respondedTickets.length === 0) {
            return null;
        }

        const totalHours = respondedTickets.reduce((sum, ticket) => {
            const createdAt = new Date(ticket.created_at).getTime();
            const assignedAt = new Date(ticket.assigned_at).getTime();

            if (!Number.isFinite(createdAt) || !Number.isFinite(assignedAt) || assignedAt < createdAt) {
                return sum;
            }

            return sum + (assignedAt - createdAt) / (1000 * 60 * 60);
        }, 0);

        return totalHours / respondedTickets.length;
    }, [allTickets]);

    const formatDurationFromHours = (hours) => {
        if (hours === null || Number.isNaN(hours)) {
            return '--';
        }

        if (hours < 1) {
            return `${Math.max(1, Math.round(hours * 60))}m`;
        }

        return `${hours.toFixed(1)}h`;
    };

    const formatSubmissionTime = (createdAt) => {
        if (!createdAt) return 'Unknown time';

        const dt = new Date(createdAt);
        if (!Number.isFinite(dt.getTime())) return 'Unknown time';

        return dt.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const performanceChartData = useMemo(() => {
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
        return Object.values(weekData).slice(-8);
    }, [displayedTickets]);

    const priorityChartData = useMemo(() => (
        [
            { name: 'Urgent', value: allTickets.filter(t => t.priority === 'urgent').length, color: '#dc2626' },
            { name: 'High', value: allTickets.filter(t => t.priority === 'high').length, color: '#f97316' },
            { name: 'Medium', value: allTickets.filter(t => t.priority === 'medium').length, color: '#eab308' },
            { name: 'Low', value: allTickets.filter(t => t.priority === 'low').length, color: '#22c55e' }
        ].filter(item => item.value > 0)
    ), [allTickets]);

    const statusChartData = useMemo(() => (
        [
            { name: 'Submitted', value: allTickets.filter(t => t.status === 'submitted').length },
            { name: 'Assigned', value: allTickets.filter(t => t.status === 'assigned').length },
            { name: 'In Progress', value: allTickets.filter(t => ['in-progress', 'in progress'].includes(t.status)).length },
            { name: 'Resolved', value: allTickets.filter(t => t.status === 'resolved').length }
        ].filter(item => item.value > 0)
    ), [allTickets]);

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
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                activeView === 'escalated' ? 'bg-surface-dark text-white' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                            }`}
                        >
                            <span className={`material-symbols-outlined ${activeView === 'escalated' ? 'text-primary' : ''}`}>priority_high</span>
                            <span className="font-medium text-sm">Escalated</span>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                                activeView === 'escalated' ? 'bg-primary text-white' : 'bg-surface-dark text-slate-400'
                            }`}>
                                {allTickets.filter(t => t.status === 'escalated' || t.status === 'tech').length}
                            </span>
                        </button>
                    </nav>


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
                        <div className="relative">
                            <button
                                onClick={toggleNotifications}
                                className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#3a2f27] text-slate-600 dark:text-[#bba99b] hover:text-primary transition-colors relative"
                                title="Notifications"
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                {unreadMessagesCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white rounded-full border-2 border-white dark:border-[#181411] text-[10px] font-bold leading-[14px] flex items-center justify-center">
                                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1e1a16] rounded-lg shadow-2xl border border-slate-200 dark:border-[#3a2f27] z-50 max-h-96 overflow-y-auto">
                                    <div className="p-4 border-b border-slate-200 dark:border-[#3a2f27] sticky top-0 bg-white dark:bg-[#1e1a16]">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                            {unreadMessagesCount > 0 && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded">
                                                    {unreadMessagesCount} new
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-[#3a2f27]">
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
                                                className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#3a2f27]/40 transition-colors ${notif.unread_count > 0 ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-slate-500 dark:text-[#bba99b] text-sm font-medium">Avg First Response</span>
                                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <span className="material-symbols-outlined text-lg">timer</span>
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{formatDurationFromHours(avgFirstResponseHours)}</h3>
                                    <span className="text-slate-400 text-xs font-bold mb-1">Created → Claimed</span>
                                </div>
                                <p className="text-[10px] text-[#bba99b] mt-2 uppercase tracking-wide">Based on assigned tickets</p>
                            </div>
                        </div>

                        {/* Performance Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Resolution Performance Chart */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Resolution Performance</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={performanceChartData}>
                                        <CartesianGrid strokeDasharray="2 6" stroke="#3a2f27" />
                                        <XAxis dataKey="name" stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e1a16', border: '1px solid #3a2f27', borderRadius: '8px', color: '#fff' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="tickets" stroke="var(--color-chart-1)" name="Tickets Completed" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Priority Distribution */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Priority Distribution</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={priorityChartData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={85} innerRadius={45} fill="#8884d8" dataKey="value">
                                            {priorityChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e1a16', border: '1px solid #3a2f27', borderRadius: '8px', color: '#fff' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Status Distribution */}
                            <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm lg:col-span-2">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Ticket Status Overview</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={statusChartData} barSize={28}>
                                        <CartesianGrid strokeDasharray="2 6" stroke="#3a2f27" />
                                        <XAxis dataKey="name" stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <YAxis stroke="#bba99b" style={{ fontSize: '12px' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e1a16', border: '1px solid #3a2f27', borderRadius: '8px', color: '#fff' }} />
                                        <Bar dataKey="value" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Performance Metrics */}
                            {employeeStats && (
                                <div className="bg-white dark:bg-[#1e1a16] p-6 rounded-xl border border-slate-200 dark:border-[#3a2f27] shadow-sm lg:col-span-2">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Performance Metrics</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-[#3a2f27]/30 p-4 rounded-lg">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#bba99b] mb-1">Avg Resolution Time</p>
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
                                    <button
                                        onClick={() => fetchTickets()}
                                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#181411] hover:bg-slate-200 dark:hover:bg-[#3a2f27] text-slate-700 dark:text-[#bba99b] transition-colors"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {ticketsError && (
                                <div className="mx-6 mt-4 rounded-lg border border-rose-300/40 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{ticketsError}</p>
                                    <button
                                        onClick={() => fetchTickets()}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

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
                                        {loading ? (
                                            [...Array(6)].map((_, idx) => (
                                                <tr key={`skeleton-${idx}`} className="animate-pulse">
                                                    <td className="px-6 py-5">
                                                        <div className="h-4 w-36 rounded bg-slate-200 dark:bg-[#3a2f27]"></div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-[#3a2f27]"></div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="h-4 w-52 rounded bg-slate-200 dark:bg-[#3a2f27] mb-2"></div>
                                                        <div className="h-3 w-40 rounded bg-slate-200 dark:bg-[#3a2f27]"></div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-[#3a2f27]"></div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="h-8 w-8 rounded bg-slate-200 dark:bg-[#3a2f27]"></div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : filteredTickets.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-14 text-center">
                                                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-3">inbox</span>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No tickets match your current filters.</p>
                                                    <p className="text-xs text-slate-500 dark:text-[#bba99b] mt-1">Try changing status/search filters or refresh the queue.</p>
                                                    <div className="mt-4 flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setFilterStatus('all');
                                                                setSearchQuery('');
                                                                setShowOnlyMyTickets(false);
                                                            }}
                                                            className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#181411] hover:bg-slate-200 dark:hover:bg-[#3a2f27] text-slate-700 dark:text-[#bba99b] transition-colors"
                                                        >
                                                            Clear Filters
                                                        </button>
                                                        <button
                                                            onClick={() => fetchTickets()}
                                                            className="px-3 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-orange-600 text-white transition-colors"
                                                        >
                                                            Refresh Tickets
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredTickets.map((ticket, idx) => (
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
                                                    <div className="flex items-center justify-between gap-3 mb-0.5">
                                                        <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">{ticket.titre || `Ticket #${ticket.id}`}</p>
                                                        <span className="shrink-0 text-[10px] font-bold text-[#bba99b] uppercase tracking-wide">
                                                            {formatSubmissionTime(ticket.created_at)}
                                                        </span>
                                                    </div>
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
                                                            onClick={(e) => { e.stopPropagation(); handleEscalate(ticket.id); }}
                                                            disabled={Boolean(actionLoading[`escalate-${ticket.id}`])}
                                                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            {ticketTotalPages > 1 && (
                                <div className="border-t border-slate-200 dark:border-[#3a2f27] px-6 py-4 flex items-center justify-between text-sm">
                                    <span className="text-slate-500 dark:text-[#bba99b]">Page {ticketPage} of {ticketTotalPages}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTicketPage((prev) => Math.max(1, prev - 1))}
                                            disabled={ticketPage === 1}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3a2f27] text-slate-600 dark:text-[#bba99b] disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            onClick={() => setTicketPage((prev) => Math.min(ticketTotalPages, prev + 1))}
                                            disabled={ticketPage >= ticketTotalPages}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3a2f27] text-slate-600 dark:text-[#bba99b] disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="h-14 bg-white dark:bg-[#181411] border-t border-slate-200 dark:border-[#3a2f27] px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">

                    </div>
                    <p className="text-[10px] text-slate-400 font-medium tracking-tight">© 2026 IDSoft Infrastructure Solutions • v4.2.0-stable</p>
                </footer>
            </main>

            {toast && (
                <div className="fixed top-5 right-5 z-[60]">
                    <div className={`min-w-[260px] max-w-sm rounded-xl px-4 py-3 shadow-xl border ${
                        toast.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300/60 text-emerald-800'
                            : toast.type === 'warning'
                                ? 'bg-amber-50 border-amber-300/60 text-amber-800'
                                : 'bg-rose-50 border-rose-300/60 text-rose-800'
                    }`}>
                        <p className="text-sm font-semibold">{toast.message}</p>
                    </div>
                </div>
            )}

            {/* Ticket Detail Modal with Chat (Restored logic) */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedTicket(null); setConversationMessages([]); }}>
                    <div className="bg-white dark:bg-[#1e1a16] border border-slate-200 dark:border-[#3a2f27] rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Left side - Ticket Details */}
                        <div className="flex-1 overflow-y-auto border-r border-slate-200 dark:border-[#3a2f27]">
                            <div className="p-6 border-b border-slate-200 dark:border-[#3a2f27] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1a16] z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ticket #{String(selectedTicket.id).slice(0, 8)}</h3>
                                    <p className="text-sm text-[#bba99b] mt-0.5">{selectedTicket.client?.nom || selectedTicket.client?.name || `Client #${selectedTicket.id_client}`}</p>
                                </div>
                                <button onClick={() => { setSelectedTicket(null); setConversationMessages([]); }} className="p-2 hover:bg-slate-100 dark:hover:bg-[#3a2f27] rounded-lg transition-colors text-[#bba99b]">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Client Contact Information Card - Prominent */}
                                <div className="bg-gradient-to-br from-primary/5 to-orange-500/5 border-2 border-primary/30 rounded-xl p-6">
                                    <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">person</span>
                                        Client Information
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider mb-1">Name</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.client?.nom || selectedTicket.client?.name || 'N/A'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">phone</span> Phone
                                                </p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {selectedTicket.client?.numero || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">mail</span> Email
                                                </p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white break-all">{selectedTicket.client?.mail || 'N/A'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">computer</span> AnyDesk Number
                                                </p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                                                    {selectedTicket.machine?.code_anydesk || 'N/A'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-[#bba99b] mt-1">
                                                    Machine: {selectedTicket.machine?.nom_poste || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ticket Details */}
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
                                        <div className="rounded-xl border border-slate-200 dark:border-[#3a2f27] bg-slate-100 dark:bg-[#181411] p-2 overflow-hidden">
                                            {!ticketImageError ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsImagePreviewOpen(true)}
                                                    className="block w-full rounded-lg overflow-hidden bg-white dark:bg-slate-950"
                                                >
                                                    <img
                                                        src={resolveTicketImageUrl(selectedTicket.image)}
                                                        alt="Ticket attachment"
                                                        className="block rounded-lg max-h-[32rem] w-full object-contain"
                                                        onError={() => setTicketImageError(true)}
                                                    />
                                                </button>
                                            ) : (
                                                <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 dark:border-[#5a4b3f] bg-white dark:bg-slate-950 p-4">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-[#e4d7c9]">The attachment could not be previewed here.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsImagePreviewOpen(true)}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-colors"
                                                    >
                                                        Open image preview
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isImagePreviewOpen && selectedTicket.image && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                        <div className="relative max-h-full w-full max-w-4xl rounded-3xl bg-slate-950 p-4 shadow-2xl ring-1 ring-white/10">
                                            <div className="flex items-center justify-between gap-4 pb-3">
                                                <p className="text-sm font-semibold text-white">Ticket image preview</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsImagePreviewOpen(false)}
                                                    className="rounded-full bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                            <div className="overflow-auto rounded-3xl border border-slate-700 bg-slate-900 p-2">
                                                <img
                                                    src={resolveTicketImageUrl(selectedTicket.image)}
                                                    alt="Ticket attachment preview"
                                                    className="mx-auto max-h-[80vh] w-auto max-w-full object-contain"
                                                    onError={() => setTicketImageError(true)}
                                                />
                                            </div>
                                        </div>
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
                                        {selectedTicket.rating_comment && (
                                            <p className="mt-3 text-sm text-slate-600 dark:text-[#bba99b] italic">"{selectedTicket.rating_comment}"</p>
                                        )}
                                    </div>
                                )}

                                {selectedTicket.status !== 'resolved' && (
                                    <div className="pt-6 border-t border-slate-100 dark:border-[#3a2f27] space-y-6">
                                        <div className="flex flex-col gap-3">
                                            {!selectedTicket.id_employee ? (
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleClaimTicket(selectedTicket.id)}
                                                        disabled={Boolean(actionLoading[`claim-${selectedTicket.id}`])}
                                                        className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                                        {actionLoading[`claim-${selectedTicket.id}`] ? 'Claiming...' : 'Claim Ticket'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEscalate(selectedTicket.id)}
                                                        disabled={Boolean(actionLoading[`escalate-${selectedTicket.id}`])}
                                                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">warning</span>
                                                        {actionLoading[`escalate-${selectedTicket.id}`] ? 'Escalating...' : 'Escalate to IT'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handleResolve(selectedTicket.id)}
                                                            disabled={Boolean(actionLoading[`resolve-${selectedTicket.id}`])}
                                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">check_circle</span>
                                                            {actionLoading[`resolve-${selectedTicket.id}`] ? 'Resolving...' : 'Resolve Ticket'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleEscalate(selectedTicket.id)}
                                                            disabled={Boolean(actionLoading[`escalate-${selectedTicket.id}`])}
                                                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">warning</span>
                                                            {actionLoading[`escalate-${selectedTicket.id}`] ? 'Escalating...' : 'Escalate to IT'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right side - Chat Panel */}
                        <div className="w-96 flex flex-col bg-slate-50 dark:bg-[#181411]">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-[#3a2f27] bg-white dark:bg-[#1e1a16]">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Chat with Client</h4>
                                <p className="text-xs text-[#bba99b] mt-0.5">{selectedTicket.client?.nom || selectedTicket.client?.name || 'Client'}</p>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <div className="animate-spin mb-3 inline-block">
                                                <span className="material-symbols-outlined text-3xl text-primary">refresh</span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Loading messages...</p>
                                        </div>
                                    </div>
                                ) : conversationMessages && conversationMessages.length > 0 ? (
                                    conversationMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${isMessageFromCurrentEmployee(msg) ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs px-4 py-2 rounded-lg ${
                                                isMessageFromCurrentEmployee(msg)
                                                    ? 'bg-primary text-white rounded-br-none' 
                                                    : 'bg-white dark:bg-[#3a2f27] text-slate-900 dark:text-white rounded-bl-none'
                                            }`}>
                                                <p className="text-sm break-words">{msg.message}</p>
                                                <p className={`text-[10px] mt-1 ${isMessageFromCurrentEmployee(msg) ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center h-full text-center">
                                        <div>
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">mark_email_unread</span>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">No messages yet. Start the conversation!</p>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-4 border-t border-slate-200 dark:border-[#3a2f27] bg-white dark:bg-[#1e1a16]">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-slate-100 dark:bg-[#3a2f27] border border-slate-200 dark:border-[#55463a] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white placeholder-slate-400"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isSubmittingMessage || !messageText.trim()}
                                        className="bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-all"
                                    >
                                        {isSubmittingMessage ? (
                                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                        ) : (
                                            <Send size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OTP Claim Verification Modal */}
            {showClaimOtpModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#1e1a16] rounded-lg shadow-xl max-w-md w-full mx-4 border border-slate-200 dark:border-[#3a2f27]">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                                Confirm Ticket Acceptance
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-[#bba99b] mb-6">
                                An OTP has been sent to the admin. Please enter the 6-digit code to complete ticket acceptance.
                            </p>

                            {claimOtpError && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-700 dark:text-red-300">{claimOtpError}</p>
                                </div>
                            )}

                            <input
                                type="text"
                                value={claimOtpCode}
                                onChange={(e) => setClaimOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit code"
                                maxLength="6"
                                disabled={isVerifyingOtp}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-[#55463a] rounded-lg bg-white dark:bg-[#3a2f27] text-slate-900 dark:text-white text-center text-2xl tracking-widest mb-6 focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                            />

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowClaimOtpModal(false);
                                        setClaimOtpCode('');
                                        setClaimOtpId(null);
                                        setClaimOtpTicketId(null);
                                        setClaimOtpError('');
                                    }}
                                    disabled={isVerifyingOtp}
                                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleVerifyClaimOtp}
                                    disabled={isVerifyingOtp || claimOtpCode.length !== 6}
                                    className="flex-1 px-4 py-2 bg-primary hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg transition-all font-medium"
                                >
                                    {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
