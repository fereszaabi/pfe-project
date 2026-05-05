import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, AlertCircle, Clock, MessageCircle } from 'lucide-react';

export function ChannelSelector({ onChannelAdded, onChannelVerified, onChannelRemoved }) {
    const [availableChannels, setAvailableChannels] = useState([]);
    const [linkedChannels, setLinkedChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAddress, setNewAddress] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verifyingId, setVerifyingId] = useState(null);

    // Fetch available channels
    useEffect(() => {
        const fetchChannels = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/channels');
                const data = await response.json();
                setAvailableChannels(data.channels || []);
                
                // Fetch linked channels
                const linkedRes = await fetch('/api/channels/my');
                const linkedData = await linkedRes.json();
                setLinkedChannels(linkedData.channels || []);
            } catch (err) {
                setError('Failed to load channels');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchChannels();
    }, []);

    const addChannelAddress = async () => {
        if (!selectedChannel || !newAddress) {
            setError('Please select a channel and enter an address');
            return;
        }

        try {
            const response = await fetch('/api/channels/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    channel: selectedChannel,
                    address: newAddress
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Failed to add channel');
                return;
            }

            // Refresh linked channels
            const linkedRes = await fetch('/api/channels/my');
            const linkedData = await linkedRes.json();
            setLinkedChannels(linkedData.channels || []);

            setNewAddress('');
            setSelectedChannel(null);
            setShowAddForm(false);

            if (onChannelAdded) {
                onChannelAdded(selectedChannel);
            }
        } catch (err) {
            setError('Error adding channel');
            console.error(err);
        }
    };

    const verifyChannel = async (addressId) => {
        if (!verificationCode) {
            setError('Please enter verification code');
            return;
        }

        try {
            setVerifyingId(addressId);
            const response = await fetch(`/api/channels/${addressId}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    code: verificationCode
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Invalid verification code');
                return;
            }

            // Refresh linked channels
            const linkedRes = await fetch('/api/channels/my');
            const linkedData = await linkedRes.json();
            setLinkedChannels(linkedData.channels || []);

            setVerificationCode('');
            setVerifyingId(null);

            if (onChannelVerified) {
                onChannelVerified(addressId);
            }
        } catch (err) {
            setError('Error verifying channel');
            console.error(err);
        } finally {
            setVerifyingId(null);
        }
    };

    const removeChannel = async (addressId) => {
        if (!confirm('Are you sure you want to remove this channel?')) {
            return;
        }

        try {
            const response = await fetch(`/api/channels/${addressId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                setError('Failed to remove channel');
                return;
            }

            // Refresh linked channels
            setLinkedChannels(linkedChannels.filter(ch => ch.id !== addressId));

            if (onChannelRemoved) {
                onChannelRemoved(addressId);
            }
        } catch (err) {
            setError('Error removing channel');
            console.error(err);
        }
    };

    const getChannelIcon = (channel) => {
        return {
            'email': '📧',
            'whatsapp': '💬',
            'sms': '📱',
            'facebook': 'f',
            'instagram': '📷',
            'telegram': '✈️',
            'web': '🌐'
        }[channel] || '💬';
    };

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="inline-block animate-spin">
                    <MessageCircle className="w-8 h-8 text-primary" />
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Loading channels...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                    <p className="text-red-700 dark:text-red-400"><AlertCircle className="inline mr-2 w-4 h-4" />{error}</p>
                </div>
            )}

            {/* Active/Linked Channels */}
            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Your Communication Channels
                </h3>

                {linkedChannels.length > 0 ? (
                    <div className="space-y-3">
                        {linkedChannels.map(channel => (
                            <div key={channel.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between bg-white dark:bg-slate-800">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{getChannelIcon(channel.channel)}</span>
                                    <div>
                                        <p className="font-semibold">{channel.address}</p>
                                        {channel.verified ? (
                                            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" /> Verified
                                            </p>
                                        ) : (
                                            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                <Clock className="w-4 h-4" /> Pending verification
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeChannel(channel.id)}
                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition"
                                    title="Remove channel"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-600 dark:text-slate-400">No channels linked yet. Add one below!</p>
                )}
            </div>

            {/* Verification Input (if needed) */}
            {verifyingId && (
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                    <p className="font-semibold mb-3">Enter verification code</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="6-character code"
                            maxLength="6"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                        />
                        <button
                            onClick={() => verifyChannel(verifyingId)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Verify
                        </button>
                    </div>
                </div>
            )}

            {/* Add New Channel */}
            <div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="w-full p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add New Communication Channel
                </button>

                {showAddForm && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Select Channel</label>
                            <div className="grid grid-cols-2 gap-2">
                                {availableChannels.map(channel => (
                                    <button
                                        key={channel.name}
                                        onClick={() => setSelectedChannel(channel.name)}
                                        className={`p-3 border rounded-lg transition text-left ${
                                            selectedChannel === channel.name
                                                ? 'border-primary bg-primary/10'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                                        }`}
                                    >
                                        <span className="text-2xl mr-2">{getChannelIcon(channel.name)}</span>
                                        <p className="font-semibold text-sm">{channel.display_name}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">{channel.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedChannel && (
                            <div>
                                <label className="block text-sm font-semibold mb-2">
                                    {selectedChannel === 'email' && 'Email Address'}
                                    {selectedChannel === 'whatsapp' && 'WhatsApp Number'}
                                    {selectedChannel === 'sms' && 'Phone Number'}
                                    {selectedChannel === 'facebook' && 'Facebook ID'}
                                </label>
                                <input
                                    type={selectedChannel === 'email' ? 'email' : 'text'}
                                    placeholder={
                                        selectedChannel === 'email' ? 'your@email.com' :
                                        selectedChannel === 'whatsapp' ? '+1234567890' :
                                        selectedChannel === 'sms' ? '+1234567890' :
                                        'Your ID'
                                    }
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={addChannelAddress}
                                disabled={!selectedChannel || !newAddress}
                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Channel
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddForm(false);
                                    setSelectedChannel(null);
                                    setNewAddress('');
                                }}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Channel Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                    💡 <strong>Tip:</strong> Link multiple channels to communicate via your preferred method. All messages will be kept together in one ticket.
                </p>
            </div>
        </div>
    );
}
