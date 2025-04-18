const express = require('express');
const bcrypt = require('brcypt');
const { generateKey } = require('../utils/keysGenerator');

const router = express.Router();

const getDb = (req) => req.app.locals.db;

// --- AUTH ---
// --- Path : /login ---

router.post('/login', (req, res) => {
  //THIS IS TEMPORARY, PROPER AUTHENTICATION WILL BE ADDED LATER
  const loginRequest = req.body;
  
  bcrypt.compare(loginRequest.password, '$2a$12$syTr35twcAPPFPr8E1q8RuqzNHd8Bb53w4ZA7D9TNubbVdHS/fxIm', (err, result) => {
    if(err) {
      console.error('Bcrypt compare error: ', err);
      return res.status(500).send('Internal Server Error');
    }

    if(result && loginRequest.username === 'admin') {
        res.sendStatus(200);
    } else {
        res.status(401).send('Unauthorized');
      }
  }); 
});

// --- DEVICES ---
// --- Path : /devices/registration ---

router.post('/devices/registration', async (req, res) => {

  const db = getDb(req);
  if (!db) return res.status(500).json({ error: 'Database not available' });

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
    res.status(201).json({ registrationKey });
  } catch (err) {
    console.error('Error inserting device:', err);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// --- Path : /devices/registration/:id ---

router.post('/devices/deregistration/:id', async (req, res) => {

  const db = getDb(req);
  if (!db) return res.status(500).json({ error: 'Database not available' });

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

    res.status(200).json({ message: 'You generated a deregistration key for this device: ', deregistrationKey });

  } catch (err) {
    console.error('Error deregistering device:', err);
    res.status(500).json({ error: 'Failed to deregister device.' });
  }
});

// --- API ---
// --- Path : /api/devices ---

router.get('/api/devices', async (req, res) => {

    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Database not available' });

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


  // --- ROOT ---
  // --- Path : ---
  router.get('/', (req, res) => {
    res.send('Hello, world! Routes are routing!');
  });

module.exports = router;