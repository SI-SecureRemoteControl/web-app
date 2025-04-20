import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
    message: string;
    onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white rounded-lg border border-red-100 shadow-sm">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-600 text-center max-w-md mb-4">{message}</p>

            {onRetry && (
                <button
                    onClick={onRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    Try Again
                </button>
            )}
        </div>
    );
};

export default ErrorState;