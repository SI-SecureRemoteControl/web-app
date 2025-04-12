let socket: WebSocket | null = null;
let messageListeners: ((data: any) => void)[] = [];

let reconnectAttempt = 0;
const maxReconnectAttempts = 5;
let reconnectTimer: number | null = null;

const connect = () => {
  // First, check if we already have a connection or are connecting
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    if (import.meta.env.MODE !== 'production') {
      console.log("WebSocket connection already exists or is connecting.");
    }
    return socket.readyState;
  }
  
  // Get WebSocket URL from environment variable
  let wsUrl = import.meta.env.VITE_WS_URL;
  
  // Validate the URL to prevent malformed connections
  if (!wsUrl) {
    console.error("WebSocket URL is not defined. Please check VITE_WS_URL environment variable.");
    return null;
  }

  console.log(`Attempting WebSocket connection to: ${wsUrl}`);
  
  // Remove any trailing slash or 'undefined' from the URL
  wsUrl = wsUrl.replace(/\/undefined$/, '').replace(/\/$/, '');
  
  // Log the actual URL we're connecting to (helpful for debugging)
  console.log(`Attempting to connect to WebSocket server at: ${wsUrl}`);
  
  try {
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket Service: Connection established");
      // Reset reconnect attempt counter on successful connection
      reconnectAttempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Notify listeners about the successful connection
      messageListeners.forEach(listener => {
        try {
          listener({ type: 'connection_status', connected: true });
        } catch (err) {
          console.error("Error in connection listener:", err);
        }
      });
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageListeners.forEach(listener => {
          try {
            listener(data);
          } catch (err) {
            console.error("Error in message listener:", err);
          }
        });
      } catch (err) {
        console.error("WebSocket Service: Error parsing message", err);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket Service Error:", error);
    };

    socket.onclose = (event) => {
      console.log(`WebSocket Service: Connection closed. Clean: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason}`);
      
      // Notify listeners about the disconnection
      messageListeners.forEach(listener => {
        try {
          listener({ type: 'connection_status', connected: false });
        } catch (err) {
          console.error("Error in disconnection listener:", err);
        }
      });
      
      socket = null;
      
      // Attempt to reconnect if not a clean close
      if (!event.wasClean && reconnectAttempt < maxReconnectAttempts) {
        reconnectAttempt++;
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt)); 
        console.log(`WebSocket Service: Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempt}/${maxReconnectAttempts})`);
        
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, delay);
      }
    };
    
    return socket.readyState;
  } catch (error) {
    console.error("Failed to create WebSocket connection:", error);
    return null;
  }
};

const disconnect = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("WebSocket Service: Closing connection.");
    socket.close(1000, "Client requested disconnect");
  }
  socket = null; 
  messageListeners = [];
};

const addMessageListener = (callback: (data: any) => void) => {
  messageListeners.push(callback);
};

const removeMessageListener = (callback: (data: any) => void) => {
  messageListeners = messageListeners.filter(listener => listener !== callback);
};

// Add a sendMessage function
const sendMessage = (data: any) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
    return true;
  }
  console.error("WebSocket Service: Cannot send message, connection not open");
  return false;
};

// Add a method to get connection status
const getConnectionStatus = () => {
  return socket && socket.readyState === WebSocket.OPEN;
};

export const websocketService = {
  connect,
  disconnect,
  addMessageListener,
  removeMessageListener,
  sendMessage,
  getConnectionStatus
};