import { useState, useEffect } from 'react';
import { getClientTicket, deleteTicket } from '../../services/api';

export function TicketTracking({ ticketId, onBack }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [comment, setComment] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [previousStatus, setPreviousStatus] = useState(null);
    const [notificationToast, setNotificationToast] = useState(null);

    useEffect(() => {
        loadTicket();
        const pollInterval = setInterval(checkForUpdates, 5000); // Poll every 5 seconds
        return () => clearInterval(pollInterval);
    }, [ticketId]);

    const loadTicket = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getClientTicket(ticketId);
            setTicket(data);
            if (data.status && !previousStatus) {
                setPreviousStatus(data.status);
            }
        } catch (err) {
            console.error('Error loading ticket:', err);
            setError('Failed to load ticket details');
        } finally {
            setLoading(false);
        }
    };

    const checkForUpdates = async () => {
        try {
            const data = await getClientTicket(ticketId);
            if (ticket && data.status !== ticket.status) {
                // Status changed, add notification
                const newNotification = {
                    id: Date.now(),
                    type: 'status_change',
                    title: 'Ticket Status Updated',
                    message: `Status changed from ${ticket.status} to ${data.status}`,
                    timestamp: new Date(),
                    read: false,
                    oldStatus: ticket.status,
                    newStatus: data.status
                };
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
                setNotificationToast(newNotification);
                setTimeout(() => setNotificationToast(null), 5000);
            } else if (ticket && data.employee && !ticket.employee && data.id_employee) {
                // Ticket was assigned
                const newNotification = {
                    id: Date.now(),
                    type: 'assignment',
                    title: 'Ticket Assigned',
                    message: `Your ticket has been assigned to ${data.employee.name}`,
                    timestamp: new Date(),
                    read: false
                };
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
                setNotificationToast(newNotification);
                setTimeout(() => setNotificationToast(null), 5000);
            }
            setTicket(data);
        } catch (err) {
            console.error('Error checking for updates:', err);
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
            <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin mb-4">
                        <span className="material-symbols-outlined text-4xl text-primary">refresh</span>
                    </div>
                    <p className="text-slate-500">Loading ticket details...</p>
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
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-lg">print</span> Print Report
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg">chat</span> Contact Technician
                        </button>
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span> Delete Ticket
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Main Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Timeline Tracking Interface */}
                        <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">route</span> Ticket Status
                            </h3>
                            
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
                        </section>

                        {/* Activity Feed & Technician Notes */}
                        <section className="space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span> Activity Log
                            </h3>
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2.5 h-2.5 rounded-full mt-2 bg-primary"></div>
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-5 flex-1 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold">Ticket Created</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(ticket.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {ticket.titre}
                                        </p>
                                    </div>
                                </div>
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
                                    <button className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 transition-colors">Post Update</button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Ticket Info Card */}
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-6 shadow-sm">
                            <h4 className="font-bold mb-4 uppercase text-xs text-slate-400 tracking-widest">Ticket Details</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Priority</span>
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs font-bold uppercase">
                                        {ticket.priority || 'Medium'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Title</span>
                                    <span className="font-medium text-right">{ticket.titre}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Machine</span>
                                    <span className="font-medium text-right">
                                        {ticket.machine?.nom_poste || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                                    <span className="font-medium text-right">
                                        {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Assigned Technician with Progress */}
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-6 shadow-sm">
                            <h4 className="font-bold mb-4 uppercase text-xs text-slate-400 tracking-widest">Assigned Technician</h4>
                            {ticket.employee ? (
                                <>
                                    {/* Progress Bar with Agent Name */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-lg">person</span>
                                                <span className="font-bold text-sm text-slate-900 dark:text-white">{ticket.employee.name}</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                {ticket.status === 'open' ? '0%' : 
                                                 ticket.status === 'in progress' || ticket.status === 'in-progress' ? '50%' : 
                                                 ticket.status === 'resolved' ? '100%' : '0%'}
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    ticket.status === 'resolved' ? 'bg-emerald-500' :
                                                    ticket.status === 'in progress' || ticket.status === 'in-progress' ? 'bg-amber-500' :
                                                    'bg-slate-300'
                                                }`}
                                                style={{
                                                    width: ticket.status === 'open' ? '0%' : 
                                                           ticket.status === 'in progress' || ticket.status === 'in-progress' ? '50%' : 
                                                           ticket.status === 'resolved' ? '100%' : '0%'
                                                }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {ticket.status === 'open' ? 'Pending Assignment' : 
                                             ticket.status === 'in progress' || ticket.status === 'in-progress' ? 'Work in Progress' : 
                                             ticket.status === 'resolved' ? 'Completed' : 'Processing'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/20 border-2 border-primary flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary">person</span>
                                        </div>
                                        <div>
                                            <p className="font-bold">{ticket.employee.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Technician</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button className="p-2 border border-slate-200 dark:border-border-dark rounded-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <span className="material-symbols-outlined text-xl">call</span>
                                        </button>
                                        <button className="p-2 border border-slate-200 dark:border-border-dark rounded-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <span className="material-symbols-outlined text-xl">mail</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">person_off</span>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">No technician assigned yet</p>
                                </div>
                            )}
                        </div>

                        {/* Attachments */}
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-6 shadow-sm">
                            <h4 className="font-bold mb-4 uppercase text-xs text-slate-400 tracking-widest">Description</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                                {ticket.description}
                            </p>
                            {ticket.image && (
                                <div className="mt-4">
                                    <p className="text-xs text-slate-500 mb-2">Attached Image</p>
                                    <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-border-dark overflow-hidden">
                                        <img alt="Ticket attachment" className="w-full h-full object-cover" src={`/storage/${ticket.image}`} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Support Shortcut */}
                        <div className="bg-gradient-to-br from-primary to-orange-700 rounded-xl p-6 text-white shadow-xl shadow-primary/10">
                            <span className="material-symbols-outlined text-3xl mb-2">support_agent</span>
                            <h5 className="font-bold text-lg leading-tight">Need immediate assistance?</h5>
                            <p className="text-xs text-white/80 mt-2 mb-4">Our live agents are available 24/7 for urgent escalations regarding your service.</p>
                            <button className="w-full bg-white text-primary font-bold py-2 rounded-lg text-sm hover:bg-orange-50 transition-colors">Open Live Chat</button>
                        </div>
                    </div>
                </div>
            </main>

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
