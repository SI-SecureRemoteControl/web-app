// mockAndroidDevice.js
const WebSocket = require('ws');
const crypto = require('crypto');
const readline = require('readline');

// Configuration
const config = {
  serverUrl: 'ws://localhost:9000/ws/control/comm', // Update this to your server URL
  deviceId: 'c7d865a558032f35',
  deviceName: 'AdiTest',
  sessionId: 'session-' + crypto.randomBytes(8).toString('hex'),
  autoAccept: true, // Auto-accept admin approval
  debugMode: true, // Show detailed logs
};

// Mock file system structure
const mockFileSystem = {
  '/': [
    { name: 'Documents', type: 'folder' },
    { name: 'Pictures', type: 'folder' },
    { name: 'Downloads', type: 'folder' },
    { name: 'Movies', type: 'folder' },
    { name: 'config.txt', type: 'file', size: 1024 },
    { name: 'readme.md', type: 'file', size: 2048 }
  ],
  '/Documents': [
    { name: 'Work', type: 'folder' },
    { name: 'Personal', type: 'folder' },
    { name: 'report.pdf', type: 'file', size: 1024 * 1024 * 2.5 },
    { name: 'notes.txt', type: 'file', size: 5120 }
  ],
  '/Pictures': [
    { name: 'Vacation', type: 'folder' },
    { name: 'Family', type: 'folder' },
    { name: 'profile.jpg', type: 'file', size: 1024 * 512 },
    { name: 'screenshot.png', type: 'file', size: 1024 * 128 }
  ],
  '/Downloads': [
    { name: 'Software', type: 'folder' },
    { name: 'movie.mp4', type: 'file', size: 1024 * 1024 * 800 },
    { name: 'book.pdf', type: 'file', size: 1024 * 1024 * 5 }
  ],
  '/Movies': [
    { name: 'Action', type: 'folder' },
    { name: 'Comedy', type: 'folder' },
    { name: 'vacation.mp4', type: 'file', size: 1024 * 1024 * 150 },
    { name: 'family.mp4', type: 'file', size: 1024 * 1024 * 200 }
  ],
  '/Documents/Work': [
    { name: 'Project1', type: 'folder' },
    { name: 'Project2', type: 'folder' },
    { name: 'presentation.pptx', type: 'file', size: 1024 * 1024 * 3.2 },
    { name: 'budget.xlsx', type: 'file', size: 1024 * 256 }
  ],
  '/Documents/Personal': [
    { name: 'Finances', type: 'folder' },
    { name: 'Health', type: 'folder' },
    { name: 'resume.pdf', type: 'file', size: 1024 * 100 },
    { name: 'notes.txt', type: 'file', size: 2048 }
  ],
  '/Pictures/Vacation': [
    { name: 'beach.jpg', type: 'file', size: 1024 * 1024 * 2 },
    { name: 'mountains.jpg', type: 'file', size: 1024 * 1024 * 1.8 },
    { name: 'city.jpg', type: 'file', size: 1024 * 1024 * 1.5 }
  ]
};

// Add more file system structure dynamically for nested paths
const generateDirectoryContent = (path) => {
  if (mockFileSystem[path]) {
    return mockFileSystem[path];
  }
  
  // Generate mock content for any path not explicitly defined
  return [
    { name: 'File1.txt', type: 'file', size: Math.floor(Math.random() * 10000) },
    { name: 'File2.pdf', type: 'file', size: Math.floor(Math.random() * 1024 * 1024) },
    { name: 'Folder1', type: 'folder' },
    { name: 'Folder2', type: 'folder' }
  ];
};

// ----- WebSocket Client -----
let ws = null;
let connectionActive = false;
let sessionActive = false;

