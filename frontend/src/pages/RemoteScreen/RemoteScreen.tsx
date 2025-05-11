// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState, useCallback} from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import { WifiOff, Loader2 } from 'lucide-react'; 

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);

  const [remoteStreamState, setRemoteStreamState] = useState<MediaStream | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(false); // Controls visibility
  const [displayMessage, setDisplayMessage] = useState<string>("Inicijalizacija...");

  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  const deviceIdFromUrl = queryParams.get('deviceId');
  const pageSessionId = queryParams.get('sessionId'); // The session ID this page is specifically viewing
  const { activeSession} = useRemoteControl();

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!showVideo || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keydown' }
    });
  }, [pageSessionId, deviceIdFromUrl]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!showVideo  || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keyup' }
    });
  }, [pageSessionId, deviceIdFromUrl]);

   const cleanupLocalWebRTCResources = useCallback((reason: string) => {
    console.log(`%c[${pageSessionId}] cleanupLocalWebRTCResources called. Reason: ${reason}`, "color: orange; font-weight: bold;");
    if (webRTCServiceRef.current) {
      webRTCServiceRef.current.closeConnection(); 
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setRemoteStreamState(null); 
    setShowVideo(false);
   }, [pageSessionId]);

  // States for gesture tracking
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [gestureStartTime, setGestureStartTime] = useState(0);
  const [gestureStartX, setGestureStartX] = useState(0);
  const [gestureStartY, setGestureStartY] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {

    if (!pageSessionId || !deviceIdFromUrl) {
      console.warn('RemoteControlPage: Session ID or Device ID not found in URL.');
      setDisplayMessage("Greška: Nedostaju ID sesije ili uređaja u URL parametrima.");
      setShowVideo(false);
      // navigate('/'); // Optionally navigate away
      return;
    }

    console.log(`%cRemoteControlPage [${pageSessionId}]: MAIN useEffect RUNNING (location.search changed or initial mount)`, "color: blue; font-weight: bold;");
    setDisplayMessage(`Povezivanje na sesiju: ${pageSessionId}...`);
    setShowVideo(false);


    const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
    webRTCServiceRef.current = service;
    let isEffectMounted = true;

    console.log(`%cRemoteControlPage [${pageSessionId}]: WebRTCService INSTANTIATED. Setting onRemoteStream callback.`, "color: green;");

    service.setOnRemoteStream((stream) => {
      if (isEffectMounted && videoRef.current) {
        console.log(`%c[${pageSessionId}] MainEffect: <<< onRemoteStream CALLBACK FIRED >>>. Attaching stream.`, "color: red; font-weight: bold;");
        setRemoteStreamState(stream);
        setDisplayMessage("Video stream aktivan.");
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        if (settings.width && settings.height) {
          videoRef.current.width = settings.width;
          videoRef.current.height = settings.height;
        }

        videoRef.current.onloadedmetadata = () => {
          if(videoRef.current && isEffectMounted){
           videoRef.current!.width = videoRef.current!.videoWidth;
            videoRef.current!.height = videoRef.current!.videoHeight;
          }
        };
      } else {
        console.warn(`%c[${pageSessionId}] MainEffect: onRemoteStream callback - conditions NOT MET. isEffectMounted: ${isEffectMounted}, videoRef.current: ${!!videoRef.current}`, "color: orange;");
      }
    });

    service.setOnIceDisconnected(() => {
      if (isEffectMounted) { 
        console.warn(`%c[${pageSessionId}] MainEffect: <<< onIceDisconnected CALLBACK FIRED >>>. ICE connection lost.`, "color: red; font-weight: bold;");
        setDisplayMessage("Veza sa uređajem je prekinuta (ICE).");
        cleanupLocalWebRTCResources('ICE disconnected'); // Clean up local resources
      }
    });

      console.log(`%c[${pageSessionId}] MainEffect: Calling createOffer().`, "color: blue;");
      service.createOffer()
        .then(() => {
          if (isEffectMounted){
            setDisplayMessage("WebRTC ponuda poslana. Čekanje odgovora...");
            console.log(`%c[${pageSessionId}] MainEffect: createOffer() resolved.`, "color: blue;");
          }
        })
        .catch(error => {
          if(isEffectMounted) {
             setDisplayMessage("Greška pri kreiranju WebRTC ponude.");
              console.error(`[${pageSessionId}] MainEffect: Failed to create offer:`, error);
              if (webRTCServiceRef.current) webRTCServiceRef.current.closeConnection();
                setShowVideo(false);
          }
        });

    const handleWebSocketMessagesForThisSession = (data: any) => {
      if (!isEffectMounted || data.sessionId !== pageSessionId || !webRTCServiceRef.current) return; // Only process messages for this page's session

      if (data.type === 'answer') {
        webRTCServiceRef.current?.handleAnswer(data.payload);
      } else if (data.type === 'ice-candidate') {
        webRTCServiceRef.current?.addIceCandidate(data.payload);
    const handleControlMessage = (data: any) => {
      if (data.type === 'answer' && data.payload?.sessionId === sessionId) {
        console.log('Primljen SDP odgovor:', data.payload);
        service.handleAnswer(data.payload);

        // Set latency to 0 temporarily when answer is received
      } else if (data.type === 'ice-candidate' && data.payload?.sessionId === sessionId) {
        console.log('Primljen ICE kandidat:', data.payload);
        service.addIceCandidate(data.payload);
      }
    };

    websocketService.addControlMessageListener(handleWebSocketMessagesForThisSession);

    return () => {
      isEffectMounted = false;
      console.log(`%c[${pageSessionId}] MainEffect: CLEANUP. Closing WebRTC.`, "color: blue; font-weight: bold;");
       if (webRTCServiceRef.current) {
        webRTCServiceRef.current.closeConnection();
        webRTCServiceRef.current = null;
      }
      websocketService.removeControlMessageListener(handleWebSocketMessagesForThisSession);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);

      service.closeConnection();
      websocketService.removeControlMessageListener(handleControlMessage);
    };
  }, [location.search, handleKeyDown, handleKeyUp, cleanupLocalWebRTCResources]);
  
  useEffect(() => {
    console.log(`%c[${pageSessionId}] StreamEffect: remoteStreamState is ${remoteStreamState ? 'defined' : 'null'}, videoRef.current is ${videoRef.current ? 'defined' : 'null'}`, "color: green;");
    if (remoteStreamState && videoRef.current) {
      console.log(`%c[${pageSessionId}] StreamEffect: Attaching stream to video element.`, "color: green; font-weight: bold;");
      videoRef.current.srcObject = remoteStreamState;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) { // Check ref again inside async callback
          videoRef.current.width = videoRef.current.videoWidth;
          videoRef.current.height = videoRef.current.videoHeight;
          console.log(`%c[${pageSessionId}] StreamEffect: Video metadata loaded. Dimensions set.`, "color: green;");
        }
      };
      setDisplayMessage("Video stream aktivan.");
      setShowVideo(true); // <<<< NOW make the video visible
    } else if (!remoteStreamState) {
      // If stream is removed (e.g., on disconnect), ensure video is hidden
      setShowVideo(false);
      if (videoRef.current) videoRef.current.srcObject = null; // Also clear srcObject
    }
  }, [remoteStreamState, pageSessionId]); // Run when remoteStreamState changes

    useEffect(() => {
    const service = webRTCServiceRef.current; // Capture current ref value
    if (!pageSessionId || !service) return;

    // If context says session is not active for this page, and we previously thought it was
    if ((!activeSession || activeSession.sessionId !== pageSessionId) && showVideo) {
        console.log(`%c[${pageSessionId}] ContextEffect: Context session mismatch/null, and video was showing. Closing.`, "color: orange;");
        setDisplayMessage(`Sesija ${pageSessionId} prekinuta.`);
        cleanupLocalWebRTCResources('context (admin) termination');
        service.closeConnection(); // Close the service
        setRemoteStreamState(null); // This will trigger the StreamEffect to hide video
        // setShowVideo(false); // StreamEffect will handle this via setRemoteStreamState(null)
    }
  }, [activeSession, pageSessionId, showVideo, navigate]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (sessionIdFromUrl && deviceIdFromUrl) {
      const service = new WebRTCService(deviceIdFromUrl, sessionIdFromUrl);

      intervalId = setInterval(async () => {
        try {
          const stats = await service.getStats();
          //console.log('WebRTC stats that is inside:', stats);
          const latency = await service.getLatency();
         // console.log('WebRTC latency that is inside:', latency);
          if (!stats) return;

          let fps: number | null = null;
          let droppedFrames: number | null = null;
          let frameWidth: number | null = null;
          let frameHeight: number | null = null;
          let packetsLost: number | null = null;
          let jitter: string | null = null;

          // Try to extract from all stats entries
          stats.forEach((stat) => {
            // FPS: try both framesPerSecond and fps
            if ('framesPerSecond' in stat && stat.framesPerSecond != null) fps = stat.framesPerSecond;
            if ('fps' in stat && stat.fps != null) fps = stat.fps;
            // Dropped frames: try both framesDropped and droppedFrames
            if ('framesDropped' in stat && stat.framesDropped != null) droppedFrames = stat.framesDropped;
            if ('droppedFrames' in stat && stat.droppedFrames != null) droppedFrames = stat.droppedFrames;
            // Resolution
            if ('frameWidth' in stat && stat.frameWidth != null) frameWidth = stat.frameWidth;
            if ('frameHeight' in stat && stat.frameHeight != null) frameHeight = stat.frameHeight;
            // Packets lost
            if ('packetsLost' in stat && stat.packetsLost != null) packetsLost = stat.packetsLost;
            // Jitter
            if ('jitter' in stat && stat.jitter != null) jitter = (stat.jitter * 1000).toFixed(2);
          });

          const latencyElement = document.getElementById('latency-display');
          if (latencyElement) {
            latencyElement.textContent =
              `FPS: ${fps ?? 'N/A'}, Dropped: ${droppedFrames ?? 'N/A'}, ` +
              `Resolution: ${frameWidth ?? '?'}x${frameHeight ?? '?'}, ` +
              `Lost Packets: ${packetsLost ?? 'N/A'}, Jitter: ${jitter ?? 'N/A'} ms, ` +
              `Latency: ${latency !== null ? latency.toFixed(2) : 'N/A'} ms`;
          }
        } catch (error) {
          console.error('Error fetching WebRTC stats:', error);
        }
      }, 1000); // Update every second
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionIdFromUrl, deviceIdFromUrl]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (sessionIdFromUrl && deviceIdFromUrl) {
      const service = new WebRTCService(deviceIdFromUrl, sessionIdFromUrl);


      intervalId = setInterval(async () => {
        try {
          const latencyValue = await service.getLatency();
          setLatency(latencyValue);
        } catch (error) {
          setLatency(null);
        }
      }, 1000);
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

  useEffect(() => {
    // Add global mouse event listeners when the component mounts
    const handleMouseMove = (event: MouseEvent) => {
      if (isGestureActive) {
        event.preventDefault();
        if (videoRef.current && sessionIdFromUrl && deviceIdFromUrl) {
          const currentCoords = getRelativeCoordinates(event.clientX, event.clientY);
          const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);

          const deltaX = event.clientX - gestureStartX;
          const deltaY = event.clientY - gestureStartY;

          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
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
                velocity: 0.5,
              },
            });
          }
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (isGestureActive) {
        handleGestureEnd(event.clientX, event.clientY);
      }
      setIsGestureActive(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isGestureActive, sessionIdFromUrl, deviceIdFromUrl]);

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
      
      console.log('Scroll swipe detected:', {
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
      sessionId: pageSessionId,
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

  if (!pageSessionId || !deviceIdFromUrl) {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                <h1 className="text-xl font-bold text-red-600">Greška</h1>
                <p className="text-gray-700 mt-2">{displayMessage || "Nije moguće učitati sesiju. Nedostaju ID uređaja ili sesije u URL-u."}</p>
            </div>
        </div>
    );
  }
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

    // Add event listeners for mouse move and mouse up immediately
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

    // Cleanup event listeners immediately
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  // Touch event handlers
  const handleTouchStart = (event: React.TouchEvent<HTMLVideoElement>) => {
   // if (event.touches.length !== 1) return;
    
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
          <p><span className="font-medium">Device ID:</span> {deviceIdFromUrl}</p>
          <p><span className="font-medium">Session ID:</span> {pageSessionId}</p>
          <p><span className="font-medium">Status:</span> {displayMessage}</p>
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
          {!showVideo && ( // Placeholder when video is hidden
            <div className="flex flex-col items-center justify-center text-gray-500">
              {displayMessage === "Video stream aktivan." || displayMessage === "Povezivanje na sesiju..." || displayMessage === "WebRTC ponuda poslana. Čekanje odgovora..." || displayMessage === "Video stream primljen. Priprema prikaza..." ? (
                <Loader2 size={48} className="mb-4 animate-spin" />
              ) : (
                <WifiOff size={48} className="mb-4" />
              )}
              <p className="text-lg font-medium">
                {displayMessage.includes("Greška") || displayMessage.includes("prekinuta") ?
                    displayMessage :
                    (remoteStreamState ? "Povezivanje video prikaza..." : displayMessage) // Show current displayMessage
                }
              </p>
              {/* ... error button ... */}
            </div>
          )}
        </div>
        <div id="latency-display" className="text-sm text-gray-600 text-center mt-2">
          Loading...
        </div>
        <div className="text-sm text-gray-600 text-center">
          {latency !== null
            ? `Trenutno zbog konekcije, latency je ${latency >= 1000 ? (latency / 1000).toFixed(1) + 's' : latency.toFixed(0) + 'ms'}`
            : 'Latency: Calculating...'}
        </div>
      </div>
    </div>
  );
};

export default RemoteControlPage;