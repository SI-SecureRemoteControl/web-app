
const WebSocket = require('ws');

class ControlSessionService {
    constructor(opts) {
        if (!opts || !opts.db || !opts.broadcastControlFrontend || !opts.generateRequestId || !opts.timeoutDuration) {
            throw new Error("ControlSessionService requires db, broadcastControlFrontend, generateRequestId, and timeoutDuration.");
        }
        this.db = opts.db;
        this.broadcastControlFrontend = opts.broadcastControlFrontend; // Injected function
        this.generateRequestId = opts.generateRequestId;           // Injected function
        this.timeoutDuration = opts.timeoutDuration;               // Injected value
        this.sessions = new Map();                                 // Internal state
        this.WebSocket = WebSocket;                                // Store class reference

        console.log("[ControlSessionService] Initialized.");
    }

    
    _sendToCommLayer(sessionId, data) {
        const session = this.sessions.get(sessionId); 
        if (!session || !session.commLayerWs) {
            console.error(`[Service._sendToCommLayer Error] Session ${sessionId} not found or socket missing.`);
            return;
        }
        
        if (session.commLayerWs.readyState === this.WebSocket.OPEN) {
            console.log(`[Service._sendToCommLayer] Sending to Comm Layer for session ${sessionId}:`, data.type); 
            console.log(`WebSocket URL or details for session ${sessionId}:`, session.commLayerWs.url || 'No URL available');
            console.log("Send to comm layer", session.commLayerWs);
            session.commLayerWs.send(JSON.stringify(data), (err) => { // Added error handling callback
                 if (err) console.error(`[Service._sendToCommLayer Error] Send failed for session ${sessionId}:`, err);
            });
        } else {
            console.error(`[Service._sendToCommLayer Error] Socket for session ${sessionId} is not open (state: ${session.commLayerWs.readyState}). Cannot send ${data.type}.`);
        }
    }

    _cleanupSession(sessionId, reason) {
        const session = this.sessions.get(sessionId); 
        if (session) {
            console.log(`[Service._cleanupSession] Cleaning up session ${sessionId} (Reason: ${reason}, State: ${session.state})`);
            clearTimeout(session.timeoutId);
            session.timeoutId = null; 
            if (session.commLayerWs && session.commLayerWs.activeSessionIds) {
                session.commLayerWs.activeSessionIds.delete(sessionId);
            }
            this.sessions.delete(sessionId); 
            console.log(`[Service._cleanupSession] Session ${sessionId} removed.`);
        } else {
             console.log(`[Service._cleanupSession] Attempted cleanup for non-existent session: ${sessionId} (Reason: ${reason})`);
        }
    }

    // Public method called by Frontend Handler
    handleFrontendControlResponse(message) {
        const { sessionId, action } = message;
        if (!sessionId || !action || !['accept', 'reject'].includes(action)) { return; }

        const session = this.sessions.get(sessionId); 
        if (!session || session.state !== 'PENDING_ADMIN') { return; }

        console.log(`[Service.handleFrontendControlResponse] Received for session ${sessionId}: ${action}`);
        clearTimeout(session.timeoutId);
        session.timeoutId = null;

        if (action === 'accept') {
            session.state = 'ADMIN_ACCEPTED';
            
            this._sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'accepted' });
            
