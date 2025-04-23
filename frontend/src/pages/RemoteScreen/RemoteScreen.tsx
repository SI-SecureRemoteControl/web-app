// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation } from 'react-router-dom';

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webRTCService, setWebRTCService] = useState<WebRTCService | null>(null);
  const location = useLocation();
  const [deviceIdFromUrl, setDeviceIdFromUrl] = useState<string | null>(null);
  const [sessionIdFromUrl, setSessionIdFromUrl] = useState<string | null>(null);
  webRTCService;
  useEffect(() => {
    websocketService.connectControlSocket();

    const searchParams = new URLSearchParams(location.search);
    const deviceId = searchParams.get('deviceId');
    const sessionId = searchParams.get('sessionId');

    if (!sessionId || !deviceId) {
      console.warn('Session ID ili Device ID nisu pronađeni u URL-u.');
      return;
    }

    setDeviceIdFromUrl(deviceId);
    setSessionIdFromUrl(sessionId);

    console.log('Device ID iz URL-a:', deviceId);
    console.log('Session ID iz URL-a:', sessionId);

    const service = new WebRTCService(deviceId ? deviceId : 'test', sessionId);
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
      if (data.type === 'answer' && data.payload?.sessionId === sessionId) {
        console.log('Primljen SDP odgovor:', data.payload);
        service.handleAnswer(data.payload);
      } else if (data.type === 'ice-candidate' && data.payload?.sessionId === sessionId) {
        console.log('Primljen ICE kandidat:', data.payload);
        service.addIceCandidate(data.payload);
      }
    };

    websocketService.addControlMessageListener(handleControlMessage);

    return () => {
      service.closeConnection();
      websocketService.removeControlMessageListener(handleControlMessage);
    };
  }, [location.search]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-end justify-center p-4 pb-8">
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-5xl w-full space-y-4">
      <h1 className="text-2xl font-bold text-center text-gray-800">Daljinski Prikaz Ekrana</h1>
      <div className="text-sm text-gray-600 text-center break-words whitespace-normal">
        {deviceIdFromUrl && <p><span className="font-medium">Device ID:</span> {deviceIdFromUrl}</p>}
        {sessionIdFromUrl && <p><span className="font-medium">Session ID:</span> {sessionIdFromUrl}</p>}
      </div>
      <div className="flex justify-center">
        <video
          ref={videoRef}
          className="rounded-xl shadow-lg border border-gray-300"
          width="640"
          height="480"
          autoPlay
          playsInline
          controls
        />
      </div>
    </div>
  </div>
  );
};

export default RemoteControlPage;