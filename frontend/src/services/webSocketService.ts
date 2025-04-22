let dbSocket: WebSocket | null = null;
let controlSocket: WebSocket | null = null;

let dbMessageListeners: ((data: any) => void)[] = [];
let controlMessageListeners: ((data: any) => void)[] = [];

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
    console.log(`WebSocket (${pathSuffix}) connection already exists or is connecting. ReadyState: ${currentSocket.readyState}`);
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
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log(`WebSocket (${pathSuffix}): Connection established successfully`);
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
        console.log(`WebSocket (${pathSuffix}) raw message:`, event.data);
        const data = JSON.parse(event.data);
        console.log(`WebSocket (${pathSuffix}) parsed message:`, data);
        
        listeners.forEach(listener => {
          try {
            listener(data);
          } catch (err) {
            console.error(`Error in ${socketVar} message listener:`, err);
          }
        });
      } catch (err) {
        console.error(`WebSocket (${pathSuffix}): Error parsing message`, err, 'Raw data:', event.data);
      }
    };

    newSocket.onerror = (error) => {
      console.error(`WebSocket (${pathSuffix}) Error:`, error);
    };

    newSocket.onclose = (event) => {
      console.log(`WebSocket (${pathSuffix}): Connection closed. Clean: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason}`);

      listeners.forEach(listener => {
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
  console.log("Adding DB message listener");
  dbMessageListeners.push(callback);
};

const removeDbMessageListener = () => {
  console.log("Removing all DB message listeners");
  dbMessageListeners = [];
};

const addControlMessageListener = (callback: (data: any) => void) => {
  console.log("Adding control message listener");
  controlMessageListeners.push(callback);
};

const removeControlMessageListener = (callback: (data: any) => void) => {
  console.log("Removing specific control message listener");
  controlMessageListeners = controlMessageListeners.filter(listener => listener !== callback);
};

const sendDbMessage = (data: any) => {
  if (dbSocket && dbSocket.readyState === WebSocket.OPEN) {
    const message = JSON.stringify(data);
    console.log("Sending DB message:", message);
    dbSocket.send(message);
    return true;
  }
  console.error("WebSocket (db): Cannot send message, connection not open. ReadyState:", dbSocket?.readyState || "socket is null");
  return false;
};

const sendControlMessage = (data: any) => {
  console.log("Attempting to send control message:", data);
  
  if (controlSocket && controlSocket.readyState === WebSocket.OPEN) {
    const message = JSON.stringify(data);
    console.log("Sending control message:", message);
    controlSocket.send(message);
    return true;
  }
  
  console.error("WebSocket (control): Cannot send message, connection not open. ReadyState:", 
    controlSocket ? 
      controlSocket.readyState === 0 ? "CONNECTING" :
      controlSocket.readyState === 1 ? "OPEN" :
      controlSocket.readyState === 2 ? "CLOSING" :
      controlSocket.readyState === 3 ? "CLOSED" : "UNKNOWN" 
    : "socket is null");
  
  return false;
};

const getDbConnectionStatus = () => {
  const isOpen = dbSocket && dbSocket.readyState === WebSocket.OPEN;
  return isOpen;
};

const getControlConnectionStatus = () => {
  const isOpen = controlSocket && controlSocket.readyState === WebSocket.OPEN;
  return isOpen;
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