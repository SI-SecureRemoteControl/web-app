import {User} from "../components/types/user";

let dbSocket: WebSocket | null = null;
let controlSocket: WebSocket | null = null;

let dbMessageListeners: ((data: any) => void)[] = [];
let controlMessageListeners: ((data: any) => void)[] = [];

// Add a listener specifically for FileBrowser
let fileBrowserListener: ((data: any) => void) | null = null;

let dbReconnectAttempt = 0;
let controlReconnectAttempt = 0;
const maxReconnectAttempts = 5;
let dbReconnectTimer: number | null = null;
let controlReconnectTimer: number | null = null;

const connectWebSocket = (
  socketVar: 'dbSocket' | 'controlSocket',
  pathSuffix: string
): number | null => {
  let currentSocket: WebSocket | null;
  let listeners: ((data: any) => void)[];

  if (socketVar === 'dbSocket') {
    currentSocket = dbSocket;
    listeners = dbMessageListeners;
  } else {
    currentSocket = controlSocket;
    listeners = controlMessageListeners;
  }

  if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) {
    if (import.meta.env.MODE !== 'production') {
      console.log(`WebSocket (${pathSuffix}) connection already exists or is connecting.`);
    }
    return currentSocket.readyState;
  }

  let wsBaseUrl = import.meta.env.VITE_WS_URL;

  if (!wsBaseUrl) {
    console.error(`WebSocket (${pathSuffix}) URL is not defined. Please check VITE_WS_URL environment variable.`);
    return null;
  }

  wsBaseUrl = wsBaseUrl.replace(/\/undefined$/, '').replace(/\/$/, '');
  const wsUrl = `${wsBaseUrl}${pathSuffix}`;

  console.log(`Attempting WebSocket (${pathSuffix}) connection to: ${wsUrl}`);

  try {
    const user: User | null = JSON.parse(localStorage.getItem('user') ?? '');
    const newSocket = new WebSocket(wsUrl, user?.username);

    newSocket.onopen = () => {
      console.log(`WebSocket (${pathSuffix}): Connection established`);
      if (socketVar === 'dbSocket') {
        dbReconnectAttempt = 0;
        if (dbReconnectTimer) {
          clearTimeout(dbReconnectTimer);
          dbReconnectTimer = null;
        }
      } else {
        controlReconnectAttempt = 0;
        if (controlReconnectTimer) {
          clearTimeout(controlReconnectTimer);
          controlReconnectTimer = null;
        }
      }

      listeners.forEach(listener => {
        try {
          listener({ type: 'connection_status', connected: true, socketType: socketVar });
        } catch (err) {
          console.error(`Error in ${socketVar} connection listener:`, err);
        }
      });
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const listeneriIspravni = socketVar === 'controlSocket' ? controlMessageListeners : dbMessageListeners;
        listeneriIspravni.forEach(listener => {
          try {
            listener(data);
          } catch (err) {
            console.error(`Error in ${socketVar} message listener:`, err);
          }
        });
      } catch (err) {
        console.error(`WebSocket (${pathSuffix}): Error parsing message`, err);
      }
    };

    newSocket.onerror = (error) => {
      console.error(`WebSocket (${pathSuffix}) Error:`, error);
    };

    newSocket.onclose = (event) => {
      console.log(`WebSocket (${pathSuffix}): Connection closed. Clean: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason}`);
      let listeneriIspravni = socketVar === 'controlSocket' ? controlMessageListeners : dbMessageListeners;
      listeneriIspravni.forEach(listener => {
        try {
          listener({ type: 'connection_status', connected: false, socketType: socketVar });
        } catch (err) {
          console.error(`Error in ${socketVar} disconnection listener:`, err);
        }
      });

      if (socketVar === 'dbSocket') {
        dbSocket = null;
      } else {
        controlSocket = null;
      }

      if (!event.wasClean && (socketVar === 'dbSocket' ? dbReconnectAttempt : controlReconnectAttempt) < maxReconnectAttempts) {
        if (socketVar === 'dbSocket') {
          dbReconnectAttempt++;
          const delay = Math.min(30000, 1000 * Math.pow(2, dbReconnectAttempt));
          console.log(`WebSocket (db): Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${dbReconnectAttempt}/${maxReconnectAttempts})`);
          if (dbReconnectTimer) clearTimeout(dbReconnectTimer);
          dbReconnectTimer = window.setTimeout(() => connectDbSocket(), delay);
        } else {
          controlReconnectAttempt++;
          const delay = Math.min(30000, 1000 * Math.pow(2, controlReconnectAttempt));
          console.log(`WebSocket (control): Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${controlReconnectAttempt}/${maxReconnectAttempts})`);
          if (controlReconnectTimer) clearTimeout(controlReconnectTimer);
          controlReconnectTimer = window.setTimeout(() => connectControlSocket(), delay);
        }
      }
    };

    if (socketVar === 'dbSocket') {
      dbSocket = newSocket;
    } else {
      controlSocket = newSocket;
    }

    return newSocket.readyState;
  } catch (error) {
    console.error(`Failed to create WebSocket (${pathSuffix}) connection:`, error);
    return null;
  }
};

