import React from 'react';
import { useSessionLogs } from '../../components/hooks/useSessionLogs.ts';
import { ArrowLeft } from 'lucide-react';
import SessionFilter from './SessionFilter';
import SessionLogList from './SessionLogList';
import SessionPagination from './SessionPagination';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

interface SessionViewerProps {
    deviceId: string;
    deviceName?: string;
    onBack?: () => void;
}

const SessionViewer: React.FC<SessionViewerProps> = ({
                                                         deviceId,
                                                         deviceName = 'Unknown Device',
                                                         onBack
                                                     }) => {
    const {
        logs,
        loading,
        error,
        filters,
        pagination,
        updateFilters,
        updatePagination,
        refetch
    } = useSessionLogs(deviceId);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <header className="mb-6">
                <div className="flex items-center mb-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="mr-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-2xl font-bold text-gray-900">Session Logs</h1>
                </div>
                <h2 className="text-lg text-gray-600">
                    Device: <span className="font-medium">{deviceName}</span> ({deviceId})
                </h2>
            </header>

            <SessionFilter
                filters={filters}
                onFilterChange={updateFilters}
            />

            <main>
                {loading ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={refetch} />
                ) : (
                    <>
                        <SessionLogList logs={logs} />
                        <SessionPagination
                            pagination={pagination}
                            onPageChange={(page) => updatePagination({ page })}
                            onPageSizeChange={(pageSize) => updatePagination({ pageSize, page: 1 })}
                        />
                    </>
                )}
            </main>
        </div>
    );
};

export default SessionViewer;