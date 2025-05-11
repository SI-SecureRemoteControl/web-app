import { websocketService } from './webSocketService';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
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
    this.onRemoteStreamCallback = callback;
  }

  private initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
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
      if (event.track.kind === 'video'){
        console.log('Primljen video stream:', event.track);
      }
      if (event.track.kind === 'video' && event.streams && event.streams[0] && this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(event.streams[0]);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State:', this.peerConnection?.iceConnectionState);
        if (this.peerConnection?.iceConnectionState === 'connected' || this.peerConnection?.iceConnectionState === 'completed') {
          console.log('WebRTC veza (ICE) uspješno uspostavljena!');
        } else if (this.peerConnection?.iceConnectionState === 'failed' || this.peerConnection?.iceConnectionState === 'disconnected' || this.peerConnection?.iceConnectionState === 'closed') {
          console.log('ICE Connection if not connected or completed:', this.peerConnection?.iceConnectionState);
          console.error('ICE veza prekinuta ili nije uspjela.');
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

  closeConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export default WebRTCService;