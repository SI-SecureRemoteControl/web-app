const WebSocket = require('ws');

const socket = new WebSocket('ws://localhost:8080/ws/control/comm'); 

socket.on('open', () => {
    console.log('Connected to the WebSocket server');
    
    const controlRequest = {
        type: 'request_control',
        sessionId: 'testSession123',
        deviceId: 'test14'
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
