import React, { useState } from 'react';
import { useDevices } from '../../components/hooks/useDevices.ts';
import DeviceCard from './DeviceCard';
import LoadingState from '../Sessions/LoadingState.tsx';
import ErrorState from '../Sessions/ErrorState.tsx';
import { Device } from '../../components/types/device.ts';
import { useDebounce } from '../../components/hooks/useDebounce.ts';

const DeviceList: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 800); // ⏳ debounce delay here

    const [statusFilter, setStatusFilter] = useState('all');
    const [networkTypeFilter, setNetworkTypeFilter] = useState('all');
    const [page, setPage] = useState(1);

    const { devices, loading, error, totalPages } = useDevices({
        searchQuery: debouncedSearchQuery,
        statusFilter,
        networkTypeFilter,
        page,
    });

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
        setPage(1);
    };

    const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(event.target.value);
        setPage(1);
    };

    const handleNetworkTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setNetworkTypeFilter(event.target.value);
        setPage(1);
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    if (loading) return <LoadingState message="Loading devices..." />;
    if (error) return <ErrorState message={error} />;

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Devices</h1>

            <div className="flex flex-wrap gap-4 mb-6">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search by device name"
                    className="p-2 border rounded"
                />

                <select onChange={handleStatusChange} value={statusFilter} className="p-2 border rounded">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>

                <select onChange={handleNetworkTypeChange} value={networkTypeFilter} className="p-2 border rounded">
                    <option value="all">All network types</option>
                    <option value="wifi">Wi-Fi</option>
                    <option value="ethernet">Ethernet</option>
                </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {devices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-gray-500 py-8">
                        <div className="h-12 w-12 mb-4 text-gray-400">
                            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <p className="text-lg font-semibold">No devices found</p>
                    </div>
                ) : (
                    devices
                        .filter((device: Device) => device.status !== 'pending')
                        .map((device: Device) => (
                            <DeviceCard key={device._id} device={device} />
                        ))
                )}
            </div>

            {/* Pagination */}
            {devices.length > 0 && (
                <div className="mt-4 flex justify-between">
                    <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className="bg-gray-300 p-2 rounded"
                    >
                        Previous
                    </button>
                    <span>Page {page} of {totalPages}</span>
                    <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="bg-gray-300 p-2 rounded"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default DeviceList;
