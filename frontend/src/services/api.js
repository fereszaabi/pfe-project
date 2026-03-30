const BASE = '/api';

function getToken() {
    return localStorage.getItem('auth_token');
}

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function apiRequest(method, path, body = null) {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data;
}

async function apiUpload(method, path, formData) {
    const token = getToken();
    const opts = {
        method,
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
    };
    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data;
}

// ── Auth ────────────────────────────────────────────────────────────
export const login = (identifier, password) =>
    apiRequest('POST', '/login', { identifier, password });

export const register = (data) =>
    apiRequest('POST', '/register', data);

export const logout = () =>
    apiRequest('POST', '/logout');

export const getMe = () =>
    apiRequest('GET', '/user');

// ── Client ───────────────────────────────────────────────────────────
export const getClientTickets = () =>
    apiRequest('GET', '/client/tickets');

export const getClientTicket = (id) =>
    apiRequest('GET', `/client/tickets/${id}`);

export const createTicket = (formData) =>
    apiUpload('POST', '/client/tickets', formData);

export const deleteTicket = (id) =>
    apiRequest('DELETE', `/client/tickets/${id}`);

// ── Machines ────────────────────────────────────────────────────────
export const getClientMachines = () =>
    apiRequest('GET', '/client/machines');

export const createMachine = (data) =>
    apiRequest('POST', '/client/machines', data);

export const updateMachine = (id, data) =>
    apiRequest('PATCH', `/client/machines/${id}`, data);

export const deleteMachine = (id) =>
    apiRequest('DELETE', `/client/machines/${id}`);

// ── Employee ─────────────────────────────────────────────────────────
export const getEmployeeTickets = () =>
    apiRequest('GET', '/employee/tickets');

export const assignTicket = (id) =>
    apiRequest('POST', `/employee/tickets/${id}/claim`);

export const claimTicket = (id) =>
    apiRequest('POST', `/employee/tickets/${id}/claim`);

export const unclaimTicket = (id) =>
    apiRequest('POST', `/employee/tickets/${id}/unclaim`);

export const updateEmployeeTicket = (id, data) =>
    apiRequest('PATCH', `/employee/tickets/${id}`, data);

export const rateTicket = (id, rating) =>
    apiRequest('POST', `/employee/tickets/${id}/rate`, { rating });

export const getEmployeeStats = () =>
    apiRequest('GET', '/employee/stats');

export const getEmployeeLeaderboard = (limit = 10) =>
    apiRequest('GET', `/employee/leaderboard?limit=${limit}`);

// ── Messaging ────────────────────────────────────────────────────────
export const getConversations = () =>
    apiRequest('GET', '/messages/conversations');

export const getConversationMessages = (conversationId) =>
    apiRequest('GET', `/messages/conversations/${conversationId}`);

export const sendMessage = (data) =>
    apiRequest('POST', '/messages/send', data);

export const startConversation = (userId) =>
    apiRequest('POST', `/messages/start/${userId}`);

export const getAvailableEmployees = () =>
    apiRequest('GET', '/messages/available-employees');

export const getUnreadMessages = () =>
    apiRequest('GET', '/messages/unread');

// ── Client Rating ────────────────────────────────────────────────────
export const rateEmployee = (ticketId, rating) =>
    apiRequest('POST', `/client/tickets/${ticketId}/rate`, { rating });

// ── Admin ────────────────────────────────────────────────────────────
export const getAdminDemandes = () =>
    apiRequest('GET', '/admin/demandes');

export const getAdminStats = () =>
    apiRequest('GET', '/admin/stats');

export const createAdminUser = (data) =>
    apiRequest('POST', '/admin/users', data);

export const updateClient = (id, data) =>
    apiRequest('PATCH', `/admin/clients/${id}`, data);

export const updateDemandeStatus = (id, data) =>
    apiRequest('PATCH', `/admin/demandes/${id}/status`, data);

export const deleteUser = (id) =>
    apiRequest('DELETE', `/admin/users/${id}`);

export const takeMoney = (id, amount) =>
    apiRequest('PATCH', `/admin/clients/${id}/take-money`, { amount });
