const express = require('express');
const dotenv = require('dotenv').config();
const { connectDB } = require('./database/db');
const WebSocket = require('ws');
const { URL } = require('url');
const { generateKey, generateRequestId } = require('./utils/keysGenerator');
const cors = require("cors");
const mainRouter = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

let db;

// stari ws server za db updates prema frontu
const wssDbUpdates = new WebSocket.Server({ noServer: true });
const dbUpdateClients = new Set();

// novi ws server za control requestove sa androida, spomenuta mapa za cache
const wssControl = new WebSocket.Server({ noServer: true })
const wssComm = new WebSocket.Server({ noServer: true })


const controlFrontendClients = new Set();
const controlSessions = new Map();
const commLayerClients = new Set();

 const CONTROL_REQUEST_TIMEOUT = 30000; // 30 sekundi za timeout requesta, mozda izmijenit

// prvi server
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

function broadcastDbUpdate(data) {
  const message = JSON.stringify({ type: 'db_change', ...data }); 
  console.log(`Broadcasting DB update ${message} to clients.`);
  for (const client of dbUpdateClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function setupChangeStream() {
  const devicesCollection = db.collection('devices');
  const changeStream = devicesCollection.watch();

  changeStream.on('change', (change) => {
    broadcastDbUpdate({
      change,
    });
  });
}

// drugi server, "type" je da razlikujemo odakle dolazi konekcija
wssControl.on('connection', (ws) => {
  console.log(`Client connected to Control WebSocket (type: frontend)`);

  controlFrontendClients.add(ws);
  console.log(`Control Frontend client added. Total control frontend clients: ${controlFrontendClients.size}`);

  controlSessions.forEach((session, sessionId) => {
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
        handleFrontendControlResponse(parsedMessage);
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

// -- wssComm -- Comm layer clients --
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
        handleCommLayerControlRequest(ws, parsedMessage);
      } else if (parsedMessage.type === 'control_status') {
        handleCommLayerStatusUpdate(parsedMessage);
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
        cleanupSessionsForSocket(ws); // Assuming this should run
  });

  ws.on('error', (error) => {
    commLayerClients.delete(ws);
    console.error('!!! BACKEND: Comm Layer WebSocket error:', error); // Enhanced log
    cleanupSessionsForSocket(ws); // Assuming this should run
  });
});

// samo za slanje poruka ka frontend klijentima
function broadcastToControlFrontend(data) {
  const message = JSON.stringify(data);
  console.log(`Broadcasting to ${controlFrontendClients.size} Control Frontend clients:`, message);
  controlFrontendClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
          client.send(message);
      }
  });
}

// za slanje poruka za sesije
function sendToCommLayer(sessionId, data) {
  const session = controlSessions.get(sessionId);
  if (!session || !session.commLayerWs) {
    console.error(`[Comm Send Error] Session ${sessionId} not found or socket missing.`);
    return;
  }
  if (session.commLayerWs.readyState === WebSocket.OPEN) {
    console.log(`Sending to Comm Layer for session ${sessionId}:`, data);

    // Log the WebSocket connection details
    console.log(`WebSocket URL or details for session ${sessionId}:`, session.commLayerWs.url || 'No URL available');
    console.log("Send to comm layer", session.commLayerWs);

    session.commLayerWs.send(JSON.stringify(data));
  } else {
    console.error(`[Comm Send Error] Socket for session ${sessionId} is not open (state: ${session.commLayerWs.readyState}).`);
  }
}

// logika za remote control sesije
async function handleCommLayerControlRequest(ws, message) {

  const { sessionId, deviceId:from } = message;
  if (!sessionId || !from) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Missing sessionId or deviceId' })); return; }
  if (controlSessions.has(sessionId)) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Session ID already active' })); return; }
  if (!db) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Database not available' })); return; }

  try {
      const device = await db.collection('devices').findOne({ deviceId: from
       });
      if (!device) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Device not found' })); return; }

      const session = {
          state: 'PENDING_ADMIN',
          device: { _id: device._id, deviceId: device.deviceId, name: device.name, model: device.model, osVersion: device.osVersion },
          commLayerWs: ws, 
          requestedTime: Date.now(),
          timeoutId: setTimeout(() => { handleAdminTimeout(sessionId); }, CONTROL_REQUEST_TIMEOUT)
      };

      controlSessions.set(sessionId, session);
      console.log(`Control session created: ${sessionId} for device ${from}. State: PENDING_ADMIN`);

      if (!ws.activeSessionIds) { ws.activeSessionIds = new Set(); }
      ws.activeSessionIds.add(sessionId);
      requestId = generateRequestId();
      broadcastToControlFrontend({
          requestId: requestId,
          type: 'request_control',
          deviceId: from,
          deviceName: session.device.name,
          timestamp: Date.now(),
          sessionId: sessionId
      });

       ws.send(JSON.stringify({ type: 'request_received', sessionId: sessionId, status: 'pending_admin_approval' })); // za debug

  } catch (error) {
      console.error(`Error handling control request ${sessionId}:`, error);
      ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Internal server error handling request' }));
      if (controlSessions.has(sessionId)) { clearTimeout(controlSessions.get(sessionId).timeoutId); controlSessions.delete(sessionId); } 
  }
}

