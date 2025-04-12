import React, { useEffect } from 'react';
import { useRemoteControl } from '../contexts/RemoteControlContext';
import './Notification.css'; // Create this CSS file for styling

const Notification: React.FC = () => {
  const { notification, clearNotification } = useRemoteControl();
  
  // Auto-dismiss notification after 5 seconds
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
  
  return (
    <div className={`notification ${notification.type}`}>
      <span className="notification-message">{notification.message}</span>
      <button className="notification-close" onClick={clearNotification}>×</button>
    </div>
  );
};

export default Notification;