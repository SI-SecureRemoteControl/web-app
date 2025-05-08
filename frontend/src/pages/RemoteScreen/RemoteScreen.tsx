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

  // States for gesture tracking
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [gestureStartTime, setGestureStartTime] = useState(0);
  const [gestureStartX, setGestureStartX] = useState(0);
  const [gestureStartY, setGestureStartY] = useState(0);

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
      cleanupMouseEvents();
    };
  }, [location.search]);

  // Convert client coordinates to relative coordinates
  const getRelativeCoordinates = (clientX: number, clientY: number) => {
    if (!videoRef.current) return { relativeX: 0, relativeY: 0 };

    const videoElement = videoRef.current;
    const boundingRect = videoElement.getBoundingClientRect();
    
    const clickX = clientX - boundingRect.left;
    const clickY = clientY - boundingRect.top;

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

    return { relativeX, relativeY };
  };

  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl || isGestureActive) {
      return;
    }

    const { relativeX, relativeY } = getRelativeCoordinates(event.clientX, event.clientY);

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

  // Handle mouse down to start gesture tracking
  const handleMouseDown = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl) {
      return;
    }

    setIsGestureActive(true);
    setGestureStartTime(Date.now());
    setGestureStartX(event.clientX);
    setGestureStartY(event.clientY);

    // Add event listeners for mouse move and mouse up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent default to avoid text selection
    event.preventDefault();
  };

  // Handle mouse move during gesture
  const handleMouseMove = (_event: MouseEvent) => {
    // Just track movement, no action needed until mouse up
  };

  // Handle mouse up to complete the gesture
  const handleMouseUp = (event: MouseEvent) => {
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
        cleanupMouseEvents();
        return;
    }

    const endTime = Date.now();
    const duration = endTime - gestureStartTime;
    const distanceX = event.clientX - gestureStartX;
    const distanceY = event.clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // If movement is small and quick, treat as a click
    if (distance < 10 && duration < 300) {
        // IMPORTANT: Handle this as a click directly here instead of letting another handler manage it
        const { relativeX, relativeY } = getRelativeCoordinates(event.clientX, event.clientY);
        
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
        
        cleanupMouseEvents();
        return;
    }

    // Get relative coordinates for start and end points
    const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
    const endCoords = getRelativeCoordinates(event.clientX, event.clientY);

    // Calculate velocity based on distance and duration (pixels per millisecond)
    const velocity = distance / duration;

    console.log('Swipe detected:', {
      start: startCoords,
      end: endCoords,
      distance,
      duration,
      velocity
    });

    // Send swipe event
    websocketService.sendControlMessage({
      action: 'swipe',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        startX: startCoords.relativeX,
        startY: startCoords.relativeY,
        endX: endCoords.relativeX,
        endY: endCoords.relativeY,
        velocity: velocity
      }
    });

    // Clean up
    cleanupMouseEvents();
  };

  // Helper to clean up mouse events
  const cleanupMouseEvents = () => {
    setIsGestureActive(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle touch start
  const handleTouchStart = (event: React.TouchEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    setIsGestureActive(true);
    setGestureStartTime(Date.now());
    setGestureStartX(touch.clientX);
    setGestureStartY(touch.clientY);

    // Prevent default to avoid scrolling
    event.preventDefault();
  };

  // Handle touch move
  const handleTouchMove = (event: React.TouchEvent<HTMLVideoElement>) => {
    // Just track movement, action happens on touch end
    if (isGestureActive) {
      event.preventDefault(); // Prevent scrolling while swiping
    }
  };

  // Handle touch end
  const handleTouchEnd = (event: React.TouchEvent<HTMLVideoElement>) => {
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
      setIsGestureActive(false);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - gestureStartTime;
    
    // Use the last known position if there are no touches left
    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - gestureStartX;
    const distanceY = touch.clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // If movement is small and quick, treat as a click
    if (distance < 10 && duration < 300) {
      // Handle as a click instead
      const { relativeX, relativeY } = getRelativeCoordinates(touch.clientX, touch.clientY);
      
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
      
      setIsGestureActive(false);
      return;
    }

    // Get relative coordinates for start and end points
    const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
    const endCoords = getRelativeCoordinates(touch.clientX, touch.clientY);

    // Calculate velocity based on distance and duration
    const velocity = distance / duration;

    console.log('Swipe detected (touch):', {
      start: startCoords,
      end: endCoords,
      distance,
      duration,
      velocity
    });

    // Send swipe event
    websocketService.sendControlMessage({
      action: 'swipe',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        startX: startCoords.relativeX,
        startY: startCoords.relativeY,
        endX: endCoords.relativeX,
        endY: endCoords.relativeY,
        velocity: velocity
      }
    });

    setIsGestureActive(false);
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
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="rounded-xl shadow-lg border border-gray-300 cursor-pointer"
            autoPlay
            playsInline
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;