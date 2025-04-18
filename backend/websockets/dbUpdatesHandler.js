const WebSocket = require('ws');

const { wssDbUpdates } = require('./wsManager');
const dbUpdateClients = new Set();

function broadcastDbUpdate(data) {
  const message = JSON.stringify({ type: 'db_change', ...data }); 
  console.log(`Broadcasting DB update ${message} to clients.`);
  for (const client of dbUpdateClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function setupChangeStream(db) {
    if (!db) {
        console.error("[DB Updates Handler] Cannot setup change stream: Database instance not provided.");
        return;
    }
    // Only setup if not using local DB (as per original logic)
    if (process.env.USE_LOCAL_DB === "true") {
        console.log("[DB Updates Handler] Local DB detected, skipping change stream setup.");
        return;
    }

    try {
        console.log("[DB Updates Handler] Setting up MongoDB change stream for 'devices' collection...");
        const devicesCollection = db.collection('devices');
        const changeStream = devicesCollection.watch();

        changeStream.on('change', (change) => {
            console.log("[DB Updates Handler] Change stream event:", change.operationType);
            // Call the broadcast function defined within this module
            broadcastDbUpdate({ change });
        });

        changeStream.on('error', (error) => {
            console.error("[DB Updates Handler] MongoDB change stream error:", error);
            // Add reconnection logic if needed
        });

        changeStream.on('close', () => {
            console.log("[DB Updates Handler] MongoDB change stream closed.");
            // Add logic to reopen if needed
        });

         console.log("[DB Updates Handler] Change stream setup successful.");

    } catch (error) {
        console.error("[DB Updates Handler] Error setting up change stream:", error);
    }
}

function initializeDbUpdatesWebSocket(db) {
    console.log("[DB Updates Handler] Initializing WebSocket listeners and change stream...");
    wssDbUpdates.on('connection', (ws, req) => {
    
      console.log('Client connected for DB Updates');
      dbUpdateClients.add(ws);
    
      ws.on('message', (message) => {
          console.log('Received message on DB Update socket (unexpected):', message);
      });
    
      ws.on('close', () => {
        console.log("close req");
          console.log(req);
          dbUpdateClients.delete(ws);
          console.log(`Client disconnected from DB Updates. Total clients: ${dbUpdateClients.size}`);
      });
    
      ws.on('error', (error) => {
          console.error('DB Update WebSocket error:', error);
          dbUpdateClients.delete(ws); 
      });
    });

    setupChangeStream(db);
    console.log("[DB Updates Handler] Initialization complete.");
}

module.exports = { initializeDbUpdatesWebSocket };