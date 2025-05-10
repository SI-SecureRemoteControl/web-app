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

  const location = useLocation();
  const navigate = useNavigate();

  const [isStreamActive, setIsStreamActive] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>("Inicijalizacija...");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null); 

  const queryParams = new URLSearchParams(location.search);
  const deviceIdFromUrl = queryParams.get('deviceId');
  const pageSessionId = queryParams.get('sessionId'); // The session ID this page is specifically viewing

  const { activeSession } = useRemoteControl(); // Get 
  const hasInitializedRef = useRef(false);

  const closeAndCleanupWebRTC = useCallback((reason?: string) => {
    if (webRTCServiceRef.current) {
      console.log(`RemoteControlPage [${pageSessionId}]: Closing WebRTC. Reason: ${reason || 'N/A'}`);
      webRTCServiceRef.current.closeConnection();
      // webRTCServiceRef.current = null; // Clearing ref here might be too early if other effects depend on it momentarily
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null; // Important: Clear the video source
    }
    setIsStreamActive(false);
    setRemoteStream(null) // Update UI state
  }, [pageSessionId]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isStreamActive || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keydown' }
    });
  }, [isStreamActive, pageSessionId, deviceIdFromUrl]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!isStreamActive || !pageSessionId || !deviceIdFromUrl || !webRTCServiceRef.current?.isConnectionActive()) return;
    websocketService.sendControlMessage({
      action: 'keyboard', deviceId: deviceIdFromUrl, sessionId: pageSessionId,
      payload: { key: event.key, code: event.code, type: 'keyup' }
    });
  }, [isStreamActive, pageSessionId, deviceIdFromUrl]);

  useEffect(() => {

    if (!pageSessionId || !deviceIdFromUrl) {
      console.warn('RemoteControlPage: Session ID or Device ID not found in URL.');
      setUserMessage("Greška: Nedostaju ID sesije ili uređaja u URL parametrima.");
      setIsStreamActive(false);
      // navigate('/'); // Optionally navigate away
      return;
    }

    console.log(`%cRemoteControlPage [${pageSessionId}]: MAIN useEffect RUNNING (location.search changed or initial mount)`, "color: blue; font-weight: bold;");
    setUserMessage(`Povezivanje na sesiju: ${pageSessionId}...`);
    setIsStreamActive(false);
    setRemoteStream(null);

    const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
    webRTCServiceRef.current = service;
    hasInitializedRef.current = true;
    let isEffectMounted = true;

    console.log(`%cRemoteControlPage [${pageSessionId}]: WebRTCService INSTANTIATED. Setting onRemoteStream callback.`, "color: green;");

    service.setOnRemoteStream((stream) => {
      if (isEffectMounted && videoRef.current) {
        console.log(`%cRemoteControlPage [${pageSessionId}]: <<<>>> setOnRemoteStream CALLBACK EXECUTED <<<>>>`, "color: red; font-size: 1.2em; font-weight: bold;");
        console.log(`%cRemoteControlPage [${pageSessionId}]: Stream object:`, "color: red;", stream);
        setRemoteStream(stream);
        setUserMessage("Video stream primljen. Priprema prikaza...");

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
        console.warn(`%cRemoteControlPage [${pageSessionId}]: setOnRemoteStream callback conditions NOT MET. isEffectMounted: ${isEffectMounted}, videoRef.current: ${!!videoRef.current}`, "color: orange;");
      }
    });

      service.createOffer()
        .then(() => {
          if (isEffectMounted) console.log(`%cRemoteControlPage [${pageSessionId}]: Offer CREATED successfully. Current userMessage: "${userMessage}"`, "color: green;"); //
            setUserMessage("WebRTC ponuda poslana. Čekanje odgovora...");
        })
        .catch(error => {
          if (isEffectMounted) setUserMessage("Greška pri kreiranju WebRTC ponude.");
          console.error(`RemoteControlPage [${pageSessionId}]: Failed to create offer:`, error);
          if (isEffectMounted) closeAndCleanupWebRTC('offer failed');
        });

    const handleWebSocketMessagesForThisSession = (data: any) => {
      if (!isEffectMounted || data.sessionId !== pageSessionId) return; // Only process messages for this page's session

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
      console.log(`%cRemoteControlPage [${pageSessionId}]: Main useEffect CLEANUP.`, "color: blue; font-weight: bold;");
      closeAndCleanupWebRTC();
       if (webRTCServiceRef.current) {
        webRTCServiceRef.current.closeConnection();
        webRTCServiceRef.current = null;
      }
      websocketService.removeControlMessageListener(handleWebSocketMessagesForThisSession);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.search, closeAndCleanupWebRTC, handleKeyDown, handleKeyUp]);

useEffect(() => {
    if (remoteStream && videoRef.current) {
      console.log(`%cRemoteControlPage [${pageSessionId}]: Attaching stored remote stream to video element.`, "color: green;");
      videoRef.current.srcObject = remoteStream;
      setIsStreamActive(true); // Now that srcObject is set, activate the stream display
      setUserMessage("Video stream aktivan.");

      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) { // Check ref again inside async callback
          console.log(`RemoteControlPage [${pageSessionId}]: Video metadata loaded. Original dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          videoRef.current.width = videoRef.current.videoWidth;
          videoRef.current.height = videoRef.current.videoHeight;
        }
      };
    } else if (remoteStream && !videoRef.current) {
        console.warn(`%cRemoteControlPage [${pageSessionId}]: Remote stream exists, but videoRef.current is still null. Waiting for ref.`, "color: orange;");
    }
  }, [remoteStream, pageSessionId]);

useEffect(() => {
    if (!pageSessionId) return;
    if (webRTCServiceRef.current && webRTCServiceRef.current.getSessionId() === pageSessionId) {
        if (!activeSession || activeSession.sessionId !== pageSessionId) {
            if (userMessage !== "Inicijalizacija..." || isStreamActive || remoteStream) { 
                 console.log(`RemoteControlPage [${pageSessionId}]: Context indicates session termination. User message: "${userMessage}". Closing local WebRTC.`);
                 setUserMessage(`Sesija ${pageSessionId} je prekinuta ili više nije aktivna.`);
                 closeAndCleanupWebRTC('context termination');
            }
        }
    } else if (!activeSession && (isStreamActive || remoteStream)) { 
        console.log(`RemoteControlPage [${pageSessionId}]: Global activeSession is null, and stream was active/received. Closing.`);
        setUserMessage(`Sesija ${pageSessionId} je prekinuta globalno.`);
        closeAndCleanupWebRTC('global session null, local stream was present');
    }
  }, [activeSession, pageSessionId, userMessage, isStreamActive, remoteStream, navigate, closeAndCleanupWebRTC]);


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
                <p className="text-gray-700 mt-2">{userMessage || "Nije moguće učitati sesiju. Nedostaju ID uređaja ili sesije u URL-u."}</p>
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
          <p><span className="font-medium">Status:</span> {userMessage}</p>
        </div>

        {isStreamActive && remoteStream ? (
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
            <p className="text-lg font-medium">{userMessage.includes("Greška") || userMessage.includes("prekinuta") ? userMessage : "više nije aktivna"}</p>
            {userMessage.includes("Greška") && (
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
