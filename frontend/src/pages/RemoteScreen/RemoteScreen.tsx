// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import WebRTCService from '../../services/webRTCService';
import { websocketService } from '../../services/webSocketService';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRemoteControl } from '../../contexts/RemoteControlContext';

const RemoteControlPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Inicijalizacija...");

  const location = useLocation();
  const navigate = useNavigate();

  const queryParams = new URLSearchParams(location.search);
  const deviceIdFromUrl = queryParams.get('deviceId');
  const pageSessionId = queryParams.get('sessionId'); // The session ID this page is specifically viewing

  const { activeSession } = useRemoteControl(); // Get 

  useEffect(() => {

    if (!pageSessionId || !deviceIdFromUrl) {
      console.warn('RemoteControlPage: Session ID or Device ID not found in URL.');
      setStatusMessage("Greška: Nedostaju ID sesije ili uređaja u URL parametrima.");
      // navigate('/'); // Optionally navigate away
      return;
    }

    console.log(`RemoteControlPage: Setting up WebRTC for session ${pageSessionId}, device ${deviceIdFromUrl}`);
    setStatusMessage(`Povezivanje na sesiju: ${pageSessionId}...`);

    const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
    webRTCServiceRef.current = service;

    service.setOnRemoteStream((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatusMessage("Video stream aktivan.");
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
          setStatusMessage("WebRTC ponuda poslana. Čekanje odgovora...");
          console.log(`RemoteControlPage [${pageSessionId}]: Offer created and sent.`);
        })
        .catch(error => {
          setStatusMessage("Greška pri kreiranju WebRTC ponude.");
          console.error(`RemoteControlPage [${pageSessionId}]: Failed to create offer:`, error);
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
       if (webRTCServiceRef.current) {
        webRTCServiceRef.current.closeConnection();
        webRTCServiceRef.current = null;
      }
      websocketService.removeControlMessageListener(handleWebSocketMessagesForThisSession);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.search]);

  useEffect(() => {
    if (!pageSessionId) return; // This page is not tied to a specific session yet

    // If there's a WebRTC service instance for THIS page
    if (webRTCServiceRef.current) {
      // And the global activeSession is null (meaning no session is active globally)
      // OR the global activeSession's ID does NOT match THIS page's session ID
      if (!activeSession || activeSession.sessionId !== pageSessionId) {
        console.log(`RemoteControlPage [${pageSessionId}]: Context indicates session is no longer active or is different. Closing local WebRTC.`);
        setStatusMessage(`Sesija ${pageSessionId} je prekinuta od strane administratora ili više nije aktivna.`);
        webRTCServiceRef.current.closeConnection(); // Close the local WebRTC connection
      }
    }
  }, [activeSession, pageSessionId, navigate]); // Dependencies

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

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-5xl w-full space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">Daljinski Prikaz Ekrana</h1>
        <div className="text-sm text-gray-600 text-center break-words whitespace-normal">
          {deviceIdFromUrl && <p><span className="font-medium">Device ID:</span> {deviceIdFromUrl}</p>}
          {pageSessionId && <p><span className="font-medium">Session ID:</span> {pageSessionId}</p>}
        </div>
        <div className="flex justify-center">
          <video
            ref={videoRef}
            onClick={handleVideoClick}
            //onKeyDown={handleKeyDown}
            //onKeyUp={handleKeyUp}
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
