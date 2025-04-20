import React, { useState } from 'react';
import { FilterOptions, DateRange } from '../../components/types/session.ts';
import { Calendar, Search, X, User } from 'lucide-react';

interface SessionFilterProps {
    filters: FilterOptions;
    onFilterChange: (filters: FilterOptions) => void;
}

const SessionFilter: React.FC<SessionFilterProps> = ({ filters, onFilterChange }) => {
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: filters.dateRange?.startDate || '',
        endDate: filters.dateRange?.endDate || ''
    });
    const [adminId, setAdminId] = useState<string>(filters.adminId || '');

    const handleApplyFilters = () => {
        const newFilters: FilterOptions = {};

        if (dateRange.startDate && dateRange.endDate) {
            newFilters.dateRange = dateRange;
        }

        if (adminId) {
            newFilters.adminId = adminId;
        }

        onFilterChange(newFilters);
    };

    const handleResetFilters = () => {
        setDateRange({ startDate: '', endDate: '' });
        setAdminId('');
        onFilterChange({});
    };

    const hasActiveFilters = !!(filters.dateRange || filters.adminId);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Filter Sessions</h3>
                {hasActiveFilters && (
                    <button
                        onClick={handleResetFilters}
                        className="text-sm text-red-600 hover:text-red-800 flex items-center mt-2 sm:mt-0"
                    >
                        <X size={16} className="mr-1" /> Clear Filters
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center">
                            <Calendar size={16} className="mr-1" /> Date Range
                        </div>
                    </label>
                    <div className="flex space-x-2">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="Start Date"
                        />
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="End Date"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        <div className="flex items-center">
                            <User size={16} className="mr-1" /> Admin ID
                        </div>
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={adminId}
                            onChange={(e) => setAdminId(e.target.value)}
                            className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="Search by admin ID"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleApplyFilters}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Apply Filters
                </button>
            </div>
        </div>
    );
};

export default SessionFilter;