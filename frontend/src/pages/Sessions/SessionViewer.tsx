import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

interface Event {
    timestamp: string;
    type: string;
    description: string;
}

interface SessionLog {
    sessionId: string;
    deviceId: string;
    status: string;
    events: Event[];
    recorded?: boolean;
}

interface ApiResponse {
    sessionLogs: SessionLog[];
    total: number;
    page: number;
    totalPages: number;
    deviceName: string;
}

const SessionViewer: React.FC<{ deviceId: string }> = ({ deviceId }) => {
    const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [, setLoading] = useState(false);
    const [deviceName, setDeviceName] = useState<string>('');

    useEffect(() => {
        setLoading(true);

        axios
            .get<ApiResponse>(`${import.meta.env.VITE_BASE_URL}/sessionview/${deviceId}?page=${page}&limit=1`)
            .then((res) => {
                const filtered = res.data.sessionLogs
                    .filter(log => log.status !== 'pending');

                setSessionLogs(filtered);
                setTotalPages(res.data.totalPages);
                setDeviceName(res.data.deviceName || 'Unknown Device');
            })
            .catch((err) => {
                console.error('Error fetching session logs:', err);
                setSessionLogs([]);
                setTotalPages(1);
                setDeviceName('Unknown Device');
            })
            .finally(() => setLoading(false));
    }, [deviceId, page]);

    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
    };

    
    const exportLogs = (type: 'txt' | 'csv' | 'xlsx') => {
    const safeDeviceName = deviceName.replace(/\s+/g, '').replace(/[^\w-]/g, '');
    const filename = `session${page}_${safeDeviceName}.${type}`;

    if (type === 'xlsx') {
        const worksheetData = sessionLogs.flatMap(session => {
            return session.events.map(event => {
                return {
                    SessionID: session.sessionId,
                    Device: deviceName,
                    Recorded: session.recorded ? 'Yes' : 'No',
                    EventTime: new Date(event.timestamp).toLocaleString(),
                    EventType: event.type,
                    EventDescription: event.description,
                };
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'SessionEvents');

        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // TXT or CSV
    let content = '';
    sessionLogs.forEach((session, index) => {
        content += `Session ${index + 1}\n`;
        content += `Device: ${deviceName}\n`;
        content += `Session ID: ${session.sessionId}\n`;
        content += `Recorded: ${session.recorded ? 'Yes' : 'No'}\n`;
        content += `Events:\n`;
        session.events.forEach(event => {
            content += ` - ${new Date(event.timestamp).toLocaleString()} | ${event.type} | ${event.description}\n`;
        });
        content += '\n---\n\n';
    });

    const mimeType = type === 'csv' ? 'text/csv' : 'text/plain';
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


    if (!sessionLogs.length) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl shadow-md p-8 text-center max-w-md">
                    <div className="text-4xl mb-4 text-gray-400">📭</div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">No Session Logs Found</h2>
                    <p className="text-gray-500">There are no session logs available for <b>{deviceName}</b> at the moment.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 px-6 py-4 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-700 text-center">
                Session Logs for <span className="text-shadow-black-600">{deviceName}</span>
            </h2>

            {sessionLogs.map((session, i) => {
                const firstEvent = session.events[0];
                const lastEvent = session.events[session.events.length - 1];
                const start = firstEvent ? new Date(firstEvent.timestamp) : null;
                const end = lastEvent ? new Date(lastEvent.timestamp) : null;
                const duration = start && end ? Math.floor((end.getTime() - start.getTime()) / 1000) : null;

                return (
                    <div
                        key={i}
                        className="p-4 border border-blue-300 rounded-md shadow-lg bg-blue-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h3 className="font-semibold text-lg">Session {(page - 1) * sessionLogs.length + i + 1}</h3>
                        <p><b>Device:</b> {deviceName}</p>
                        <p><b>Session ID:</b> {session.sessionId.slice(0, 20)}...</p>
                        <p><b>Date of Session:</b> {start?.toLocaleDateString() || 'N/A'}</p>
                        <p><b>Start Time:</b> {start?.toLocaleTimeString() || 'N/A'}</p>
                        <p><b>End Time:</b> {end?.toLocaleTimeString() || 'N/A'}</p>
                        <p><b>Duration:</b> {duration !== null ? formatDuration(duration) : 'N/A'}</p>
                        <div className="mt-2 space-y-1">
                            {session.events.map((event, j) => (
                                <div key={j} className="text-sm text-gray-800">
                                    <b>{new Date(event.timestamp).toLocaleTimeString()}:</b> {event.type} – {event.description}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            <div className="flex justify-center items-center mt-4">
                <div className="space-x-2">
                    <button onClick={() => exportLogs('txt')} className="px-3 py-1 border border-blue-500 rounded-md shadow-lg bg-blue-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-blue-300">
                        Export as TXT
                    </button>
                    <button onClick={() => exportLogs('csv')} className="px-3 py-1 border border-yellow-500 rounded-md shadow-lg bg-yellow-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-yellow-300">
                        Export as CSV
                    </button>
                    <button onClick={() => exportLogs('xlsx')} className="px-3 py-1 border border-green-500 rounded-md shadow-lg bg-green-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-green-300">
                        Export as Excel
                    </button>
                </div>
            </div>

            <div className="flex justify-center items-center gap-4">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border border-blue-200 rounded disabled:opacity-50 hover:bg-blue-100">
                    Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-blue-200 rounded disabled:opacity-50 hover:bg-blue-100">
                    Next
                </button>
            </div>
        </div>
    );
};

export default SessionViewer;

