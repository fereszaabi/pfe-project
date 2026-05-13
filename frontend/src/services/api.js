const API_ROOT = import.meta.env.VITE_API_ROOT || '';
const BASE = API_ROOT ? `${API_ROOT.replace(/\/$/, '')}/api` : '/api';

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

async function apiRequest(method, path, body = null, timeout = 30000) {
    const controller = new AbortController();
    const signal = controller.signal;
    const opts = { method, headers: authHeaders(), signal };
    if (body) opts.body = JSON.stringify(body);

    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(BASE + path, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw data;
        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw { error: 'Request timed out. Please try again.' };
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function apiUpload(method, path, formData, timeout = 10000) {
    const token = getToken();
    const controller = new AbortController();
    const opts = {
        method,
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: controller.signal,
    };

    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(BASE + path, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw data;
        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw { error: 'Request timed out. Please try again.' };
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildQuery(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return query ? `?${query}` : '';
}

// ── Auth ────────────────────────────────────────────────────────────
export const login = (identifier, password, captchaToken, captchaAnswer) =>
    apiRequest('POST', '/login', { identifier, password, captcha_token: captchaToken, captcha_answer: captchaAnswer });

export const getCaptchaChallenge = () =>
    apiRequest('GET', '/captcha/challenge');

export const verifyCaptcha = (token, answer) =>
    apiRequest('POST', '/captcha/verify', { captcha_token: token, captcha_answer: answer });

export const verifyLoginOtp = (loginToken, otp) =>
    apiRequest('POST', '/login/verify-otp', { login_token: loginToken, otp });

export const sendRegisterVerificationCode = (data) =>
    apiRequest('POST', '/register/send-code', data);

export const register = (data) =>
    apiRequest('POST', '/register', data);

export const logout = () =>
    apiRequest('POST', '/logout');

export const getMe = () =>
    apiRequest('GET', '/user');

// ── Client ───────────────────────────────────────────────────────────
export const getClientTickets = (params) =>
    apiRequest('GET', `/client/tickets${buildQuery(params)}`);

export const getClientTicket = (id) =>
    apiRequest('GET', `/client/tickets/${id}`);

export const sendTicketOtp = () =>
    apiRequest('POST', '/client/tickets/send-otp');

export const createTicket = (formData) =>
    apiUpload('POST', '/client/tickets', formData);

export const deleteTicket = (id) =>
    apiRequest('DELETE', `/client/tickets/${id}`);

// ── Machines ────────────────────────────────────────────────────────
export const getMachines = () =>
    apiRequest('GET', '/client/machines');

export const getClientMachines = () =>
    apiRequest('GET', '/client/machines');

export const getClientProfile = () =>
    apiRequest('GET', '/client/profile');

export const getClientLogs = (params) =>
    apiRequest('GET', `/client/logs${buildQuery(params)}`);

export const getClientLogsStreamUrl = () =>
    `${BASE}/client/logs/stream`;

export const markClientLogRead = (logId) =>
    apiRequest('PATCH', `/client/logs/${logId}/read`);

export const deleteTicketImage = (ticketId) =>
    apiRequest('DELETE', `/client/tickets/${ticketId}/image`);

export const askSupportBot = (message, history = []) =>
    apiRequest('POST', '/client/support-bot', { message, history });

export const getSupportBotHistory = () =>
    apiRequest('GET', '/client/support-bot/history');

export const getSupportBotSession = (sessionId) =>
    apiRequest('GET', `/client/support-bot/history/${sessionId}`);

export const saveSupportBotHistory = (title, messages) =>
    apiRequest('POST', '/client/support-bot/history', { title, messages });

export const getHelpArticles = (params) =>
    apiRequest('GET', `/client/help/articles${buildQuery(params)}`);

export const createMachine = (data) =>
    apiRequest('POST', '/client/machines', data);

export const updateMachine = (id, data) =>
    apiRequest('PATCH', `/client/machines/${id}`, data);

export const deleteMachine = (id) =>
    apiRequest('DELETE', `/client/machines/${id}`);

// ── Employee ─────────────────────────────────────────────────────────
export const getEmployeeTickets = (params) =>
    apiRequest('GET', `/employee/tickets${buildQuery(params)}`);

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

export const getItTickets = () =>
    apiRequest('GET', '/it/tickets');

// ── Messaging ────────────────────────────────────────────────────────
export const getConversations = () =>
    apiRequest('GET', '/messages/conversations');

export const getConversationMessages = (conversationId) =>
    apiRequest('GET', `/messages/conversations/${conversationId}`);

export const getTicketMessages = (ticketId) =>
    apiRequest('GET', `/messages/tickets/${ticketId}`);

export const sendMessage = (data) =>
    apiRequest('POST', '/messages/send', data);

export const startConversation = (userId) =>
    apiRequest('POST', `/messages/start/${userId}`);

export const getAvailableEmployees = () =>
    apiRequest('GET', '/messages/available-employees');

export const getUnreadMessages = () =>
    apiRequest('GET', '/messages/unread');

// ── Client Rating ────────────────────────────────────────────────────
export const rateEmployee = (ticketId, rating, ratingComment = '') =>
    apiRequest('POST', `/client/tickets/${ticketId}/rate`, {
        rating,
        rating_comment: ratingComment,
    });

// ── Admin ────────────────────────────────────────────────────────────
export const getAdminDemandes = (params) =>
    apiRequest('GET', `/admin/demandes${buildQuery(params)}`);

export const getAdminTicketDetail = (id) =>
    apiRequest('GET', `/admin/demandes/${id}`);

export const getAdminStats = () =>
    apiRequest('GET', '/admin/stats');

export const getAdminOtpCodes = (limit = 20) =>
    apiRequest('GET', `/admin/otp-codes?limit=${encodeURIComponent(limit)}`);

export const getAdminClients = (params) =>
    apiRequest('GET', `/admin/clients${buildQuery(params)}`);

export const createAdminUser = (data) =>
    apiRequest('POST', '/admin/users', data);

export const updateClient = (id, data) =>
    apiRequest('PATCH', `/admin/clients/${id}`, data);

export const updateDemandeStatus = (id, data) =>
    apiRequest('PATCH', `/admin/demandes/${id}/status`, data);

export const assignAdminTicket = (id, employeeId) =>
    apiRequest('PATCH', `/admin/demandes/${id}/assign`, { employee_id: employeeId });

export const deleteUser = (id) =>
    apiRequest('DELETE', `/admin/users/${id}`);

export const takeMoney = (id, amount) =>
    apiRequest('PATCH', `/admin/clients/${id}/take-money`, { amount });

export const updateClientBalance = (id, amount, operation = 'set') =>
    apiRequest('PATCH', `/admin/clients/${id}/balance`, { amount, operation });

export const getInsufficientFundsTickets = () =>
    apiRequest('GET', '/admin/tickets/insufficient-funds');

export const adminBlockTicket = (ticketId) =>
    apiRequest('POST', `/admin/tickets/${ticketId}/block`);

export const adminUnblockTicket = (ticketId) =>
    apiRequest('POST', `/admin/tickets/${ticketId}/unblock`);

// ── Employee Management ──────────────────────────────────────────────
export const getEmployees = () =>
    apiRequest('GET', '/admin/employees');

export const createEmployee = (data) =>
    apiRequest('POST', '/admin/employees', data);

export const updateEmployee = (id, data) =>
    apiRequest('PATCH', `/admin/employees/${id}`, data);

export const deleteEmployee = (id) =>
    apiRequest('DELETE', `/admin/employees/${id}`);

export const getEmployeePerformance = (employeeId) =>
    apiRequest('GET', `/admin/employees/${employeeId}/stats`);

// ── Analytics & Reporting ───────────────────────────────────────────
export const getKpiMetrics = (startDate, endDate) =>
    apiRequest('GET', `/analytics/kpis${buildQuery({ start_date: startDate, end_date: endDate })}`);

export const getTrendData = (metric, startDate, endDate) =>
    apiRequest('GET', `/analytics/trends${buildQuery({ metric, start_date: startDate, end_date: endDate })}`);

export const getAgentWorkload = (startDate, endDate) =>
    apiRequest('GET', `/analytics/agent-workload${buildQuery({ start_date: startDate, end_date: endDate })}`);

export const getBacklogDetails = (startDate, endDate, priority = null) =>
    apiRequest('GET', `/analytics/backlog${buildQuery({ start_date: startDate, end_date: endDate, priority })}`);

export const exportReport = (reportType, format, startDate, endDate) =>
    apiRequest('POST', '/analytics/export', { report_type: reportType, format, start_date: startDate, end_date: endDate });

// ── Multi-Channel Communication ──────────────────────────────────────
export const getAvailableChannels = () =>
    apiRequest('GET', '/channels');

export const getClientChannels = () =>
    apiRequest('GET', '/channels/my');

export const addChannelAddress = (channel, address) =>
    apiRequest('POST', '/channels/add', { channel, address });

export const verifyChannelAddress = (addressId, code) =>
    apiRequest('POST', `/channels/${addressId}/verify`, { code });

export const removeChannelAddress = (addressId) =>
    apiRequest('DELETE', `/channels/${addressId}`);

export const getAdminChannels = () =>
    apiRequest('GET', '/channels/admin/list');

export const getWebhookStatus = () =>
    apiRequest('GET', '/webhooks/status');

export const retryFailedWebhooks = () =>
    apiRequest('POST', '/webhooks/retry');

// ── Client Profile ──────────────────────────────────────────────────
export const updateClientProfile = (data) =>
    apiRequest('PATCH', '/client/profile', data);

export const contactSupport = (subject, message) =>
    apiRequest('POST', '/client/support/contact', { subject, message });

export const startSupportConversation = (subject = 'Balance Top-up Inquiry') =>
    apiRequest('POST', '/messages/start-support', { subject });
// ── Notifications ───────────────────────────────────────────────
export const notifyEmployeeAssignment = (employeeId, ticketId, ticketTitle) =>
    apiRequest('POST', '/employee/notify/assignment', { employee_id: employeeId, ticket_id: ticketId, ticket_title: ticketTitle });

export const notifyEmployeeReassignment = (employeeId, ticketId, ticketTitle, previousEmployeeId = null) =>
    apiRequest('POST', '/employee/notify/reassignment', { employee_id: employeeId, ticket_id: ticketId, ticket_title: ticketTitle, previous_employee_id: previousEmployeeId });