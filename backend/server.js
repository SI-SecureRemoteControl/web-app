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




app.get('/api/devices/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const skip = (page - 1) * pageSize;
    const devices = await db.collection('devices')
        .find({ status })
        .skip(skip)
        .limit(parseInt(pageSize))
        .toArray();

    const totalCount = await db.collection('devices').countDocuments({ status });

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (err) {
    console.error('Error fetching devices by status:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/devices/by-last-active-dmy', async (req, res) => {
  try {
    const {
      startDay, startMonth, startYear,
      endDay, endMonth, endYear,
      page = 1,
      pageSize = 10
    } = req.query;


    if (!startDay || !startMonth || !startYear) {
      return res.status(400).json({
        success: false,
        error: 'startDay, startMonth, and startYear are required (e.g., startDay=5&startMonth=4&startYear=2025)'
      });
    }


    const startDate = new Date(
        `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}T00:00:00Z`
    );

    const endDate = endDay && endMonth && endYear
        ? new Date(`${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}T23:59:59Z`)
        : new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Default: startDate + 1 day


    console.log('Parsed dates:', { startDate, endDate });

    const query = {
      lastActiveTime: {
        $gte: startDate,
        $lte: endDate
      }
    };

    const skip = (page - 1) * pageSize;
    const devices = await db.collection('devices')
        .find(query)
        .sort({ lastActiveTime: -1 })
        .skip(skip)
        .limit(parseInt(pageSize))
        .toArray();

    const totalCount = await db.collection('devices').countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: err.message
    });
  }
});

app.get('/api/devices/by-ip/:ipAddress', async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const { exact = 'true', page = 1, pageSize = 10 } = req.query;

    const query = {
      ipAddress: exact === 'true'
          ? ipAddress
          : { $regex: ipAddress, $options: 'i' }
    };

    const skip = (page - 1) * pageSize;
    const devices = await db.collection('devices')
        .find(query)
        .skip(skip)
        .limit(parseInt(pageSize))
        .toArray();

    const totalCount = await db.collection('devices').countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (err) {
    console.error('Error fetching devices by IP:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: err.message
    });
  }
});

app.get('/api/devices/:id', async (req, res) => {
  try {
    const device = await db.collection('devices').findOne({ deviceId: req.params.id });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: device });
  } catch (err) {
    console.error('Error fetching device:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});





app.get('/api/devices', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      networkType,
      search,
      sortBy = 'lastActiveTime',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * pageSize;
    const query = {};

    if (status) query.status = status;
    if (networkType) query.networkType = networkType;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { osVersion: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const devices = await db.collection('devices')
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(pageSize))
        .toArray();

    const totalCount = await db.collection('devices').countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
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

