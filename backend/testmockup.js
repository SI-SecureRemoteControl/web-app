const WebSocket = require('ws');

// Mock WebSocket server for testing
const mockCommLayerServer = new WebSocket.Server({ port: 9001 }, () => {
  console.log('Mock Comm Layer WebSocket server running on port 9001');
});

// Mock session storage
const controlSessions = new Map();

// Mock `sendToCommLayer` function
function sendToCommLayer(sessionId, data) {
  const session = controlSessions.get(sessionId);
  if (!session || !session.commLayerWs) {
    console.error(`[Comm Send Error] Session ${sessionId} not found or socket missing.`);
    return;
  }
  if (session.commLayerWs.readyState === WebSocket.OPEN) {
    console.log(`Sending to Comm Layer for session ${sessionId}:`, data);
    session.commLayerWs.send(JSON.stringify(data));
  } else {
    console.error(`[Comm Send Error] Socket for session ${sessionId} is not open (state: ${session.commLayerWs.readyState}).`);
  }
}

// Handle incoming connections to the mock server
mockCommLayerServer.on('connection', (ws) => {
  console.log('Mock Comm Layer client connected.');

  // Simulate a session
  const sessionId = 'testSession123';
  controlSessions.set(sessionId, { commLayerWs: ws });

  // Send a test request to the Comm Layer
  const testData = {
    type: 'test_request',
    sessionId: sessionId,
    message: 'This is a test message to the Comm Layer',
  };

  console.log('Sending test data to Comm Layer...');
  sendToCommLayer(sessionId, testData);

  // Handle messages from the mock client
  ws.on('message', (message) => {
    console.log('Received message from Comm Layer:', message.toString());
  });

  ws.on('close', () => {
    console.log('Mock Comm Layer client disconnected.');
    controlSessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error('Mock Comm Layer WebSocket error:', error);
  });
});