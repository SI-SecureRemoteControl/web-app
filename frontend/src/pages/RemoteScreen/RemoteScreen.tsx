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
  const [userMessage, setUserMessage] = useState<string>("Inicijalizacija..."); // For user-facing messages

  const queryParams = new URLSearchParams(location.search);
  const deviceIdFromUrl = queryParams.get('deviceId');
  const pageSessionId = queryParams.get('sessionId'); // The session ID this page is specifically viewing

  const { activeSession } = useRemoteControl(); // Get 

  const closeAndCleanupWebRTC = useCallback(() => {
    if (webRTCServiceRef.current) {
      console.log(`RemoteControlPage [${pageSessionId}]: Closing WebRTC connection explicitly.`);
      webRTCServiceRef.current.closeConnection();
      // webRTCServiceRef.current = null; // Clearing ref here might be too early if other effects depend on it momentarily
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null; // Important: Clear the video source
    }
    setIsStreamActive(false); // Update UI state
  }, [pageSessionId]);

  useEffect(() => {

    if (!pageSessionId || !deviceIdFromUrl) {
      console.warn('RemoteControlPage: Session ID or Device ID not found in URL.');
      setUserMessage("Greška: Nedostaju ID sesije ili uređaja u URL parametrima.");
      setIsStreamActive(false);
      // navigate('/'); // Optionally navigate away
      return;
    }

    console.log(`RemoteControlPage: Setting up WebRTC for session ${pageSessionId}, device ${deviceIdFromUrl}`);
    setUserMessage(`Povezivanje na sesiju: ${pageSessionId}...`);
    setIsStreamActive(false);

    const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
    webRTCServiceRef.current = service;

    service.setOnRemoteStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setUserMessage("Video stream aktivan.");
        setIsStreamActive(true); // Stream is now active
        console.log(`RemoteControlPage [${pageSessionId}]: Remote stream attached.`);

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        if (settings.width && settings.height) {
          videoRef.current.width = settings.width;
          videoRef.current.height = settings.height;
        }

        // Alternativno (ako `settings` ne daje tačne dimenzije odmah), koristi `loadedmetadata`:
        videoRef.current.onloadedmetadata = () => {
          if(videoRef.current){
           videoRef.current!.width = videoRef.current!.videoWidth;
            videoRef.current!.height = videoRef.current!.videoHeight;
          }
        };
      }
    });

      service.createOffer()
        .then(() => {
          setUserMessage("WebRTC ponuda poslana. Čekanje odgovora...");
          console.log(`RemoteControlPage [${pageSessionId}]: Offer created and sent.`);
        })
        .catch(error => {
          setUserMessage("Greška pri kreiranju WebRTC ponude.");
          console.error(`RemoteControlPage [${pageSessionId}]: Failed to create offer:`, error);
          closeAndCleanupWebRTC();
        });

    const handleWebSocketMessagesForThisSession = (data: any) => {
      if (data.sessionId !== pageSessionId) return; // Only process messages for this page's session

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
      console.log(`RemoteControlPage [${pageSessionId}]: Cleaning up WebRTC service and listeners due to unmount or param change.`);
      closeAndCleanupWebRTC();
       if (webRTCServiceRef.current) {
        webRTCServiceRef.current.closeConnection();
        webRTCServiceRef.current = null;
      }
      websocketService.removeControlMessageListener(handleWebSocketMessagesForThisSession);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.search, closeAndCleanupWebRTC]);

useEffect(() => {
    if (!pageSessionId) return;
    if (!activeSession || activeSession.sessionId !== pageSessionId) {
      // Check if a stream was supposed to be active for this page
      if (webRTCServiceRef.current || isStreamActive) { // If service existed or stream was active
        console.log(`RemoteControlPage [${pageSessionId}]: Context indicates session is no longer active or is different. Closing local WebRTC.`);
        setUserMessage(`Sesija ${pageSessionId} je prekinuta ili više nije aktivna.`);
        closeAndCleanupWebRTC(); 
      }
    }
  }, [activeSession, pageSessionId, navigate, closeAndCleanupWebRTC, isStreamActive]); // Added closeAndCleanupWebRTC & isStreamActive


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


  const handleKeyDown = (event: KeyboardEvent) => {
    if (!pageSessionId) {
      return;
    }

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: pageSessionId,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keydown'
      }
    });
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!pageSessionId) {
      return;
    }

    websocketService.sendControlMessage({
      action: 'keyboard',
      deviceId: deviceIdFromUrl,
      sessionId: pageSessionId,
      payload: {
        key: event.key,
        code: event.code,
        type: 'keyup'
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

        {isStreamActive ? (
          <div className="flex justify-center">
            <video
              ref={videoRef}
              onClick={handleVideoClick}
              className="rounded-xl shadow-lg border border-gray-300 cursor-pointer bg-black"
              autoPlay
              playsInline
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-500">
            {/* <VideoOff size={48} className="mb-4" /> */}
            <WifiOff size={48} className="mb-4" />
            <p className="text-lg font-medium">{userMessage.includes("Greška") || userMessage.includes("prekinuta") ? userMessage : "Veza je prekinuta ili se uspostavlja."}</p>
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
