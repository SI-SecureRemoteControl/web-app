import React from 'react';
import { ClipboardList } from 'lucide-react';

interface EmptyStateProps {
    message?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message = 'No session logs found for this device.' }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <ClipboardList size={48} className="text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500 text-center max-w-md">{message}</p>
        </div>
    );
};

export default EmptyState;