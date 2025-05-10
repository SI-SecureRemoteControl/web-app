// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState, useCallback} from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRemoteControl } from '../../contexts/RemoteControlContext';
import { WifiOff } from 'lucide-react'; 

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);

  const [isStreamActuallyPlaying, setIsStreamActuallyPlaying] = useState<boolean>(false);
  const [displayMessage, setDisplayMessage] = useState<string>("Inicijalizacija...");

  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  const deviceIdFromUrl = queryParams.get('deviceId');
  const pageSessionId = queryParams.get('sessionId'); // The session ID this page is specifically viewing

  const { activeSession } = useRemoteControl(); // Get 

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isStreamActuallyPlaying || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keydown' }
    });
  }, [isStreamActuallyPlaying , pageSessionId, deviceIdFromUrl]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!isStreamActuallyPlaying  || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keyup' }
    });
  }, [isStreamActuallyPlaying , pageSessionId, deviceIdFromUrl]);

  useEffect(() => {

    if (!pageSessionId || !deviceIdFromUrl) {
      console.warn('RemoteControlPage: Session ID or Device ID not found in URL.');
      setDisplayMessage("Greška: Nedostaju ID sesije ili uređaja u URL parametrima.");
      setIsStreamActuallyPlaying(false);
      // navigate('/'); // Optionally navigate away
      return;
    }

    console.log(`%cRemoteControlPage [${pageSessionId}]: MAIN useEffect RUNNING (location.search changed or initial mount)`, "color: blue; font-weight: bold;");
    setDisplayMessage(`Povezivanje na sesiju: ${pageSessionId}...`);
    setIsStreamActuallyPlaying(false);


    const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
    webRTCServiceRef.current = service;
    let isEffectMounted = true;

    console.log(`%cRemoteControlPage [${pageSessionId}]: WebRTCService INSTANTIATED. Setting onRemoteStream callback.`, "color: green;");

    service.setOnRemoteStream((stream) => {
      if (isEffectMounted && videoRef.current) {
        console.log(`%c[${pageSessionId}] MainEffect: <<< onRemoteStream CALLBACK FIRED >>>. Attaching stream.`, "color: red; font-weight: bold;");
        setDisplayMessage("Video stream aktivan.");
        videoRef.current.srcObject = stream;
        setIsStreamActuallyPlaying(true);
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
          }
        });

    const handleWebSocketMessagesForThisSession = (data: any) => {
      if (!isEffectMounted || data.sessionId !== pageSessionId || !webRTCServiceRef.current) return; // Only process messages for this page's session

      if (data.type === 'answer') {
        console.log(`%c[${pageSessionId}] MainEffect: Received ANSWER. Passing to service.`, "color: purple;");
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
  }, [location.search, handleKeyDown, handleKeyUp]);
 
/*
useEffect(() => {
    if (!pageSessionId) return;
    if (webRTCServiceRef.current && webRTCServiceRef.current.getSessionId() === pageSessionId) {
        if (!activeSession || activeSession.sessionId !== pageSessionId) {
            if (userMessage !== "Inicijalizacija..." || isStreamActive || remoteStream) { 
                 console.log(`RemoteControlPage [${pageSessionId}]: Context indicates session termination. User message: "${userMessage}". Closing local WebRTC.`);
                 setDisplayMessage(`Sesija ${pageSessionId} je prekinuta ili više nije aktivna.`);
                 closeAndCleanupWebRTC('context termination');
            }
        }
    } else if (!activeSession && (isStreamActive || remoteStream)) { 
        console.log(`RemoteControlPage [${pageSessionId}]: Global activeSession is null, and stream was active/received. Closing.`);
        setDisplayMessage(`Sesija ${pageSessionId} je prekinuta globalno.`);
        closeAndCleanupWebRTC('global session null, local stream was present');
    }
  }, [activeSession, pageSessionId, userMessage, isStreamActive, remoteStream, navigate, closeAndCleanupWebRTC]);
*/

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

        {isStreamActuallyPlaying ? (
          <div className="flex justify-center">
            <video
              ref={videoRef}
              onClick={handleVideoClick}
              className="rounded-xl shadow-lg border border-gray-300 cursor-pointer bg-black"
              autoPlay
              playsInline
              muted
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-500">
            {/* <VideoOff size={48} className="mb-4" /> */}
            <WifiOff size={48} className="mb-4" />
            <p className="text-lg font-medium">
              {displayMessage.includes("Greška") || displayMessage.includes("prekinuta") ?
                    displayMessage :
                    "Očekuje se video stream..."
                }</p>
            {displayMessage.includes("Greška") && (
                <button
                    onClick={() => navigate('/devices')} // Example: Navigate to devices list
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Povratak na uređaje
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteControlPage;
