const WebSocket = require('ws');

// Create WebSocket server
const server = new WebSocket.Server({ port: 9000 });

// Store connected clients
const clients = new Set();

// Mock device data
const mockDevices = [
  { deviceId: 'device-123', deviceName: 'Test Device 1' },
  { deviceId: 'device-456', deviceName: 'Test Device 2' }
];

server.on('connection', (socket) => {
  console.log('Admin client connected');
  clients.add(socket);

  // Send connection confirmation
  socket.send(JSON.stringify({
    type: 'connection_status',
    connected: true
  }));

  // Handle messages from client
  socket.on('message', (message) => {
    const data = JSON.parse(message.toString());
    console.log('Received message:', data);

    // Handle different message types
    switch (data.action) {
      case 'accept':
        handleAcceptRequest(socket, data);
        break;
      case 'reject':
        handleDeclineRequest(socket, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  });

  socket.on('close', () => {
    console.log('Client disconnected');
    clients.delete(socket);
  });
});

// Handle accept request
function handleAcceptRequest(socket, data) {
  console.log(`Admin accepted request for device ${data.deviceId}`);

  setTimeout(() => {
    socket.send(JSON.stringify({
      type: 'session_status',
      status: 'connected',
      message: `Remote session with ${data.deviceId} established successfully`
    }));
  }, 1500);
}

// Handle decline request
function handleDeclineRequest(socket, data) {
  console.log(`Admin declined request for device ${data.deviceId}`);
}

// Function to send a mock remote control request
function sendMockRequest() {
  const mockDevice = mockDevices[Math.floor(Math.random() * mockDevices.length)];
  const requestId = 'req-' + Date.now();
  const sessionId = 'sess-' + Math.floor(Math.random() * 1000000);

  clients.forEach(client => {
    client.send(JSON.stringify({
      requestId: requestId,
      type: 'request_control',
      from: mockDevice.deviceId,
      deviceName: mockDevice.deviceName,
      timestamp: Date.now(),
      sessionId: sessionId
    }));
  });

  console.log(`Sent mock request for device: ${mockDevice.deviceName}`);
}

// Send a mock request every 20 seconds
setInterval(sendMockRequest, 20000);

console.log('Mock WebSocket server running on port 9000');
