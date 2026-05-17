import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:8000';
const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY || import.meta.env.VITE_PUSHER_APP_KEY || 'local';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || import.meta.env.VITE_PUSHER_HOST || '127.0.0.1';
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || import.meta.env.VITE_PUSHER_PORT || 8080);
const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME || import.meta.env.VITE_PUSHER_SCHEME || 'http';
const REVERB_CLUSTER = import.meta.env.VITE_REVERB_APP_CLUSTER || import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1';

let echoInstance = null;

export function getEcho() {
    if (echoInstance) {
        return echoInstance;
    }

    const token = localStorage.getItem('auth_token');

    window.Pusher = Pusher;

    echoInstance = new Echo({
        broadcaster: 'pusher',
        key: REVERB_KEY,
        cluster: REVERB_CLUSTER,
        wsHost: REVERB_HOST,
        wsPort: REVERB_PORT,
        wssPort: REVERB_PORT,
        forceTLS: REVERB_SCHEME === 'https',
        encrypted: REVERB_SCHEME === 'https',
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
