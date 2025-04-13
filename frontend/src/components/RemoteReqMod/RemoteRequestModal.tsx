import { X } from 'lucide-react';
import { RemoteRequest } from '../types/RemoteRequest';
import { useRemoteRequests } from '../../contexts/RemoteRequestContext';
import {useState} from "react";


interface RemoteRequestModalProps {
    request: RemoteRequest;
    onClose: () => void;
}

export default function RemoteRequestModal({ request, onClose }: RemoteRequestModalProps) {
    const { updateRequestStatus, removeRequest } = useRemoteRequests();
    const [isLoading, setIsLoading] = useState(false);

    const handleAccept = async () => {
        try {
            setIsLoading(true);
            // TODO: Implement WebSocket event sending
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
            updateRequestStatus(request.id, 'accepted');
            onClose();
        } catch (error) {
            console.error('Failed to accept request:', error);
            // Handle error state
        } finally {
            setIsLoading(false);
        }
    };

    const handleDecline = () => {
        removeRequest(request.id);
        // TODO: Implement WebSocket event sending for decline
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 text-white shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">Remote Control Request</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="font-medium text-gray-300">Device Name</label>
                        <p className="mt-1 text-white">{request.deviceName}</p>
                    </div>

                    <div>
                        <label className="font-medium text-gray-300">Request Time</label>
                        <p className="mt-1 text-white">{new Date(request.timestamp).toLocaleString()}</p>
                    </div>

                    <div className="flex space-x-3 mt-6">
                        <button
                            onClick={handleAccept}
                            disabled={isLoading}
                            className={`flex-1 px-4 py-2 rounded-md text-gray-900 bg-white hover:bg-green-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors ${
                                isLoading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {isLoading ? 'Connecting...' : 'Accept Control'}
                        </button>
                        <button
                            onClick={handleDecline}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 rounded-md text-white bg-gray-700 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
                        >
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}