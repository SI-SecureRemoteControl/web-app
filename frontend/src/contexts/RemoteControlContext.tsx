import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { websocketService } from '../services/webSocketService'; 
import { useNavigate } from 'react-router-dom';

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
  status: 'pending' | 'connected' | 'error'; // Frontend uses these specific statuses
  sessionId: string;
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
  navigateToWebRTC: boolean;
  currentSessionId?: string;
  currentDeviceId?: string;
}

// --- CORRECTION 1: Action Type Payload ---
type RemoteControlAction =
  | { type: 'CONNECTION_CHANGE'; payload: { connected: boolean } }
  | { type: 'NEW_REQUEST'; payload: RemoteRequest }
  | { type: 'ACCEPT_REQUEST'; payload: { requestId: string; deviceId: string; deviceName: string; sessionId: string } }
  | { type: 'DECLINE_REQUEST'; payload: { requestId: string } }
  | { type: 'REQUEST_TIMEOUT'; payload: { requestId: string; deviceName: string } }
  | { type: 'SESSION_STATUS_UPDATE'; payload: { sessionId: string; status: string; message: string } }
  | { type: 'CLEAR_NOTIFICATION' }
  | { type: 'RESET_NAVIGATION' };

// Initial state
const initialState: RemoteControlState = {
  requests: [],
  activeSession: null,
  notification: null,
  isConnected: false,
  navigateToWebRTC: false,
  currentSessionId: undefined,
  currentDeviceId: undefined
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
        } : state.notification // Keep existing notification if connection comes back
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
            sessionId: action.payload.sessionId
          },
          currentSessionId: action.payload.sessionId,
          currentDeviceId: action.payload.deviceId,
          notification: { type: 'info', message: `Connecting to ${action.payload.deviceName}...` },
          navigateToWebRTC: false // Don't navigate immediately
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

    // --- CORRECTION 2: SESSION_STATUS_UPDATE Reducer Logic ---
    case 'SESSION_STATUS_UPDATE': { 
      console.log('SESSION_STATUS_UPDATE received:', action.payload);

      // Only update if we have an active session
      if (!state.activeSession) {
        console.warn('Received status update but no active session exists');
        return state;
      }

      // Check if the update is for the current active session
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

      // Map backend status (string) to frontend status ('pending' | 'connected' | 'error')
      let frontendStatus: 'pending' | 'connected' | 'error' = state.activeSession.status; // Default to current
      let notificationType: 'success' | 'error' | 'info' = 'info';
      let notificationMessage = action.payload.message || '';
      let shouldNavigate = false;
      let shouldClearSession = false;

      const backendStatus = action.payload.status;

      if (backendStatus === 'connected') {
        frontendStatus = 'connected';
        notificationType = 'success';
        notificationMessage = notificationMessage || `Connected to ${state.activeSession.deviceName}`;
        shouldNavigate = true; 
        console.log('Mapping to: connected');
      }
      else if (backendStatus === 'pending_device_confirmation' ||
               backendStatus === 'admin_accepted' ||
               backendStatus === 'pending') { // Explicitly handle 'pending' too
        frontendStatus = 'pending';
        notificationType = 'info';
        notificationMessage = notificationMessage || 'Session pending...';
        console.log('Mapping to: pending');
      }
      else if (backendStatus === 'failed' ||
               backendStatus === 'rejected' ||
               backendStatus === 'timed_out' ||
               backendStatus === 'disconnected' ||
               backendStatus === 'terminated' ||
               backendStatus === 'error') { // Explicitly handle 'error'
        frontendStatus = 'error';
        notificationType = 'error';
        shouldClearSession = true; // Clear session on terminal errors/disconnects
        notificationMessage = notificationMessage || `Session ended: ${backendStatus}`;
        console.log('Mapping to: error (clearing session)');
      } else {
          console.warn(`Unhandled backend status received: ${backendStatus}. Keeping current state.`);
          notificationMessage = notificationMessage || `Received unknown status: ${backendStatus}`;
          frontendStatus = 'error'; 
          notificationType = 'error';
          shouldClearSession = true; 
      }

      // If session should be cleared (terminal states)
      if (shouldClearSession) {
        return {
          ...state,
          activeSession: null, // Clear the session
          notification: {
            type: notificationType,
            message: notificationMessage
          },
          navigateToWebRTC: false, // Ensure navigation flag is off
          currentSessionId: undefined, // Clear current IDs
          currentDeviceId: undefined
        };
      }

      // Otherwise, update the existing session
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          status: frontendStatus // Update status
        },
        notification: {
          type: notificationType,
          message: notificationMessage
        },
        navigateToWebRTC: shouldNavigate // Set navigation flag
      };
    } 

    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notification: null
      };
    case 'RESET_NAVIGATION':
      return {
        ...state,
        navigateToWebRTC: false,
      };
    default:
      return state;
  }
}


