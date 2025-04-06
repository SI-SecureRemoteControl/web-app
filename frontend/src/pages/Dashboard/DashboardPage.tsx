import React from 'react'; // Import React itself
import { useState, useEffect } from 'react'; // Keep state and effect hooks
import axios from 'axios'; // Keep axios for API calls
import { Smartphone, Wifi, Radio } from 'lucide-react'; // Keep icons

// Pretpostavka je da su ove putanje tačne u odnosu na novi fajl
// Ako nisu, prilagodite ih:
import { Device, DeviceStatus, NetworkType } from '../../components/types/device';
import { DeviceStatusBadge } from '../../components/Devices/DeviceStatusBadge';
import { DeviceFilters } from '../../components/Devices/DeviceFilters';
import { UnregisterModal } from '../../components/Devices/UnregisterModal';

// Definicija interfejsa ostaje ista
interface DeviceResponse {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    devices: Device[];
}

export default function DeviceDashboard() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
    const [networkTypeFilter, setNetworkTypeFilter] = useState<NetworkType | 'all'>('all');
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [isUnregisterModalOpen, setIsUnregisterModalOpen] = useState(false);

    // useEffect za dohvatanje podataka ostaje ovde
    useEffect(() => {
        fetchDevices();
    }, [page, searchQuery, statusFilter, networkTypeFilter]);

    const fetchDevices = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                sortBy: 'lastActiveTime',
                sortOrder: 'desc',
            });

            if (searchQuery) {
                params.append('deviceName', searchQuery);
            }
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (networkTypeFilter !== 'all') {
                params.append('networkType', networkTypeFilter);
            }

            // Vodite računa da je ova putanja dostupna iz vašeg okruženja
            const response = await axios.get<DeviceResponse>(`/api/devices?${params.toString()}`);
            setDevices(response.data.devices);
            setTotalPages(response.data.totalPages);
        } catch (err) {
            setError('Failed to fetch devices. Please try again later.');
            console.error('Error fetching devices:', err);
        } finally {
            setLoading(false);
        }
    };

    // handleUnregister funkcija ostaje ovde
    const handleUnregister = (device: Device) => {
        setSelectedDevice(device);
        setIsUnregisterModalOpen(true);
    };

    // getNetworkIcon funkcija ostaje ovde
    const getNetworkIcon = (type?: NetworkType) => {
        switch (type) {
            case 'wifi':
                return <Wifi className="h-5 w-5 text-blue-500" />;
            case 'mobileData':
                return <Radio className="h-5 w-5 text-green-500" />;
            default:
                return null;
        }
    };

    // Prikaz greške ostaje ovde
    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
                <div className="bg-red-50 text-red-800 p-4 rounded-lg shadow">
                    {error}
                </div>
            </div>
        );
    }

    // Glavni JSX za prikaz dashboard-a ostaje ovde
    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Device Dashboard</h1>

                <DeviceFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    networkTypeFilter={networkTypeFilter}
                    setNetworkTypeFilter={setNetworkTypeFilter}
                />

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : devices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                        No devices found
                                    </td>
                                </tr>
                            ) : (
                                devices.map((device) => (
                                    // Proverite da li 'device.id' postoji i da je jedinstven. Ako koristite MongoDB _id, možda je device._id
                                    <tr key={device.id || device._id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{device.name}</div>
                                                    <div className="text-sm text-gray-500">{device.model}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <DeviceStatusBadge status={device.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {getNetworkIcon(device.networkType)}
                                                <span className="ml-2 text-sm text-gray-500">
                                                    {device.networkType ? device.networkType === 'mobileData' ? 'Mobile Data' : 'WiFi' : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {device.ipAddress || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {device.lastActive ? new Date(device.lastActive).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleUnregister(device)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Unregister
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination ostaje ovde */}
                {totalPages > 1 && (
                    <div className="mt-4 flex justify-center">
                        <nav className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 rounded border disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 rounded border disabled:opacity-50"
                            >
                                Next
                            </button>
                        </nav>
                    </div>
                )}
            </div>

            <UnregisterModal
                isOpen={isUnregisterModalOpen}
                onClose={() => setIsUnregisterModalOpen(false)}
                unregisterKey={selectedDevice?.deregistrationKey || ''}
            />
        </div>
    );
}
