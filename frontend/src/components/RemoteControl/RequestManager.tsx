import React from 'react';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import { RequestModal } from '../RemoteControl/RequestModal';
import { Monitor, AlertTriangle } from 'lucide-react';

export const RequestManager: React.FC = () => {
  const { requests, activeSession } = useRemoteControl();
  
  // Show the first pending request modal if any exists
  const currentRequest = requests.length > 0 ? requests[0] : null;
  
  return (
    <>
      {currentRequest && (
        <RequestModal request={currentRequest} />
      )}
      
      {activeSession && (
        <div className="fixed bottom-4 right-4 bg-blue-50 border border-blue-200 rounded-md p-4 shadow-md z-40">
          <div className="flex items-center">
            <Monitor className="text-blue-500 mr-2" size={20} />
            <div>
              <h4 className="font-medium text-blue-800">Remote Session Active</h4>
              <p className="text-sm text-blue-600">Connected to: {activeSession.deviceName}</p>
              {activeSession.status === 'pending' && (
                <div className="flex items-center mt-1 text-amber-600">
                  <AlertTriangle size={14} className="mr-1" />
                  <span className="text-xs">Establishing connection...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};