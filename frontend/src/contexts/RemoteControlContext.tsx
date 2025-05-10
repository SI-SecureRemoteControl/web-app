import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { websocketService } from '../services/webSocketService';
import { useNavigate } from 'react-router-dom';
import {UserContext} from "../contexts/UserContext";
import {User} from "../components/types/user";

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
  | { type: 'SESSION_STATUS_UPDATE'; payload: { sessionId: string; status: string; message: string; deviceId?: string; decision?: 'accepted' } }
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

    case 'SESSION_STATUS_UPDATE': {
      const { sessionId: payloadSessionId, status: backendStatus, message: payloadMessage, deviceId: payloadDeviceId } = action.payload;
      console.log(`Context Reducer: SESSION_STATUS_UPDATE for ${payloadSessionId}, new backend status: ${backendStatus}`);

      // IMPORTANT: Only process this update if it's for the session we believe is active,
      // OR if we don't have an active session yet and this is an activating status for the accepted session.
      if (!state.activeSession || state.activeSession.sessionId !== payloadSessionId) {
        // If we have no active session, but this update is for the one we JUST accepted (check by sessionId if available)
        // This can happen if ACCEPT_REQUEST was dispatched, and a server status comes in before the next render cycle fully reflects the new activeSession.
        // However, given ACCEPT_REQUEST *sets* activeSession, this path should be less common for initial statuses.
        // More likely, this is a status update for an OLD session after a new one has been activated, or if no session is active.
        console.warn(`Context Reducer: SESSION_STATUS_UPDATE for ${payloadSessionId} received, but current active session is ${state.activeSession?.sessionId || 'null'}. Ignoring unless it's a relevant initial status.`);
        // Let's not ignore if it's 'pending_device_confirmation' or 'connected' for a session we *might* have just accepted.
        // This is tricky. For now, if no active session matches, we don't update it, UNLESS it's a terminal state.
        // A robust way is to ensure ACCEPT_REQUEST always primes activeSession.

        const isPotentiallyActivating = ['pending_device_confirmation', 'connected'].includes(backendStatus);
        if (!isPotentiallyActivating && !(state.activeSession && state.activeSession.sessionId === payloadSessionId)) {
             // If not activating and not for current active, and not terminal, ignore.
            const isTerminal = ['failed', 'rejected', 'timed_out', 'disconnected', 'terminated', 'terminated_by_admin', 'terminated_not_found'].includes(backendStatus);
            if (!isTerminal) { // Only ignore if not terminal and not for current active
                console.log("Ignoring status update for non-active session or non-activating status.");
                return state;
            }
        }
      }


      let frontendStatus: 'pending' | 'connected' | 'error' = state.activeSession?.status || 'pending';
      let notificationType: 'success' | 'error' | 'info' = 'info';
      let notificationMessage = payloadMessage || `Status: ${backendStatus}`;
      let shouldNavigate = state.navigateToWebRTC;
      let shouldClearSession = false;

      if (backendStatus === 'connected') {
        frontendStatus = 'connected';
        notificationType = 'success';
        notificationMessage = `Povezan sa ${state.activeSession?.deviceName || payloadDeviceId || 'uređajem'}.`;
        shouldNavigate = true;
      } else if (backendStatus === 'pending_device_confirmation' || backendStatus === 'admin_accepted') {
        frontendStatus = 'pending';
        notificationType = 'info';
      } else if (
        ['failed', 'rejected', 'timed_out', 'disconnected', 'terminated',
         'terminated_by_admin', 'terminated_not_found',
         'comm_disconnected', 'comm_disconnected_while_connected', 'error']
        .includes(backendStatus)
      ) {
        frontendStatus = 'error';
        notificationType = 'error';
        shouldClearSession = true;
        notificationMessage = `Sesija sa ${state.activeSession?.deviceName || payloadDeviceId || 'uređajem'} je završena: ${backendStatus}`;
      } else {
        console.warn(`Context Reducer: Unhandled backend status '${backendStatus}'. Treating as pending.`);
        frontendStatus = 'pending'; // Or 'error' if preferred for unknown states
        notificationType = 'info';
      }

      if (shouldClearSession) {
        // Only clear if the update is for the currently active session
        if (state.activeSession && state.activeSession.sessionId === payloadSessionId) {
            console.log(`Context Reducer: Clearing active session ${payloadSessionId} due to: ${backendStatus}`);
            return {
                ...state,
                activeSession: null,
                notification: { type: notificationType, message: notificationMessage },
                navigateToWebRTC: false,
                currentSessionId: undefined,
                currentDeviceId: undefined,
            };
        } else {
            // Terminal status for a non-active session, just update notification if needed
            console.log(`Context Reducer: Received terminal status ${backendStatus} for ${payloadSessionId}, but it wasn't the active one. Updating notification only.`);
            return {...state, notification: { type: notificationType, message: notificationMessage }};
        }
      }

      // If it's an update for the currently active session (or one we are activating)
      if (state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        return {
          ...state,
          activeSession: {
            ...state.activeSession,
            status: frontendStatus,
            deviceId: payloadDeviceId || state.activeSession.deviceId, // Update if server provides it
          },
          notification: { type: notificationType, message: notificationMessage },
          navigateToWebRTC: shouldNavigate,
          currentSessionId: payloadSessionId, // Ensure these are consistent
          currentDeviceId: payloadDeviceId || state.activeSession.deviceId,
        };
      } else if (backendStatus === 'connected' || backendStatus === 'pending_device_confirmation') {
        // This handles the case where `activeSession` was null, but we get a 'connected' or 'pending'
        // This path indicates the `ACCEPT_REQUEST` might not have fully populated `activeSession` yet,
        // or this is the very first status update for that newly accepted session.
        const originalRequest = state.requests.find(r => r.sessionId === payloadSessionId);
        console.log(`Context Reducer: Setting up new active session ${payloadSessionId} with status ${backendStatus}`);
        return {
            ...state,
            activeSession: {
                sessionId: payloadSessionId,
                deviceId: payloadDeviceId || originalRequest?.deviceId || '',
                deviceName: originalRequest?.deviceName || 'Nepoznat uređaj',
                status: frontendStatus,
                requestId: originalRequest?.requestId || '',
            },
            notification: { type: notificationType, message: notificationMessage },
            navigateToWebRTC: shouldNavigate,
            currentSessionId: payloadSessionId,
            currentDeviceId: payloadDeviceId || originalRequest?.deviceId || '',
        };
      }

      console.warn(`Context Reducer: Fell through SESSION_STATUS_UPDATE logic for ${payloadSessionId}, status ${backendStatus}.`);
      return state; // Should not be reached if logic above is exhaustive
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
    const userContext: User | null = useContext(UserContext);

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
      if(!userContext && !localStorage.getItem("token")) {
        console.log('User not logged in');
        return;
      }
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

    }, [userContext]);

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
