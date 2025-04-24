import React from 'react';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import { Wifi, WifiOff } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useRemoteControl();
  
  return (
    <div className={`flex items-center text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
      {isConnected ? (
        <>
          <Wifi size={16} className="mr-1" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff size={16} className="mr-1" />
          <span>Disconnected</span>
        </>
      )}
    </div>
  );
};