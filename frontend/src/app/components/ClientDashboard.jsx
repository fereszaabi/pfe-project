import { useState, useEffect, useMemo, useRef } from 'react';
import { getClientTickets, createTicket, rateEmployee, getMachines, getUnreadMessages, askSupportBot, getClientProfile, getClientLogs, getClientLogsStreamUrl, markClientLogRead, deleteTicketImage, getSupportBotHistory, saveSupportBotHistory, getHelpArticles, sendTicketOtp } from '../../services/api';
import { getStatusBadgeClasses, getPriorityBadgeClasses } from '../utils/ticketStyles';
import { getEcho } from '../../services/realtime';

export function ClientDashboard({ user, onViewTicket, onLogout, onNavigate, activeView }) {
    const promptedRatingTicketsRef = useRef(new Set());
    const supportMessagesEndRef = useRef(null);
    const ticketsSectionRef = useRef(null);
    const isFetchingTicketsRef = useRef(false);
    const botRequestAbortRef = useRef(null); // For cancelling pending bot requests
    const botTimeoutIdRef = useRef(null); // For tracking request timeout
    const supportWelcomeMessage = {
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I am ID Soft AI Quick Support. Tell me what issue you are facing and I will help you troubleshoot it.',
    };
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [showSupportChat, setShowSupportChat] = useState(false);
    const [supportTab, setSupportTab] = useState('chat');
    const [supportHistory, setSupportHistory] = useState([]);
    const [activeHistoryId, setActiveHistoryId] = useState(null);
    const [helpSearch, setHelpSearch] = useState('');
    const [helpCategory, setHelpCategory] = useState('all');
    const [helpArticles, setHelpArticles] = useState([]);
    const [helpCategories, setHelpCategories] = useState([]);
    const [helpLoading, setHelpLoading] = useState(false);
    const [helpError, setHelpError] = useState('');
    const [supportInput, setSupportInput] = useState('');
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [supportMessages, setSupportMessages] = useState([
        supportWelcomeMessage,
    ]);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [ticketSearch, setTicketSearch] = useState('');
    const [debouncedTicketSearch, setDebouncedTicketSearch] = useState('');
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketTotalPages, setTicketTotalPages] = useState(1);
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
    const lastLogIdRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [clientActorId, setClientActorId] = useState(null);
    const [ticketNotice, setTicketNotice] = useState(null);
    const [pendingTicketSubmission, setPendingTicketSubmission] = useState(null);
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [newTicket, setNewTicket] = useState({
        titre: '',
        description: '',
        machine_id: '',
        code_anydesk: '',
        priority: 'low',
        image: null
    });
    const [showTicketOtpPrompt, setShowTicketOtpPrompt] = useState(false);
    const [ticketOtpCode, setTicketOtpCode] = useState('');
    const [ticketOtpError, setTicketOtpError] = useState('');
    const [isOtpSending, setIsOtpSending] = useState(false);
    const [clientId, setClientId] = useState(null);

    const priorityFees = { low: 10, medium: 20, high: 25, urgent: 30 };

    const getSelectedPriorityCost = (priority) => Number(priorityFees[priority] ?? 0);

    const normalizeMessage = (value) => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            return value.message ?? value.error ?? value.details ?? value.detail ?? JSON.stringify(value);
        }
        return String(value);
    };

    const hasInsufficientFundsForPriority = (priority) => {
        const fee = getSelectedPriorityCost(priority);
        return Number(clientBalance) < fee;
    };

    const handlePriorityChange = (priority) => {
        if (!priority) return;
        setNewTicket((prev) => ({ ...prev, priority }));
        setSubmitError('');
    };

    const normalizeTicketsResponse = (data) => {
        console.log('Raw ticket data:', data);
        const demandesPayload = data?.demandes?.data ?? data?.demandes ?? data?.data ?? [];
        console.log('Normalized tickets:', demandesPayload);
        const totalPages = data?.demandes?.last_page ?? data?.pagination?.total_pages ?? data?.last_page ?? 1;
        
        return {
            tickets: Array.isArray(demandesPayload) ? demandesPayload : [],
            totalPages,
        };
    };

    const loadTickets = async (page = ticketPage, search = debouncedTicketSearch) => {
        if (isFetchingTicketsRef.current) return;
        isFetchingTicketsRef.current = true;
        setLoadingTickets(true);

        try {
            const params = { all: 1 };
            if (search.trim()) {
                params.search = search.trim();
            }
            const ticketData = await getClientTickets(params).catch((err) => {
                console.error('Error loading tickets:', err);
                return null;
            });

            const { tickets: nextTickets, totalPages } = normalizeTicketsResponse(ticketData);
            console.log('Loaded tickets:', nextTickets);
            setTickets(nextTickets);
            setTicketTotalPages(totalPages);
        } finally {
            isFetchingTicketsRef.current = false;
            setLoadingTickets(false);
        }
    };

    const loadDashboardData = async () => {
        try {
            const [machineData, profileData] = await Promise.all([
                getMachines().catch(() => null),
                getClientProfile().catch(() => null),
            ]);

            if (Array.isArray(machineData?.machines)) {
                setMachines(machineData.machines);
            }

            const profileBalance = Number(profileData?.profile?.money ?? profileData?.money ?? NaN);
            if (!Number.isNaN(profileBalance)) {
                setClientBalance(profileBalance);
            }

            // Set client ID for realtime channels
            const clientIdFromProfile = profileData?.profile?.id ?? profileData?.id;
            if (clientIdFromProfile) {
                setClientId(clientIdFromProfile);
            }
        } catch (error) {
            // Handle errors if needed
        }
    };

    useEffect(() => {
        let channel = null;
        let clientChannel = null;

        loadDashboardData();
        loadTickets();

        try {
            if (user?.id) {
                const echo = getEcho();
                channel = echo.private(`user.user.${user.id}`);

                // Also listen on client-specific channel if we have clientId
                if (clientId) {
                    clientChannel = echo.private(`user.client.${clientId}`);
                }

                channel.listen('.ticket.updated', (event) => {
                    const updatedTicket = event?.ticket;
                    console.log('Realtime ticket update:', updatedTicket);
                    if (!updatedTicket?.id) return;

                    setTickets((prev) => {
                        const exists = prev.some((ticket) => ticket.id === updatedTicket.id);
                        const existingTicket = prev.find((ticket) => ticket.id === updatedTicket.id);
                        if (exists && existingTicket) {
                            const notificationPayload = createTicketUpdateNotification(updatedTicket, existingTicket);
                            showRealtimeNotification(notificationPayload);

                            return prev.map((ticket) =>
                                ticket.id === updatedTicket.id ? { ...ticket, ...updatedTicket } : ticket
                            );
                        }

                        // Don't add new tickets from realtime, only update existing
                        return prev;
                    });
                });

                // Listen for ticket messages on user channel
                channel.listen('.ticket.message.created', (event) => {
                    const message = event?.message;
                    if (!message) return;

                    // Only show notifications for messages from employees (technicians)
                    const senderType = message.sender_type || message.senderType;
                    if (senderType === 'employee') {
                        showRealtimeNotification({
                            title: 'New Message',
                            message: `New message from technician: ${message.message?.slice(0, 50) || ''}...`,
                        });
                    }
                });

                // Set up listeners for client-specific channel if it exists
                if (clientChannel) {
                    clientChannel.listen('.ticket.updated', (event) => {
                        const updatedTicket = event?.ticket;
                        if (!updatedTicket?.id) return;

                        setTickets((prev) => {
                            const exists = prev.some((ticket) => ticket.id === updatedTicket.id);
                            if (exists) {
                                const existingTicket = prev.find((ticket) => ticket.id === updatedTicket.id);
                                const notificationPayload = createTicketUpdateNotification(updatedTicket, existingTicket);
                                showRealtimeNotification(notificationPayload);

                                return prev.map((ticket) =>
                                    ticket.id === updatedTicket.id ? { ...ticket, ...updatedTicket } : ticket
                                );
                            }
                            return prev;
                        });
                    });

                    clientChannel.listen('.ticket.message.created', (event) => {
                        const message = event?.message;
                        if (!message) return;

                        // Only show notifications for messages from employees (technicians)
                        const senderType = message.sender_type || message.senderType;
                        if (senderType === 'employee') {
                            showRealtimeNotification({
                                title: 'New Message',
                                message: `New message from technician: ${message.message?.slice(0, 50) || ''}...`,
                            });
                        }
                    });
                }
            }
        } catch (err) {
            // Realtime connection failed, but dashboard should still work
            console.warn('Realtime connection failed:', err);
        }

        return () => {
            if (channel) {
                try {
                    channel.unsubscribe();
                } catch (e) {
                    // ignore cleanup errors
                }
            }
            if (clientChannel) {
                try {
                    clientChannel.unsubscribe();
                } catch (e) {
                    // ignore cleanup errors
                }
            }
        };
    }, [user?.id, clientId]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTicketSearch(ticketSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [ticketSearch]);

    // Load tickets when page or debounced search changes
    useEffect(() => {
        loadTickets(ticketPage, debouncedTicketSearch);
    }, [ticketPage, debouncedTicketSearch]);

    // Real-time client logs (SSE) with polling fallback for notifications
    useEffect(() => {
        let isMounted = true;
        let eventSource = null;

        const applyLogs = async (logs) => {
            if (!Array.isArray(logs)) return;

            const notifs = logs.map(l => ({
                id: l.id,
                title: l.software_name || 'Update',
                message: normalizeMessage(l.description),
                timestamp: new Date(l.created_at),
                read: Boolean(l.is_read),
                ticketId: l.demande_id,
                type: l.status || 'log',
            }));

            if (isMounted) {
                setNotifications(notifs);
                setUnreadCount(notifs.filter(n => !n.read).length);
            }

            const latestBalanceLog = logs.find(l => l.status === 'balance_change');
            if (latestBalanceLog) {
                const latestId = latestBalanceLog.id;
                if (!lastLogIdRef.current || lastLogIdRef.current !== latestId) {
                    lastLogIdRef.current = latestId;
                    const profile = await getClientProfile().catch(() => null);
                    const balance = Number(profile?.profile?.money ?? profile?.money ?? NaN);
                    if (!Number.isNaN(balance) && isMounted) {
                        setClientBalance(balance);
                    }
                }
            }
        };

        const loadInitialLogs = async () => {
            try {
                const data = await getClientLogs({ per_page: 50 });
                const logs = data?.logs ?? [];
                await applyLogs(logs);
            } catch (_) {
                // ignore initial fetch errors
            }
        };

        const startEventStream = () => {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return;
            }

            const streamUrl = `${getClientLogsStreamUrl()}?token=${encodeURIComponent(token)}`;
            eventSource = new EventSource(streamUrl);

            eventSource.addEventListener('logs', (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    applyLogs(payload?.logs ?? []);
                } catch (_) {
                    // ignore malformed events
                }
            });

            eventSource.addEventListener('ping', () => {
                // keep-alive only
            });

            eventSource.onerror = () => {
                if (eventSource) {
                    eventSource.close();
                }
            };
        };

        loadInitialLogs();
        startEventStream();

        return () => {
            isMounted = false;
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);

    useEffect(() => {
        supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [supportMessages, showSupportChat]);

    const fetchSupportHistory = async () => {
        try {
            const data = await getSupportBotHistory();
            const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
            setSupportHistory(sessions);
            if (sessions.length > 0 && !activeHistoryId) {
                setActiveHistoryId(sessions[0].id);
            }
        } catch (_) {
            setSupportHistory([]);
        }
    };

    useEffect(() => {
        if (showSupportChat) {
            fetchSupportHistory();
            setHelpSearch('');
            setHelpCategory('all');
        }
    }, [showSupportChat]);

    const fetchHelpCenter = async () => {
        setHelpLoading(true);
        setHelpError('');
        try {
            const data = await getHelpArticles({
                search: helpSearch.trim(),
                category: helpCategory === 'all' ? '' : helpCategory,
                limit: 8,
            });

            setHelpArticles(Array.isArray(data?.articles) ? data.articles : []);
            setHelpCategories(Array.isArray(data?.categories) ? data.categories : []);
        } catch (err) {
            setHelpArticles([]);
            setHelpCategories([]);
            setHelpError('Help Center is unavailable right now.');
        } finally {
            setHelpLoading(false);
        }
    };

    useEffect(() => {
        if (showSupportChat && supportTab === 'help') {
            fetchHelpCenter();
        }
    }, [showSupportChat, supportTab, helpSearch, helpCategory]);

    const getHistoryTitle = (messages) => {
        const firstUser = messages.find((m) => m.role === 'user');
        const raw = normalizeMessage(firstUser?.content) || 'Support Chat';
        return raw.length > 48 ? `${raw.slice(0, 48)}...` : raw;
    };

    const saveSupportHistory = async (messages) => {
        const hasUserMessage = messages.some((m) => m.role === 'user');
        if (!hasUserMessage) return;

        const trimmedMessages = messages.slice(-50).map((msg) => ({
            role: msg.role,
            content: normalizeMessage(msg.content),
        }));

        try {
            await saveSupportBotHistory(getHistoryTitle(trimmedMessages), trimmedMessages);
            await fetchSupportHistory();
        } catch (_) {
            // ignore history persistence errors
        }
    };

    const closeSupportChat = async () => {
        // Immediately close modal first (don't await)
        setShowSupportChat(false);
        
        // Then cancel any pending operations
        setIsBotReplying(false);
        
        if (botRequestAbortRef.current) {
            try {
                botRequestAbortRef.current.abort();
            } catch (e) {
                // ignore abort errors
            }
            botRequestAbortRef.current = null;
        }
        
        if (botTimeoutIdRef.current) {
            clearTimeout(botTimeoutIdRef.current);
            botTimeoutIdRef.current = null;
        }

        // Save history in background (don't await)
        saveSupportHistory(supportMessages).catch(() => {});
        
        // Reset state after brief delay to ensure modal closes first
        setTimeout(() => {
            setSupportMessages([supportWelcomeMessage]);
            setSupportInput('');
            setSupportTab('chat');
            setActiveHistoryId(null);
        }, 100);
    };

    // small in-app toast for important notifications (balance changes)
    const [notificationToast, setNotificationToast] = useState(null);
    const [activeNotificationId, setActiveNotificationId] = useState(null);

    const showRealtimeNotification = ({ title, message, ticketId = null, type = 'log' }) => {
        const newNotification = {
            id: `realtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            message,
            ticketId,
            type,
            timestamp: new Date(),
            read: false,
        };

        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        setActiveNotificationId(newNotification.id);

        const toast = { id: newNotification.id, title, message };
        setNotificationToast(toast);
        setTimeout(() => {
            setNotificationToast((current) => (current?.id === toast.id ? null : current));
        }, 5000);
    };

    useEffect(() => {
        if (!notifications || notifications.length === 0) return;
        const latest = notifications.find(n => n.type === 'balance_change' || n.type === 'log');
        if (!latest) return;

        // show toast for balance_change if it's unread
        if (!latest.read) {
            setNotificationToast({ id: latest.id, title: latest.title, message: latest.message });
            setTimeout(() => setNotificationToast(null), 5000);
        }
    }, [notifications]);

    useEffect(() => {
        if (!notifications || notifications.length === 0) {
            setActiveNotificationId(null);
            return;
        }

        if (!activeNotificationId || !notifications.some((notif) => notif.id === activeNotificationId)) {
            setActiveNotificationId(notifications[0].id);
        }
    }, [notifications, activeNotificationId]);

    const activeNotification = notifications.find((notif) => notif.id === activeNotificationId) || null;

    const selectNotification = async (notif) => {
        try {
            await markClientLogRead(notif.id).catch(() => null);
            setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setActiveNotificationId(notif.id);
            setShowNotifications(true);
        } catch (e) {
            // ignore
        }
    };

    const markAllNotificationsAsRead = () => {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
        setUnreadCount(0);
    };

    const createTicketUpdateNotification = (updatedTicket, existingTicket) => {
        const wasUnassigned = !existingTicket?.id_employee;
        const nowAssigned = Boolean(updatedTicket.id_employee);
        const statusChanged = updatedTicket.status && existingTicket?.status !== updatedTicket.status;

        if (wasUnassigned && nowAssigned) {
            return {
                title: 'Ticket Claimed',
                message: `Ticket #${updatedTicket.id} has been claimed by a technician.`,
                ticketId: updatedTicket.id,
            };
        }

        if (statusChanged) {
            if (['resolved', 'closed'].includes(updatedTicket.status)) {
                return {
                    type: 'resolved',
                    action: 'rate',
                    title: updatedTicket.status === 'resolved' ? 'Ticket Resolved' : 'Ticket Closed',
                    message: `Ticket #${updatedTicket.id} has been ${updatedTicket.status}. Click to review and rate the technician.`,
                    ticketId: updatedTicket.id,
                };
            }

            return {
                type: 'status_change',
                title: 'Ticket Updated',
                message: `Ticket #${updatedTicket.id} status changed to ${updatedTicket.status}.`,
                ticketId: updatedTicket.id,
            };
        }

        return {
            type: 'update',
            title: 'Ticket Updated',
            message: `Ticket #${updatedTicket.id} was updated.`,
            ticketId: updatedTicket.id,
        };
    };

    const openNotification = (notif) => {
        selectNotification(notif);

        if (notif.action === 'rate' && notif.ticketId) {
            const ticketToRate = tickets.find((ticket) => ticket.id === notif.ticketId);
            if (ticketToRate) {
                setRatingTicket(ticketToRate);
                setRatingValue(0);
                setRatingComment('');
                setRatingError('');
                setShowNotifications(false);
                return;
            }
        }

        if (notif.ticketId) {
            onViewTicket?.(notif.ticketId);
        }
    };

    const closeTicketNotice = () => {
        setTicketNotice(null);
    };

    const scrollToTickets = () => {
        window.requestAnimationFrame(() => {
            ticketsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    useEffect(() => {
        if (!showSupportChat) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeSupportChat();
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

        if (!user?.id) {
            return () => {
                isMounted = false;
            };
        }

        try {
            const echo = getEcho();
            const channels = [`user.user.${user.id}`];
            if (user.role === 'client') {
                channels.push(`user.client.${user.id}`);
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
                try {
                    channels.forEach((channelName) => echo.leave(channelName));
                } catch (e) {
                    // ignore cleanup errors
                }
            };
        } catch (err) {
            // Realtime connection failed, but component should still work
            console.warn('Realtime message listener failed:', err);
            return () => {
                isMounted = false;
            };
        }
    }, [user?.id]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) setNewTicket({ ...newTicket, image: file });
    };

    const buildTicketFormData = (ticketData, useNewMachine) => {
        const fd = new FormData();
        fd.append('titre', ticketData.titre);
        fd.append('description', ticketData.description);
        if (useNewMachine) {
            fd.append('code_anydesk', ticketData.code_anydesk);
        } else {
            fd.append('machine_id', ticketData.machine_id);
        }
        fd.append('priority', ticketData.priority);
        if (ticketData.image) fd.append('image', ticketData.image);
        return fd;
    };

    const submitTicket = async (ticketData, useNewMachine = createNewMachine) => {
        setSubmitError('');
        setTicketOtpError('');

        // Validate machine selection
        if (!useNewMachine && !ticketData.machine_id) {
            setSubmitError('Please select an existing machine or create a new one');
            return;
        }
        if (useNewMachine && !ticketData.code_anydesk.trim()) {
            setSubmitError('Please enter the AnyDesk code for the new machine');
            return;
        }

        const fee = getSelectedPriorityCost(ticketData.priority);
        const lowBalance = Number(clientBalance) < fee;

        if (lowBalance) {
            setTicketNotice({
                title: 'Insufficient funds',
                message: 'Your ticket can still be submitted. Please pay within 7 days and an admin will be notified.',
                deadline: '7 days',
            });
        }

        // Store pending data and request OTP
        setPendingTicketSubmission({ ticketData, useNewMachine });
        setShowTicketOtpPrompt(true);
        setTicketOtpCode('');
        setIsOtpSending(true);

        try {
            const response = await sendTicketOtp();
            setTicketOtpError('');
        } catch (err) {
            const errorMsg = err?.message || 'Failed to send verification code. Please try again.';
            setTicketOtpError(errorMsg);
            setShowTicketOtpPrompt(true);
        } finally {
            setIsOtpSending(false);
        }
    };

    const submitTicketWithOtp = async () => {
        if (!ticketOtpCode.trim()) {
            setTicketOtpError('Please enter the verification code');
            return;
        }

        if (!pendingTicketSubmission) {
            setTicketOtpError('Ticket data lost. Please try again.');
            return;
        }

        const { ticketData, useNewMachine } = pendingTicketSubmission;
        setIsSubmittingTicket(true);
        setShowTicketOtpPrompt(false);
        setTicketNotice({
            title: 'Creating ticket',
            message: 'Your ticket is being created. Please wait...',
            deadline: null,
            processing: true,
        });

        const fd = buildTicketFormData(ticketData, useNewMachine);
        fd.append('otp_code', ticketOtpCode);

        try {
            const response = await createTicket(fd);
            const refreshedBalance = Number(response?.client_balance ?? NaN);
            if (!Number.isNaN(refreshedBalance)) {
                setClientBalance(refreshedBalance);
            }

            if (response?.insufficient_funds) {
                setTicketNotice({
                    title: 'Insufficient funds',
                    message: normalizeMessage(response?.warning ?? 'Your ticket was submitted. Please pay within 7 days. An admin has been notified.'),
                    deadline: response?.payment_deadline || '7 days',
                });
            }

            const machineData = await getMachines().catch(() => null);
            if (Array.isArray(machineData?.machines)) {
                setMachines(machineData.machines);
            }

            const profileData = await getClientProfile().catch(() => null);
            const profileBalance = Number(profileData?.profile?.money ?? profileData?.money ?? NaN);
            if (!Number.isNaN(profileBalance)) {
                setClientBalance(profileBalance);
            }

            await loadTickets();
            setNewTicket({ titre: '', description: '', machine_id: '', code_anydesk: '', priority: 'low', image: null });
            setCreateNewMachine(false);
            setShowCreateTicket(false);
            scrollToTickets();

            setTicketNotice({
                title: response?.insufficient_funds ? 'Ticket submitted' : 'Ticket submitted',
                message: normalizeMessage(
                    response?.insufficient_funds
                        ? response?.warning ?? 'Your ticket was submitted. Please pay within 7 days. An admin has been notified.'
                        : 'Your ticket has been submitted successfully.'
                ),
                deadline: response?.payment_deadline || null,
                processing: false,
            });
        } catch (err) {
            const messages = err?.errors ? Object.values(err.errors).flat().join(' ') : err?.error || err?.message || 'Failed to create ticket';
            setTicketOtpError(messages);
            setShowTicketOtpPrompt(true);
        } finally {
            setIsSubmittingTicket(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await submitTicket(newTicket, createNewMachine);
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
                await loadTickets();
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

        // Cancel any pending request
        if (botRequestAbortRef.current) {
            try {
                botRequestAbortRef.current.abort();
            } catch (e) {
                // ignore
            }
        }
        if (botTimeoutIdRef.current) {
            clearTimeout(botTimeoutIdRef.current);
            botTimeoutIdRef.current = null;
        }

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
        };

        setSupportMessages((prev) => [...prev, userMsg]);
        setSupportInput('');
        setIsBotReplying(true);

        // Create new abort controller for this request
        const abortController = new AbortController();
        botRequestAbortRef.current = abortController;

        // Set 8-second timeout
        const timeoutId = setTimeout(() => {
            try {
                abortController.abort();
            } catch (e) {
                // ignore
            }
        }, 8000);
        botTimeoutIdRef.current = timeoutId;

        try {
            const history = [...supportMessages, userMsg]
                .slice(-12)
                .map((m) => ({ role: m.role, content: m.content }));

            const response = await askSupportBot(trimmed, history);
            
            // Clear timeout if request succeeded
            if (botTimeoutIdRef.current) {
                clearTimeout(botTimeoutIdRef.current);
                botTimeoutIdRef.current = null;
            }

            const botReply = normalizeMessage(response?.reply ?? 'I could not generate a response right now. Please try again.');
            const isTimeout = response?.meta?.timeout === true;

            setSupportMessages((prev) => [
                ...prev,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: botReply,
                    isError: isTimeout,
                },
            ]);
        } catch (err) {
            // Clear timeout on error
            if (botTimeoutIdRef.current) {
                clearTimeout(botTimeoutIdRef.current);
                botTimeoutIdRef.current = null;
            }

            // Determine error message based on error type.
            // apiRequest throws plain objects (e.g. { error: "..." }) on non-2xx,
            // so we check those before falling back to Error.message / generic text.
            let errorMessage = 'AI assistant is temporarily unavailable. Please try again or create a support ticket.';

            if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) {
                errorMessage = 'Request timed out. Please try again or create a support ticket.';
            } else if (err?.reply) {
                // Backend returned a fallback reply inside a non-ok response body
                errorMessage = normalizeMessage(err.reply);
            } else if (err?.error) {
                // apiRequest wraps abort/timeout as { error: "..." }
                errorMessage = normalizeMessage(err.error);
            } else if (typeof err?.message === 'string' && (err.message.includes('timeout') || err.message.includes('unable'))) {
                errorMessage = 'AI assistant took too long to respond. Please create a support ticket for faster help.';
            } else if (err?.message) {
                errorMessage = normalizeMessage(err.message);
            }

            setSupportMessages((prev) => [
                ...prev,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content: errorMessage,
                    isError: true,
                },
            ]);
        } finally {
            setIsBotReplying(false);
            botRequestAbortRef.current = null;
        }
    };


    const userTickets = useMemo(() => tickets, [tickets]);
    const activeTickets = useMemo(
        () => userTickets.filter(t => ['submitted', 'open', 'assigned', 'in-progress', 'in progress'].includes(t.status)).length,
        [userTickets]
    );
    const resolvedTickets = useMemo(
        () => userTickets.filter(t => t.status === 'resolved').length,
        [userTickets]
    );
    const urgentTickets = useMemo(
        () => userTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length,
        [userTickets]
    );
    const totalTickets = useMemo(() => userTickets.length, [userTickets]);
    const resolutionRate = useMemo(
        () => (totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0),
        [totalTickets, resolvedTickets]
    );
    const latestTicket = useMemo(() => (
        [...userTickets]
            .filter((t) => t.created_at)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    ), [userTickets]);
    const lastUpdateLabel = useMemo(
        () => (latestTicket ? new Date(latestTicket.created_at).toLocaleDateString() : '--'),
        [latestTicket]
    );

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
                        <div className="relative">
                            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white rounded-full ring-2 ring-white dark:ring-background-dark text-[10px] font-bold leading-[14px] flex items-center justify-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-[30rem] bg-white dark:bg-surface-dark rounded-lg shadow-2xl border border-slate-200 dark:border-border-dark z-50 max-h-[38rem] overflow-hidden">
                                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-border-dark sticky top-0 bg-white dark:bg-surface-dark z-10">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                            {unreadCount > 0 && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded mt-1 inline-block">
                                                    {unreadCount} new
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={markAllNotificationsAsRead} className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                                            Mark all read
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-[1.2fr_1.8fr] gap-4 p-4 h-[34rem]">
                                        <div className="overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                                            {notifications.length > 0 ? (
                                                notifications.map((notif) => (
                                                    <button
                                                        key={notif.id}
                                                        type="button"
                                                        onClick={() => openNotification(notif)}
                                                        className={`w-full text-left p-4 border-b border-slate-200 dark:border-slate-800 transition-colors ${activeNotificationId === notif.id ? 'bg-white dark:bg-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-900/80'} ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold text-sm text-slate-900 dark:text-white">{normalizeMessage(notif.title)}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{normalizeMessage(notif.message)}</p>
                                                            </div>
                                                            {!notif.read && (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">New</span>
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">{notif.timestamp.toLocaleString()}</p>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center">
                                                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl block mb-2">notifications_none</span>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                                            {activeNotification ? (
                                                <>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-1">
                                                            {activeNotification.type === 'balance_change' ? (
                                                                <span className="material-symbols-outlined text-amber-500 text-3xl">payments</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-blue-500 text-3xl">info</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-900 dark:text-white text-lg">{normalizeMessage(activeNotification.title)}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activeNotification.timestamp.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{normalizeMessage(activeNotification.message)}</div>
                                                    {activeNotification.ticketId && (
                                                        <div className="mt-5 flex items-center gap-2">
                                                            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">Ticket #{activeNotification.ticketId}</span>
                                                            <button
                                                                onClick={() => onViewTicket?.(activeNotification.ticketId)}
                                                                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 transition-colors"
                                                            >
                                                                Open Ticket
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                                                    <span className="material-symbols-outlined text-4xl mb-3">notifications_none</span>
                                                    <p className="font-semibold">Select a notification</p>
                                                    <p className="text-xs mt-2">Notification details will appear here.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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

                    {/* Vital Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                <span className="material-symbols-outlined text-3xl">confirmation_number</span>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Tickets</p>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{activeTickets}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Last update {lastUpdateLabel}</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Resolution Rate</p>
                                    <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{resolutionRate}%</h3>
                                </div>
                            </div>
                            <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                    className="h-2 rounded-full bg-emerald-500"
                                    style={{ width: `${resolutionRate}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{resolvedTickets} of {totalTickets} tickets closed</p>
                        </div>
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Account Balance</p>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{Number(clientBalance).toFixed(2)} DT</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Updated in real time</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                                <span className="material-symbols-outlined text-3xl">priority_high</span>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Urgent Queue</p>
                                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{urgentTickets}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Requires immediate action</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary to-orange-600 p-6 rounded-xl relative overflow-hidden shadow-lg shadow-primary/20 mb-8">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p className="text-white/80 text-sm font-medium">Need Help?</p>
                                <h3 className="text-2xl font-bold text-white mt-1">ID Soft AI Quick Support</h3>
                                <p className="text-white/80 text-sm mt-1">Ask the assistant before opening a ticket.</p>
                            </div>
                            <button
                                onClick={() => setShowSupportChat(true)}
                                className="px-5 py-2.5 bg-white text-primary font-bold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Start AI Chat
                            </button>
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
                                        {normalizeMessage(submitError)}
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
                                        Insufficient funds for this priority ({getSelectedPriorityCost(newTicket.priority)} DT). The ticket will still be submitted and the admin will be notified automatically.
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

                    {/* OTP Verification Modal */}
                    {showTicketOtpPrompt && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md p-8">
                                <div className="text-center mb-6">
                                    <span className="material-symbols-outlined text-4xl text-primary mb-3 block">verified_user</span>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Verify Your Identity</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                        A verification code has been sent to your email address.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={ticketOtpCode}
                                        onChange={(e) => {
                                            setTicketOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                            setTicketOtpError('');
                                        }}
                                        placeholder="000000"
                                        className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-2xl font-mono tracking-widest focus:border-primary focus:ring-primary h-14 transition-colors"
                                    />
                                    {ticketOtpError && (
                                        <p className="text-sm text-red-600 dark:text-red-400">{normalizeMessage(ticketOtpError)}</p>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowTicketOtpPrompt(false);
                                            setTicketOtpCode('');
                                            setTicketOtpError('');
                                            setPendingTicketSubmission(null);
                                        }}
                                        disabled={isSubmittingTicket}
                                        className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={submitTicketWithOtp}
                                        disabled={isSubmittingTicket || !ticketOtpCode.trim()}
                                        className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmittingTicket ? 'Verifying...' : 'Verify & Submit'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Tickets Table */}
                    <div ref={ticketsSectionRef} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">My Support Tickets</h3>
                                <p className="text-xs text-slate-500">Use search to filter by title or status.</p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                    <input
                                        value={ticketSearch}
                                        onChange={(e) => {
                                            setTicketSearch(e.target.value);
                                            setTicketPage(1);
                                        }}
                                        placeholder="Search tickets..."
                                        className="w-full sm:w-60 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                </div>
                                {userTickets.length > 0 && (
                                    <span className="text-sm text-slate-500">{userTickets.length} shown</span>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {loadingTickets ? (
                                <div className="p-8 space-y-4">
                                    {[...Array(4)].map((_, idx) => (
                                        <div key={`ticket-skeleton-${idx}`} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                    ))}
                                </div>
                            ) : userTickets.length === 0 ? (
                                <div className="p-12 text-center">
                                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4 block">
                                        confirmation_number
                                    </span>
                                    <p className="text-slate-500 dark:text-slate-400 mb-4">No tickets match your search.</p>
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
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadgeClasses(ticket.status)}`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getPriorityBadgeClasses(ticket.priority)}`}>
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
                </div>
            </main>

            {ticketNotice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeTicketNotice}>
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-300">warning</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{normalizeMessage(ticketNotice.title)}</h3>
                                    <p className="text-xs text-slate-500">Support ticket alert</p>
                                </div>
                            </div>
                            <button onClick={closeTicketNotice} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-700 dark:text-slate-300">{normalizeMessage(ticketNotice.message)}</p>
                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-semibold">Payment deadline</p>
                                <p>You need to settle this within {normalizeMessage(ticketNotice.deadline)}.</p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={closeTicketNotice}
                                    className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                                >
                                    Okay
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                    {normalizeMessage(ratingError)}
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeSupportChat}>
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">ID Soft AI Quick Support</h3>
                                <p className="text-xs text-slate-500">Powered by ID Soft AI assistant</p>
                            </div>
                            <button onClick={closeSupportChat} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="px-4 pt-4">
                            <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 gap-1">
                                <button
                                    onClick={() => setSupportTab('chat')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${supportTab === 'chat' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                >
                                    Live Chat
                                </button>
                                <button
                                    onClick={() => setSupportTab('history')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${supportTab === 'history' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                >
                                    History ({supportHistory.length})
                                </button>
                                <button
                                    onClick={() => setSupportTab('help')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${supportTab === 'help' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}
                                >
                                    Help Center
                                </button>
                            </div>
                        </div>

                        {supportTab === 'chat' ? (
                            <>
                                <div className="h-[420px] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/40 space-y-3">
                                    {supportMessages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}`}>
                                                {normalizeMessage(msg.content)}
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
                            </>
                        ) : supportTab === 'history' ? (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1 space-y-2 max-h-[420px] overflow-y-auto">
                                    {supportHistory.length === 0 ? (
                                        <div className="p-6 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
                                            No previous chats yet.
                                        </div>
                                    ) : (
                                        supportHistory.map((entry) => (
                                            <button
                                                key={entry.id}
                                                onClick={() => setActiveHistoryId(entry.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${activeHistoryId === entry.id ? 'border-primary bg-primary/10 text-slate-900 dark:text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                                            >
                                                <p className="font-semibold line-clamp-2">{normalizeMessage(entry.title)}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{new Date(entry.createdAt).toLocaleString()}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg p-4 max-h-[420px] overflow-y-auto">
                                    {supportHistory.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Select a chat to view details.</div>
                                    ) : (
                                        (supportHistory.find((entry) => entry.id === activeHistoryId) || supportHistory[0])?.messages?.map((msg, idx) => (
                                            <div key={`${activeHistoryId}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
                                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}`}>
                                                    {normalizeMessage(msg.content)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2 relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                                        <input
                                            value={helpSearch}
                                            onChange={(e) => setHelpSearch(e.target.value)}
                                            placeholder="Search help articles..."
                                            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <select
                                        value={helpCategory}
                                        onChange={(e) => setHelpCategory(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    >
                                        <option value="all">All categories</option>
                                        {helpCategories.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>

                                {helpError && (
                                    <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                                        {normalizeMessage(helpError)}
                                    </div>
                                )}

                                {helpLoading ? (
                                    <div className="space-y-3">
                                        {[...Array(3)].map((_, idx) => (
                                            <div key={`help-skeleton-${idx}`} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : helpArticles.length === 0 ? (
                                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500">
                                        No help articles matched your search.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                                        {helpArticles.map((article) => (
                                            <article key={article.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 hover:border-primary/40 transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{normalizeMessage(article.category)}</p>
                                                        <h4 className="font-bold text-slate-900 dark:text-white mt-1">{article.title}</h4>
                                                    </div>
                                                    <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">{normalizeMessage(article.summary)}</p>
                                                {Array.isArray(article.keywords) && article.keywords.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {article.keywords.slice(0, 3).map((keyword) => (
                                                            <span key={keyword} className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                {keyword}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}