import React, { useEffect } from 'react';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import { X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { notification, clearNotification } = useRemoteControl();
  
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);
  
  if (!notification) {
    return null;
  }
  
  const bgColor = {
    success: 'bg-green-50 border-green-500',
    error: 'bg-red-50 border-red-500',
    info: 'bg-blue-50 border-blue-500'
  }[notification.type];
  
  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800'
  }[notification.type];
  
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-md border-l-4 shadow-md ${bgColor}`}>
      <div className="flex items-start">
        <div className={`flex-grow ${textColor}`}>
          {notification.message}
        </div>
        <button 
          onClick={clearNotification}
          className={`ml-4 ${textColor} hover:opacity-75`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};