// Context
interface RemoteControlContextType extends RemoteControlState {
    acceptRequest: (requestId: string, deviceId: string, deviceName: string, sessionId: string) => void;
    declineRequest: (requestId: string, deviceId: string, sessionId: string) => void;
    terminateSession: (sessionId: string) => void; 
    clearNotification: () => void;
    resetNavigation: () => void;
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


    const navigate = useNavigate();

    // Use a ref to track timeout IDs for each request
    const requestTimeoutsRef = useRef<Record<string, NodeJS.Timeout | number>>({});

    const REQUEST_TIMEOUT_DURATION = 30000; 

    // Function to clear timeout for a specific request
    const clearRequestTimeout = (requestId: string) => {
      if (requestTimeoutsRef.current[requestId]) {
        clearTimeout(requestTimeoutsRef.current[requestId] as NodeJS.Timeout); 
        delete requestTimeoutsRef.current[requestId];
      }
    };

    // Function to handle request timeout
    const handleRequestTimeout = (requestId: string, deviceName: string) => {
      // Check if the request still exists (it might have been accepted/declined already)
      if (stateRef.current.requests.some(req => req.requestId === requestId)) {
        dispatch({
          type: 'REQUEST_TIMEOUT',
          payload: { requestId, deviceName }
        });
        sendWebSocketMessage('timeout_request', { requestId });
      }
       clearRequestTimeout(requestId); 
    };

    const sendWebSocketMessage = (type: string, data: any) => {
      console.log('Sending WebSocket message:', { type, ...data });
      return websocketService.sendControlMessage({ type, ...data });
    };


