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

  useEffect(() => {
    setLoading(true);
    // axios.get<ApiResponse>(`/sessionview/${deviceId}?page=${page}&limit=5`)
     axios.get<ApiResponse>(`http://localhost:8080/sessionview/${deviceId}?page=${page}&limit=5`) // 

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

  if (loading) return <div>Loading session logs...</div>;
  if (!sessionLogs.length) return <div>No session logs available for this device.</div>;

  

  return (
    <div className="space-y-4 px-6 py-4 max-w-5xl mx-auto">
      {sessionLogs.map((session, i) => {
        const firstEvent = session.events[0];
        const lastEvent = session.events.length > 0 ? session.events[session.events.length - 1] : null;
  
        const start = firstEvent ? new Date(firstEvent.timestamp) : null;
        const end = lastEvent ? new Date(lastEvent.timestamp) : null;
  
        const duration = start && end ? ((end.getTime() - start.getTime()) / 1000).toFixed(1) : 'N/A';
  
        return (
          <div key={i} className="p-4 border rounded-md shadow-sm bg-white">
            <h3 className="font-semibold text-lg">Session {i + 1}</h3>
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