import { useState, useEffect } from 'react';
import { SessionLog, FilterOptions, PaginationOptions } from '../types/session';

// Mock API function - in a real app, this would call your actual API
const fetchSessionLogs = async (
    deviceId: string,
    filters: FilterOptions,
    pagination: Omit<PaginationOptions, 'totalPages'>
): Promise<{ logs: SessionLog[]; totalPages: number }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock data
    const mockLogs: SessionLog[] = [
        {
            id: '1',
            deviceId,
            startTime: '2025-04-20T14:32:00Z',
            endTime: '2025-04-20T14:47:23Z',
            duration: '15m 23s',
            adminId: 'admin_123',
            actions: [
                { id: 'a1', timestamp: '2025-04-20T14:33:00Z', action: 'Opened settings' },
                { id: 'a2', timestamp: '2025-04-20T14:35:00Z', action: 'Took screenshot' }
            ]
        },
        {
            id: '2',
            deviceId,
            startTime: '2025-04-19T10:15:00Z',
            endTime: '2025-04-19T10:28:45Z',
            duration: '13m 45s',
            adminId: 'admin_456',
            actions: [
                { id: 'a3', timestamp: '2025-04-19T10:16:00Z', action: 'Updated firmware' },
                { id: 'a4', timestamp: '2025-04-19T10:22:00Z', action: 'Restarted device' }
            ]
        },
        {
            id: '3',
            deviceId,
            startTime: '2025-04-18T16:05:00Z',
            endTime: '2025-04-18T16:15:30Z',
            duration: '10m 30s',
            adminId: 'admin_123',
            actions: [
                { id: 'a5', timestamp: '2025-04-18T16:07:00Z', action: 'Checked diagnostics' }
            ]
        },
        {
            id: '4',
            deviceId,
            startTime: '2025-04-17T09:30:00Z',
            endTime: '2025-04-17T09:45:15Z',
            duration: '15m 15s',
            adminId: 'admin_789',
            actions: [
                { id: 'a6', timestamp: '2025-04-17T09:32:00Z', action: 'Configured network settings' },
                { id: 'a7', timestamp: '2025-04-17T09:40:00Z', action: 'Installed updates' }
            ]
        }
    ];

    // Filter logs based on filters
    let filteredLogs = [...mockLogs];

    if (filters.dateRange) {
        const { startDate, endDate } = filters.dateRange;
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.startTime);
            return logDate >= new Date(startDate) && logDate <= new Date(endDate);
        });
    }

    if (filters.adminId) {
        filteredLogs = filteredLogs.filter(log =>
            log.adminId.toLowerCase().includes(filters.adminId!.toLowerCase())
        );
    }

    // Calculate pagination
    const { page, pageSize } = pagination;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    return {
        logs: paginatedLogs,
        totalPages: Math.ceil(filteredLogs.length / pageSize) || 1
    };
};

export function useSessionLogs(deviceId: string) {
    const [logs, setLogs] = useState<SessionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterOptions>({});
    const [pagination, setPagination] = useState<PaginationOptions>({
        page: 1,
        pageSize: 10,
        totalPages: 1
    });

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const { page, pageSize } = pagination;
            const response = await fetchSessionLogs(deviceId, filters, { page, pageSize });
            setLogs(response.logs);
            setPagination(prev => ({ ...prev, totalPages: response.totalPages }));
        } catch (err) {
            setError('Failed to fetch session logs. Please try again.');
            console.error('Error fetching session logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [deviceId, filters, pagination.page, pagination.pageSize]);

    const updateFilters = (newFilters: FilterOptions) => {
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filters change
    };

    const updatePagination = (newPagination: Partial<PaginationOptions>) => {
        setPagination(prev => ({ ...prev, ...newPagination }));
    };

    return {
        logs,
        loading,
        error,
        filters,
        pagination,
        updateFilters,
        updatePagination,
        refetch: fetchLogs
    };
}