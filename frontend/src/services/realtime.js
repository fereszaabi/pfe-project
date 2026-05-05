import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:8000';
const PUSHER_KEY = import.meta.env.VITE_PUSHER_APP_KEY || 'local';
const PUSHER_HOST = import.meta.env.VITE_PUSHER_HOST || '127.0.0.1';
const PUSHER_PORT = Number(import.meta.env.VITE_PUSHER_PORT || 6001);
const PUSHER_SCHEME = import.meta.env.VITE_PUSHER_SCHEME || 'http';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1';

let echoInstance = null;

export function getEcho() {
    if (echoInstance) {
        return echoInstance;
    }

    const token = localStorage.getItem('auth_token');

    window.Pusher = Pusher;

    echoInstance = new Echo({
        broadcaster: 'pusher',
        key: PUSHER_KEY,
        cluster: PUSHER_CLUSTER,
        wsHost: PUSHER_HOST,
        wsPort: PUSHER_PORT,
        wssPort: PUSHER_PORT,
        forceTLS: PUSHER_SCHEME === 'https',
        encrypted: PUSHER_SCHEME === 'https',
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${API_ROOT}/broadcasting/auth`,
        auth: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
    });

    return echoInstance;
}

export function resetEcho() {
    if (echoInstance) {
        echoInstance.disconnect();
        echoInstance = null;
    }
}
