import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Event {
  timestamp: string;
  type: string;
  description: string;
}

interface SessionLog {
  sessionId: string;
  deviceId: string;
  events: Event[];
}

interface ApiResponse {
  sessionLogs: SessionLog[];
  total: number;
  page: number;
  totalPages: number;
}

const SessionViewer: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('');


  useEffect(() => {
    setLoading(true);

    axios.get<ApiResponse>(`${import.meta.env.VITE_BASE_URL}/sessionview/${deviceId}?page=${page}&limit=1`)
        .then((res) => {
          setSessionLogs(res.data.sessionLogs);
          setTotalPages(res.data.totalPages);
        })
        .catch((err) => {
          console.error('Error fetching session logs:', err);
          setSessionLogs([]);
          setTotalPages(1);
        })
        .finally(() => setLoading(false));
  }, [deviceId, page]);

  // Dohvati naziv uređaja
    useEffect(() => {
        axios
            .get(`${import.meta.env.VITE_BASE_URL}/devices/${deviceId}`)
            .then((res) => {
                // Successfully fetched the device name
                setDeviceName(res.data.name || 'Unknown Device');
            })
            .catch((err) => {
                console.error('Error fetching device name:', err);
                // Set the device name to 'Unknown Device' in case of error
                setDeviceName('Unknown Device');
            });
    }, [deviceId]);

  if (!sessionLogs.length) {
    return (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl shadow-md p-8 text-center max-w-md">
            <div className="text-4xl mb-4 text-gray-400">📭</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No Session Logs Found
            </h2>
            <p className="text-gray-500">
              There are no session logs available for <b>{deviceName}</b> at the moment.
            </p>
          </div>
        </div>
    );
  }

  return (
      <div className="space-y-4 px-6 py-4 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-700">
          Session Logs for <span className="text-blue-600">{deviceName}</span>
        </h2>

        {sessionLogs.map((session, i) => {
          const firstEvent = session.events[0];
          const lastEvent = session.events.length > 0 ? session.events[session.events.length - 1] : null;

          const start = firstEvent ? new Date(firstEvent.timestamp) : null;
          const end = lastEvent ? new Date(lastEvent.timestamp) : null;

          const duration = start && end ? ((end.getTime() - start.getTime()) / 1000).toFixed(1) : 'N/A';

          return (
              <div key={i} className="p-4 border rounded-md shadow-sm bg-white">
                <h3 className="font-semibold text-lg">
                  Session {(page - 1) * sessionLogs.length + i + 1}
                </h3>
                <p><b>Device:</b> {deviceName}</p>
                <p><b>Session ID:</b> {session.sessionId.slice(0, 20)}...</p>
                <p><b>Start:</b> {start ? start.toLocaleString() : 'N/A'}</p>
                <p><b>Duration:</b> {duration}s</p>

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

        <div className="flex justify-center items-center gap-4 mt-4">
          <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
  );
};

export default SessionViewer;