            this.broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'pending_device_confirmation', decision: 'accepted' });
        } else { // action === 'reject'
            session.state = 'ADMIN_REJECTED';
            // CALL internal method _sendToCommLayer
            this._sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'rejected', reason: 'rejected_by_admin' });
            // CALL injected method broadcastControlFrontend
            this.broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'rejected', decision: 'rejected', reason: 'rejected_by_admin' });
            // CALL internal method _cleanupSession
            this._cleanupSession(sessionId, 'ADMIN_REJECTED');
        }
        console.log(`[Service.handleFrontendControlResponse] Processed ${action} for ${sessionId}.`);
    }

    
    async handleCommLayerControlRequest(ws, message) {
        const { sessionId, deviceId: from } = message;
        if (!sessionId || !from) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Missing sessionId or deviceId' })); return; }
        
        if (this.sessions.has(sessionId)) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Session ID already active' })); return; }
        

        try {
            
            const device = await this.db.collection('devices').findOne({ deviceId: from });
            if (!device) { ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Device not found' })); return; }

             
            const frontendRequestId = this.generateRequestId(); 

            const newSession = {
                state: 'PENDING_ADMIN',
                device: { _id: device._id.toString(), deviceId: device.deviceId, name: device.name, model: device.model, osVersion: device.osVersion },
                commLayerWs: ws,
                requestedTime: Date.now(),
                requestId: frontendRequestId, 
                
                timeoutId: setTimeout(() => { this.handleAdminTimeout(sessionId); }, this.timeoutDuration)
            };

            
            this.sessions.set(sessionId, newSession);
            console.log(`[Service.handleCommLayerControlRequest] Session created: ${sessionId}, State: PENDING_ADMIN`);

            if (!ws.activeSessionIds) { ws.activeSessionIds = new Set(); }
            ws.activeSessionIds.add(sessionId);

            
            this.broadcastControlFrontend({
                requestId: frontendRequestId, 
                type: 'request_control',
                deviceId: from,
                deviceName: newSession.device.name,
                timestamp: Date.now(), 
                sessionId: sessionId
            });

            ws.send(JSON.stringify({ type: 'request_received', sessionId: sessionId, status: 'pending_admin_approval' }));

        } catch (error) {
            console.error(`[Service.handleCommLayerControlRequest] Error handling request ${sessionId}:`, error);
            ws.send(JSON.stringify({ type: 'error', sessionId, message: 'Internal server error handling request' }));
            if (this.sessions.has(sessionId)) { this._cleanupSession(sessionId, 'ERROR_DURING_REQUEST'); }
        }
    }

    
    handleCommLayerStatusUpdate(message) {
        const { sessionId, status, details, deviceId } = message;
        if (!sessionId || !status) { /* ...validation... */ return; }

        
        const session = this.sessions.get(sessionId);
        if (!session) { /* ...validation... */ return; }

        console.log(`[Service.handleCommLayerStatusUpdate] Session ${sessionId}: Received status '${status}'`, details || '');
        let frontendStatus = status;
        let cleanupReason = null;
        let shouldBroadcast = true; 

        switch (status) {
             case 'connected':
                 if (session.state === 'ADMIN_ACCEPTED') { 
                      session.state = 'CONNECTED';
                      frontendStatus = 'connected';
                 } else {
                      console.warn(`[Service] Received 'connected' for session ${sessionId} in unexpected state: ${session.state}. Ignoring.`);
                      shouldBroadcast = false;
                 }
                 break;
             case 'failed':
                session.state = 'FAILED'; frontendStatus = 'failed'; cleanupReason = 'FAILED'; 
                 break;
             case 'disconnected':
                 session.state = 'DISCONNECTED'; frontendStatus = 'disconnected'; cleanupReason = 'DISCONNECTED'; 
                 break;
             default:
                 console.warn(`[Service] Unknown status '${status}' from Comm Layer for session ${sessionId}`);
                 shouldBroadcast = false; 
                 return;
        }
        if(shouldBroadcast) { 
            this.broadcastControlFrontend({
                type: 'control_status_update',
                sessionId: sessionId,
                deviceId: deviceId || session.device?.deviceId, 
                status: frontendStatus,
                message: details || `Session ${sessionId} status: ${frontendStatus}.`,
                details: details
            });
        }

        if (cleanupReason) {
            this._cleanupSession(sessionId, cleanupReason);
        }
    }

    cleanupSessionsForSocket(ws) {
        console.log('[Service.cleanupSessionsForSocket] Cleaning up sessions for disconnected Comm Layer socket.');
        if (ws.activeSessionIds && ws.activeSessionIds.size > 0) {
            const sessionsToCleanup = new Set(ws.activeSessionIds);
            console.log(`[Service] Found ${sessionsToCleanup.size} session(s) on disconnecting socket:`, Array.from(sessionsToCleanup));

            sessionsToCleanup.forEach(sessionId => {
                const session = this.sessions.get(sessionId);
                if (session) {
                    console.log(`[Service] Handling session ${sessionId} (State: ${session.state}) for disconnected socket.`);
                    let cleanupReason = 'COMM_DISCONNECTED';
                    let frontendStatus = 'comm_disconnected';
                    let shouldBroadcast = true; 

                    if (session.state === 'CONNECTED') {
                        frontendStatus = 'disconnected'; cleanupReason = 'COMM_DISCONNECTED_WHILE_CONNECTED';
                    } else if (session.state === 'PENDING_ADMIN' || session.state === 'ADMIN_ACCEPTED') {
                       
                    } else {

                         shouldBroadcast = false;
                         cleanupReason = `CLEANUP_ON_COMM_CLOSE_${session.state}`; 
                    }

                    if (shouldBroadcast) {
                        this.broadcastControlFrontend({
                            type: 'control_status_update',
                            sessionId: sessionId,
                            deviceId: session.device?.deviceId,
                            status: frontendStatus,
                            message: `Communication channel lost for session ${sessionId}.`
                        });
                    }
                    this._cleanupSession(sessionId, cleanupReason);
                } else {
                    console.warn(`[Service] Session ${sessionId} on socket not found in map during cleanup.`);
                    ws.activeSessionIds.delete(sessionId);
                }
            });
            ws.activeSessionIds.clear();
        } else {
             console.log('[Service.cleanupSessionsForSocket] Disconnected socket had no active sessions recorded.');
        }
    }

    handleAdminTimeout(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.state === 'PENDING_ADMIN') {
            session.state = 'TIMED_OUT';
            session.timeoutId = null; 
            console.log(`[Service.handleAdminTimeout] Session timed out: ${sessionId}`);

            this._sendToCommLayer(sessionId, { type: 'control_decision', sessionId: sessionId, decision: 'rejected', reason: 'timed_out' });

            this.broadcastControlFrontend({ type: 'control_status_update', sessionId: sessionId, deviceId: session.device?.deviceId, status: 'timed_out', decision: 'rejected', reason: 'timed_out' });
      
            this._cleanupSession(sessionId, 'TIMED_OUT');
        } else {
            console.log(`[Service.handleAdminTimeout] Timeout fired for session ${sessionId}, but state is ${session?.state || 'non-existent'}. Ignoring.`);
            if (session && session.timeoutId) { clearTimeout(session.timeoutId); session.timeoutId = null; }
        }
    }

    
    getSessionsForFrontend() {
        const sessions = [];
         
        this.sessions.forEach((session, sessionId) => {
            if (session.state === 'PENDING_ADMIN' || session.state === 'CONNECTED') {
                sessions.push({
                    sessionId, state: session.state, device: session.device, requestId: session.requestId, timestamp: session.requestedTime
                });
            }
        });
        console.log(`[Service.getSessionsForFrontend] Providing ${sessions.length} initial sessions.`);
        return sessions;
    }
}

module.exports = ControlSessionService;