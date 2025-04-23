const WebSocket = require('ws');

// WebSocket client for the backend
const socket = new WebSocket('wss://backend-wf7e.onrender.com/ws/control/comm');

// Session ID to use for the test
const sessionId = 'testSession123';

socket.on('open', () => {
  console.log('Connected to the backend WebSocket server.');

  // Simulate sending a new request
  const controlRequest = {
    type: 'request_control',
    requestId: 'req-123',
    sessionId: sessionId,
    deviceId: 'c7d865a558032f35',
    deviceName: 'Test Device',
    timestamp: Date.now(),
  };

  console.log('Sending new control request...');
  socket.send(JSON.stringify(controlRequest));

  // Wait for a short delay before sending a "declined" status
  setTimeout(() => {
    const sessionStatus = {
      type: 'control_status',
      sessionId: sessionId,
      status: 'rejected',
      details: 'Android has declined the request.',
    };

    console.log('Sending session status: Android has declined...');
    socket.send(JSON.stringify(sessionStatus));
  }, 2000); // 2-second delay to simulate processing time
});

// Handle messages from the server
socket.on('message', (data) => {
  const message = data.toString('utf8');
  console.log('Received message from server:', message);

  try {
    const parsedMessage = JSON.parse(message);
    console.log('Parsed message:', parsedMessage);
  } catch (e) {
    console.error('Failed to parse message as JSON:', e);
  }
});

// Handle WebSocket errors
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Handle WebSocket close
socket.on('close', () => {
  console.log('WebSocket connection closed.');
});