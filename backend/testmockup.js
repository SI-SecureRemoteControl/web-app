const WebSocket = require('ws');

// WebSocket client for the backend
const socket = new WebSocket('wss://backend-wf7e.onrender.com/ws/control/comm');

// Session ID to use for the test
const sessionId = 'testSession123';

// Flag to prevent repeated execution
let hasSentMessages = false;

socket.on('open', () => {
  console.log('Connected to the backend WebSocket server.');

  if (!hasSentMessages) {
    hasSentMessages = true; // Set the flag to true to prevent repeated execution

    // Simulate sending an `accept` decision
    const acceptDecision = {
      type: 'control_decision',
      sessionId: sessionId,
      decision: 'accepted',
    };

    console.log('Sending accept decision...');
    socket.send(JSON.stringify(acceptDecision));

    // Wait for a short delay before sending the `session_status` message
    setTimeout(() => {
      const sessionStatus = {
        type: 'session_status',
        sessionId: sessionId,
        status: 'connected', // Change to 'failed' or 'disconnected' as needed
        details: 'Session successfully connected',
      };

      console.log('Sending session status...');
      socket.send(JSON.stringify(sessionStatus));
    }, 2000); // 2-second delay to simulate processing time
  }
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