const express = require('express');
const dotenv = require('dotenv').config();
const bcrypt = require('bcrypt');
const { generateKey, generateRequestId } = require('./utils/keysGenerator');
const { connectDB } = require('./database/db');
const WebSocket = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const authorize = require('./services/authorization');

const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");

const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

let db;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// stari ws server za db updates prema frontu
const wssDbUpdates = new WebSocket.Server({ noServer: true });
const dbUpdateClients = new Set();

// novi ws server za control requestove sa androida, spomenuta mapa za cache
const wssControl = new WebSocket.Server({ noServer: true })
const wssComm = new WebSocket.Server({ noServer: true })


const controlFrontendClients = new Map();
const controlSessions = new Map();
const commLayerClients = new Set();

 const CONTROL_REQUEST_TIMEOUT = 30000; // 30 sekundi za timeout requesta, mozda izmijenit

server.on('upgrade', (request, socket, head) => {

  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  console.log(`WebSocket upgrade request received for path: ${pathname}`);

  if(pathname === '/ws/db_updates') {

    wssDbUpdates.handleUpgrade(request, socket, head, (ws) => {
      wssDbUpdates.emit('connection', ws, request);
    });
  }
  else if(pathname === '/ws/control/frontend') {

    wssControl.handleUpgrade(request, socket, head, (ws) => {
      wssControl.emit('connection', ws, request, 'frontend');
    });
  }
  else if(pathname === '/ws/control/comm') {
    // TODO: Add Comm Layer specific authentication/validation if needed here
    wssComm.handleUpgrade(request, socket, head, (ws) => {
      wssComm.emit('connection', ws, request, 'comm');
    });
  }
  else {
    
    console.log(`WebSocket connection rejected for unknown path: ${pathname}`);
    socket.destroy();
  }
})

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

  controlFrontendClients.set(ws.protocol, ws);
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
    controlFrontendClients.delete(ws.protocol);
    console.log(`Control Frontend client disconnected. Total clients: ${controlFrontendClients.size}`);
  });

  ws.on('error', (error) => {
    console.error('Control Frontend WebSocket error:', error);
    controlFrontendClients.delete(ws.protocol);
  });
});

// -- wssComm -- Comm layer clients --
wssComm.on('connection', (ws) => {
  console.log('Comm Layer client connected to Control WebSocket.');

  commLayerClients.add(ws);
  controlFrontendClients.set('commLayer', ws);

  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('Received message from Comm layer:', parsedMessage);
      if (parsedMessage.type === 'request_control') {
        handleCommLayerControlRequest(ws, parsedMessage);
      } else if (parsedMessage.type === 'control_status') {
        handleCommLayerStatusUpdate(parsedMessage);
      } else {
        console.log('Received unknown message type from Comm Layer:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Failed to parse message from Comm Layer:', error);
    }
  });

  ws.on('close', () => {
    commLayerClients.delete(ws);
    controlFrontendClients.delete('commLayer');

    console.log('Comm Layer client disconnected from Control WebSocket.');
    cleanupSessionsForSocket(ws);
  });

  ws.on('error', (error) => {
    commLayerClients.delete(ws);
    controlFrontendClients.delete('commLayer');

    console.error('Comm Layer WebSocket error:', error);
    cleanupSessionsForSocket(ws);
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

// ---------------------------------------------------------- rute

app.post('/devices/registration', async (req, res) => {
  const deviceName = req.body.deviceName;
  if (!deviceName) {
    return res.status(400).json({ error: 'Device name is required.' });
  }
  const registrationKey = generateKey('registration');

  const newDevice = {
    name: deviceName,
    registrationKey: registrationKey,
    status: 'pending'
  };
  try {
    await db.collection('devices').insertOne(newDevice);
    res.status(200).json({ registrationKey });
  } catch (err) {
    console.error('Error inserting device:', err);
    res.status(500).json({ error: 'Database insert failed' });
  }
});


app.post('/devices/deregistration/:id', async (req, res) => {
  const { id } = req.params; 
  const deregistrationKey = generateKey('deregistration');
  try {
    const device = await db.collection('devices').findOne({ deviceId: id });
    if (!device) {
      return res.status(404).json({ error: 'Device not found in database.' });
    }
    const result = await db.collection('devices').updateOne(
      { deviceId: id },
      { $set: { deregistrationKey: deregistrationKey } }
    );
    if (result.matchedCount === 0) {
      return res.status(500).json({ error: 'Failed to update device.' });
    }

    res.status(200).json({ message: 'You generated a deregistration key for this device', deregistrationKey });
  } catch (err) {
    console.error('Error deregistering device:', err);
    res.status(500).json({ error: 'Failed to deregister device.' });
  }
});


app.get('/api/devices', async (req, res) => {
  try {
    const {
      deviceId,
      deviceName,
      model,
      osVersion,
      status,
      networkType,
      ipAddress,
      lastActivityBefore,
      lastActivityAfter,
      sortBy = 'lastActiveTime',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (deviceId) query.deviceId = deviceId;
    if (deviceName) query.name = { $regex: deviceName, $options: 'i' };
    if (model) query.model = model;
    if (osVersion) query.osVersion = osVersion;
    if (status) query.status = status;
    if (networkType) query.networkType = networkType;
    if (ipAddress) query.ipAddress = ipAddress;

    if (lastActivityBefore || lastActivityAfter) {
      query.lastActiveTime = {};
      if (lastActivityBefore) query.lastActiveTime.$lte = new Date(lastActivityBefore);
      if (lastActivityAfter) query.lastActiveTime.$gte = new Date(lastActivityAfter);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const devicesCollection = db.collection('devices');

    const devices = await devicesCollection.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

    const total = await devicesCollection.countDocuments(query);

    res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      devices
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});


app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// ---------------------------------------------------------- auth

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('web_admin_user').insertOne({ username, password: hashedPassword, role });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.collection('web_admin_user').findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Authentication failed' });
        }
        const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
            expiresIn: '1h',
        });
        delete user.password;
        res.status(200).json({ token, user });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

connectDB()
    .then((database) => {
      db = database;

      if (process.env.USE_LOCAL_DB !== "true") {
        setupChangeStream();
        console.log("setup");
      }
    })
    .catch((err) => {
      process.exit(1);
    });

