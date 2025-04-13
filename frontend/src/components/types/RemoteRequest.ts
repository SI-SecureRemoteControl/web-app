export interface RemoteRequest {
    id: string;
    deviceName: string;
    timestamp: Date;
    status: 'pending' | 'accepted' | 'declined';
}

export interface RemoteRequestContextType {
    requests: RemoteRequest[];
    addRequest: (request: RemoteRequest) => void;
    removeRequest: (id: string) => void;
    updateRequestStatus: (id: string, status: RemoteRequest['status']) => void;
}