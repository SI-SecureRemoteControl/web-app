import React from 'react';
import { Search, Filter } from 'lucide-react';
import { DeviceStatus, NetworkType } from '../types/device';

interface DeviceFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: DeviceStatus | 'all';
    setStatusFilter: (status: DeviceStatus | 'all') => void;
    networkTypeFilter: NetworkType | 'all';
    setNetworkTypeFilter: (type: NetworkType | 'all') => void;
}

export const DeviceFilters: React.FC<DeviceFiltersProps> = ({
                                                                searchQuery,
                                                                setSearchQuery,
                                                                statusFilter,
                                                                setStatusFilter,
                                                                networkTypeFilter,
                                                                setNetworkTypeFilter,
                                                            }) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or model..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-4 flex-wrap md:flex-nowrap">
                    <div className="flex items-center gap-2">
                        <Filter size={20} className="text-gray-500" />
                        <select
                            className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as DeviceStatus | 'all')}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                    <select
                        className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={networkTypeFilter}
                        onChange={(e) => setNetworkTypeFilter(e.target.value as NetworkType | 'all')}
                    >
                        <option value="all">All Network Types</option>
                        <option value="wifi">WiFi</option>
                        <option value="mobileData">Mobile Data</option>
                    </select>
                </div>
            </div>
        </div>
    );
};