import React, { createContext, useContext, useState, useCallback } from 'react';
import { RemoteRequest, RemoteRequestContextType } from '../components/types/RemoteRequest';

const RemoteRequestContext = createContext<RemoteRequestContextType | undefined>(undefined);

export function RemoteRequestProvider({ children }: { children: React.ReactNode }) {
    const [requests, setRequests] = useState<RemoteRequest[]>([]);

    const addRequest = useCallback((request: RemoteRequest) => {
        setRequests(prev => [...prev, request]);
    }, []);

    const removeRequest = useCallback((id: string) => {
        setRequests(prev => prev.filter(request => request.id !== id));
    }, []);

    const updateRequestStatus = useCallback((id: string, status: RemoteRequest['status']) => {
        setRequests(prev =>
            prev.map(request =>
                request.id === id ? { ...request, status } : request
            )
        );
    }, []);

    return (
        <RemoteRequestContext.Provider value={{ requests, addRequest, removeRequest, updateRequestStatus }}>
            {children}
        </RemoteRequestContext.Provider>
    );
}

export function useRemoteRequests() {
    const context = useContext(RemoteRequestContext);
    if (context === undefined) {
        throw new Error('useRemoteRequests must be used within a RemoteRequestProvider');
    }
    return context;
}