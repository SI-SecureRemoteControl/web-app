const WebSocket = require('ws');

const socket = new WebSocket('wss://backend-wf7e.onrender.com/ws/control/comm'); 

socket.on('open', () => {
    console.log('Connected to the WebSocket server');
    
    const controlRequest = {
      requestId: "123",
      type: 'request_control',
      deviceId: 'c51df48d6b532ff0',
      deviceName: "name",
      timestamp: Date.now(),
      sessionId: '3123123'
    };

    socket.send(JSON.stringify(controlRequest));
});

socket.on('message', (data) => {
  const message = data.toString('utf8');
  console.log('Received message:', message);
  
  try {
    const parsedMessage = JSON.parse(message);
    console.log('Parsed message:', parsedMessage);
  } catch (e) {
    console.error('Failed to parse message as JSON:', e);
  }
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

socket.on('close', () => {
  console.log('WebSocket connection closed');
});
