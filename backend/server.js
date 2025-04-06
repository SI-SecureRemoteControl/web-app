const express = require('express');
const dotenv = require('dotenv').config();
const bcrypt = require('bcrypt');
const { generateKey } = require('./utils/keysGenerator');
const { connectDB } = require('./database/db');
const WebSocket = require('ws');

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

let db, client;


const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcastUpdate(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function setupChangeStream() {
  const devicesCollection = db.collection('devices');
  const changeStream = devicesCollection.watch();

  changeStream.on('change', (change) => {
    broadcastUpdate({
      type: 'DEVICE_UPDATE',
      data: change,
    });
  });
}



app.post('/login', (req, res) => {
  //THIS IS TEMPORARY, PROPER AUTHENTICATION WILL BE ADDED LATER
  const loginRequest = req.body;
  
  bcrypt.compare(loginRequest.password, '$2a$12$syTr35twcAPPFPr8E1q8RuqzNHd8Bb53w4ZA7D9TNubbVdHS/fxIm', (err, result) => {
    if(err) {
      console.error(err);
      return;
    }

    if(result) {
      if(loginRequest.username == 'admin') {
        res.sendStatus(200);
      } else {
        res.sendStatus(400);
      }
    } else {
      res.sendStatus(400);
    }
  });
});


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
    if (deviceName) query.name = deviceName;
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



connectDB()
    .then((database) => {
      db = database;

      console.log(`Connected to MongoDB: ${database.databaseName}`);

    })
    .catch((err) => {
      console.error('Failed to connect to database', err);
      process.exit(1);
    });

