import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { websocketService, invokeFileBrowserListener } from '../services/webSocketService';
import { useNavigate } from 'react-router-dom';
import { UserContext } from "../contexts/UserContext";
import { User } from "../components/types/user";

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
  triggerAutomaticTermination: string | null;
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
  | { type: 'RESET_NAVIGATION' }
  | { type: 'CLEAR_AUTOMATIC_TERMINATION_TRIGGER' };

// Initial state
const getInitialState = (): RemoteControlState => {
  const savedSession = localStorage.getItem('activeSession');
  const savedSessionId = localStorage.getItem('currentSessionId');
  const savedDeviceId = localStorage.getItem('currentDeviceId');
  return {
    requests: [],
    activeSession: savedSession ? JSON.parse(savedSession) : null,
    notification: null,
    isConnected: false,
    navigateToWebRTC: false,
    currentSessionId: savedSessionId || undefined,
    currentDeviceId: savedDeviceId || undefined,
    triggerAutomaticTermination: null
  };
};

const initialState: RemoteControlState = getInitialState();

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
        } : state.notification,
        triggerAutomaticTermination: state.triggerAutomaticTermination // Keep existing notification if connection comes back
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
        },
        triggerAutomaticTermination: state.triggerAutomaticTermination
      };
    case 'ACCEPT_REQUEST': {
      const newSession: ActiveSession = {
        status: 'pending',
        requestId: action.payload.requestId,
        deviceId: action.payload.deviceId,
        deviceName: action.payload.deviceName,
        sessionId: action.payload.sessionId
      };
      localStorage.setItem('activeSession', JSON.stringify(newSession));
      localStorage.setItem('currentSessionId', action.payload.sessionId);
      localStorage.setItem('currentDeviceId', action.payload.deviceId);
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        activeSession: newSession,
        currentSessionId: action.payload.sessionId,
        currentDeviceId: action.payload.deviceId,
        notification: { type: 'info', message: `Connecting to ${action.payload.deviceName}...` },
        navigateToWebRTC: false,
        triggerAutomaticTermination: state.triggerAutomaticTermination  // Don't navigate immediately
      };
    }
    case 'DECLINE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        notification: {
          type: 'info',
          message: 'Request declined'
        },
        triggerAutomaticTermination: state.triggerAutomaticTermination
      };
    case 'REQUEST_TIMEOUT':
      return {
        ...state,
        requests: state.requests.filter(req => req.requestId !== action.payload.requestId),
        notification: {
          type: 'info',
          message: `Remote control request from ${action.payload.deviceName} timed out`
        },
        triggerAutomaticTermination: state.triggerAutomaticTermination
      };

    case 'SESSION_STATUS_UPDATE': {
      const { sessionId: payloadSessionId, status: backendStatus, message: payloadMessage, deviceId: payloadDeviceId } = action.payload;
      console.log(`Context Reducer: SESSION_STATUS_UPDATE for ${payloadSessionId}, new backend status: ${backendStatus}`);

      if (backendStatus === 'inactive_disconnect' && state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        console.log(`Context Reducer: Received 'inactive_disconnect' for active session ${payloadSessionId}. Setting trigger.`);
        return {
          ...state,
          notification: { type: 'error', message: payloadMessage || `Sesija ${payloadSessionId} završena zbog neaktivnosti.` },
          triggerAutomaticTermination: payloadSessionId, 
          navigateToWebRTC: false, 
        };
      }
      else if (backendStatus === 'session_expired' && state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        console.log(`Context Reducer: Received 'session_expired' for active session ${payloadSessionId}. Setting trigger.`);
        return {
          ...state,
          notification: { type: 'error', message: payloadMessage || `Sesija ${payloadSessionId} završena zbog toga sto je istekla.` },
          triggerAutomaticTermination: payloadSessionId, 
          navigateToWebRTC: false, 
        };
      }
      else if (backendStatus === 'terminate_session' && state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        console.log(`Context Reducer: Received 'terminate_session' for active session ${payloadSessionId}. Setting trigger.`);
        return {
          ...state,
          notification: { type: 'error', message: payloadMessage || `Sesija ${payloadSessionId} završena zbog toga sto je ugasena od androida.` },
          triggerAutomaticTermination: payloadSessionId, 
          navigateToWebRTC: false, 
        };
      }

      //INACTIVITY_REPORTED_BY_COMM
      const isTerminal = ['failed', 'rejected', 'timed_out', 'disconnected', 'terminated', 'terminated_by_admin', 'terminated_not_found', 'inactive_disconnect', 'session_expired', 'terminate_session'].includes(backendStatus);
      if (isTerminal && state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        console.log(`Context Reducer: Clearing active session ${payloadSessionId} due to terminal status: ${backendStatus}`);
        // Clear persisted session on terminal
        localStorage.removeItem('activeSession');
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('currentDeviceId');
        return {
          ...state,
          activeSession: null,
          notification: { type: 'error', message: payloadMessage || `Sesija ${payloadSessionId} završena: ${backendStatus}` },
          navigateToWebRTC: false,
          currentSessionId: undefined,
          currentDeviceId: undefined,
          triggerAutomaticTermination: null
        };
      }

      if (isTerminal && (!state.activeSession || state.activeSession.sessionId !== payloadSessionId)) {
        console.log(`Context Reducer: Received terminal status ${backendStatus} for non-active/mismatched session ${payloadSessionId}. Updating notification only.`);
        return { ...state, notification: { type: 'error', message: payloadMessage || `Sesija ${payloadSessionId} završena: ${backendStatus}` },
      triggerAutomaticTermination: state.triggerAutomaticTermination };
      }

      if (state.activeSession && state.activeSession.sessionId === payloadSessionId) {
        let frontendStatus: 'pending' | 'connected' | 'error' = state.activeSession.status;
        let notificationType: 'success' | 'error' | 'info' = 'info';
        let notificationMsg = payloadMessage || `Status: ${backendStatus}`;
        let shouldNavigate = state.navigateToWebRTC;

        if (backendStatus === 'connected') {
          frontendStatus = 'connected';
          notificationType = 'success';
          notificationMsg = `Povezan sa ${state.activeSession.deviceName}.`;
          shouldNavigate = true;
        } else if (backendStatus === 'pending_device_confirmation' || backendStatus === 'admin_accepted') {
          frontendStatus = 'pending';
          notificationType = 'info';
        } else {
          // Any other non-terminal status for the active session
          console.warn(`Context Reducer: Unexpected non-terminal status '${backendStatus}' for active session ${payloadSessionId}. Treating as pending.`);
          frontendStatus = 'pending'; // Or update as needed
        }

        // Persist session on update
        const updatedSession: ActiveSession = {
          ...state.activeSession,
          status: frontendStatus,
          deviceId: payloadDeviceId || state.activeSession.deviceId,
        };
        localStorage.setItem('activeSession', JSON.stringify(updatedSession));
        localStorage.setItem('currentSessionId', payloadSessionId);
        localStorage.setItem('currentDeviceId', payloadDeviceId || state.activeSession.deviceId);
        return {
          ...state,
          activeSession: updatedSession,
          notification: { type: notificationType, message: notificationMsg },
          navigateToWebRTC: shouldNavigate,
          currentSessionId: payloadSessionId,
          currentDeviceId: payloadDeviceId || state.activeSession.deviceId,
          triggerAutomaticTermination: null
        };
      }
      console.warn(`Context Reducer: Ignoring non-terminal status update for ${payloadSessionId} (status: ${backendStatus}) as it does not match current active session ${state.activeSession?.sessionId}.`);
      return state; // Should not be reached if logic above is exhaustive
    }
    case 'CLEAR_NOTIFICATION':
      return {
        ...state,
        notification: null,
        triggerAutomaticTermination: state.triggerAutomaticTermination
      };
    case 'RESET_NAVIGATION':
      return {
        ...state,
        navigateToWebRTC: false,
        triggerAutomaticTermination: state.triggerAutomaticTermination
      };
    case 'CLEAR_AUTOMATIC_TERMINATION_TRIGGER': 
      return {
        ...state,
        triggerAutomaticTermination: null,
      };
    default:
      return state;
  }
}


