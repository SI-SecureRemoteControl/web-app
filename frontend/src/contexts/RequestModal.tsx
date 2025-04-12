import React from 'react';
import { useRemoteControl, RemoteRequest } from '../contexts/RemoteControlContext';
import './RequestModal.css';

interface RequestModalProps {
  request: RemoteRequest;
}

const RequestModal: React.FC<RequestModalProps> = ({ request }) => {
  const { acceptRequest, declineRequest } = useRemoteControl();
  
  const handleAccept = () => {
    acceptRequest(request.requestId, request.deviceId, request.deviceName);
  };
  
  const handleDecline = () => {
    declineRequest(request.requestId, request.deviceId);
  };
  
  return (
    <div className="request-modal-overlay">
      <div className="request-modal">
        <div className="request-modal-header">
          <h3>Remote Control Request</h3>
        </div>
        <div className="request-modal-body">
          <p><strong>Device:</strong> {request.deviceName}</p>
          <p><strong>Device ID:</strong> {request.deviceId}</p>
          <p><strong>Requested at:</strong> {new Date(request.timestamp).toLocaleTimeString()}</p>
        </div>
        <div className="request-modal-footer">
          <button 
            className="btn-decline" 
            onClick={handleDecline}
          >
            Decline
          </button>
          <button 
            className="btn-accept" 
            onClick={handleAccept}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;