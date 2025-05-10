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

        // Alternativno (ako `settings` ne daje tačne dimenzije odmah), koristi `loadedmetadata`:
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
      }
    };

    websocketService.addControlMessageListener(handleWebSocketMessagesForThisSession);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

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
    if (!videoRef.current || !pageSessionId) {
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
      sessionId: pageSessionId,
      payload: {
        x: relativeX,
        y: relativeY,
        button: 'left'
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

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-5xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">Daljinski Prikaz Ekrana</h1>
        <div className="text-sm text-gray-600 text-center break-words whitespace-normal">
          <p><span className="font-medium">Device ID:</span> {deviceIdFromUrl}</p>
          <p><span className="font-medium">Session ID:</span> {pageSessionId}</p>
          <p><span className="font-medium">Status:</span> {displayMessage}</p>
        </div>

        <div className="flex justify-center items-center min-h-[300px] bg-gray-200 rounded-xl"> {/* Container for video or placeholder */}
          {/* Video element is always in the DOM, visibility controlled by CSS/wrapper */}
          <video
            ref={videoRef}
            onClick={handleVideoClick}
            className={`rounded-xl shadow-lg border border-gray-300 cursor-pointer bg-black ${showVideo ? 'block' : 'hidden'}`} // Toggle visibility
            autoPlay
            playsInline
            muted
            style={{ maxWidth: '100%', height: 'auto' }}
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
      </div>
    </div>
  );
};

export default RemoteControlPage;