// Context
interface RemoteControlContextType extends RemoteControlState {
  acceptRequest: (requestId: string, deviceId: string, deviceName: string, sessionId: string) => void;
  declineRequest: (requestId: string, deviceId: string, sessionId: string) => void;
  terminateSession: (sessionId: string, reason?: string) => void;
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
    if (!userContext && !localStorage.getItem("token")) {
      console.log('User not logged in');
      return;
    }
    console.log('Setting up WebSocket listeners');

    // Set up WebSocket listener for remote control requests
    const handleWebSocketMessage = (data: any) => {

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
        if(data.endTime) {
          localStorage.setItem("session_end_time", data.endTime);
        }

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
      } else if (data.type === 'browse_request') {
        console.log('Handling browse_request message:', data);
      } else if (data.type === 'disconnect_fileshare_session') {
        console.log('Handling disconnect_fileshare_session message:', data);
      }else if (data.type === 'browse_response') {
        console.log('Forwarding browse_response to FileBrowser:', data);
        invokeFileBrowserListener(data);
      } else if(data.type === 'download_response'){
        invokeFileBrowserListener(data);
      }else if(data.type==='upload_status'){
        invokeFileBrowserListener(data);
      }else {
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
    //ne radi
    /*else if (!state.navigateToWebRTC && state.currentDeviceId && state.currentSessionId) {
      console.log(`Navigating to /remote-control?deviceId=${state.currentDeviceId}&sessionId=${state.currentSessionId}`);
      navigate(`/file-browser?deviceId=${state.currentDeviceId}&sessionId=${state.currentSessionId}`);
      dispatch({ type: 'RESET_NAVIGATION' });
    }*/
  }, [state.navigateToWebRTC, state.currentDeviceId, state.currentSessionId, navigate]);

  // NEW: Navigate to dashboard after session is terminated by backend (e.g., terminate_session)
  useEffect(() => {
    // If session is cleared and last notification is terminal, go to dashboard
    if (
      state.activeSession === null &&
      state.notification &&
      state.notification.type === 'error' &&
      state.notification.message &&
      (
        state.notification.message.includes('završena') ||
        state.notification.message.includes('terminated')
      )
    ) {
      console.log('Session terminated by backend, navigating to dashboard.');
      navigate('/dashboard');
      window.location.reload();
    }
  }, [state.activeSession, state.notification, navigate]);

  // Auto-disconnect and navigate to dashboard on terminate_session
  useEffect(() => {
    // If backend triggers terminate_session, auto-disconnect and navigate
    if (
      state.notification &&
      state.notification.type === 'error' &&
      state.notification.message &&
      (
        state.notification.message.includes('terminate_session') ||
        state.notification.message.includes('završena') ||
        state.notification.message.includes('terminated')
      )
    ) {
      // Call terminateSession if session is still active
      if (state.activeSession) {
        // Use a ref to avoid closure issues
        stateRef.current.activeSession && terminateSession(stateRef.current.activeSession.sessionId);
      } else {
        // If already cleared, just navigate
        navigate('/dashboard');
        window.location.reload();
      }
    }
  }, [state.notification, state.activeSession, navigate]);

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

    // Immediately clear the session from state for instant UI update
    dispatch({
      type: 'SESSION_STATUS_UPDATE',
      payload: {
        sessionId,
        status: 'terminated',
        message: 'Session terminated by user.'
      }
    });

    // Then send the termination message to backend
    const success = sendWebSocketMessage('terminate_session', {
      sessionId,
      deviceId
    });

    // Optionally, show a notification if sending failed (but session is already cleared from UI)
    if (!success) {
      dispatch({
        type: 'CLEAR_NOTIFICATION'
      });
      dispatch({
        type: 'CONNECTION_CHANGE',
        payload: { connected: false }
      });
      console.error('Failed to send termination request');
    }

    // After session is terminated, navigate to dashboard and refresh the page
    navigate('/dashboard');
    window.location.reload(); // Programmatically refresh the page to ensure a clean state
  };

  useEffect(() => {
    if (state.triggerAutomaticTermination && state.activeSession) {
      if (state.triggerAutomaticTermination === state.activeSession.sessionId) {
        console.log(`[EFFECT] Auto-terminating session ${state.triggerAutomaticTermination} due to trigger (e.g., inactive_disconnect).`);
        // Get the notification message that was set when 'inactive_disconnect' was processed
        terminateSession(state.triggerAutomaticTermination);
        dispatch({ type: 'CLEAR_AUTOMATIC_TERMINATION_TRIGGER' }); // Clear the trigger
      } else {
        // Mismatch, clear the trigger as it's for a different/old session
        console.warn(`[EFFECT] Auto-termination trigger for ${state.triggerAutomaticTermination} does not match active session ${state.activeSession.sessionId}. Clearing trigger.`);
        dispatch({ type: 'CLEAR_AUTOMATIC_TERMINATION_TRIGGER' });
      }
    }
  }, [state.triggerAutomaticTermination, state.activeSession, terminateSession]); 

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
    resetNavigation,
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
