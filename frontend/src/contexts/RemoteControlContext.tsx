import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { websocketService } from '../services/webSocketService';

// Types
export interface RemoteRequest {
  requestId: string;
  deviceId: string;
  deviceName: string;
  timestamp: number;
  sessionId: string;
}

export interface ActiveSession {
  requestId: string;
  deviceId: string;
  deviceName: string;
  status: 'pending' | 'connected' | 'error';
  sessionId: string; // Added sessionId to match backend data
}

export interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface RemoteControlState {
  requests: RemoteRequest[];
  activeSession: ActiveSession | null;
  notification: Notification | null;
  isConnected: boolean;
}

type RemoteControlAction =
  | { type: 'CONNECTION_CHANGE'; payload: { connected: boolean } }
  | { type: 'NEW_REQUEST'; payload: RemoteRequest }
  | { type: 'ACCEPT_REQUEST'; payload: { requestId: string; deviceId: string; deviceName: string; sessionId: string } }
  | { type: 'DECLINE_REQUEST'; payload: { requestId: string } }
  | { type: 'REQUEST_TIMEOUT'; payload: { requestId: string; deviceName: string } }
  | { type: 'SESSION_STATUS_UPDATE'; payload: { sessionId: string; status: string; message: string } }
  | { type: 'CLEAR_NOTIFICATION' };

// Initial state
const initialState: RemoteControlState = {
  requests: [],
  activeSession: null,
  notification: null,
  isConnected: false
};

// Reducer function
function reducer(state: RemoteControlState, action: RemoteControlAction): RemoteControlState {
  // console.log('REDUCER ACTION:', action.type, action.payload);
  
  switch (action.type) {
    case 'CONNECTION_CHANGE':
      return {
        ...state,
        isConnected: action.payload.connected,
        notification: !action.payload.connected ? {
          type: 'error',
          message: 'WebSocket connection lost. Attempting to reconnect...'
        } : null
      };
    case 'NEW_REQUEST':
      // Avoid duplicates
      if (state.requests.some(req => req.requestId === action.payload.requestId)) {
        return state;
      }
      return {
        ...state,
        requests: [...state.requests, action.payload],
        notification: {
          type: 'info',
          message: `New remote control request from ${action.payload.deviceName}`
        }
      };
    case 'ACCEPT_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        activeSession: {
          status: 'pending',
          requestId: action.payload.requestId,
          deviceId: action.payload.deviceId,
          deviceName: action.payload.deviceName,
          sessionId: action.payload.sessionId // Store sessionId for matching later
        }
      };
    case 'DECLINE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        notification: {
          type: 'info',
          message: 'Request declined'
        }
      };
    case 'REQUEST_TIMEOUT':
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        notification: {
          type: 'info',
          message: `Remote control request from ${action.payload.deviceName} timed out`
        }
      };
    case 'SESSION_STATUS_UPDATE':
      console.log('SESSION_STATUS_UPDATE for status:', action.payload.status);
      
      // Only update if we have an active session
      if (!state.activeSession) {
        console.warn('Received status update but no active session exists');
        return state;
      }
      
      // Check if we have matching sessionId
      const sessionMatch = action.payload.sessionId && 
                          state.activeSession.sessionId === action.payload.sessionId;
      
      console.log('Session match check:', {
        sessionMatch,
        activeSessionId: state.activeSession.sessionId,
        payloadSessionId: action.payload.sessionId
      });
      
      if (!sessionMatch) {
        console.warn('Session ID mismatch, ignoring update');
        return state;
      }
      
      // Map backend status to frontend status
      let frontendStatus: 'pending' | 'connected' | 'error' = 'pending';
      let notificationType: 'success' | 'error' | 'info' = 'info';
      let notificationMessage = action.payload.message || '';
      
      if (action.payload.status === 'connected') {
        frontendStatus = 'connected';
        notificationType = 'success';
        notificationMessage = notificationMessage || `Connected to ${state.activeSession.deviceName}`;
        console.log('Setting status to connected');
      } 
      else if (action.payload.status === 'pending_device_confirmation' || 
               action.payload.status === 'admin_accepted') {
        // Keep as pending for intermediate states
        frontendStatus = 'pending';
        notificationType = 'info';
        notificationMessage = notificationMessage || 'Waiting for device confirmation...';
        console.log('Keeping status as pending (waiting for device)');
      }
      else if (action.payload.status === 'failed' || 
               action.payload.status === 'rejected' || 
               action.payload.status === 'timed_out' ||
               action.payload.status === 'disconnected') {
        // Only these specific error statuses should clear the session
        frontendStatus = 'error';
        notificationType = 'error';
        console.log('Setting status to error and clearing session');
        return {
          ...state,
          activeSession: null,
          notification: {
            type: notificationType,
            message: notificationMessage || `Session ended: ${action.payload.status}`
          }
        };
      }
      
      // For all other statuses, maintain the active session with updated status
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          status: frontendStatus
        },
        notification: {
          type: notificationType,
          message: notificationMessage
        }
      };
    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notification: null
      };
    default:
      return state;
  }
}

// Context
interface RemoteControlContextType extends RemoteControlState {
  acceptRequest: (requestId: string, deviceId: string, deviceName: string, sessionId: string) => void;
  declineRequest: (requestId: string, deviceId: string, sessionId: string) => void;
  clearNotification: () => void;
}

const RemoteControlContext = createContext<RemoteControlContextType | undefined>(undefined);

