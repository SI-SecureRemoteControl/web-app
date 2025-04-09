let socket: WebSocket | null = null;
let messageListeners: ((data: any) => void)[] = [];

const connect = () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("WebSocket connection already exists or is connecting.");
    return;
  }

  const wsUrl = import.meta.env.VITE_WS_URL;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("WebSocket Service: Connection established");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      messageListeners.forEach(listener => listener(data));
    } catch (err) {
      console.error("WebSocket Service: Error parsing message", err);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket Service Error:", error);
  };

  socket.onclose = (event) => {
    console.log(`WebSocket Service: Connection closed. Clean: ${event.wasClean}, Code: ${event.code}, Reason: ${event.reason}`);
    socket = null;
  };
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

export const websocketService = {
  connect,
  disconnect,
  addMessageListener,
  removeMessageListener,
};