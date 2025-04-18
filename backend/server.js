const express = require('express');
const dotenv = require('dotenv').config();
const { connectDB } = require('./database/db');
const { generateKey, generateRequestId } = require('./utils/keysGenerator');
const cors = require("cors");
const mainRouter = require('./routes/index');
const WebSocket = require('ws');

const { initializeWebSocket, wssDbUpdates, wssControl, wssComm } = require('./websockets/wsManager');
const { initializeDbUpdatesWebSocket } = require('./websockets/dbUpdatesHandler');
const { initializeControlFrontendWebSocket, broadcastControlFrontend: broadcastControlFrontend } = require('./websockets/controlFrontendHandler');
const { initializeControlCommWebSocket } = require('./websockets/controlCommHandler'); 

const ControlSessionService = require('./services/controlSession');

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

const CONTROL_REQUEST_TIMEOUT = 30000; // 30 sekundi za timeout requesta, mozda izmijenit

connectDB()
    .then((database) => {
      db = database;
      console.log("Database connected successfully.");

      app.locals.db = db;

      app.use('/', mainRouter);
      console.log("Routes mounted.");

      const controlSessionService = new ControlSessionService({
        db: db,
        broadcastControlFrontend: broadcastControlFrontend, 
        generateRequestId: generateRequestId,             
        timeoutDuration: CONTROL_REQUEST_TIMEOUT          
      });
    console.log("ControlSessionService instantiated.");

      initializeDbUpdatesWebSocket(db);

      initializeControlFrontendWebSocket({
        
        getInitialSessions: controlSessionService.getSessionsForFrontend.bind(controlSessionService),
        handleFrontendControlResponse: controlSessionService.handleFrontendControlResponse.bind(controlSessionService)
    });

    initializeControlCommWebSocket({
      handleCommLayerControlRequest: controlSessionService.handleCommLayerControlRequest.bind(controlSessionService),
      handleCommLayerStatusUpdate: controlSessionService.handleCommLayerStatusUpdate.bind(controlSessionService),
      cleanupSessionsForSocket: controlSessionService.cleanupSessionsForSocket.bind(controlSessionService)
    });;

      const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });

      initializeWebSocket(server);

      server.on('error', (error) => {
        console.error('Server error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use. Exiting.`);
            process.exit(1);
        }
      });

    })
    .catch((err) => {
      process.exit(1);
    });