// Provider component
export function RemoteControlProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Use a ref to track the latest state for use in event listeners
  const stateRef = useRef(state);
  
  // Keep stateRef updated with latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  // Use a ref to track timeout IDs for each request
  const requestTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Timeout duration in milliseconds
  const REQUEST_TIMEOUT_DURATION = 30000; // 30 seconds
  
  // Function to clear timeout for a specific request
  const clearRequestTimeout = (requestId: string) => {
    if (requestTimeoutsRef.current[requestId]) {
      clearTimeout(requestTimeoutsRef.current[requestId]);
      delete requestTimeoutsRef.current[requestId];
    }
  };
  
  // Function to handle request timeout
  const handleRequestTimeout = (requestId: string, deviceName: string) => {
    dispatch({
      type: 'REQUEST_TIMEOUT',
      payload: { requestId, deviceName }
    });
    clearRequestTimeout(requestId);
    
    // Optionally notify backend about timeout
    sendWebSocketMessage('timeout_request', { requestId });
  };
  
  useEffect(() => {
    console.log('Setting up WebSocket listeners');
    
    // Set up WebSocket listener for remote control requests
    const handleWebSocketMessage = (data: any) => {
      console.log('WebSocket message received:', data);
      
      if (data.type === 'request_control') {
        const request = {
          requestId: data.requestId,
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          timestamp: data.timestamp || Date.now(),
          sessionId: data.sessionId
        };
        
        dispatch({ 
          type: 'NEW_REQUEST', 
          payload: request
        });
        
        // Set timeout for this request
        clearRequestTimeout(request.requestId); // Clear any existing timeout (just in case)
        requestTimeoutsRef.current[request.requestId] = setTimeout(() => {
          handleRequestTimeout(request.requestId, request.deviceName);
        }, REQUEST_TIMEOUT_DURATION);
      } 
      else if (data.type === 'control_status_update') {
        console.log('Received control_status_update:', data);
        
        // Get current state from ref to ensure we have the latest
        const currentState = stateRef.current;
        
        // Check if we have an active session
        if (!currentState.activeSession) {
          console.warn('No active session exists, ignoring status update');
          return;
        }
        
        const sessionId = data.sessionId;
        const status = data.status; // Keep the original status from backend
        const message = data.message || `Session status: ${data.status}`;
        
        console.log('Dispatching status update with original backend status:', status);
        
        dispatch({
          type: 'SESSION_STATUS_UPDATE',
          payload: {
            sessionId,
            status, // Pass the original status to let the reducer decide how to handle it
            message
          }
        });
      }
      else if (data.type === 'session_status') {
        console.log('Received session_status (legacy):', data);
        
        dispatch({
          type: 'SESSION_STATUS_UPDATE',
          payload: {
            sessionId: data.sessionId || '',
            status: data.status,
            message: data.message
          }
        });
      } 
      else if (data.type === 'connection_status') {
        dispatch({
          type: 'CONNECTION_CHANGE',
          payload: {
            connected: data.connected
          }
        });
      }
    };
    
    console.log('Connecting to control socket...');
    websocketService.connectControlSocket(); // Connect to the control socket
    websocketService.addControlMessageListener(handleWebSocketMessage); 
    
    // Update connection status regularly
    const connectionCheckInterval = setInterval(() => {
      const isConnected = websocketService.getControlConnectionStatus();
      dispatch({
        type: 'CONNECTION_CHANGE',
        payload: { connected: isConnected ?? false }
      });
    }, 5000);
    
    // Clean up on unmount
    return () => {
      console.log('Cleaning up WebSocket listeners');
      
      // Clear all request timeouts
      Object.keys(requestTimeoutsRef.current).forEach(requestId => {
        clearTimeout(requestTimeoutsRef.current[requestId]);
      });
      
      websocketService.removeControlMessageListener(handleWebSocketMessage);
      clearInterval(connectionCheckInterval);
    };
  }, []);
  
  // Actions
  const sendWebSocketMessage = (type: string, data: any) => {
    console.log('Sending WebSocket message:', { type, ...data });
    return websocketService.sendControlMessage({ type, ...data });
  };
  
  const acceptRequest = (requestId: string, deviceId: string, deviceName: string, sessionId: string) => {
    console.log('Accepting request:', { requestId, deviceId, deviceName, sessionId });
    
    const success = sendWebSocketMessage('control_response', { 
      sessionId, 
      action: 'accept',
      requestId, // Include requestId for reference
      deviceId   // Include deviceId for reference
    });
    
    if (success) {
      clearRequestTimeout(requestId);
      
      dispatch({
        type: 'ACCEPT_REQUEST',
        payload: { requestId, deviceId, deviceName, sessionId }
      });
    } else {
      dispatch({
        type: 'SESSION_STATUS_UPDATE',
        payload: {
          sessionId,
          status: 'error',
          message: 'Failed to send accept request. Please check your connection.'
        }
      });
    }
  };
  
  const declineRequest = (requestId: string, deviceId: string, sessionId: string) => {
    console.log('Declining request:', { requestId, deviceId, sessionId });
    
    const success = sendWebSocketMessage('control_response', { 
      action: 'reject', 
      sessionId, 
      requestId, 
      deviceId 
    });
    
    if (success) {
      // Clear timeout for this request
      clearRequestTimeout(requestId);
      
      dispatch({
        type: 'DECLINE_REQUEST',
        payload: { requestId }
      });
    }
  };
  
  const clearNotification = () => {
    dispatch({ type: 'CLEAR_NOTIFICATION' });
  };
  
  // Context value
  const value = {
    ...state,
    acceptRequest,
    declineRequest,
    clearNotification
  };
  
  return (
    <RemoteControlContext.Provider value={value}>
      {children}
    </RemoteControlContext.Provider>
  );
}

// Custom hook for using the context
export function useRemoteControl() {
  const context = useContext(RemoteControlContext);
  if (context === undefined) {
    throw new Error('useRemoteControl must be used within a RemoteControlProvider');
  }
  return context;
}