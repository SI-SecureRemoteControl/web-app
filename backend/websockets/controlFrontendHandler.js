const WebSocket = require('ws');


const { wssControl } = require('./wsManager');

const controlFrontendClients = new Set();


let _getInitialSessions;
let _handleFrontendControlResponseFunc; 

function broadcastToControlFrontend(data) {
    if (controlFrontendClients.size === 0) return;

    const message = JSON.stringify(data);
    controlFrontendClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, (err) => {
                if (err) {
                    console.error(`[Control Frontend Handler] Failed to send message to a client:`, err);
                }
            });
        }
    });
}


function initializeControlFrontendWebSocket(opts) {
    console.log("[Control Frontend Handler] Initializing WebSocket listeners...");


    if (!opts || !opts.getInitialSessions || !opts.handleFrontendControlResponse) {
        console.error("[Control Frontend Handler] Initialization failed: Missing required options (getInitialSessions, handleFrontendControlResponse).");

        throw new Error("ControlFrontendWebSocket handler requires getInitialSessions and handleFrontendControlResponse functions during initialization.");
    }

    _getInitialSessions = opts.getInitialSessions;
    _handleFrontendControlResponseFunc = opts.handleFrontendControlResponse; 

    wssControl.on('connection', (ws, req, type) => {
        console.log(`[Control Frontend Handler] Client connected.`);
        controlFrontendClients.add(ws);
        console.log(`[Control Frontend Handler] Total clients: ${controlFrontendClients.size}`);

        try {
            const initialSessionsInfo = _getInitialSessions(); 
            console.log(`[Control Frontend Handler] Sending initial state for ${initialSessionsInfo.length} sessions.`);

            initialSessionsInfo.forEach(sessionInfo => {
                let messageToSend = null;
                if (sessionInfo.state === 'PENDING_ADMIN') {
                    messageToSend = {
                        type: 'request_control', 
                        sessionId: sessionInfo.sessionId,
                        device: sessionInfo.device 
                    };
                } else if (sessionInfo.state === 'CONNECTED') {
                    messageToSend = {
                        type: 'control_status_update', 
                        sessionId: sessionInfo.sessionId,
                        deviceId: sessionInfo.device?.deviceId, 
                        status: 'connected' 
                    };
                }

                if (messageToSend) {
                    ws.send(JSON.stringify(messageToSend), (err) => {
                        if(err) console.error(`[Control Frontend Handler] Error sending initial session state ${sessionInfo.sessionId}:`, err);
                    });
                }
            });
        } catch (error) {
            console.error("[Control Frontend Handler] Error getting or sending initial sessions:", error);
        }

        ws.on('message', (message) => {
            const messageString = message.toString();
            try {
                const parsedMessage = JSON.parse(messageString);
                

                if (parsedMessage.type === 'control_response') {
                    _handleFrontendControlResponseFunc(parsedMessage);
                } else {
                    console.log('[Control Frontend Handler] Received unknown message type:', parsedMessage.type);
                  
                }
            } catch (error) {
                console.error('[Control Frontend Handler] Failed to parse message or handle:', error);
                console.error('[Control Frontend Handler] Raw message was:', messageString);
            }
        });

        ws.on('close', (code, reason) => {
            controlFrontendClients.delete(ws);
            console.log(`[Control Frontend Handler] Client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}. Total clients: ${controlFrontendClients.size}`);
        });

        ws.on('error', (error) => {
            console.error('[Control Frontend Handler] WebSocket error:', error);
            controlFrontendClients.delete(ws); 
        });
    });

    console.log("[Control Frontend Handler] Initialization complete.");
}


module.exports = {
    initializeControlFrontendWebSocket,
    broadcastToControlFrontend 
};