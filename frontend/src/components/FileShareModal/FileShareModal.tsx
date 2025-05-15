import React from 'react';

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
    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none">
      <div className="bg-white rounded-lg shadow-lg p-4 w-80 pointer-events-auto">
        <div className="mb-2">
          <h3 className="text-base font-semibold">File Sharing Request</h3>
        </div>
        <div className="mb-4">
          <p className="text-sm"><strong>Device ID:</strong> {deviceId}</p>
          <p className="text-sm"><strong>Session ID:</strong> {sessionId}</p>
        </div>
        <div className="flex justify-end space-x-2">
          <button 
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            onClick={handleDecline}
          >
            Decline
          </button>
          <button 
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
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
