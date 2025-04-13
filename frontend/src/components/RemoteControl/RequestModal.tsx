import React from 'react';
import { RemoteRequest, useRemoteControl } from '../../contexts/RemoteControlContext';

interface RequestModalProps {
  request: RemoteRequest;
}

export const RequestModal: React.FC<RequestModalProps> = ({ request }) => {
  const { acceptRequest, declineRequest } = useRemoteControl();
  
  const handleAccept = () => {
    acceptRequest(request.requestId, request.from, request.deviceName, request.sessionId);
  };
  
  const handleDecline = () => {
    declineRequest(request.requestId, request.from, request.sessionId);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Remote Control Request</h3>
        </div>
        
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Device:</span> {request.deviceName}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Device ID:</span> {request.from}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Requested at:</span> {new Date(request.timestamp).toLocaleString()}
            </p>
          </div>
          
          <p className="text-sm text-gray-700">
            Do you want to accept this remote control request?
          </p>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
          <button
            onClick={handleDecline}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};