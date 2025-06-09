import React, { useEffect, useState } from 'react';
//import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

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
            .get<ApiResponse>(`${import.meta.env.VITE_API_URL}/sessionview/${deviceId}?page=${page}&limit=1`)
            .then((res) => {
                const filtered = res.data.sessionLogs
                    .filter(log => log.status !== 'pending')
                    .map(log => ({
                        ...log,
                        events: log.events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    }));

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
        return hrs > 0 ? `${Math.abs(hrs)}h ${Math.abs(mins)}m ${Math.abs(secs)}s` : `${Math.abs(mins)}m ${Math.abs(secs)}s`;
    };


    const exportLogs = async (type: 'txt' | 'csv' | 'xlsx') => {
        const safeDeviceName = deviceName.replace(/\s+/g, '').replace(/[^\w-]/g, '');
        const filename = `session${page}_${safeDeviceName}.${type}`;

        if (type === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Session Events');

            sheet.columns = [
                { header: 'Session Number', key: 'session' },
                { header: 'Session ID', key: 'sessionId' },
                { header: 'Device', key: 'device' },
                { header: 'Date of Session', key: 'dateOfSession' },
                { header: 'Start Time', key: 'startTime' },
                { header: 'End Time', key: 'endTime' },
                { header: 'Duration', key: 'duration' },
                { header: 'Event Time', key: 'eventTime' },
                { header: 'Event Type', key: 'eventType' },
                { header: 'Event Description', key: 'eventDescription' },
            ];

            sessionLogs.forEach(session => {
                let sessionDetailsAdded = false; 

                const startEvent = session.events.find(event => event.type === 'session_start');
                const endEvent = session.events.find(event => event.type === 'session_end' || event.type === 'inactive_disconnect' || event.type === 'session_expired');
                const start = startEvent ? new Date(startEvent.timestamp) : null;
                const end = endEvent ? new Date(endEvent.timestamp) : null;
                const duration = start && end ? Math.round((Math.floor(end.getTime() / 1000) - Math.floor(start.getTime() / 1000))) : null;

                session.events.forEach(event => {
                    sheet.addRow({
                        session: sessionDetailsAdded ? '' : `Session ${(page - 1) * sessionLogs.length + sessionLogs.indexOf(session) + 1}`,
                        sessionId: sessionDetailsAdded ? '' : session.sessionId,
                        device: sessionDetailsAdded ? '' : deviceName,
                        dateOfSession: sessionDetailsAdded ? '' : (start?.toLocaleDateString() || 'N/A'),
                        startTime: sessionDetailsAdded ? '' : (start?.toLocaleTimeString() || 'N/A'),
                        endTime: sessionDetailsAdded ? '' : (end?.toLocaleTimeString() || 'N/A'),
                        duration: sessionDetailsAdded ? '' : (duration !== null ? formatDuration(duration) : 'N/A'),
                        eventTime: new Date(event.timestamp).toLocaleString(),
                        eventType: event.type,
                        eventDescription: event.description,
                    });
                    sessionDetailsAdded = true; 
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
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
        sessionLogs.forEach((session) => {
            const startEvent = session.events.find(event => event.type === 'session_start');
            const endEvent = session.events.find(event => event.type === 'session_end' || event.type === 'inactive_disconnect'|| event.type === 'session_expired');
            const start = startEvent ? new Date(startEvent.timestamp) : null;
            const end = endEvent ? new Date(endEvent.timestamp) : null;
            const duration = start && end ? Math.round((Math.floor(end.getTime() / 1000) - Math.floor(start.getTime() / 1000))) : null;

            content += `Session ${page}\n`;
            content += `Device: ${deviceName}\n`;
            content += `Session ID: ${session.sessionId}\n`;
            content += `Date of Session: ${start?.toLocaleDateString() || 'N/A'}\n`;
            content += `Start Time: ${start?.toLocaleTimeString() || 'N/A'}\n`;
            content += `End Time: ${end?.toLocaleTimeString() || 'N/A'}\n`;
            content += `Duration: ${duration !== null ? formatDuration(duration) : 'N/A'}\n`;
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
                const startEvent = session.events.find(event => event.type === 'session_start');
                const endEvent = session.events.find(event => event.type === 'session_end' || event.type === 'inactive_disconnect'|| event.type === 'session_expired');
                const start = startEvent ? new Date(startEvent.timestamp) : null;
                const end = endEvent ? new Date(endEvent.timestamp) : null;
                const duration = start && end ? Math.round((Math.floor(end.getTime() / 1000) - Math.floor(start.getTime() / 1000))) : null;

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

