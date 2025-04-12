import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { websocketService } from '../services/webSocketService';

// Types
export interface RemoteRequest {
  requestId: string;
  deviceId: string;
  deviceName: string;
  timestamp: number;
}

export interface ActiveSession {
  requestId: string;
  deviceId: string;
  deviceName: string;
  status: 'pending' | 'connected' | 'error';
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
  | { type: 'ACCEPT_REQUEST'; payload: { requestId: string; deviceId: string; deviceName: string } }
  | { type: 'DECLINE_REQUEST'; payload: { requestId: string } }
  | { type: 'REQUEST_TIMEOUT'; payload: { requestId: string; deviceName: string } }
  | { type: 'SESSION_STATUS_UPDATE'; payload: { status: 'pending' | 'connected' | 'error'; message: string } }
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
          deviceName: action.payload.deviceName
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
      return {
        ...state,
        activeSession: action.payload.status === 'connected' 
          ? { ...state.activeSession!, status: action.payload.status } 
          : null,
        notification: {
          type: action.payload.status === 'connected' ? 'success' : 'error',
          message: action.payload.message
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
  acceptRequest: (requestId: string, deviceId: string, deviceName: string) => void;
  declineRequest: (requestId: string, deviceId: string) => void;
  clearNotification: () => void;
}

const RemoteControlContext = createContext<RemoteControlContextType | undefined>(undefined);

// Provider component
export function RemoteControlProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
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
    // Set up WebSocket listener for remote control requests
    const handleWebSocketMessage = (data: any) => {
      if (data.type === 'remote_control_request') {
        const request = {
          requestId: data.requestId,
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          timestamp: data.timestamp || Date.now()
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
      } else if (data.type === 'session_status') {
        dispatch({
          type: 'SESSION_STATUS_UPDATE',
          payload: {
            status: data.status,
            message: data.message
          }
        });
      } else if (data.type === 'connection_status') {
        dispatch({
          type: 'CONNECTION_CHANGE',
          payload: {
            connected: data.connected
          }
        });
      }
    };
    
    // Connect to WebSocket and add listener
    websocketService.connect();
    websocketService.addMessageListener(handleWebSocketMessage);
    
    // Update connection status regularly
    const connectionCheckInterval = setInterval(() => {
      const isConnected = websocketService.getConnectionStatus();
      dispatch({
        type: 'CONNECTION_CHANGE',
        payload: { connected: isConnected ?? false }
      });
    }, 5000);
    
    // Clean up on unmount
    return () => {
      // Clear all request timeouts
      Object.keys(requestTimeoutsRef.current).forEach(requestId => {
        clearTimeout(requestTimeoutsRef.current[requestId]);
      });
      
      websocketService.removeMessageListener(handleWebSocketMessage);
      clearInterval(connectionCheckInterval);
    };
  }, []);
  
  // Actions
  const sendWebSocketMessage = (type: string, data: any) => {
    return websocketService.sendMessage({ type, ...data });
  };
  
  const acceptRequest = (requestId: string, deviceId: string, deviceName: string) => {
    const success = sendWebSocketMessage('accept_request', { requestId, deviceId });
    
    if (success) {
      // Clear timeout for this request
      clearRequestTimeout(requestId);
      
      dispatch({
        type: 'ACCEPT_REQUEST',
        payload: { requestId, deviceId, deviceName }
      });
    } else {
      dispatch({
        type: 'SESSION_STATUS_UPDATE',
        payload: {
          status: 'error',
          message: 'Failed to send accept request. Please check your connection.'
        }
      });
    }
  };
  
  const declineRequest = (requestId: string, deviceId: string) => {
    const success = sendWebSocketMessage('decline_request', { requestId, deviceId });
    
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