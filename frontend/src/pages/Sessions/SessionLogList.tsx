import React from 'react';
import { SessionLog } from '../../components/types/session.ts';
import SessionLogItem from './SessionLogItem';
import EmptyState from './EmptyState';

interface SessionLogListProps {
    logs: SessionLog[];
}

const SessionLogList: React.FC<SessionLogListProps> = ({ logs }) => {
    if (!logs.length) {
        return <EmptyState />;
    }

    return (
        <div className="grid grid-cols-1 gap-4 animate-fadeIn">
            {logs.map(log => (
                <SessionLogItem key={log.id} log={log} />
            ))}
        </div>
    );
};

export default SessionLogList;