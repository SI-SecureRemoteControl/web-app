const express = require('express');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { generateKey } = require('./utils/keysGenerator');
const { connectDB } = require('./database/db');


dotenv.config(); 

const app = express();
const port = process.env.PORT || 5000;
const cors=require("cors");
const corsOptions ={
   origin:'*', 
   credentials:true,            
   optionSuccessStatus:200,
}

app.use(cors(corsOptions))
app.use(express.json())

let db;
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
      { $set: { deregistrationKey } }
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


app.get('/', (req, res) => {
  res.send('Hello, world!');
});

connectDB()
  .then((database) => {
    db = database;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database', err);
    process.exit(1);
  });