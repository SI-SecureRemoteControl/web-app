import { InboxIcon } from 'lucide-react';
import { useRemoteRequests } from '../../contexts/RemoteRequestContext';
import RemoteRequestModal from './RemoteRequestModal';
import { RemoteRequest } from '../types/RemoteRequest';
import {useState} from "react";

export default function RemoteRequestInbox() {
    const { requests } = useRemoteRequests();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<RemoteRequest | null>(null);
    const pendingRequests = requests.filter(r => r.status === 'pending');

    const handleRequestClick = (request: RemoteRequest) => {
        setSelectedRequest(request);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <InboxIcon className="w-6 h-6" />
                {pendingRequests.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {pendingRequests.length}
          </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50">
                    {pendingRequests.length === 0 ? (
                        <p className="px-4 py-2 text-gray-500">No pending requests</p>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {pendingRequests.map((request) => (
                                <button
                                    key={request.id}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none"
                                    onClick={() => handleRequestClick(request)}
                                >
                                    <div className="font-medium text-gray-900">{request.deviceName}</div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(request.timestamp).toLocaleString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedRequest && (
                <RemoteRequestModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                />
            )}
        </div>
    );
}