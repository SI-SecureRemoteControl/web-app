import React from 'react';
import './FileShareModal.css';

interface FileShareModalProps {
  deviceId: string;
  sessionId: string;
  onDecision: (decision: boolean) => void;
}

const FileShareModal: React.FC<FileShareModalProps> = ({ deviceId, sessionId, onDecision }) => {
  const handleAccept = () => {
    onDecision(true);
  };

  const handleDecline = () => {
    onDecision(false);
  };

  return (
    <div className="file-share-modal-overlay">
      <div className="file-share-modal">
        <div className="file-share-modal-header">
          <h3>File Sharing Request</h3>
        </div>
        <div className="file-share-modal-body">
          <p><strong>Device ID:</strong> {deviceId}</p>
          <p><strong>Session ID:</strong> {sessionId}</p>
        </div>
        <div className="file-share-modal-footer">
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

export default FileShareModal;
