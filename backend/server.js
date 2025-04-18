const express = require('express');
const dotenv = require('dotenv').config();
const { connectDB } = require('./database/db');
const { generateKey, generateRequestId } = require('./utils/keysGenerator');
const cors = require("cors");
const mainRouter = require('./routes/index');
const WebSocket = require('ws');

const { initializeWebSocket, wssDbUpdates, wssControl, wssComm } = require('./websockets/wsManager');
const { initializeDbUpdatesWebSocket } = require('./websockets/dbUpdates.handler');
const { initializeControlFrontendWebSocket, broadcastControlFrontend: broadcastControlFrontend } = require('./websockets/controlFrontend.handler');
const { initializeControlCommWebSocket } = require('./websockets/controlComm.handler'); 

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

const controlSessions = new Map();

const CONTROL_REQUEST_TIMEOUT = 30000; // 30 sekundi za timeout requesta, mozda izmijenit

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
      broadcastControlFrontend({
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
      broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'pending_device_confirmation', decision: 'accepted' });


  } else if (action === 'reject') {
      console.log(`Admin rejected control session: ${sessionId}`);
      session.state = 'ADMIN_REJECTED'; 

      sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'rejected', reason: 'rejected_by_admin' });
      broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'rejected', decision: 'rejected', reason: 'rejected_by_admin' });
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
      broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'timed_out' ,decision: 'rejected', reason: 'timed_out'});
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

  broadcastControlFrontend({
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
              broadcastControlFrontend({
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

      initializeDbUpdatesWebSocket(db);

      initializeControlFrontendWebSocket({
        controlSessions: controlSessions, 
        handleFrontendControlResponse: handleFrontendControlResponse 
      });

      initializeControlCommWebSocket({
        handleCommLayerControlRequest: handleCommLayerControlRequest,
        handleCommLayerStatusUpdate: handleCommLayerStatusUpdate,
        cleanupSessionsForSocket: cleanupSessionsForSocket
      });

      const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });

      initializeWebSocket(server);

      server.on('error', (error) => {
        console.error('Server error:', error);
        // Handle specific errors like EADDRINUSE
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use. Exiting.`);
            process.exit(1);
        }
      });

    })
    .catch((err) => {
      process.exit(1);
    });

