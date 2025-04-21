import React, { useState } from 'react';
import { useDevices } from '../../components/hooks/useDevices.ts';
import DeviceCard from './DeviceCard';
import LoadingState from '../Sessions/LoadingState.tsx';
import ErrorState from '../Sessions/ErrorState.tsx';
import { Device } from '../../components/types/device.ts';

const DeviceList: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [networkTypeFilter, setNetworkTypeFilter] = useState('all');
    const [page, setPage] = useState(1);

    const { devices, loading, error, totalPages } = useDevices({
        searchQuery,
        statusFilter,
        networkTypeFilter,
        page,
    });

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
        setPage(1);  // Reset to first page when search query changes
    };

    const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(event.target.value);
        setPage(1);  // Reset to first page when status changes
    };

    const handleNetworkTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setNetworkTypeFilter(event.target.value);
        setPage(1);  // Reset to first page when network type changes
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    if (loading) return <LoadingState message="Loading devices..." />;
    if (error) return <ErrorState message={error} />;

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Devices</h1>

            <div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search by device name"
                    className="mb-4 p-2 border rounded"
                />

                <select onChange={handleStatusChange} value={statusFilter} className="mb-4 p-2 border rounded">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>

                <select onChange={handleNetworkTypeChange} value={networkTypeFilter} className="mb-4 p-2 border rounded">
                    <option value="all">All network types</option>
                    <option value="wifi">Wi-Fi</option>
                    <option value="ethernet">Ethernet</option>
                </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {devices.map((device: Device) => (
                    <DeviceCard key={device._id} device={device} />
                ))}
            </div>

            {/* Pagination */}
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
        </div>
    );
};

export default DeviceList;
