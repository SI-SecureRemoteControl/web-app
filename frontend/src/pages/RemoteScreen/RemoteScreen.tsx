// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation } from 'react-router-dom';
import { Switch } from '../../components/ui/Switch.tsx';

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
  
  // Toggle for mouse mode (standard vs toggle mode)
  const [isToggleMode, setIsToggleMode] = useState(false);
  
  // State for touch emulation mode (similar to Chrome DevTools)
  const [isTouchEmulationEnabled, setIsTouchEmulationEnabled] = useState(false);

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

    return () => {
      service.closeConnection();
      websocketService.removeControlMessageListener(handleControlMessage);
    };
  }, [location.search]);

  // Set up touch-friendly environment as soon as component mounts
  useEffect(() => {
    // Always set these touch-friendly styles regardless of mode
    document.body.style.touchAction = 'manipulation';
    document.body.style.overscrollBehavior = 'contain';
    
    // Add these meta tags programmatically to improve touch handling
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    
    return () => {
      // Cleanup when component unmounts
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
    };
  }, []); // Note: Run only once on mount

  // Additional useEffect for any isTouchEmulationEnabled specific behaviors
  useEffect(() => {
    // Apply any additional configuration specific to touch emulation mode
    if (isTouchEmulationEnabled) {
      // Add any special handling for explicit touch emulation mode
      console.log('Touch emulation mode enabled');
    } else {
      console.log('Touch emulation mode disabled');
    }
  }, [isTouchEmulationEnabled]);

  const handleDocumentKeyDown = (event: KeyboardEvent) => {
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
        type: 'keydown',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    });
  };

  const handleDocumentKeyUp = (event: KeyboardEvent) => {
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
        type: 'keyup',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    });
  };

  // Convert client coordinates to relative coordinates
  const getRelativeCoordinates = (clientX: number, clientY: number) => {
    if (!videoRef.current) return { relativeX: 0, relativeY: 0 };

    const videoElement = videoRef.current;
    const boundingRect = videoElement.getBoundingClientRect();
    console.log('Bounding rect:', boundingRect);

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
  
  useEffect(() => {
    document.addEventListener('keydown', handleDocumentKeyDown);
    document.addEventListener('keyup', handleDocumentKeyUp);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
      document.removeEventListener('keyup', handleDocumentKeyUp);
    };
  }, [sessionIdFromUrl]);
  
  const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    // In toggle mode, clicks are handled by gesture system instead
    if (!videoRef.current || !sessionIdFromUrl || isGestureActive || isToggleMode) {
      return;
    }

    const { relativeX, relativeY } = getRelativeCoordinates(event.clientX, event.clientY);

    console.log('Clicked at corrected relative coordinates:', relativeX, relativeY);
    
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

    // Always start gesture tracking regardless of mode
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
  const handleMouseMove = (event: MouseEvent) => {
    // Prevent default to avoid text selection during swipe
    if (isGestureActive) {
      event.preventDefault();
    }
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

    // If movement is small and quick in toggle mode, or in standard mode, treat as a click
    if ((isToggleMode && distance < 10) || (!isToggleMode && distance < 10 && duration < 300)) {
      // Handle as a click
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
    
    // In toggle mode, we always want to detect swipes - even slower ones
    // In standard mode, we only detect quick swipes

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
      velocity,
      isToggleMode
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
    console.log('handleTouchStart triggered');

    if (!videoRef.current || !sessionIdFromUrl || event.touches.length !== 1) {
      return;
    }
    
    // Don't prevent default here - let the browser handle normal touch behavior
    // This is key to making swipes work correctly
    
    const touch = event.touches[0];
    setIsGestureActive(true);
    setGestureStartTime(Date.now());
    setGestureStartX(touch.clientX);
    setGestureStartY(touch.clientY);
  };

  // Handle touch move - important to prevent default scrolling behavior
  const handleTouchMove = (_event: React.TouchEvent<HTMLVideoElement>) => {
    // Don't prevent default here either - crucial for swipes to work
    // We just want to track the movement but let the browser handle the gesture
  };

  // Handle touch end
  const handleTouchEnd = (event: React.TouchEvent<HTMLVideoElement>) => {
    console.log('handleTouchEnd triggered');
    
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
      setIsGestureActive(false);
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - gestureStartTime;

    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - gestureStartX;
    const distanceY = touch.clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // If we detect a valid swipe or click gesture, then prevent default
    if (distance > 10 || (distance < 10 && duration < 300)) {
      event.preventDefault();
    }

    // If movement is small, treat as a click in toggle mode
    // In standard mode, only if quick and small
    if ((isToggleMode && distance < 10) || (!isToggleMode && distance < 10 && duration < 300)) {
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

  // Handle keyboard events from video element
  const handleKeyDown = (event: React.KeyboardEvent<HTMLVideoElement>) => {
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
        type: 'keydown',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    });
  };
  
  // Handle key up events from video element
  const handleKeyUp = (event: React.KeyboardEvent<HTMLVideoElement>) => {
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
        type: 'keyup',
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
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
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-medium text-gray-700">Standard Mode</span>
          <Switch 
            checked={isToggleMode} 
            onCheckedChange={setIsToggleMode} 
            id="mouse-mode-switch"
          />
          <span className="text-sm font-medium text-gray-700">Toggle Mode</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Normal Mode</span>
          <Switch 
            checked={isTouchEmulationEnabled} 
            onCheckedChange={setIsTouchEmulationEnabled} 
            id="touch-emulation-switch"
          />
          <span className="text-sm font-medium text-gray-700">Touch Emulation</span>
        </div>
        <div className="flex justify-center">
          <video
            ref={videoRef}
            onClick={handleVideoClick}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
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
              touchAction: 'manipulation', // Always use manipulation
              pointerEvents: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTapHighlightColor: 'rgba(0,0,0,0)', /* Remove tap highlight on mobile */
              outline: 'none', /* Remove focus outline */
              cursor: 'pointer'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;