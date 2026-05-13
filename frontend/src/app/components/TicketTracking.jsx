import { useState, useEffect, useRef } from 'react';
import { getClientTicket, deleteTicket, getTicketMessages, sendMessage, deleteTicketImage } from '../../services/api';
import { getEcho } from '../../services/realtime';

export function TicketTracking({ ticketId, onBack }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [comment, setComment] = useState('');
    const [postingUpdate, setPostingUpdate] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [previousStatus, setPreviousStatus] = useState(null);
    const [notificationToast, setNotificationToast] = useState(null);
    const [conversationMessages, setConversationMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const messagesEndRef = useRef(null);
    const lastSeenMessageIdRef = useRef(null);
    const ticketDetailCacheRef = useRef(new Map());

    const ticketTimeline = ticket ? [
        {
            key: 'created',
            label: 'Ticket Created',
            detail: ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'Unknown time',
            active: true,
            icon: 'task_alt',
        },
        {
            key: 'assigned',
            label: ticket.employee ? `Assigned to ${ticket.employee.name || ticket.employee.nom || 'technician'}` : 'Waiting for assignment',
            detail: ticket.assigned_at ? new Date(ticket.assigned_at).toLocaleString() : 'Not assigned yet',
            active: Boolean(ticket.assigned_at || ticket.employee),
            icon: 'person_add',
        },
        {
            key: 'in-progress',
            label: 'Work in Progress',
            detail: ['in progress', 'in-progress', 'resolved', 'closed'].includes(ticket.status)
                ? 'Technician has started working on this ticket'
                : 'Not started yet',
            active: ['in progress', 'in-progress', 'resolved', 'closed'].includes(ticket.status),
            icon: 'construction',
        },
        {
            key: 'resolved',
            label: 'Resolution / Closure',
            detail: ticket.completed_at ? new Date(ticket.completed_at).toLocaleString() : 'Still open',
            active: ['resolved', 'closed'].includes(ticket.status),
            icon: 'check_circle',
        },
        {
            key: 'rated',
            label: 'Client Rating',
            detail: ticket.client_rating ? `${ticket.client_rating}/5 stars` : 'Pending your review',
            active: Boolean(ticket.client_rating),
            icon: 'star',
        },
    ] : [];

    const isMessageFromTechnician = (msg) => {
        if (!msg) return false;

        const senderType = msg.sender_type || msg.senderType;
        if (senderType) {
            return senderType === 'employee';
        }

        if (ticket?.id_employee && msg?.sender?.id) {
            return Number(msg.sender.id) === Number(ticket.id_employee);
        }

        return false;
    };

    const BACKEND_BASE_URL = 'http://127.0.0.1:8000';

    const resolveTicketImageUrl = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') return '';
        if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('data:') || imagePath.startsWith('blob:')) return imagePath;
        if (imagePath.startsWith('/')) return `${BACKEND_BASE_URL}${imagePath}`;
        const normalized = imagePath.replace(/^storage\//, '');
        return `${BACKEND_BASE_URL}/storage/${normalized}`;
    };

    const handleDeleteImage = async () => {
        if (!ticket?.id) return;
        if (!confirm('Delete attached image? This cannot be undone.')) return;
        try {
            await deleteTicketImage(ticket.id);
            await loadTicket();
        } catch (err) {
            console.error('Failed to delete image:', err);
            alert('Failed to delete image.');
        }
    };

    useEffect(() => {
        loadTicket();
    }, [ticketId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversationMessages]);

    const isFetchingMessagesRef = useRef(false);

    const getAuthChannels = () => {
        const authRaw = window.localStorage.getItem('auth_user');
        if (!authRaw) return [];

        try {
            const authUser = JSON.parse(authRaw);
            if (!authUser?.id) return [];

            const channels = [`user.user.${authUser.id}`];
            if (authUser.role === 'employee') {
                channels.push(`user.employee.${authUser.id}`);
            }
            if (authUser.role === 'client') {
                channels.push(`user.client.${authUser.id}`);
            }
            return channels;
        } catch {
            return [];
        }
    };

    useEffect(() => {
        if (!ticketId) return;

        const echo = getEcho();
        const ticketChannel = echo.private(`ticket.${ticketId}`);
        const userChannels = getAuthChannels();
        const allChannels = [ticketChannel, ...userChannels.map((c) => echo.private(c))];

        const handleIncomingMessage = (event) => {
            const incoming = event?.message;
            if (!incoming) return;

            setConversationMessages((prev) => {
                if (prev.some((msg) => msg.id === incoming.id)) {
                    return prev;
                }
                return [...prev, incoming];
            });

            if (isMessageFromTechnician(incoming)) {
                const newNotification = {
                    id: Date.now(),
                    type: 'message',
                    title: 'New Message',
                    message: `New message from technician: ${incoming.message?.slice(0, 60) || ''}`,
                    timestamp: new Date(),
                    read: false,
                };
                setNotifications((prev) => [newNotification, ...prev]);
                setUnreadCount((prev) => prev + 1);
                setNotificationToast(newNotification);
                setTimeout(() => setNotificationToast(null), 5000);
            }
        };

        allChannels.forEach((channel) => {
            channel.listen('.ticket.message.created', handleIncomingMessage);
        });

        ticketChannel.listen('.ticket.updated', (event) => {
            const updatedTicket = event?.ticket;
            if (!updatedTicket) return;

            setTicket((prev) => {
                if (!prev) return updatedTicket;

                if (updatedTicket.status && prev.status && updatedTicket.status !== prev.status) {
                    const newNotification = {
                        id: Date.now(),
                        type: 'status_change',
                        title: 'Ticket Status Updated',
                        message: `Status changed from ${prev.status} to ${updatedTicket.status}`,
                        timestamp: new Date(),
                        read: false,
                        oldStatus: prev.status,
                        newStatus: updatedTicket.status,
                    };
                    setNotifications((prevNotifs) => [newNotification, ...prevNotifs]);
                    setUnreadCount((prevCount) => prevCount + 1);
                    setNotificationToast(newNotification);
                    setTimeout(() => setNotificationToast(null), 5000);
                } else if (updatedTicket.employee && !prev.employee && updatedTicket.id_employee) {
                    const newNotification = {
                        id: Date.now(),
                        type: 'assignment',
                        title: 'Ticket Assigned',
                        message: `Your ticket has been assigned to ${updatedTicket.employee.name}`,
                        timestamp: new Date(),
                        read: false,
                    };
                    setNotifications((prevNotifs) => [newNotification, ...prevNotifs]);
                    setUnreadCount((prevCount) => prevCount + 1);
                    setNotificationToast(newNotification);
                    setTimeout(() => setNotificationToast(null), 5000);
                }

                return { ...prev, ...updatedTicket };
            });
        });

        return () => {
            echo.leave(`ticket.${ticketId}`);
            userChannels.forEach((channelName) => echo.leave(channelName));
        };
    }, [ticketId]);

    const fetchConversationMessages = async (options = {}) => {
        const { silent = false } = options;
        try {
            if (!silent) {
                setLoadingMessages(true);
            }
            if (isFetchingMessagesRef.current) return;
            isFetchingMessagesRef.current = true;

            const data = await getTicketMessages(ticketId);
            const msgs = Array.isArray(data.messages) ? data.messages : [];
            setConversationMessages(msgs);

            const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            if (latestMsg?.id) {
                if (lastSeenMessageIdRef.current === null) {
                    lastSeenMessageIdRef.current = latestMsg.id;
                } else if (latestMsg.id !== lastSeenMessageIdRef.current && isMessageFromTechnician(latestMsg)) {
                    const newNotification = {
                        id: Date.now(),
                        type: 'message',
                        title: 'New Message',
                        message: `New message from technician: ${latestMsg.message?.slice(0, 60) || ''}`,
                        timestamp: new Date(),
                        read: false,
                    };
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    setNotificationToast(newNotification);
                    setTimeout(() => setNotificationToast(null), 5000);
                    lastSeenMessageIdRef.current = latestMsg.id;
                } else {
                    lastSeenMessageIdRef.current = latestMsg.id;
                }
            }
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            isFetchingMessagesRef.current = false;
            if (!silent) {
                setLoadingMessages(false);
            }
        }
    };

    const cacheTicketDetails = (ticketData) => {
        if (!ticketId || !ticketData) return;
        ticketDetailCacheRef.current.set(ticketId, {
            ticket: ticketData,
            timestamp: Date.now(),
        });
    };

    const isTicketCacheFresh = (cachedEntry) => {
        return cachedEntry && (Date.now() - cachedEntry.timestamp) < 1000 * 60 * 5;
    };

    const loadTicketData = async ({ refresh = false, silentMessages = false } = {}) => {
        try {
            if (!silentMessages) {
                setLoadingMessages(true);
            }

            const ticketPromise = refresh || !ticket
                ? getClientTicket(ticketId)
                : Promise.resolve({ ticket });
            const messagesPromise = getTicketMessages(ticketId);

            const [ticketResult, messagesResult] = await Promise.allSettled([ticketPromise, messagesPromise]);

            if (ticketResult.status === 'fulfilled') {
                const ticketData = ticketResult.value?.ticket ?? ticketResult.value;
                if (ticketData) {
                    setTicket(ticketData);
                    cacheTicketDetails(ticketData);
                    if (ticketData?.status && !previousStatus) {
                        setPreviousStatus(ticketData.status);
                    }
                }
            } else {
                console.error('Error loading ticket details:', ticketResult.reason);
            }

            if (messagesResult.status === 'fulfilled') {
                const msgs = Array.isArray(messagesResult.value?.messages) ? messagesResult.value.messages : [];
                setConversationMessages(msgs);

                const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                if (latestMsg?.id) {
                    if (lastSeenMessageIdRef.current === null) {
                        lastSeenMessageIdRef.current = latestMsg.id;
                    } else if (latestMsg.id !== lastSeenMessageIdRef.current && isMessageFromTechnician(latestMsg)) {
                        const newNotification = {
                            id: Date.now(),
                            type: 'message',
                            title: 'New Message',
                            message: `New message from technician: ${latestMsg.message?.slice(0, 60) || ''}`,
                            timestamp: new Date(),
                            read: false,
                        };
                        setNotifications(prev => [newNotification, ...prev]);
                        setUnreadCount(prev => prev + 1);
                        setNotificationToast(newNotification);
                        setTimeout(() => setNotificationToast(null), 5000);
                        lastSeenMessageIdRef.current = latestMsg.id;
                    } else {
                        lastSeenMessageIdRef.current = latestMsg.id;
                    }
                }
            } else {
                console.error('Error loading ticket messages:', messagesResult.reason);
            }
        } catch (err) {
            console.error('Error loading ticket content:', err);
        } finally {
            if (!silentMessages) {
                setLoadingMessages(false);
            }
        }
    };

    const loadTicket = async () => {
        setError(null);
        const cachedEntry = ticketDetailCacheRef.current.get(ticketId);

        if (cachedEntry && isTicketCacheFresh(cachedEntry)) {
            setTicket(cachedEntry.ticket);
            setLoading(false);
            loadTicketData({ refresh: true, silentMessages: true });
            return;
        }

        setLoading(true);
        try {
            await loadTicketData();
        } catch (err) {
            console.error('Error loading ticket:', err);
            setError('Failed to load ticket details');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim()) {
            console.warn('Message text is empty');
            return;
        }

        if (!ticket?.id_employee) {
            console.error('No employee assigned to this ticket', {
                ticket,
                id_employee: ticket?.id_employee,
            });
            return;
        }

        setIsSubmittingMessage(true);
        try {
            const payload = {
                recipient_id: ticket.id_employee,
                recipient_type: 'employee',
                message: messageText,
                ticket_id: ticketId,
            };
            console.log('Sending message with payload:', payload);
            
            const response = await sendMessage(payload);
            console.log('Message sent successfully:', response);
            
            setMessageText('');
            // Refresh messages
            await fetchConversationMessages();
        } catch (error) {
            console.error('Failed to send message - Full error:', error);
            const errorMessage = error?.message || error?.error || JSON.stringify(error);
            console.error('Error details:', {
                message: error?.message,
                error: error?.error,
                status: error?.status,
                fullError: error,
            });
            alert(`Failed to send message:\n${errorMessage}`);
        } finally {
            setIsSubmittingMessage(false);
        }
    };

    const handlePostUpdate = async () => {
        if (!comment.trim()) {
            return;
        }

        if (!ticket?.id_employee) {
            alert('No technician is assigned yet, so update cannot be posted.');
            return;
        }

        setPostingUpdate(true);
        try {
            await sendMessage({
                recipient_id: ticket.id_employee,
                recipient_type: 'employee',
                message: comment.trim(),
                ticket_id: ticketId,
            });

            setComment('');
            await fetchConversationMessages();
        } catch (error) {
            const errorMessage = error?.message || error?.error || 'Failed to post update.';
            alert(errorMessage);
        } finally {
            setPostingUpdate(false);
        }
    };

    const markAsRead = (notifId) => {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleDeleteTicket = async () => {
        try {
            setDeleting(true);
            await deleteTicket(ticketId);
            setShowDeleteConfirm(false);
            // Navigate back after deletion
            setTimeout(() => onBack(), 500);
        } catch (err) {
            console.error('Error deleting ticket:', err);
            setError('Failed to delete ticket');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center px-4">
                <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4 animate-pulse">
                        <span className="material-symbols-outlined text-3xl">support_agent</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Opening ticket details…</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Fetching your ticket and conversation faster.</p>
                </div>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center">
                <div className="text-center bg-white dark:bg-surface-dark rounded-xl p-8 max-w-md">
                    <span className="material-symbols-outlined text-4xl text-red-500 mb-4 block">error</span>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">{error || 'Ticket not found'}</p>
                    <button 
                        onClick={onBack}
                        className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen">
            {/* Toast Notification */}
            {notificationToast && (
                <div className="fixed top-4 right-4 z-[60] animate-in fade-in slide-in-from-top">
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl p-4 max-w-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                {notificationToast.type === 'status_change' && (
                                    <span className="material-symbols-outlined text-amber-500 text-xl">update</span>
                                )}
                                {notificationToast.type === 'assignment' && (
                                    <span className="material-symbols-outlined text-emerald-500 text-xl">person_add</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{notificationToast.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{notificationToast.message}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-sm shadow-2xl">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400">warning</span>
                        </div>
                        <h3 className="text-lg font-bold text-center mb-2">Delete Ticket?</h3>
                        <p className="text-center text-slate-600 dark:text-slate-300 text-sm mb-6">
                            Are you sure you want to delete ticket <span className="font-bold">#{ticket.id}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteTicket}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <span className="animate-spin">⟳</span> Deleting...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">delete</span> Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-4 lg:px-10 py-3 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
                            <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-2xl">confirmation_number</span>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">IDSoft <span className="text-primary">Service</span></h2>
                        </div>
                        <nav className="hidden md:flex items-center gap-6">
                            <a onClick={onBack} className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href="#">Dashboard</a>
                            <a className="text-sm font-medium text-primary" href="#">My Tickets</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                            <input className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary" placeholder="Search tickets..." type="text" />
                        </div>
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="material-symbols-outlined p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors relative"
                            >
                                notifications
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-surface-dark rounded-lg shadow-2xl border border-slate-200 dark:border-border-dark z-50 max-h-96 overflow-y-auto">
                                    <div className="p-4 border-b border-slate-200 dark:border-border-dark sticky top-0 bg-white dark:bg-surface-dark">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                            {unreadCount > 0 && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-1 rounded">
                                                    {unreadCount} new
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {notifications.length > 0 ? (
                                            notifications.map(notif => (
                                                <div 
                                                    key={notif.id}
                                                    onClick={() => markAsRead(notif.id)}
                                                    className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors ${
                                                        !notif.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-1">
                                                            {notif.type === 'status_change' && (
                                                                <span className="material-symbols-outlined text-amber-500 text-xl">update</span>
                                                            )}
                                                            {notif.type === 'assignment' && (
                                                                <span className="material-symbols-outlined text-emerald-500 text-xl">person_add</span>
                                                            )}
                                                            {notif.type === 'message' && (
                                                                <span className="material-symbols-outlined text-blue-500 text-xl">chat</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{notif.title}</p>
                                                                {!notif.read && (
                                                                    <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2"></div>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{notif.message}</p>
                                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                                                {notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl block mb-2">notifications_none</span>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/20 border-2 border-primary overflow-hidden">
                            <img alt="User Profile" className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgBkMOQo3JQUyvxQ-Hf0n73YGF5kn0kRJb7NrPOWdlPuK0AYO0o8X4LiRlWHJzfz2JxPaxOrZ3uApgaa8e7SMR01ptXIDp9ubmdK5cCv2xA2Rk292IpM89skZK6ZV0JoD58ShKvupiRdP_aUiIDd2j1hvcd_UEGYUmikjt3RgID9CYWFeAclGvEhDYMOmOn5FSlKLL-Mpcpidq3kEUGSS1r2jjAsRY66e5_rSZhZy0q4OascgUdXYxOph2Nr7nKtxQnVuTn5eNfNc" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 lg:px-10 py-8">
                {/* Breadcrumbs & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <nav className="flex text-sm text-slate-500 dark:text-slate-400 mb-2">
                            <a className="hover:text-primary cursor-pointer" onClick={onBack}>My Tickets</a>
                            <span className="mx-2">/</span>
                            <span className="text-slate-900 dark:text-slate-200">{ticket.id} Tracking</span>
                        </nav>
                        <h1 className="text-3xl font-extrabold flex items-center gap-3">
                            Ticket #{ticket.id}
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                                {ticket.status || 'Open'}
                            </span>
                        </h1>
                    </div>
                    <div className="flex gap-3">
                    
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span> Delete Ticket
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left Column: Main Content */}
                    <div className="flex-1 space-y-8">
                        {/* Timeline Tracking Interface */}
                        <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">route</span> Ticket Status
                            </h3>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                                <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-900/30 p-4 lg:col-span-2">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Portal Summary</p>
                                            <h4 className="text-xl font-bold mt-1">#{ticket.id} {ticket.titre || 'Support Ticket'}</h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl">
                                                {ticket.description || 'No description provided.'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</p>
                                            <span className="inline-flex mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                {ticket.priority || 'normal'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-900/30 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Assigned Technician</p>
                                    <p className="text-lg font-bold mt-2">{ticket.employee?.name || ticket.employee?.nom || 'Unassigned'}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{ticket.employee?.email || ticket.employee?.mail || 'Waiting for assignment'}</p>
                                    <div className="mt-4 flex items-center justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Created</span>
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className={`rounded-xl border p-4 ${ticket.sla_breached ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10' : 'border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-900/30'}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">SLA Status</p>
                                    <p className={`text-lg font-bold mt-2 capitalize ${ticket.sla_breached ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {ticket.sla_state || 'pending'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                        {ticket.sla_due_at
                                            ? `Due ${new Date(ticket.sla_due_at).toLocaleString()}`
                                            : 'SLA target not available'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                {/* Workflow Progress */}
                                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-wide">Workflow Progress</p>
                                    <div className="space-y-4">
                                        {/* Stage 1: Open */}
                                        <div className="flex items-center gap-4">
                                            <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm transition-all ${
                                                ticket.status !== undefined ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                <span className="material-symbols-outlined text-lg">task_alt</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">Submitted</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        {/* Connector Line */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 flex justify-center">
                                                <div className={`w-1 h-6 ${
                                                    ticket.status === 'in progress' || ticket.status === 'in-progress' || ticket.status === 'resolved' 
                                                        ? 'bg-amber-500' 
                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                }`}></div>
                                            </div>
                                        </div>

                                        {/* Stage 2: In Progress */}
                                        <div className="flex items-center gap-4">
                                            <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm transition-all ${
                                                ticket.status === 'in progress' || ticket.status === 'in-progress' || ticket.status === 'resolved' 
                                                    ? 'bg-amber-500 text-white' 
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                <span className="material-symbols-outlined text-lg">construction</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">In Progress</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Work being handled</p>
                                            </div>
                                        </div>

                                        {/* Connector Line */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 flex justify-center">
                                                <div className={`w-1 h-6 ${
                                                    ticket.status === 'resolved' 
                                                        ? 'bg-emerald-500' 
                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                }`}></div>
                                            </div>
                                        </div>

                                        {/* Stage 3: Resolved */}
                                        <div className="flex items-center gap-4">
                                            <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm transition-all ${
                                                ticket.status === 'resolved' 
                                                    ? 'bg-emerald-500 text-white' 
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">Resolved</p>
                                                {ticket.end_at && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(ticket.end_at).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Summary */}
                                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Current Status</p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                                                {ticket.status === 'open' ? 'Open' : 
                                                 ticket.status === 'in progress' ? 'In Progress' : 
                                                 ticket.status === 'in-progress' ? 'In Progress' :
                                                 ticket.status === 'resolved' ? 'Resolved' : ticket.status}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Created</p>
                                            <p className="text-lg font-medium text-slate-900 dark:text-white">
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {ticket.image && (
                                <div className="mt-6 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-[#bba99b] uppercase tracking-wider block">Attached Image</label>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Visible to both you and the technician.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={resolveTicketImageUrl(ticket.image)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 border border-slate-200 dark:border-border-dark rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                Open
                                            </a>
                                            <button onClick={handleDeleteImage} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">Delete Image</button>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-900/30">
                                        <img src={resolveTicketImageUrl(ticket.image)} alt="Attachment" className="w-full max-h-80 object-contain bg-white dark:bg-slate-950" />
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Activity Feed & Technician Notes */}
                        <section className="space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span> Activity Log
                            </h3>
                            <div className="space-y-4">
                                {ticketTimeline.map((item, index) => (
                                    <div key={item.key} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2.5 h-2.5 rounded-full mt-2 ${item.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                                            {index !== ticketTimeline.length - 1 && (
                                                <div className="w-px flex-1 min-h-12 bg-slate-200 dark:bg-slate-800"></div>
                                            )}
                                        </div>
                                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-5 flex-1 shadow-sm">
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
                                                        <span className="font-bold">{item.label}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${item.active ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                                    {item.active ? 'Active' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Client Reply Area */}
                            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-4 mt-6">
                                <textarea
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary p-4"
                                    placeholder="Add a comment or ask a question..."
                                    rows={3}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                ></textarea>
                                <div className="flex justify-end mt-3">
                                    <button
                                        onClick={handlePostUpdate}
                                        disabled={postingUpdate || !comment.trim()}
                                        className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {postingUpdate ? 'Posting...' : 'Post Update'}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Chat Panel */}
                    <div className="w-96 shrink-0 hidden lg:block">
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-sm overflow-hidden flex flex-col h-96 sticky top-24">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-800">
                                <h4 className="font-bold text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">chat</span>
                                    Technician Chat
                                </h4>
                                {ticket.employee && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Chat with {ticket.employee.name}
                                    </p>
                                )}
                            </div>

                            {/* Messages Container */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/30">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <span className="text-xs text-slate-400">Loading messages...</span>
                                    </div>
                                ) : conversationMessages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-center">
                                        <p className="text-xs text-slate-400">No messages yet. Start the conversation!</p>
                                    </div>
                                ) : (
                                    conversationMessages.map((msg, index) => {
                                        const isFromTechnician = isMessageFromTechnician(msg);
                                        return (
                                            <div key={index} className={`flex ${isFromTechnician ? 'justify-start' : 'justify-end'}`}>
                                                <div
                                                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                                        isFromTechnician
                                                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                                                            : 'bg-primary text-white'
                                                    }`}
                                                >
                                                    <p className="break-words">{msg.message}</p>
                                                    <p className={`text-xs mt-1 ${isFromTechnician ? 'text-slate-500 dark:text-slate-400' : 'text-white/70'}`}>
                                                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            {ticket.id_employee ? (
                                <div className="p-4 border-t border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark">
                                    <div className="flex gap-2">
                                        <textarea
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                            placeholder="Type your message..."
                                            rows="2"
                                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary resize-none text-slate-900 dark:text-white"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={isSubmittingMessage || !messageText.trim()}
                                            className="bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">send</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-800 text-center">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        No technician assigned yet
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Chat Panel (Mobile) */}
            {ticket && (
                <div className="lg:hidden fixed inset-0 bg-black/50 z-40 flex items-end">
                    <div className="w-full bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-order-dark rounded-t-xl overflow-hidden flex flex-col h-96">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">chat</span>
                                Chat with Technician
                            </h4>
                            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/30">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <span className="text-xs text-slate-400">Loading messages...</span>
                                </div>
                            ) : conversationMessages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-center">
                                    <p className="text-xs text-slate-400">No messages yet. Start the conversation!</p>
                                </div>
                            ) : (
                                conversationMessages.map((msg, index) => {
                                    const isFromTechnician = isMessageFromTechnician(msg);
                                    return (
                                        <div key={index} className={`flex ${isFromTechnician ? 'justify-start' : 'justify-end'}`}>
                                            <div
                                                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                                    isFromTechnician
                                                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                                                        : 'bg-primary text-white'
                                                }`}
                                            >
                                                <p className="break-words">{msg.message}</p>
                                                <p className={`text-xs mt-1 ${isFromTechnician ? 'text-slate-500 dark:text-slate-400' : 'text-white/70'}`}>
                                                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        {ticket.id_employee ? (
                            <div className="p-4 border-t border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark">
                                <div className="flex gap-2">
                                    <textarea
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                        placeholder="Type your message..."
                                        rows="2"
                                        className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary resize-none text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isSubmittingMessage || !messageText.trim()}
                                        className="bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">send</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-slate-800 text-center">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    No technician assigned yet
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <footer className="mt-12 py-10 border-t border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark">
                <div className="max-w-7xl mx-auto px-4 lg:px-10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">confirmation_number</span>
                        <span className="font-bold text-slate-900 dark:text-white">IDSoft Service Management</span>
                    </div>
                    <div className="flex gap-8">
                        <a className="hover:text-primary" href="#">Support Policy</a>
                        <a className="hover:text-primary" href="#">Privacy</a>
                        <a className="hover:text-primary" href="#">Terms of Service</a>
                    </div>
                    <p>© 2023 IDSoft Global. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
