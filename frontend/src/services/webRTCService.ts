import { websocketService } from './webSocketService';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onIceDisconnectedCallback: (() => void) | null = null; // new callback for disconnects coming from android users
  private deviceId: string | null = null;
  private sessionId: string | null = null;

  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet: boolean = false;


  constructor(deviceId: string, sessionId: string) {
    this.deviceId = deviceId;
    this.sessionId = sessionId;
    this.initializePeerConnection();
    this.setupWebSocketListeners();
  }

  setOnRemoteStream(callback: (stream: MediaStream) => void) {
    console.log(`%cWebRTCService [${this.sessionId}]: setOnRemoteStream CALLED BY PAGE. Callback function stored.`, "color: purple;");
    this.onRemoteStreamCallback = callback;
  }

  setOnIceDisconnected(callback: () => void) {
    console.log(`%cWebRTCService [${this.sessionId}]: setOnIceDisconnected CALLED BY PAGE.`, "color: purple;");
    this.onIceDisconnectedCallback = callback;
  }
  
  public isConnectionActive(): boolean { 
    return this.peerConnection !== null &&
           (this.peerConnection.iceConnectionState === 'connected' ||
            this.peerConnection.iceConnectionState === 'completed');
  }

  public getSessionId(): string | null { // Public getter for sessionId
    return this.sessionId;
  }

  private initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    { urls: "stun:stun.l.google.com:5349" },
    { urls: "stun:stun1.l.google.com:3478" },
    { urls: "stun:stun1.l.google.com:5349" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:5349" },
    { urls: "stun:stun3.l.google.com:3478" },
    { urls: "stun:stun3.l.google.com:5349" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:5349" }
      ],
    });

    // Dodajte transceiver za video (receive-only)
    this.peerConnection.addTransceiver('video', { direction: 'recvonly' });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Lokalni ICE kandidat:', event.candidate.toJSON());
        this.sendSignalingMessage('ice-candidate', event.candidate.toJSON());
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log(`%cWebRTCService [${this.sessionId}]: ONTRACK event fired. Track kind: ${event.track.kind}. Number of streams: ${event.streams?.length}`, "color: purple; font-weight: bold;");
      if (event.track.kind === 'video'){
        console.log('Primljen video stream:', event.track);
      }
      if (event.track.kind === 'video' && event.streams && event.streams[0] && this.onRemoteStreamCallback) {
        console.log(`%cWebRTCService [${this.sessionId}]: --->>> INVOKING onRemoteStreamCallback with stream ID: ${event.streams[0].id}`, "color: purple; font-size: 1.2em;");
        this.onRemoteStreamCallback(event.streams[0]);
      } else {
          console.warn(`%cWebRTCService [${this.sessionId}]: ONTRACK - Conditions to call onRemoteStreamCallback NOT MET. Has streams[0]: ${!!(event.streams && event.streams[0])}, Has callback: ${!!this.onRemoteStreamCallback}`, "color: orange;");
        }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return; // Guard against race conditions on close
      const state = this.peerConnection.iceConnectionState;
      console.log(`%cWebRTCService [${this.sessionId}]: ICE Connection State: ${state}`, "color: teal;");

      if (state === 'connected' || state === 'completed') {
        console.log(`%cWebRTCService [${this.sessionId}]: WebRTC veza (ICE) uspješno uspostavljena!`, "color: teal;");
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        console.error(`%cWebRTCService [${this.sessionId}]: ICE veza prekinuta ili nije uspjela. State: ${state}`, "color: red;");
        if (this.onIceDisconnectedCallback) { 
          console.log(`%cWebRTCService [${this.sessionId}]: Invoking onIceDisconnectedCallback.`, "color: red;");
          this.onIceDisconnectedCallback();
        }
      }
    };
  }

  private setupWebSocketListeners() {
    websocketService.addControlMessageListener((data) => {
      console.log("ovaj" + data);
      if (data.type === 'answer') {
        console.log('Primljen udaljeni SDP odgovor:', data.payload);
        this.handleAnswer(data.payload);
      } else if (data.type === 'ice-candidate') {
        console.log('Primljen udaljeni ICE kandidat:', data.payload);
        this.addIceCandidate(data.payload);
      }
    });
  }

  async createOffer() {
    console.log('createOffer pozvan.');
  
    return new Promise( (resolve, reject) => {
      setTimeout(async () => {
        try {
          const offer = await this.peerConnection?.createOffer();
          await this.peerConnection?.setLocalDescription(offer);
          console.log('Kreiran lokalni SDP offer (nakon delay-a):', offer?.sdp);
          this.sendSignalingMessage('offer', offer);
          resolve(offer);
        } catch (error) {
          console.error('Greška prilikom kreiranja offera (nakon delay-a):', error);
          reject(error);
        }
      }, 500);
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    console.log('handleAnswer pozvan s odgovorom:', answer);  
      try {
        const answerWithType: RTCSessionDescriptionInit = {
          sdp: answer.sdp,
          type: 'answer',
        };
        console.log("Dodajem tip (nakon delay-a)");
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(answerWithType));
        this.isRemoteDescriptionSet = true; 
        while (this.iceCandidateBuffer.length > 0) {
            const candidate = this.iceCandidateBuffer.shift(); 
            if (candidate && this.peerConnection?.remoteDescription) {
                 try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('Sačuvani ICE kandidat dodan:', candidate);
                 } catch (error) {
                    console.error('Greška prilikom dodavanja sačuvanog ICE kandidata:', error);
                 }
            }
        }
        console.log('Udaljeni SDP odgovor postavljen (nakon delay-a).');
      } catch (error) {
        console.error('Greška prilikom postavljanja udaljenog opisa (nakon delay-a):', error);
      }
    
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.isRemoteDescriptionSet) {
      console.log('Remote description nije postavljen. Sačuvam ICE kandidata u buffer.', candidate);
      this.iceCandidateBuffer.push(candidate);
      return;
    }

    console.log('Remote description je postavljen. Dodajem ICE kandidata direktno.', candidate);
    try {
      if (candidate) {
         await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
         console.log('Udaljeni ICE kandidat dodan:', candidate);
      } else {
         console.log('Primljen null ICE kandidat, preskačem dodavanje.');
      }
    } catch (error) {
      console.error('Greška prilikom dodavanja ICE kandidata:', error);
    }
  }

  private sendSignalingMessage(type: string, payload: any) {
    if (websocketService.getControlConnectionStatus()) {
      websocketService.sendControlMessage({ type, payload, deviceId: this.deviceId, sessionId: this.sessionId });
    } else {
      console.error('WebSocket (control) veza nije otvorena. Ne mogu poslati signalizacijsku poruku:', { type, payload });
    }
  }

  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) {
      console.warn('PeerConnection is not initialized.');
      return null;
    }

    try {
      const stats = await this.peerConnection.getStats();
      return stats;
    } catch (error) {
      console.error('Error fetching WebRTC stats:', error);
      return null;
    }
  }

  async getLatency(): Promise<number | null> {
    if (!this.peerConnection) {
        console.warn('PeerConnection is not initialized.');
        return null;
    }

    try {
        const stats = await this.peerConnection.getStats();

        let minRtt: number | null = null;

        stats.forEach((stat) => {
            if (stat.type === 'candidate-pair' && stat.currentRoundTripTime !== undefined) {
                const rttMs = stat.currentRoundTripTime * 1000;
                if (minRtt === null || rttMs < minRtt) minRtt = rttMs;
            }
        });

        if (minRtt === null) {
            stats.forEach((stat) => {
                if (stat.type === 'remote-inbound-rtp' && stat.roundTripTime !== undefined) {
                    const rttMs = stat.roundTripTime * 1000;
                    if (minRtt === null || rttMs < minRtt) minRtt = rttMs;
                }

                if (stat.type === 'outbound-rtp' && stat.roundTripTime !== undefined) {
                    const rttMs = stat.roundTripTime * 1000;
                    if (minRtt === null || rttMs < minRtt) minRtt = rttMs;
                }

                if (stat.type === 'inbound-rtp' && stat.roundTripTime !== undefined) {
                    const rttMs = stat.roundTripTime * 1000;
                    if (minRtt === null || rttMs < minRtt) minRtt = rttMs;
                }

                if ('avgResponseTime' in stat && stat.avgResponseTime !== undefined) {
                    const rttMs = stat.avgResponseTime;
                    if (minRtt === null || rttMs < minRtt) minRtt = rttMs;
                }
            });
        }

        return minRtt;
    } catch (error) {
        console.error('Error fetching WebRTC latency:', error);
        return null;
    }
}


  closeConnection() {
    const currentSessionForLog = this.sessionId || 'unknown';
    console.log(`%cWebRTCService [${currentSessionForLog}]: closeConnection() called.`, "color: brown; font-weight: bold;");

    this.onRemoteStreamCallback = null; // Nullify callbacks first
    this.onIceDisconnectedCallback = null; 

    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onnegotiationneeded = null;

      this.peerConnection.getTransceivers().forEach(transceiver => {
        if (transceiver.stop) { // Check if stop method exists
            transceiver.stop();
        }
      });

      this.peerConnection.close();
      this.peerConnection = null;
      console.log(`%cWebRTCService [${currentSessionForLog}]: Peer connection closed and nulled.`, "color: brown;");
    }
    this.isRemoteDescriptionSet = false;
    this.iceCandidateBuffer = []; 

    // If you had a specific listener added by this service instance:
    // if (this.webSocketMessageHandler && websocketService.removeControlMessageListener) {
    //   websocketService.removeControlMessageListener(this.webSocketMessageHandler);
    //   this.webSocketMessageHandler = null;
    // }
    console.log(`WebRTCService [${this.sessionId}]: Cleanup finished.`);
  }
}

export default WebRTCService;