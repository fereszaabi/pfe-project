import { useState } from 'react';

export function TicketTracking({ ticketId, onBack }) {
    // Mock data for the specific ticket based on the HTML
    const ticket = {
        id: ticketId || 'ID-8829',
        status: 'Active',
        priority: 'High',
        category: 'Hardware Repair',
        workstationId: 'WS-ALPHA-292',
        slaRemaining: '04:22:15',
        technician: {
            name: 'Marco Rivera',
            role: 'Senior Hardware Specialist',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDo59qvaJ5K4G00V7hcygQZAe3jB9hKPpNkb_8FpnDYorOKay5rjSl5GhZtuh9l2R3VcA-sGNmALRirb5jULj5nI1vwXxmYpYxc7k8shSQ0PwnzWWz_jNLZZELFCV08zgNieASHWUwlTWAIDKQ3SL4ndci7Bo0o2Heh7LdfJhnAjGcwm36T_CDe9OS-HbUwa19XwA6t-qHm1aZ3g7uNnD8ttS__3s5ai4PAzBGeEfUhIV6OyZbVx7MzoJuJIJiD1N_jSFQ6G88DYyE'
        },
        updates: [
            {
                user: 'Marco Rivera',
                role: 'Senior Tech',
                time: 'Today, 2:45 PM',
                content: 'Disassembled the chassis and confirmed physical damage to the PCIe slot. Replacement part #P-992-B has been ordered from the central warehouse. Work will resume once the part arrives.',
                isSystem: false,
                image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC4fIqiBp65HCyIllDM-TH-1GTJ2rxHurVBAL9b6h9ykj-1bFH0oVwXDcY5fKY-oHBX_Z5iiKjqAQFheNGNyfnKQbUNd7mWgrMDdUjU3drPYqLvDESeGjsen2GBhKsY2YNfoYnBn-STY_I3ZqvQ1MxbfUVtZ3tAYmj77SpVmMNPaZGPxPTb1ri9mhPDGvD-G5ygMUEO3ed5ouRx8DCDHDrrBUvgxkOhNYzLWHHJefPI6E7EWqP0qnN33-dlg7mgnCgDmnAqGPcy_E'
            },
            {
                user: 'System Automator',
                role: '',
                time: 'Oct 25, 10:15 AM',
                content: 'Ticket status changed from Issued to Being Treated. Assigned to Marco Rivera.',
                isSystem: true
            },
            {
                user: 'Ticket Created',
                role: '',
                time: 'Oct 24, 10:00 AM',
                content: 'Initial submission: Hardware failure, workstation does not boot.',
                isSystem: true
            }
        ]
    };

    const [comment, setComment] = useState('');

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen">
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
                            <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href="#">Service Catalog</a>
                            <a className="text-sm font-medium hover:text-primary transition-colors cursor-pointer" href="#">Knowledge Base</a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                            <input className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary" placeholder="Search tickets..." type="text" />
                        </div>
                        <button className="material-symbols-outlined p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">notifications</button>
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
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider border border-primary/20">{ticket.status}</span>
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-lg">print</span> Print Report
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-lg">chat</span> Contact Technician
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Main Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Timeline Tracking Interface */}
                        <section className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">route</span> Live Progress Tracking
                            </h3>
                            <div className="relative flex justify-between">
                                {/* Connecting Line Background */}
                                <div className="absolute top-5 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 -z-0"></div>
                                {/* Active Line Overlay */}
                                <div className="absolute top-5 left-0 w-1/2 h-1 bg-primary -z-0"></div>

                                {/* Step 1: Issued */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                                        <span className="material-symbols-outlined font-variation-settings-fill">check_circle</span>
                                    </div>
                                    <p className="mt-3 font-bold text-sm">Issued</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Oct 24, 10:00 AM</p>
                                </div>

                                {/* Step 2: Being Treated */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 ring-4 ring-primary/20 animate-pulse">
                                        <span className="material-symbols-outlined">engineering</span>
                                    </div>
                                    <p className="mt-3 font-bold text-sm text-primary">Being Treated</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Oct 25, 02:30 PM</p>
                                </div>

                                {/* Step 3: Quality Check */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined">verified</span>
                                    </div>
                                    <p className="mt-3 font-bold text-sm text-slate-400">Verification</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
                                </div>

                                {/* Step 4: Resolved */}
                                <div className="relative z-10 flex flex-col items-center group">
                                    <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined">task_alt</span>
                                    </div>
                                    <p className="mt-3 font-bold text-sm text-slate-400">Resolved</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Expected: Oct 27</p>
                                </div>
                            </div>

                            <div className="mt-12 p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary">info</span>
                                <div>
                                    <p className="text-sm font-semibold">Current Update: Technician Diagnosing Motherboard</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Our Senior Technician is currently running diagnostics on the power supply module. Estimated completion of this phase is 2 hours.</p>
                                </div>
                            </div>
                        </section>

                        {/* Activity Feed & Technician Notes */}
                        <section className="space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span> Activity Log & Technician Notes
                            </h3>
                            <div className="space-y-4">
                                {ticket.updates.map((update, idx) => (
                                    <div key={idx} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2.5 h-2.5 rounded-full mt-2 ${idx === 0 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                            {idx !== ticket.updates.length - 1 && <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700"></div>}
                                        </div>
                                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-5 flex-1 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{update.user}</span>
                                                    {update.role && (
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-tighter">{update.role}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{update.time}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {update.content}
                                            </p>
                                            {update.image && (
                                                <div className="mt-4 flex gap-2">
                                                    <div className="h-16 w-24 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-border-dark overflow-hidden cursor-zoom-in">
                                                        <img alt="Hardware Photo" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" src={update.image} />
                                                    </div>
                                                </div>
                                            )}
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
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs font-bold uppercase">{ticket.priority}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Category</span>
                                    <span className="font-medium">{ticket.category}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Workstation ID</span>
                                    <span className="font-medium">{ticket.workstationId}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">SLA Timer</span>
                                    <span className="font-bold text-primary">{ticket.slaRemaining} remaining</span>
                                </div>
                            </div>
                        </div>

                        {/* Assigned Technician */}
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-6 shadow-sm">
                            <h4 className="font-bold mb-4 uppercase text-xs text-slate-400 tracking-widest">Assigned Technician</h4>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-200">
                                    <img alt="Technician" className="h-full w-full object-cover" src={ticket.technician.avatar} />
                                </div>
                                <div>
                                    <p className="font-bold">{ticket.technician.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{ticket.technician.role}</p>
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
                        </div>

                        {/* Attachments */}
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl p-6 shadow-sm">
                            <h4 className="font-bold mb-4 uppercase text-xs text-slate-400 tracking-widest">Attachments (3)</h4>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="material-symbols-outlined text-primary">image</span>
                                        <span className="text-xs font-medium truncate">damage_report_1.jpg</span>
                                    </div>
                                    <button className="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">download</button>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="material-symbols-outlined text-primary">description</span>
                                        <span className="text-xs font-medium truncate">diagnostics.pdf</span>
                                    </div>
                                    <button className="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">download</button>
                                </div>
                                <button className="w-full mt-4 py-2 border-2 border-dashed border-slate-200 dark:border-border-dark rounded-lg text-xs font-bold text-slate-500 flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all">
                                    <span className="material-symbols-outlined text-sm">add_circle</span> Upload File
                                </button>
                            </div>
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
