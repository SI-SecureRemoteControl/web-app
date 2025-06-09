import { useState, useEffect } from 'react';
import { Device } from '../types/device';

interface DeviceFilters {
    searchQuery: string;
    statusFilter: string;
    networkTypeFilter: string;
    page: number;
}

export function useDevices(filters: DeviceFilters) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState<number>(1);  // Add total pages state

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams({
                    page: filters.page.toString(),
                    limit: '10',
                    sortBy: 'lastActiveTime',
                    sortOrder: 'desc',
                });

                if (filters.searchQuery) {
                    params.append('deviceName', filters.searchQuery);
                }
                if (filters.statusFilter !== 'all') {
                    params.append('status', filters.statusFilter);
                }
                if (filters.networkTypeFilter !== 'all') {
                    params.append('networkType', filters.networkTypeFilter);
                }

                const url = import.meta.env.VITE_BASE_URL + `/api/devices?${params.toString()}`;
                const res = await fetch(url);

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                setDevices(data.devices);
                setTotalPages(data.totalPages);
            } catch (err) {
                setError('Failed to fetch devices. Please try again later.');
                console.error('Error fetching devices:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
    }, [
        filters.page,
        filters.searchQuery,
        filters.statusFilter,
        filters.networkTypeFilter,
    ]);

    return { devices, loading, error, totalPages };
}
