import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

interface SessionLog {
    status: string;
    sessionId: string;
    recorded: boolean;
    recordedBy?: string;
    events: {
        timestamp: string;
        type: string;
        description: string;
    }[];
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
    const [loading, setLoading] = useState(false);
    const [deviceName, setDeviceName] = useState<string>('');

    useEffect(() => {
        setLoading(true);
        axios
            .get<ApiResponse>(
                `${import.meta.env.VITE_BASE_URL}/sessionview/${deviceId}?page=${page}&limit=1`
            )
            .then((res) => {
                const filtered = res.data.sessionLogs.filter((log) => log.status !== 'pending');
                setSessionLogs(filtered);
                setTotalPages(res.data.totalPages);
                setDeviceName(res.data.deviceName || 'Unknown Device');
            })
            .catch(() => {
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

    const exportLogs = (
        format: 'txt' | 'csv' | 'xlsx',
        sessionLogs: SessionLog[],
        deviceName: string,
        page: number
    ) => {
        if (format === 'txt' || format === 'csv') {
            const delimiter = format === 'txt' ? '\n' : ',';
            const lines = sessionLogs.map((session, index) => {
                const sessionStart = session.events[0]?.timestamp;
                const sessionEnd = session.events[session.events.length - 1]?.timestamp;
                const durationSec = session.events.length > 1
                    ? Math.floor((new Date(sessionEnd!).getTime() - new Date(sessionStart!).getTime()) / 1000)
                    : 0;

                const header = `Session ${index + 1}${delimiter}Device: ${deviceName}${delimiter}Session ID: ${session.sessionId}${delimiter}Recorded: ${session.recorded ? `Yes${session.recordedBy ? ` (by ${session.recordedBy})` : ''}` : 'No'}${delimiter}Start Time: ${sessionStart ? new Date(sessionStart).toLocaleString() : 'N/A'}${delimiter}End Time: ${sessionEnd ? new Date(sessionEnd).toLocaleString() : 'N/A'}${delimiter}Duration: ${formatDuration(durationSec)}${delimiter}Events:${delimiter}`;

                const eventLines = session.events
                    .map((event, i) => `${i + 1}. ${new Date(event.timestamp).toLocaleString()} - ${event.type}: ${event.description}`)
                    .join(delimiter);

                return `${header}${eventLines}${delimiter.repeat(2)}`;
            });

            const blob = new Blob([lines.join('')], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const safeDeviceName = deviceName.replace(/\s+/g, '').replace(/[^\w-]/g, '');
            link.download = `session${page}_${safeDeviceName}.${format}`;
            link.click();
        }

        if (format === 'xlsx') {
            const worksheetData: any[] = [];
            sessionLogs.forEach((session, index) => {
                const start = session.events[0]?.timestamp;
                const end = session.events[session.events.length - 1]?.timestamp;
                const durationSec = session.events.length > 1
                    ? Math.floor((new Date(end!).getTime() - new Date(start!).getTime()) / 1000)
                    : 0;

                session.events.forEach((event, j) => {
                    worksheetData.push({
                        SessionNumber: (page - 1) * sessionLogs.length + index + 1,
                        Device: deviceName,
                        SessionID: session.sessionId,
                        Recorded: session.recorded ? `Yes${session.recordedBy ? ` (by ${session.recordedBy})` : ''}` : 'No',
                        EventNumber: j + 1,
                        EventTimestamp: new Date(event.timestamp).toLocaleString(),
                        EventType: event.type,
                        EventDescription: event.description,
                        StartTime: start ? new Date(start).toLocaleString() : 'N/A',
                        EndTime: end ? new Date(end).toLocaleString() : 'N/A',
                        Duration: formatDuration(durationSec),
                    });
                });
            });

            const worksheet = XLSX.utils.json_to_sheet(worksheetData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sessions');

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const safeDeviceName = deviceName.replace(/\s+/g, '').replace(/[^\w-]/g, '');
            link.download = `session${page}_${safeDeviceName}.xlsx`;
            link.click();
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[300px]">Učitavanje podataka...</div>;
    }

    if (!sessionLogs.length) {
        return <div className="flex items-center justify-center min-h-[300px]">Nema pronađenih sesija za {deviceName}.</div>;
    }

    return (
        <div className="space-y-4 px-6 py-4 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-700 text-center">
                Sesije za uređaj <span className="text-black">{deviceName}</span>
            </h2>

            {sessionLogs.map((session, i) => {
                const firstEvent = session.events[0];
                const lastEvent = session.events[session.events.length - 1];
                const start = firstEvent ? new Date(firstEvent.timestamp) : null;
                const end = lastEvent ? new Date(lastEvent.timestamp) : null;
                const duration = start && end ? Math.floor((end.getTime() - start.getTime()) / 1000) : null;

                return (
                    <div key={i} className="p-4 border border-blue-300 rounded-md shadow-lg bg-blue-100">
                        <h3 className="font-semibold text-lg">Sesija {(page - 1) * sessionLogs.length + i + 1}</h3>
                        <p><b>Uređaj:</b> {deviceName}</p>
                        <p><b>ID sesije:</b> {session.sessionId.slice(0, 20)}...</p>
                        <p><b>Datum sesije:</b> {start?.toLocaleDateString() || 'N/A'}</p>
                        <p><b>Vrijeme početka:</b> {start?.toLocaleTimeString() || 'N/A'}</p>
                        <p><b>Vrijeme završetka:</b> {end?.toLocaleTimeString() || 'N/A'}</p>
                        <p><b>Trajanje:</b> {duration !== null ? formatDuration(duration) : 'N/A'}</p>
                        <p><b>Zabilježena:</b> {session.recorded ? `Da${session.recordedBy ? ` (by ${session.recordedBy})` : ''}` : 'Ne'}</p>

                        <details className="mt-2">
                            <summary className="cursor-pointer text-blue-600">Prikaži događaje ({session.events.length})</summary>
                            <ul className="list-disc list-inside text-sm mt-2">
                                {session.events.map((event, j) => (
                                    <li key={j}><b>{new Date(event.timestamp).toLocaleString()}:</b> {event.type} - {event.description}</li>
                                ))}
                            </ul>
                        </details>
                    </div>
                );
            })}

            <div className="flex items-center justify-between mt-6">
                <button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} className="px-3 py-1 border border-blue-200 rounded disabled:opacity-50 hover:bg-blue-100">Prethodna</button>
                <span>Stranica {page} od {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)} className="px-3 py-1 border border-blue-200 rounded disabled:opacity-50 hover:bg-blue-100">Sljedeća</button>
            </div>

            <div className="flex gap-4 mt-4 justify-center">
                <button onClick={() => exportLogs('txt', sessionLogs, deviceName, page)} className="px-3 py-1 border border-blue-500 rounded-md shadow-lg bg-blue-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-blue-300">Export .txt</button>
                <button onClick={() => exportLogs('csv', sessionLogs, deviceName, page)} className="px-3 py-1 border border-yellow-500 rounded-md shadow-lg bg-yellow-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-yellow-300">Export .csv</button>
                <button onClick={() => exportLogs('xlsx', sessionLogs, deviceName, page)} className="px-3 py-1 border border-green-500 rounded-md shadow-lg bg-green-100 hover:shadow-2xl transition-shadow duration-300 hover:bg-green-300">Export .xlsx</button>
            </div>
        </div>
    );
};

export default SessionViewer;