// za handleanje odgovora admina sa fronta
 function handleFrontendControlResponse(message) {
  const { sessionId, action } = message;
  if (!sessionId || !action) { console.error('Control Frontend response missing sessionId or action'); return; }
  const session = controlSessions.get(sessionId);
  if (!session || session.state !== 'PENDING_ADMIN') { console.warn(`Response for invalid/handled session ${sessionId} or wrong state ${session?.state}`); return; }

  clearTimeout(session.timeoutId);
  session.timeoutId = null;

  if (action === 'accept') {
      console.log(`Admin accepted control session: ${sessionId}`);
      session.state = 'ADMIN_ACCEPTED';
      controlSessions.set(sessionId, session); 

      sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'accepted' });
      broadcastToControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'pending_device_confirmation', decision: 'accepted' });


  } else if (action === 'reject') {
      console.log(`Admin rejected control session: ${sessionId}`);
      session.state = 'ADMIN_REJECTED'; 

      sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'rejected', reason: 'rejected_by_admin' });
      broadcastToControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'rejected', decision: 'rejected', reason: 'rejected_by_admin' });
      cleanupSession(sessionId, 'ADMIN_REJECTED');

  } else {
      console.warn(`Unknown action '${action}' from Control Frontend for session ${sessionId}`);
  }
}

// za handleanje timeout ako admin ne prihvati za 30 sekundi
 function handleAdminTimeout(sessionId) {
  const session = controlSessions.get(sessionId);
  if (session && session.state === 'PENDING_ADMIN') {
      console.log(`Admin response timed out for session: ${sessionId}`);
      session.state = 'TIMED_OUT'; 

      sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'rejected', reason: 'timed_out' });
      broadcastToControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'timed_out' ,decision: 'rejected', reason: 'timed_out'});
      cleanupSession(sessionId, 'TIMED_OUT');
  }
}

// za odgovor sa strane androida
 function handleCommLayerStatusUpdate(message) {
  const { sessionId, status, details, deviceId } = message;
  if (!sessionId || !status) { console.error('Comm Layer status update missing sessionId or status'); return; }
  const session = controlSessions.get(sessionId);
  if (!session) { console.warn(`Status update for unknown/expired session: ${sessionId}`); return; }

  console.log(`Comm Layer status update for session ${sessionId}: ${status}`, details || '');
  let frontendStatus = status;
  let cleanupReason = null;

  switch (status) {
      case 'connected':
          session.state = 'CONNECTED';
          frontendStatus = 'connected';
          break;
      case 'failed':
          session.state = 'FAILED';
          frontendStatus = 'failed';
          cleanupReason = 'FAILED';
          break;
      case 'disconnected':
          session.state = 'DISCONNECTED';
          frontendStatus = 'disconnected';
          cleanupReason = 'DISCONNECTED';
          break;
      default:
          console.warn(`Unknown status '${status}' from Comm Layer for session ${sessionId}`);
          return;
  }
  controlSessions.set(sessionId, session); // update mapa

  broadcastToControlFrontend({
      type: 'control_status_update',
      sessionId: sessionId,
      deviceId: deviceId,
      status: frontendStatus,
      message: details || `Session ${sessionId} status: ${frontendStatus}.`,
      details: details
  });

  if (cleanupReason) {
      cleanupSession(sessionId, cleanupReason);
  }
}

 function cleanupSession(sessionId, reason) {
  const session = controlSessions.get(sessionId);
  if (session) {
      console.log(`Cleaning up control session ${sessionId} (Reason: ${reason})`);
      clearTimeout(session.timeoutId);
      if (session.commLayerWs && session.commLayerWs.activeSessionIds) {
          session.commLayerWs.activeSessionIds.delete(sessionId);
      }
      controlSessions.delete(sessionId);
  }
}

 function cleanupSessionsForSocket(ws) {
  console.log('Cleaning up control sessions for disconnected Comm Layer socket.');
  if (ws.activeSessionIds && ws.activeSessionIds.size > 0) {
      ws.activeSessionIds.forEach(sessionId => {
          const session = controlSessions.get(sessionId);
          if (session) {
              console.log(`Handling session ${sessionId} for disconnected socket (State: ${session.state}).`);
              let cleanupReason = 'COMM_DISCONNECTED';
              let frontendStatus = 'comm_disconnected';
               if(session.state === 'CONNECTED') {
                  frontendStatus = 'disconnected';
                  cleanupReason = 'COMM_DISCONNECTED_WHILE_CONNECTED';
               } else if (session.state !== 'PENDING_ADMIN' && session.state !== 'ADMIN_ACCEPTED') {
                   cleanupSession(sessionId, 'CLEANUP_ON_COMM_CLOSE_TERMINAL');
                  return;
               }
              broadcastToControlFrontend({
                  type: 'control_status_update',
                  sessionId: sessionId,
                  deviceId: session.device?.deviceId,
                  status: frontendStatus,
                  message: `Communication channel lost for session ${sessionId}.`
              });
              cleanupSession(sessionId, cleanupReason);
          }
      });
  }
}

connectDB()
    .then((database) => {
      db = database;
      console.log("Database connected successfully.");

      app.locals.db = db;

      app.use('/', mainRouter);
      console.log("Routes mounted.");

      if (process.env.USE_LOCAL_DB !== "true") {
        setupChangeStream();
        console.log("setup");
      }

      const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });

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

    })
    .catch((err) => {
      process.exit(1);
    });

