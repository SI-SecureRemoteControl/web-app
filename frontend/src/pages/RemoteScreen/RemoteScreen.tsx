import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import WebRTCService from '../../services/webRTCService'; 

const RemoteControlPage: React.FC = () => {
  const { resetNavigation, currentSessionId } = useRemoteControl();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webRTCService, setWebRTCService] = useState<WebRTCService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!true) {
      navigate('/'); 
      return;
    }

    let sessionId='test';
    if (sessionId) {
      const service = new WebRTCService(sessionId);
        service.getIceCandidateState();
      setWebRTCService(service);
      service.setOnRemoteStream((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setLoading(false);
      });

      service.setOnIceCandidate((candidate) => {
        console.log('Sending ICE Candidate:', candidate);
        // dodati slanje na be ovih ic
      });
      service.getIceCandidateState();

      service.setOnSDP((sdp) => {
        console.log('Sending SDP Offer:', sdp);
        service.getIceCandidateState();

        // slanje be ovih sdp offera
      });

      service.createOffer().catch((err) => {
        console.error('Error creating WebRTC offer on page:', err);
        setError('Failed to establish connection.');
        setLoading(false);
      });
      service.getIceCandidateState();

    } else {
      setError('Session ID not found.');
      setLoading(false);
    }

    return () => {
      if (webRTCService) {
        webRTCService.closeConnection();
      }
      resetNavigation();
    };
  }, []);


  useEffect(() => {
    // const handleWebSocketMessage = (data: any) => {
    //   if (webRTCService && currentSessionId) {
    //     if (data.type === 'sdp_answer' && data.sessionId === currentSessionId) {
    //       webRTCService.handleAnswer(data.sdp);
    //     } else if (data.type === 'ice_candidate' && data.sessionId === currentSessionId && data.candidate) {
    //       webRTCService.addIceCandidate(data.candidate);
    //     }
    //   }
    // };

    //dodati handlere na socket
    //websocketService.addControlMessageListener(handleWebSocketMessage); 

    return () => {
      // Unsubscribe from WebSocket messages
      //websocketService.removeControlMessageListener(handleWebSocketMessage);
    };
  }, [webRTCService, currentSessionId]);

  if (loading) {
    return <div>Uspostavljanje video veze...</div>;
  }

  if (error) {
    return <div>Greška: {error}</div>;
  }

  return (
    <div>
      <h1>Daljinski Prikaz Ekrana</h1>
      <video ref={videoRef} width="640" height="480" autoPlay playsInline />
    </div>
  );
};

export default RemoteControlPage;