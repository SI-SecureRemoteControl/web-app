import React from 'react';
import { PaginationOptions } from '../../components/types/session.ts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SessionPaginationProps {
    pagination: PaginationOptions;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

const SessionPagination: React.FC<SessionPaginationProps> = ({
                                                                 pagination,
                                                                 onPageChange,
                                                                 onPageSizeChange
                                                             }) => {
    const { page, pageSize, totalPages } = pagination;

    return (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center mb-4 sm:mb-0">
        <span className="text-sm text-gray-700 mr-2">
          Show:
        </span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-700 ml-2">per page</span>
            </div>

            <div className="flex items-center">
        <span className="text-sm text-gray-700 mr-4">
          Page {page} of {totalPages}
        </span>
                <nav className="flex items-center">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                        className={`p-2 rounded-md border ${
                            page <= 1
                                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                        className={`ml-2 p-2 rounded-md border ${
                            page >= totalPages
                                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <ChevronRight size={16} />
                    </button>
                </nav>
            </div>
        </div>
    );
};

export default SessionPagination;