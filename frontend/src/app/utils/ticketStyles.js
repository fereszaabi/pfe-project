const statusStyles = {
    submitted: 'bg-orange-100 text-orange-700 border border-orange-200',
    open: 'bg-orange-100 text-orange-700 border border-orange-200',
    assigned: 'bg-purple-100 text-purple-700 border border-purple-200',
    'in-progress': 'bg-blue-100 text-blue-700 border border-blue-200',
    'in progress': 'bg-blue-100 text-blue-700 border border-blue-200',
    resolved: 'bg-green-100 text-green-700 border border-green-200',
    escalated: 'bg-red-100 text-red-700 border border-red-200',
    tech: 'bg-red-100 text-red-700 border border-red-200',
};

const priorityStyles = {
    urgent: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
    high: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
    low: 'bg-green-500/10 text-green-500 border border-green-500/20',
};

const priorityDots = {
    urgent: 'bg-rose-500',
    high: 'bg-amber-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
};

export const getStatusBadgeClasses = (status) => {
    const key = String(status || '').toLowerCase();
    return statusStyles[key] || 'bg-slate-100 text-slate-600 border border-slate-200';
};

export const getPriorityBadgeClasses = (priority) => {
    const key = String(priority || '').toLowerCase();
    return priorityStyles[key] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
};

export const getPriorityDotClasses = (priority) => {
    const key = String(priority || '').toLowerCase();
    return priorityDots[key] || 'bg-slate-500';
};