const connectDbSocket = () => connectWebSocket('dbSocket', '/ws/db_updates');
const connectControlSocket = () => connectWebSocket('controlSocket', '/ws/control/frontend');

const disconnectDbSocket = () => {
  if (dbSocket && dbSocket.readyState === WebSocket.OPEN) {
    console.log("WebSocket (db): Closing connection.");
    dbSocket.close(1000, "Client requested disconnect");
  }
  dbSocket = null;
  dbMessageListeners = [];
};

const disconnectControlSocket = () => {
  if (controlSocket && controlSocket.readyState === WebSocket.OPEN) {
    console.log("WebSocket (control): Closing connection.");
    controlSocket.close(1000, "Client requested disconnect");
  }
  controlSocket = null;
  controlMessageListeners = [];
};

const addDbMessageListener = (callback: (data: any) => void) => {
  dbMessageListeners.push(callback);
};

const removeDbMessageListener = () => {
  dbMessageListeners = [];
};

const addControlMessageListener = (callback: (data: any) => void) => {
  controlMessageListeners.push(callback);
};

const removeControlMessageListener = (callback: (data: any) => void) => {
  controlMessageListeners = controlMessageListeners.filter(listener => listener !== callback);
};

const sendDbMessage = (data: any) => {
  if (dbSocket && dbSocket.readyState === WebSocket.OPEN) {
    dbSocket.send(JSON.stringify(data));
    return true;
  }
  console.error("WebSocket (db): Cannot send message, connection not open");
  return false;
};

const sendControlMessage = (data: any) => {
    console.log(data);
  if (controlSocket && controlSocket.readyState === WebSocket.OPEN) {
    controlSocket.send(JSON.stringify(data));
    return true;
  }
  console.error("WebSocket (control): Cannot send message, connection not open");
  return false;
};

const getDbConnectionStatus = () => {
  return dbSocket && dbSocket.readyState === WebSocket.OPEN;
};

const getControlConnectionStatus = () => {
  return controlSocket && controlSocket.readyState === WebSocket.OPEN;
};

export const registerFileBrowserListener = (listener: (data: any) => void) => {
  fileBrowserListener = listener;
  console.log('FileBrowser listener registered.');
};

export const invokeFileBrowserListener = (data: any) => {
  if (fileBrowserListener) {
    fileBrowserListener(data);
  } else {
    console.warn('No FileBrowser listener registered to handle data:', data);
  }
};

export const websocketService = {
  connectDbSocket,
  connectControlSocket,
  disconnectDbSocket,
  disconnectControlSocket,
  addDbMessageListener,
  removeDbMessageListener,
  addControlMessageListener,
  removeControlMessageListener,
  sendDbMessage,
  sendControlMessage,
  getDbConnectionStatus,
  getControlConnectionStatus,
};
