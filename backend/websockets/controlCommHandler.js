const WebSocket = require('ws'); 
const { wssComm } = require('./wsManager');

const commLayerClients = new Set();

let _handleCommLayerControlRequest;
let _handleCommLayerStatusUpdate;
let _cleanupSessionsForSocket;

function initializeControlCommWebSocket(opts){
    console.log("[Control Comm Handler] Initializing WebSocket listeners...");

    if (!opts || !opts.handleCommLayerControlRequest || !opts.handleCommLayerStatusUpdate || !opts.cleanupSessionsForSocket) {
        console.error("[Control Comm Handler] Initialization failed: Missing required function references.");
        throw new Error("ControlCommWebSocket handler requires session logic function references during initialization.");
    }

    _handleCommLayerControlRequest = opts.handleCommLayerControlRequest;
    _handleCommLayerStatusUpdate = opts.handleCommLayerStatusUpdate;
    _cleanupSessionsForSocket = opts.cleanupSessionsForSocket;

    wssComm.on('connection', (ws, request) => {
      console.log(`>>> BACKEND: wssComm 'connection' event fired. Comm Layer client connected.`); // Added log
    
      commLayerClients.add(ws);
      console.log(`>>> BACKEND: Attaching message listener to Comm Layer client socket.`); // Added log
    
      ws.on('message', (message) => {
        console.log(`>>> BACKEND: Received raw message from Comm Layer: ${message.toString()}`); // Added log
        try {
          const parsedMessage = JSON.parse(message);
          console.log('>>> BACKEND: Parsed message from Comm layer:', parsedMessage); // Existing log + prefix
          if (parsedMessage.type === 'request_control') {
            console.log(">>> BACKEND: Handling 'request_control' from Comm Layer..."); // Added log
            _handleCommLayerControlRequest(ws, parsedMessage);
          } else if (parsedMessage.type === 'control_status') {
            _handleCommLayerStatusUpdate(parsedMessage);
          } else {
            console.log('Received unknown message type from Comm Layer:', parsedMessage.type);
          }
        } catch (error) {
          console.error('!!! BACKEND: Failed to parse message from Comm Layer:', error);
                console.error(`!!! BACKEND: Raw message was: ${message.toString()}`); // Log raw message on error
        }
      });
    
      ws.on('close', (code, reason) => {
        commLayerClients.delete(ws);
    
        const reasonString = reason ? reason.toString() : 'N/A';
            console.log(`>>> BACKEND: Comm Layer client disconnected from Control WebSocket. Code: ${code}, Reason: ${reasonString}`); // Enhanced log
            _cleanupSessionsForSocket(ws); // Assuming this should run
      });
    
      ws.on('error', (error) => {
        commLayerClients.delete(ws);
        console.error('!!! BACKEND: Comm Layer WebSocket error:', error); // Enhanced log
        _cleanupSessionsForSocket(ws); // Assuming this should run
      });
    });
}

module.exports = {
    initializeControlCommWebSocket
};