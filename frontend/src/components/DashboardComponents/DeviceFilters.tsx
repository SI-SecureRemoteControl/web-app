import React from 'react';
import { Search, Filter } from 'lucide-react';
import { DeviceStatus } from '../types/device';

interface DeviceFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: DeviceStatus | 'all';
    setStatusFilter: (status: DeviceStatus | 'all') => void;
    typeFilter: string;
    setTypeFilter: (type: string) => void;
    onlineFilter: string;
    setOnlineFilter: (status: string) => void;
}

export const DeviceFilters: React.FC<DeviceFiltersProps> = ({
                                                                searchQuery,
                                                                setSearchQuery,
                                                                statusFilter,
                                                                setStatusFilter,
                                                                typeFilter,
                                                                setTypeFilter,
                                                                onlineFilter,
                                                                setOnlineFilter,
                                                            }) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search devices..."
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
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Notregistered">Not Registered</option>
                        </select>
                    </div>
                    <select
                        className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">All Types</option>
                        <option value="smartphone">Smartphone</option>
                        <option value="tablet">Tablet</option>
                        <option value="desktop">Desktop</option>
                    </select>
                    <select
                        className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={onlineFilter}
                        onChange={(e) => setOnlineFilter(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                    </select>
                </div>
            </div>
        </div>
    );
};