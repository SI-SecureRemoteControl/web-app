const WebSocket = require('ws');
const { wssControl } = require('./wsManager');

let _controlSessions; 
let _handleFrontendControlResponse; 

const controlFrontendClients = new Set();

function broadcastToControlFrontend(data) {
  const message = JSON.stringify(data);
  console.log(`Broadcasting to ${controlFrontendClients.size} Control Frontend clients:`, message);
  controlFrontendClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
          client.send(message);
      }
  });
}

function initializeControlFrontendWebSocket(opts){
    console.log("[Control Frontend Handler] Initializing WebSocket listeners...");

    if (!opts || !opts.controlSessions || !opts.handleFrontendControlResponse) {
        console.error("[Control Frontend Handler] Initialization failed: Missing required options (controlSessions, handleFrontendControlResponse).");
        // Throw an error or prevent listeners from attaching
        throw new Error("ControlFrontendWebSocket handler requires controlSessions and handleFrontendControlResponse during initialization.");
    }
    _controlSessions = opts.controlSessions;
    _handleFrontendControlResponse = opts.handleFrontendControlResponse;

    wssControl.on('connection', (ws) => {
        console.log(`Client connected to Control WebSocket (type: frontend)`);
      
        controlFrontendClients.add(ws);
        console.log(`Control Frontend client added. Total control frontend clients: ${controlFrontendClients.size}`);
      
        _controlSessions.forEach((session, sessionId) => {
          if(session.state === 'PENDING_ADMIN') {
            ws.send(JSON.stringify({ type: 'request_control', sessionId, device: session.device }));
          } else if(session.state === 'CONNECTED') {
            ws.send(JSON.stringify({ type: 'control_status_update', sessionId, deviceId: session.device?.deviceId, status: 'connected' }));
          }
        });
      
        ws.on('message', (message) => {
          try {
            const parsedMessage = JSON.parse(message);
            console.log('Received message from Control Frontend:', parsedMessage);
            if (parsedMessage.type === 'control_response') {
              _handleFrontendControlResponse(parsedMessage);
            } else {
              console.log('Received unknown message type from Control Frontend:', parsedMessage.type);
            }
          } catch (error) {
            console.error('Failed to parse message from Control Frontend:', error);
          }
        });
      
        ws.on('close', () => {
          controlFrontendClients.delete(ws);
          console.log(`Control Frontend client disconnected. Total clients: ${controlFrontendClients.size}`);
        });
      
        ws.on('error', (error) => {
          console.error('Control Frontend WebSocket error:', error);
          controlFrontendClients.delete(ws);
        });
      });
}

module.exports = {
    initializeControlFrontendWebSocket,
    broadcastToControlFrontend 
};