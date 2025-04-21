import { websocketService } from './webSocketService';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private deviceId: string | null = null;
  private sessionId: string | null = null;

  constructor(deviceId: string, sessionId: string) {
    this.deviceId = deviceId;
    this.sessionId = sessionId;
    this.initializePeerConnection();
    this.setupWebSocketListeners(); // Dodajte postavljanje WebSocket listenera
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
      if (event.track.kind === 'video' && event.streams && event.streams[0] && this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(event.streams[0]);
      }
    };
  }

  private setupWebSocketListeners() {
    websocketService.addControlMessageListener((data) => {
      console.log("ovaj" + data);
      if (data.type === 'answer') {
        console.log('Primljen udaljeni SDP odgovor:', data.payload);
        this.handleAnswer(data.payload);
      } else if (data.type === 'ice-candidate' && data.deviceId === this.deviceId) {
        console.log('Primljen udaljeni ICE kandidat:', data.payload);
        this.addIceCandidate(data.payload);
      }
    });
  }

  async createOffer() {
    if (!this.peerConnection) {
      console.error('Peer veza nije inicijalizirana.');
      return null;
    }
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('Kreiran lokalni SDP offer:', offer.sdp);
      this.sendSignalingMessage('offer', offer);
      return offer;
    } catch (error) {
      console.error('Greška prilikom kreiranja offera:', error);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      console.error('Peer veza nije inicijalizirana.');
      return;
    }
    try {
      const answerWithType: RTCSessionDescriptionInit = {
        sdp: answer.sdp,
        type: 'answer',
      };
      console.log("added type");
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerWithType));

      console.log('Udaljeni SDP odgovor postavljen.');
    } catch (error) {
      console.error('Greška prilikom postavljanja udaljenog opisa:', error);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.error('Peer veza nije inicijalizirana.');
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Udaljeni ICE kandidat dodan:', candidate);
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

  closeConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export default WebRTCService;