import { useState, useEffect } from 'react'; 
import { Smartphone, Wifi, Radio, WifiOff } from 'lucide-react'; 
import { Device, DeviceStatus, NetworkType } from '../../components/types/device';
import { DeviceStatusBadge } from '../../components/Devices/DeviceStatusBadge';
import { DeviceFilters } from '../../components/Devices/DeviceFilters';
import { UnregisterModal } from '../../components/Devices/UnregisterModal';
import { websocketService } from '../../services/webSocketService';


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

    useEffect(() => {
        fetchDevices();
    }, [page, searchQuery, statusFilter, networkTypeFilter]);

    useEffect(() => {
        const handleWebSocketMessage = (data: any) => {
           console.log("Message received in component:", data);
           if (data.change) { 
              const change = data.change;
               if (change.operationType === 'update') {
                   setDevices(prev => prev.map(d => d.deviceId === change.documentKey._id ? change.fullDocument : d)); 
               } else if (change.operationType === 'insert') {
                   setDevices(prev => [change.fullDocument, ...prev]);
               } else if (change.operationType === 'delete') {
                    setDevices(prev => prev.filter(d => d.deviceId !== change.documentKey._id)); 
               }
           } 
        };
      
        websocketService.connect();
        websocketService.addMessageListener(handleWebSocketMessage);
      
        return () => {
          console.log("DeviceDashboard unmounting: Removing message listener.");
          websocketService.removeMessageListener(handleWebSocketMessage);
        };
      }, []);

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

            const url: string = import.meta.env.VITE_BASE_URL + `/api/devices?${params.toString()}`;
            const headers = new Headers({ 'Content-Type': 'application/json' });

            const res: Response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log(data);
            setDevices(data.devices);
            setTotalPages(data.totalPages);

        } catch (err) {

            setError('Failed to fetch devices. Please try again later.');
            console.error('Error fetching devices:', err);
        } finally {
            console.log(devices);
            setLoading(false);
        }
    };

    // handleUnregister funkcija ostaje ovde
    const handleUnregister = async (device: Device) => {
        setSelectedDevice(device);
        const url: string = import.meta.env.VITE_BASE_URL + `/devices/deregistration/${device.deviceId}`;
        const headers = new Headers({ 'Content-Type': 'application/json' });

        const res: Response = await fetch(url, {
            method: 'POST',
            headers: headers
        });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        device.deregistrationKey = data.deregistrationKey;
        setIsUnregisterModalOpen(true);
    };

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

    const EmptyState = () => (
        <div className="text-center py-12">
            <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
            <p className="text-gray-500 mb-6">
                {searchQuery || statusFilter !== 'all' || networkTypeFilter !== 'all'
                    ? "No devices match your current filters. Try adjusting your search criteria."
                    : "There are no registered devices in the system yet."}
            </p>
            {(searchQuery || statusFilter !== 'all' || networkTypeFilter !== 'all') && (
                <button
                    onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setNetworkTypeFilter('all');
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Clear all filters
                </button>
            )}
        </div>
    );

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
                <div className="bg-red-50 text-red-800 p-4 rounded-lg shadow">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent p-6">
            <div className="max-w-7xl mx-auto">            
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP
                                        Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last
                                        Active
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4">
                                            <div className="flex items-center justify-center">
                                                <div
                                                    className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : devices.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4">
                                            <EmptyState />
                                        </td>
                                    </tr>
                                ) : (

                                    devices.map((device) => (
                                        // Proverite da li 'device.id' postoji i da je jedinstven. Ako koristite MongoDB _id, možda je device._id
                                        <tr key={device.deviceId}>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
                                                    <div>
                                                        <div
                                                            className="text-sm font-medium text-gray-900">{device.name}</div>
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
                                                {device.lastActiveTime ? new Date(device.lastActiveTime).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleUnregister(device)}
                                                    disabled={device.status !== 'active' && device.status !== 'inactive'} 
                                                    className={`px-4 py-2 rounded-lg transition-colors font-medium
                                            ${device.status === 'active' || device.status === 'inactive'
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
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

                {/* Pagination */}
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
