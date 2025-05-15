import React from 'react';

type FileShareModalProps = {
  deviceId: string;
  sessionId: string;
  onDecision: (decision: boolean) => void;
};

const FileShareModal: React.FC<FileShareModalProps> = ({ deviceId, sessionId, onDecision }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <h3 className="text-lg font-semibold mb-4">File Sharing Request</h3>
        <p className="mb-6">
          Device <span className="font-bold">{deviceId}</span> is requesting to share files in session <span className="font-bold">{sessionId}</span>.
        </p>
        <div className="flex justify-around">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => onDecision(true)}
          >
            Accept
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={() => onDecision(false)}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileShareModal;
