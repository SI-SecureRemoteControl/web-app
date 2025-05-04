// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation } from 'react-router-dom';

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [deviceIdFromUrl, setDeviceIdFromUrl] = useState<string | null>(null);
  const [sessionIdFromUrl, setSessionIdFromUrl] = useState<string | null>(null);
  const location = useLocation();

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

    const service = new WebRTCService(deviceId, sessionId);

    service.setOnRemoteStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        if (settings.width && settings.height) {
          videoRef.current.width = settings.width;
          videoRef.current.height = settings.height;
        }

        // Alternativno (ako `settings` ne daje tačne dimenzije odmah), koristi `loadedmetadata`:
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.width = videoRef.current!.videoWidth;
          videoRef.current!.height = videoRef.current!.videoHeight;
        };
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

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      service.closeConnection();
      websocketService.removeControlMessageListener(handleControlMessage);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.search]);

  /*const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl) {
      return;
    }

    const rect = videoRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const relativeX = clickX / rect.width;
    const relativeY = clickY / rect.height;

    console.log('Kliknuto na relativne koordinate:', relativeX, relativeY);

    websocketService.sendControlMessage({
      action: 'mouse_click',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        x: relativeX,
        y: relativeY,
        button: 'left'
      }
    });
  };
  */
  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl) {
      return;
    }

    const videoElement = videoRef.current;

    const boundingRect = videoElement.getBoundingClientRect();
    const clickX = event.clientX - boundingRect.left;
    const clickY = event.clientY - boundingRect.top;

    const displayedWidth = boundingRect.width;
    const displayedHeight = boundingRect.height;

    const naturalWidth = videoElement.videoWidth;
    const naturalHeight = videoElement.videoHeight;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    const correctedX = clickX * scaleX;
    const correctedY = clickY * scaleY;

    const relativeX = correctedX / naturalWidth;
    const relativeY = correctedY / naturalHeight;

    console.log('Kliknuto na korigirane relativne koordinate:', relativeX, relativeY);

    websocketService.sendControlMessage({
      action: 'mouse_click',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        x: relativeX,
        y: relativeY,
        button: 'left'
      }
    });
  };


  const handleKeyDown = (event: KeyboardEvent) => {
    if (!sessionIdFromUrl) {
      return;
    }

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keydown'
      }
    });
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!sessionIdFromUrl) {
      return;
    }

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keyup'
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-5xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">Daljinski Prikaz Ekrana</h1>
        <div className="text-sm text-gray-600 text-center break-words whitespace-normal">
          {deviceIdFromUrl && <p><span className="font-medium">Device ID:</span> {deviceIdFromUrl}</p>}
          {sessionIdFromUrl && <p><span className="font-medium">Session ID:</span> {sessionIdFromUrl}</p>}
        </div>
        <div className="flex justify-center">
          <video
            ref={videoRef}
            onClick={handleVideoClick}
            className="rounded-xl shadow-lg border border-gray-300 cursor-pointer w-[360px] h-[640px]"
            autoPlay
            playsInline
          />
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;