// Connect to server
function connectToServer() {
  log('Connecting to server: ' + config.serverUrl);
  
  ws = new WebSocket(config.serverUrl);
  
  ws.on('open', () => {
    connectionActive = true;
    log('Connected to server successfully');
    
    // Wait a moment and then initiate control request
    setTimeout(() => {
      if (!sessionActive) {
        requestControlSession();
      }
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      log('Received message:', message);
      handleServerMessage(message);
    } catch (error) {
      logError('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    connectionActive = false;
    sessionActive = false;
    log('Connection closed');
    
    // Try to reconnect after delay
    setTimeout(() => {
      if (!connectionActive) {
        connectToServer();
      }
    }, 5000);
  });
  
  ws.on('error', (error) => {
    logError('WebSocket error:', error);
  });
}

// Handle messages from the server
function handleServerMessage(message) {
  switch (message.type) {
    case 'request_received':
      log('Control request received by server, status:', message.status);
      break;
      
    case 'control_decision':
      handleControlDecision(message);
      break;
      
    case 'browse_request':
      handleBrowseRequest(message);
      break;
      
    case 'download_request':
      handleDownloadRequest(message);
      break;
      
    case 'session_terminated':
      log('Session terminated by server. Reason:', message.reason);
      sessionActive = false;
      break;
      
    case 'error':
      logError('Received error from server:', message.message);
      break;
      
    default:
      log('Unhandled message type:', message.type);
      break;
  }
}

// Request a control session
function requestControlSession() {
  if (!connectionActive) {
    logError('Cannot request session: not connected');
    return;
  }
  
  const request = {
    type: 'request_control',
    sessionId: config.sessionId,
    deviceId: config.deviceId,
    deviceName: config.deviceName,
    timestamp: Date.now()
  };
  
  sendMessage(request);
  log('Sent control request');
}

// Handle control decision from server
function handleControlDecision(message) {
  if (message.decision === 'accepted') {
    log('Control request accepted by admin');
    sessionActive = true;
    
    // Send status update to indicate we're connected
    sendMessage({
      type: 'control_status',
      sessionId: config.sessionId,
      deviceId: config.deviceId,
      status: 'connected',
      details: 'Android device connected and ready',
    });
  } else {
    log('Control request rejected by admin. Reason:', message.reason);
    sessionActive = false;
  }
}

// Handle browse request
function handleBrowseRequest(message) {
  if (!sessionActive) {
    logError('Cannot browse: Session not active');
    return;
  }
  
  const { path } = message;
  log(`Browse request received for path: ${path}`);
  
  // Get directory contents from our mock file system
  const entries = mockFileSystem[path] || generateDirectoryContent(path);
  
  // Send browse response
  sendMessage({
    type: 'browse_response',
    sessionId: message.sessionId,
    deviceId: message.deviceId,
    path: path,
    entries: entries
  });
  
  log(`Sent browse response for path: ${path} with ${entries.length} entries`);
}

// Handle download request
function handleDownloadRequest(message) {
  if (!sessionActive) {
    logError('Cannot download: Session not active');
    return;
  }
  
  const { paths } = message;
  log(`Download request received for paths:`, paths);
  
  // Generate a mock download URL
  const downloadUrl = `https://mockdownload.example.com/${config.deviceId}/${paths.join(',')}?token=${Date.now()}`;
  
  // Send download response
  sendMessage({
    type: 'download_response',
    sessionId: message.sessionId,
    deviceId: message.deviceId,
    downloadUrl: downloadUrl
  });
  
  log(`Sent download response with URL: ${downloadUrl}`);
}

// Send a message to the server
function sendMessage(message) {
  if (!connectionActive || !ws) {
    logError('Cannot send message: not connected');
    return false;
  }
  
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logError('Error sending message:', error);
    return false;
  }
}

// ----- Utilities -----

// Logging functions
function log(...args) {
  if (config.debugMode) {
    console.log(`[${new Date().toISOString()}] [MOCK-ANDROID]`, ...args);
  }
}

function logError(...args) {
  console.error(`[${new Date().toISOString()}] [MOCK-ANDROID] [ERROR]`, ...args);
}

// Setup CLI
function setupCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('line', (input) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 'help':
        console.log('\nAvailable commands:');
        console.log('  connect             - Connect to the server');
        console.log('  request             - Send a control request');
        console.log('  status              - Show current connection status');
        console.log('  disconnect          - Disconnect from the server');
        console.log('  config              - Show current configuration');
        console.log('  debug [on/off]      - Toggle debug mode');
        console.log('  ls [path]           - Show mock files at path');
        console.log('  exit                - Exit the application');
        console.log('  help                - Show this help message\n');
        break;
        
      case 'connect':
        if (!connectionActive) {
          connectToServer();
        } else {
          log('Already connected');
        }
        break;
        
      case 'request':
        if (connectionActive && !sessionActive) {
          requestControlSession();
        } else if (!connectionActive) {
          logError('Not connected to server');
        } else {
          log('Session already active');
        }
        break;
        
      case 'status':
        console.log(`\nStatus:`);
        console.log(`  Connection: ${connectionActive ? 'Active' : 'Disconnected'}`);
        console.log(`  Session: ${sessionActive ? 'Active' : 'Inactive'}`);
        console.log(`  Device ID: ${config.deviceId}`);
        console.log(`  Session ID: ${config.sessionId}\n`);
        break;
        
      case 'disconnect':
        if (connectionActive) {
          ws.close();
          connectionActive = false;
          sessionActive = false;
          log('Disconnected from server');
        } else {
          log('Not connected');
        }
        break;
        
      case 'config':
        console.log('\nCurrent configuration:');
        console.log(JSON.stringify(config, null, 2));
        console.log();
        break;
        
      case 'debug on':
        config.debugMode = true;
        console.log('Debug mode enabled');
        break;
        
      case 'debug off':
        config.debugMode = false;
        console.log('Debug mode disabled');
        break;
        
      case 'exit':
        if (connectionActive) {
          ws.close();
        }
        console.log('Exiting...');
        process.exit(0);
        break;
        
      default:
        if (command.startsWith('ls')) {
          const parts = command.split(' ');
          const path = parts.length > 1 ? parts[1] : '/';
          
          console.log(`\nContents of ${path}:`);
          const entries = mockFileSystem[path] || generateDirectoryContent(path);
          
          entries.forEach(entry => {
            const size = entry.type === 'file' && entry.size ? 
              `(${formatFileSize(entry.size)})` : '';
            console.log(`  ${entry.type === 'folder' ? '📁' : '📄'} ${entry.name} ${size}`);
          });
          console.log();
        } else {
          console.log('Unknown command. Type "help" for available commands.');
        }
        break;
    }
  });
  
  console.log('\n=== Mock Android Device ===');
  console.log('Type "help" for available commands\n');
}

// Format file size for display
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ----- Main -----
function main() {
  setupCLI();
  connectToServer();
}

main();