    useEffect(() => {
      console.log('Setting up WebSocket listeners');

      // Set up WebSocket listener for remote control requests
      const handleWebSocketMessage = (data: any) => {
        console.log('WebSocket message received:', data);

        if (data.type === 'request_control') {
          const request: RemoteRequest = { 
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
          clearRequestTimeout(request.requestId); 
          requestTimeoutsRef.current[request.requestId] = setTimeout(() => {
            handleRequestTimeout(request.requestId, request.deviceName);
          }, REQUEST_TIMEOUT_DURATION);

        }
        else if (data.type === 'control_status_update' || data.type === 'session_status') { 
            console.log(`Received ${data.type}:`, data);

            // Get current state from ref to ensure we have the latest
            // const currentState = stateRef.current;

            // Basic validation: ensure necessary fields exist
            if (!data.sessionId || typeof data.status !== 'string') {
                console.warn(`Invalid ${data.type} message received:`, data);
                return;
            }

            // if (!currentState.activeSession) {
            //    console.warn('No active session exists, ignoring status update');
            //    return;
            // }

            const sessionId = data.sessionId;
            const status = data.status; // Keep the original backend status (string)
            const message = data.message || `Session status: ${data.status}`;

            dispatch({
                type: 'SESSION_STATUS_UPDATE',
                payload: {
                    sessionId,
                    status, 
                    message
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
        } else {
            console.log('Received unhandled WebSocket message type:', data.type);
        }
      };

      console.log('Connecting to control socket...');
      websocketService.connectControlSocket(); 
      websocketService.addControlMessageListener(handleWebSocketMessage);

      const connectionCheckInterval = setInterval(() => {
        const isConnected = websocketService.getControlConnectionStatus();
        if (stateRef.current.isConnected !== isConnected) {
            dispatch({
            type: 'CONNECTION_CHANGE',
            payload: { connected: isConnected ?? false }
            });
        }
      }, 5000);

      return () => {
        console.log('Cleaning up WebSocket listeners');

        // Clear all request timeouts
        Object.keys(requestTimeoutsRef.current).forEach(requestId => {
          clearTimeout(requestTimeoutsRef.current[requestId] as NodeJS.Timeout);
        });
        requestTimeoutsRef.current = {}; 

        websocketService.removeControlMessageListener(handleWebSocketMessage);
        clearInterval(connectionCheckInterval);
        // websocketService.disconnectControlSocket();
      };

    }, []); 

    // Navigation Effect
    useEffect(() => {
      if (state.navigateToWebRTC && state.currentDeviceId && state.currentSessionId) {
        console.log(`Navigating to /remote-control?deviceId=${state.currentDeviceId}&sessionId=${state.currentSessionId}`);
        navigate(`/remote-control?deviceId=${state.currentDeviceId}&sessionId=${state.currentSessionId}`);
        dispatch({ type: 'RESET_NAVIGATION' });
      }
    }, [state.navigateToWebRTC, state.currentDeviceId, state.currentSessionId, navigate]);


    // Context Actions
    const acceptRequest = (requestId: string, deviceId: string, deviceName: string, sessionId: string) => {
      console.log('Accepting request:', { requestId, deviceId, deviceName, sessionId });

      const success = sendWebSocketMessage('control_response', {
        sessionId,
        action: 'accept',
        requestId, 
        deviceId   
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
                sessionId, // Use the relevant sessionId
                status: 'error', // Indicate an error state
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
      } else {
          dispatch({ type: 'CLEAR_NOTIFICATION' }); // Clear previous first
          dispatch({ type: 'CONNECTION_CHANGE', payload: { connected: false } }); // Example: Indicate connection issue
          console.error("Failed to send decline request");
      }
    };

    const terminateSession = (sessionId: string) => {
      console.log('Terminating session:', { sessionId });

      // Get active session from state ref to ensure it's current
      const currentActiveSession = stateRef.current.activeSession;

      if (!currentActiveSession || currentActiveSession.sessionId !== sessionId) {
        console.warn('Cannot terminate - no matching active session found in current state');
        return;
      }

      const deviceId = currentActiveSession.deviceId;

      const success = sendWebSocketMessage('terminate_session', {
        sessionId,
        deviceId
      });

      dispatch({
        type: 'SESSION_STATUS_UPDATE',
        payload: {
          sessionId,
          status: 'terminated', // Use backend status string
          message: success ? 'Session termination requested...' : 'Failed to send termination request. Session may still be active.'
        }
      });

    };

    const clearNotification = () => {
      dispatch({ type: 'CLEAR_NOTIFICATION' });
    };

    const resetNavigation = () => {
      dispatch({ type: 'RESET_NAVIGATION' });
    };

    // Context value
    const value: RemoteControlContextType = { 
      ...state,
      acceptRequest,
      declineRequest,
      terminateSession, 
      clearNotification,
      resetNavigation
    };

    return (
      <RemoteControlContext.Provider value={value}>
        {children}
      </RemoteControlContext.Provider>
    );
}


export function useRemoteControl(): RemoteControlContextType { 
  const context = useContext(RemoteControlContext);
  if (context === undefined) {
    throw new Error('useRemoteControl must be used within a RemoteControlProvider');
  }
  return context;
}