// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useRemoteControl } from '../../contexts/RemoteControlContext';

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webRTCService, setWebRTCService] = useState<WebRTCService | null>(null);
  const { currentDeviceId, currentSessionId, resetNavigation } = useRemoteControl();
  webRTCService;
  useEffect(() => {
    websocketService.connectControlSocket();

    if (!currentSessionId || !currentDeviceId) {
      console.log('Device ID iz Context-a:', currentDeviceId);
      console.log('Session ID iz Context-a:', currentSessionId);
      console.warn('Session ID ili Device ID nisu dostupni.');
      return;
    }

    const service = new WebRTCService(currentDeviceId ? currentDeviceId: 'test');
    setWebRTCService(service);

    service.setOnRemoteStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    service.createOffer().catch(error => {
      console.error('Greška prilikom kreiranja offera:', error);
    });

    const handleControlMessage = (data: any) => {
      if (data.type === 'answer' && data.payload?.sessionId === currentSessionId) {
        console.log('Primljen SDP odgovor:', data.payload);
        service.handleAnswer(data.payload);
      } else if (data.type === 'ice-candidate' && data.payload?.sessionId === currentSessionId) {
        console.log('Primljen ICE kandidat:', data.payload);
        service.addIceCandidate(data.payload);
      }
    };

    websocketService.addControlMessageListener(handleControlMessage);

    return () => {
      service.closeConnection();
      websocketService.removeControlMessageListener(handleControlMessage);
      resetNavigation();
    };
  }, []);

  return (
    <div>
      <h1>Daljinski Prikaz Ekrana</h1>
      {currentDeviceId && <p>Device ID: {currentDeviceId}</p>}
      {currentSessionId && <p>Session ID: {currentSessionId}</p>}
      <video ref={videoRef} width="640" height="480" autoPlay playsInline />
    </div>
  );
};

export default RemoteControlPage;