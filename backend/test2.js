const WebSocket = require('ws');

// WebSocket client for the backend
const socket = new WebSocket('wss://backend-wf7e.onrender.com/ws/control/comm');

// Handle WebSocket connection
socket.on('open', () => {
  console.log('Connected to the backend WebSocket server.');

  // Simulate sending an `accept` decision
  const acceptDecision = {
    type: 'control_decision',
    sessionId: 'testSession123', // Replace with a valid sessionId if needed
    decision: 'accepted',
  };

  console.log('Sending accept decision...');
  socket.send(JSON.stringify(acceptDecision));

  // Simulate sending a `reject` decision
  const rejectDecision = {
    type: 'control_decision',
    sessionId: 'testSession123', // Replace with a valid sessionId if needed
    decision: 'rejected',
    reason: 'rejected_by_admin',
  };

  console.log('Sending reject decision...');
  socket.send(JSON.stringify(rejectDecision));
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