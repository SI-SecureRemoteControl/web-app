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
  
  const [latency, setLatency] = useState<number | null>(null);

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

        // Set latency to 0 temporarily when answer is received
        setLatency(0);
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

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (sessionIdFromUrl && deviceIdFromUrl) {
      const service = new WebRTCService(deviceIdFromUrl, sessionIdFromUrl);

      intervalId = setInterval(async () => {
        try {
          const stats = await service.getStats();
          if (!stats) return;

          stats.forEach((stat) => {
            if (stat.currentRoundTripTime) {
              setLatency(Math.round(stat.currentRoundTripTime * 1000)); // Convert to ms
            }
          });
        } catch (error) {
          console.error('Error fetching WebRTC stats:', error);
        }
      }, 1000); // Update every second
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionIdFromUrl, deviceIdFromUrl]);

  // Set up touch-friendly environment and add wheel event listeners
  useEffect(() => {
    // Set touch-friendly styles
    document.body.style.touchAction = 'manipulation';
    document.body.style.overscrollBehavior = 'contain';
    
    // Add viewport meta tag for better touch handling
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
    // Add wheel event listener for trackpad gestures
    if (videoRef.current) {
      videoRef.current.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
    
    // Setup keyboard listeners
    document.addEventListener('keydown', handleDocumentKeyDown);
    document.addEventListener('keyup', handleDocumentKeyUp);
    
    return () => {
      // Cleanup
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
      
      if (videoRef.current) {
        videoRef.current.removeEventListener('wheel', handleWheelEvent);
      }
      
      document.removeEventListener('keydown', handleDocumentKeyDown);
      document.removeEventListener('keyup', handleDocumentKeyUp);
    };
  }, [sessionIdFromUrl]);

  // Convert client coordinates to relative coordinates
  const getRelativeCoordinates = (clientX: number, clientY: number) => {
    if (!videoRef.current) return { relativeX: 0, relativeY: 0 };

    const videoElement = videoRef.current;
    const boundingRect = videoElement.getBoundingClientRect();

    const clickX = clientX - boundingRect.left;
    const clickY = clientY - boundingRect.top;

    const displayedWidth = boundingRect.width;
    const displayedHeight = boundingRect.height;

    const naturalWidth = videoElement.videoWidth || displayedWidth;
    const naturalHeight = videoElement.videoHeight || displayedHeight;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    const correctedX = clickX * scaleX;
    const correctedY = clickY * scaleY;

    const relativeX = correctedX / naturalWidth;
    const relativeY = correctedY / naturalHeight;

    return { relativeX, relativeY };
  };

  // Handle wheel events (MacBook trackpad gestures)
  const handleWheelEvent = (event: WheelEvent) => {
    if (!videoRef.current || !sessionIdFromUrl || !deviceIdFromUrl) return;
    
    // Prevent default scrolling behavior
    event.preventDefault();
    
    // Only process if movement is significant enough
    const threshold = 20; // Adjust based on sensitivity needed
    
    if (Math.abs(event.deltaX) > threshold || Math.abs(event.deltaY) > threshold) {
      // Get current cursor position
      const rect = videoRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate end position based on wheel deltas
      const scaleMultiplier = 3; // Amplify the gesture
      const endX = centerX + (event.deltaX * scaleMultiplier);
      const endY = centerY + (event.deltaY * scaleMultiplier);
      
      // Convert to relative coordinates
      const startCoords = getRelativeCoordinates(centerX, centerY);
      const endCoords = getRelativeCoordinates(endX, endY);
      
      // Calculate velocity
      const velocity = Math.sqrt(event.deltaX * event.deltaX + event.deltaY * event.deltaY) / 100;
      
      console.log('Trackpad swipe detected:', {
        start: startCoords,
        end: endCoords,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
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
    }
  };

  // Handle keyboard events
  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (!sessionIdFromUrl) return;

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keydown',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    });
  };

  const handleDocumentKeyUp = (event: KeyboardEvent) => {
    if (!sessionIdFromUrl) return;

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: sessionIdFromUrl,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keyup',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    });
  };
  
  // Handle video click
  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !sessionIdFromUrl || isGestureActive) return;

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
  };
  
  // Unified gesture handling for both mouse and touch
  const handleGestureStart = (clientX: number, clientY: number) => {
    if (!videoRef.current || !sessionIdFromUrl) return;
    
    setIsGestureActive(true);
    setGestureStartTime(Date.now());
    setGestureStartX(clientX);
    setGestureStartY(clientY);
  };
  
  const handleGestureEnd = (clientX: number, clientY: number) => {
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
      setIsGestureActive(false);
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - gestureStartTime;
    const distanceX = clientX - gestureStartX;
    const distanceY = clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // Detect clicks vs swipes
    const MIN_SWIPE_DISTANCE = 5;
    
    if (distance < MIN_SWIPE_DISTANCE) {
      // Handle as a click
      const { relativeX, relativeY } = getRelativeCoordinates(clientX, clientY);
      
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
    } else {
      // Handle as a swipe
      const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
      const endCoords = getRelativeCoordinates(clientX, clientY);
      
      // Calculate velocity
      const velocity = distance / Math.max(duration, 1);
      
      console.log('Swipe detected:', {
        start: startCoords,
        end: endCoords,
        distance,
        duration,
        velocity
      });
      
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
    }
    
    setIsGestureActive(false);
  };
  
  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (event.button === 0) { // Left mouse button
      handleGestureStart(event.clientX, event.clientY);
    }

    // Add event listeners for mouse move and mouse up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent default behavior to avoid issues
    event.preventDefault();
  };
  
  const handleMouseMove = (event: MouseEvent) => {
    if (isGestureActive) {
      event.preventDefault();
      
      // Ako je srednji klik aktivan, pošaljite swipe informacije u realnom vremenu
      if (videoRef.current && sessionIdFromUrl && deviceIdFromUrl) {
        const currentCoords = getRelativeCoordinates(event.clientX, event.clientY);
        const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
        
        // Izračunajte razliku između početne i trenutne pozicije
        const deltaX = event.clientX - gestureStartX;
        const deltaY = event.clientY - gestureStartY;
        
        // Ako je pomak dovoljno velik, pošaljite swipe poruku
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          // Resetirajte početnu poziciju za kontinuirani swipe
          setGestureStartX(event.clientX);
          setGestureStartY(event.clientY);
          
          websocketService.sendControlMessage({
            action: 'swipe',
            deviceId: deviceIdFromUrl,
            sessionId: sessionIdFromUrl,
            payload: {
              startX: startCoords.relativeX,
              startY: startCoords.relativeY,
              endX: currentCoords.relativeX,
              endY: currentCoords.relativeY,
              velocity: 0.5 // Možete prilagoditi brzinu prema potrebi
            }
          });
        }
      }
    }
  };
  
  const handleMouseUp = (event: MouseEvent) => {
    if (isGestureActive) {
      handleGestureEnd(event.clientX, event.clientY);
    }

    // Cleanup
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  // Touch event handlers
  const handleTouchStart = (event: React.TouchEvent<HTMLVideoElement>) => {
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    handleGestureStart(touch.clientX, touch.clientY);
  };
  
  const handleTouchMove = (_event: React.TouchEvent<HTMLVideoElement>) => {
    // No need to do anything here, just tracking
  };
  
  const handleTouchEnd = (event: React.TouchEvent<HTMLVideoElement>) => {
    if (event.changedTouches.length === 0) {
      setIsGestureActive(false);
      return;
    }
    
    const touch = event.changedTouches[0];
    handleGestureEnd(touch.clientX, touch.clientY);
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
            tabIndex={0}
            className="rounded-xl shadow-lg border border-gray-300 cursor-pointer"
            autoPlay
            playsInline
            style={{
              display: 'block',
              maxWidth: '100%',
              height: 'auto',
              touchAction: 'manipulation',
              pointerEvents: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTapHighlightColor: 'rgba(0,0,0,0)',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
        <div className="text-sm text-gray-600 text-center mt-2">
            <p>Data is sending to mobile with <span className="font-medium">{latency} ms</span> latency</p>
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;