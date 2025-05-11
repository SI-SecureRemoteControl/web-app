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
  const [isTouchEmulationEnabled, setIsTouchEmulationEnabled] = useState(true); // Set to true by default

  // Debug state
  const [lastEventType, setLastEventType] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");

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
    // Always set these touch-friendly styles
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
    
    // *** NEW: Add event listeners for wheel events to detect trackpad gestures ***
    if (videoRef.current) {
      videoRef.current.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
    
    return () => {
      // Cleanup when component unmounts
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
      
      if (videoRef.current) {
        videoRef.current.removeEventListener('wheel', handleWheelEvent);
      }
    };
  }, []);

  // *** NEW: Wheel event handler for trackpad gestures ***
  const handleWheelEvent = (event: WheelEvent) => {
    if (!videoRef.current || !sessionIdFromUrl || !deviceIdFromUrl) return;
    
    // Prevent default scrolling behavior
    event.preventDefault();
    
    setLastEventType("wheel");
    setDebugInfo(`deltaX: ${event.deltaX}, deltaY: ${event.deltaY}`);
    
    // Threshold to determine if this is a significant gesture
    const threshold = 50;
    
    // Only process if movement is significant enough
    if (Math.abs(event.deltaX) > threshold || Math.abs(event.deltaY) > threshold) {
      // Get current cursor position
      const rect = videoRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate end position based on wheel deltas
      // Scale the deltas to make the swipe more noticeable
      const scaleMultiplier = 2;
      const endX = centerX + (event.deltaX * scaleMultiplier);
      const endY = centerY + (event.deltaY * scaleMultiplier);
      
      // Convert to relative coordinates
      const startCoords = getRelativeCoordinates(centerX, centerY);
      const endCoords = getRelativeCoordinates(endX, endY);
      
      // Calculate velocity based on delta values
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

    setLastEventType("click");
    
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

    setLastEventType("mousedown");
    
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
      setLastEventType("mousemove");
      setDebugInfo(`x: ${event.clientX}, y: ${event.clientY}`);
    }
  };

  // Handle mouse up to complete the gesture
  const handleMouseUp = (event: MouseEvent) => {
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
      cleanupMouseEvents();
      return;
    }

    setLastEventType("mouseup");
    
    const endTime = Date.now();
    const duration = endTime - gestureStartTime;
    const distanceX = event.clientX - gestureStartX;
    const distanceY = event.clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    setDebugInfo(`distance: ${distance.toFixed(2)}, duration: ${duration}ms`);

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
    
    // *** IMPORTANT: Lower the threshold for detecting swipes ***
    // For MacBook touchbar/trackpad support
    const MIN_SWIPE_DISTANCE = 5; // Lowered from 10
    
    // Only process if movement is significant enough
    if (distance >= MIN_SWIPE_DISTANCE) {
      // Get relative coordinates for start and end points
      const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
      const endCoords = getRelativeCoordinates(event.clientX, event.clientY);

      // Calculate velocity based on distance and duration (pixels per millisecond)
      const velocity = distance / Math.max(duration, 1); // Avoid division by zero

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
    }

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
    
    setLastEventType("touchstart");
    
    const touch = event.touches[0];
    setIsGestureActive(true);
    setGestureStartTime(Date.now());
    setGestureStartX(touch.clientX);
    setGestureStartY(touch.clientY);
    
    // Don't prevent default for touch events to allow natural gestures
  };

  // Handle touch move
  const handleTouchMove = (event: React.TouchEvent<HTMLVideoElement>) => {
    if (isGestureActive) {
      setLastEventType("touchmove");
      setDebugInfo(`touch x: ${event.touches[0].clientX}, y: ${event.touches[0].clientY}`);
    }
    // Don't prevent default here to allow natural touch behavior
  };

  // Handle touch end
  const handleTouchEnd = (event: React.TouchEvent<HTMLVideoElement>) => {
    console.log('handleTouchEnd triggered');
    
    if (!isGestureActive || !videoRef.current || !sessionIdFromUrl) {
      setIsGestureActive(false);
      return;
    }
    
    setLastEventType("touchend");
    
    const endTime = Date.now();
    const duration = endTime - gestureStartTime;

    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - gestureStartX;
    const distanceY = touch.clientY - gestureStartY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    setDebugInfo(`touch distance: ${distance.toFixed(2)}, duration: ${duration}ms`);

    // *** IMPORTANT: Reduced threshold for detecting swipes ***
    const MIN_SWIPE_DISTANCE = 5; // Lowered from 10

    // If movement is small, treat as a click
    if (distance < MIN_SWIPE_DISTANCE) {
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
    const velocity = distance / Math.max(duration, 1); // Avoid division by zero

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
        
        {/* Debug info display - helpful for troubleshooting */}
        <div className="text-xs text-gray-500 text-center">
          Last event: {lastEventType} {debugInfo && `- ${debugInfo}`}
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
              WebkitTapHighlightColor: 'rgba(0,0,0,0)',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
        
        {/* Instructions for MacBook users */}
        <div className="text-sm text-gray-600 text-center mt-4">
          <p className="font-medium mb-1">How to use with MacBook touchbar/trackpad:</p>
          <ul className="text-left max-w-md mx-auto space-y-1">
            <li>• <strong>Two-finger swipe</strong>: Swipe on the trackpad with two fingers</li>
            <li>• <strong>Click</strong>: Normal trackpad click</li>
            <li>• <strong>Toggle mode</strong>: Enable for easier gesture recognition</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;