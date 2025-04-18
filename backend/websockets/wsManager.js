const WebSocket = require('ws');
const { URL } = require('url');

console.log("Initializing WebSocket Server instances (wssDbUpdates, wssControl, wssComm)...");
const wssDbUpdates = new WebSocket.Server({ noServer: true });
const wssControl = new WebSocket.Server({ noServer: true });
const wssComm = new WebSocket.Server({ noServer: true });
console.log("WebSocket Server instances created.");


function initializeWebSocket(server){
    
    server.on('upgrade', (request, socket, head) => {

        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
        console.log(`WebSocket upgrade request received for path: ${pathname}`);
      
        if(pathname === '/ws/db_updates') {
      
          console.log(">>> BACKEND: Path matches /ws/db_updates. Handling upgrade..."); // Added log
              wssDbUpdates.handleUpgrade(request, socket, head, (ws) => {
                  console.log(">>> BACKEND: wssDbUpdates upgrade successful. Emitting connection..."); // Added log
                  wssDbUpdates.emit('connection', ws, request);
          });
        }
        else if(pathname === '/ws/control/frontend') {
      
          console.log(">>> BACKEND: Path matches /ws/control/frontend. Handling upgrade..."); // Added log
          wssControl.handleUpgrade(request, socket, head, (ws) => {
              console.log(">>> BACKEND: wssControl upgrade successful. Emitting connection..."); // Added log
              wssControl.emit('connection', ws, request, 'frontend');
          });
        }
        else if(pathname === '/ws/control/comm') {
          console.log(">>> BACKEND: Path matches /ws/control/comm. Attempting wssComm.handleUpgrade...");
              wssComm.handleUpgrade(request, socket, head, (ws) => {
                  console.log(">>> BACKEND: wssComm.handleUpgrade successful. Emitting 'connection' for Comm Layer.");
                  wssComm.emit('connection', ws, request, 'comm'); // 'comm' type seems correct
          });
        }
        else {
          
          console.log(`WebSocket connection rejected for unknown path: ${pathname}`);
          socket.destroy();
        }
      })
}

module.exports = {
    initializeWebSocket, // Function to attach the upgrade handler
    wssDbUpdates,        // Instance for DB updates
    wssControl,          // Instance for Control Frontend
    wssComm,             // Instance for Control Comm Layer
};