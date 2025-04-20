import React from 'react';
import { SessionLog } from '../../components/types/session.ts';
import { ChevronDown, ChevronUp, Clock, User } from 'lucide-react';

interface SessionLogItemProps {
    log: SessionLog;
}

const SessionLogItem: React.FC<SessionLogItemProps> = ({ log }) => {
    const [expanded, setExpanded] = React.useState(false);

    const formatDateTime = (dateTimeString: string) => {
        const date = new Date(dateTimeString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const hasActions = log.actions && log.actions.length > 0;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-md">
            <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">
                            Session {log.id}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                            <Clock size={16} className="mr-1" />
                            {formatDateTime(log.startTime)}
                        </p>
                    </div>

                    <div className="flex flex-col sm:items-end">
            <span className="text-sm font-medium text-blue-600">
              Duration: {log.duration}
            </span>
                        <span className="text-sm text-gray-600 flex items-center mt-1">
              <User size={16} className="mr-1" />
                            {log.adminId}
            </span>
                    </div>
                </div>

                {hasActions && (
                    <div className="mt-3">
                        <button
                            onClick={() => setExpanded(prev => !prev)}
                            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                        >
                            {expanded ? (
                                <>Hide Actions <ChevronUp size={16} className="ml-1" /></>
                            ) : (
                                <>View Actions ({log.actions?.length}) <ChevronDown size={16} className="ml-1" /></>
                            )}
                        </button>

                        {expanded && (
                            <div className="mt-3 pl-4 border-l-2 border-blue-200 animate-fadeIn">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Actions Performed:</h4>
                                <ul className="space-y-2">
                                    {log.actions?.map(action => (
                                        <li key={action.id} className="text-sm">
                      <span className="text-gray-500">
                        {new Date(action.timestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })}
                      </span>
                                            <span className="ml-2 text-gray-800">{action.action}</span>
                                            {action.details && (
                                                <span className="text-gray-600 ml-1">({action.details})</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SessionLogItem;