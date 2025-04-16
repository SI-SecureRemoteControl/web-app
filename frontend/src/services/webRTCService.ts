class WebRTCService {
    private peerConnection: RTCPeerConnection | null = null;
    private sessionId: string | undefined;// mozda mi nece trebati ovo 
    private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
    private onIceCandidateCallback: ((candidate: RTCIceCandidateInit) => void) | null = null;
    private onSDPCallback: ((sdp: RTCSessionDescriptionInit) => void) | null = null;
  
    constructor(sessionId?: string) {
      this.sessionId = sessionId;
      this.initializePeerConnection();
    }
  

    setSessionId(sessionId: string) {
      this.sessionId = sessionId;
    }
  
    setOnRemoteStream(callback: (stream: MediaStream) => void) {
      this.onRemoteStreamCallback = callback;
    }
  
    setOnIceCandidate(callback: (candidate: RTCIceCandidateInit) => void) {
      this.onIceCandidateCallback = callback;
    }
  
    setOnSDP(callback: (sdp: RTCSessionDescriptionInit) => void) {
      this.onSDPCallback = callback;
    }
  
    private initializePeerConnection() {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
  
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidateCallback && this.sessionId) {
          this.onIceCandidateCallback(event.candidate.toJSON());
          // You will need to send this via your WebSocket to the backend
          console.log('Local ICE Candidate:', event.candidate.toJSON());
        }
      };
  
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0] && this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      };
    }
  
    async createOffer() {
      if (!this.peerConnection) {
        console.error('Peer connection not initialized.');
        return null;
      }
      try {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        if (this.onSDPCallback && this.peerConnection.localDescription) {
          this.onSDPCallback(this.peerConnection.localDescription.toJSON());
          // You will need to send this via your WebSocket to the backend
          console.log('Local SDP Offer:', this.peerConnection.localDescription.toJSON());
          return this.peerConnection.localDescription.toJSON();
        }
        return null;
      } catch (error) {
        console.error('Error creating offer:', error);
        return null;
      }
    }
  
    async handleAnswer(answer: RTCSessionDescriptionInit) {
      if (!this.peerConnection) {
        console.error('Peer connection not initialized.');
        return;
      }
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote SDP Answer set.');
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  
    async addIceCandidate(candidate: RTCIceCandidateInit) {
      if (!this.peerConnection) {
        console.error('Peer connection not initialized.');
        return;
      }
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('Remote ICE Candidate added:', candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  
    // You might need a method to add tracks (e.g., for local media if you implement two-way communication later)
    // For now, the Android device will be sending the track.
  
    closeConnection() {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
    }

    getIceCandidateState() {
        console.log("state is> ", this.peerConnection?.iceConnectionState);
    }
}
  
export default WebRTCService;