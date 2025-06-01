// src/pages/RemoteControlPage.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import WebRTCService from "../../services/webRTCService";
import { websocketService } from "../../services/webSocketService";
import { useLocation, useNavigate } from "react-router-dom";
import { useRemoteControl } from "../../contexts/RemoteControlContext";
import { Wifi, FolderKanban, Loader2 } from "lucide-react";
import { screenRecorder } from "../../services/screenRecorder";
import {useStopwatch} from "react-timer-hook";

const RemoteControlPage: React.FC = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const webRTCServiceRef = useRef<WebRTCService | null>(null);

	const location = useLocation();
	const navigate = useNavigate();

	const queryParams = new URLSearchParams(location.search);
	const deviceIdFromUrl = queryParams.get("deviceId");
	const pageSessionId = queryParams.get("sessionId"); // The session ID this page is specifically viewing
	const { activeSession } = useRemoteControl();
	const [recordingStatus, setRecordingStatus] = useState<string>(
		"Nema aktivnog snimanja."
	);
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const stopwatch = useStopwatch({ autoStart: false});
	const [fileSize, setFileSize] = useState(0);


	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
	const [latency, setLatency] = useState<number | null>(null);

	const cleanupLocalWebRTCResources = useCallback(
		(reason: string) => {
			console.log(
				`%c[${pageSessionId}] cleanupLocalWebRTCResources called. Reason: ${reason}`,
				"color: orange; font-weight: bold;"
			);
			if (webRTCServiceRef.current) {
				webRTCServiceRef.current.closeConnection();
				webRTCServiceRef.current = null; // Ensure ref is cleared after closing
			}
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
		},
		[pageSessionId]
	);

	// States for gesture tracking
	const [isGestureActive, setIsGestureActive] = useState(false);
	const [gestureStartTime, setGestureStartTime] = useState(0);
	const [gestureStartX, setGestureStartX] = useState(0);
	const [gestureStartY, setGestureStartY] = useState(0);

	useEffect(() => {
		screenRecorder.setOnRecordingStatusChange((status) => {
			setRecordingStatus(status);
			setIsRecording(screenRecorder.isRecording());
		});

		if (!pageSessionId || !deviceIdFromUrl) {
			return;
		}
		console.log(
			`%c[${pageSessionId}] MainEffect: START/RE-START. Setting up.`,
			"color: blue;"
		);
		// No need to set remoteStreamState for video display
		const service = new WebRTCService(deviceIdFromUrl, pageSessionId);
		webRTCServiceRef.current = service;
		let isEffectMounted = true;

		service.setOnRemoteStream((stream) => {
			if (isEffectMounted) {
				console.log(
					`%c[${pageSessionId}] MainEffect: <<< onRemoteStream CALLBACK FIRED >>>.`,
					"color: red;"
				);
				setRemoteStream(stream);
				screenRecorder.setStream(stream);
			}
		});

		service.setOnIceDisconnected(() => {
			if (isEffectMounted) {
				console.warn(
					`%c[${pageSessionId}] MainEffect: <<< onIceDisconnected CALLBACK FIRED >>>.`,
					"color: red;"
				);
				cleanupLocalWebRTCResources("ICE disconnected"); // Clean up local resources
				//  setIsLoading(false); // Stop loading on disconnect
			}
		});

		console.log(
			`%c[${pageSessionId}] MainEffect: Calling createOffer().`,
			"color: blue;"
		);
		service
			.createOffer()
			.then(() => {
				if (isEffectMounted) {
					console.log(
						`%c[${pageSessionId}] MainEffect: createOffer() resolved.`,
						"color: blue;"
					);
				}
			})
			.catch((error) => {
				if (isEffectMounted) {
					console.error(
						`[${pageSessionId}] MainEffect: Failed to create offer:`,
						error
					);
					cleanupLocalWebRTCResources("Offer failed");
				}
			});

		const handleWebSocketMessagesForThisSession = (data: any) => {
			if (
				!isEffectMounted ||
				data.sessionId !== pageSessionId ||
				!webRTCServiceRef.current
			)
				return; // Only process messages for this page's session
			if (data.type === "answer") {
				webRTCServiceRef.current?.handleAnswer(data.payload);
			} else if (data.type === "ice-candidate") {
				webRTCServiceRef.current?.addIceCandidate(data.payload);
			}
		};

		websocketService.addControlMessageListener(
			handleWebSocketMessagesForThisSession
		);

		const fetchLatency = async () => {
			if (webRTCServiceRef.current) {
				const latency = await webRTCServiceRef.current.getLatency();
				setLatency(latency);
			} else {
				setLatency(null);
			}
		};
		const latencyInterval = setInterval(fetchLatency, 5000);

		return () => {
			isEffectMounted = false;
			console.log(`%c[${pageSessionId}] MainEffect: CLEANUP.`, "color: blue;");
			cleanupLocalWebRTCResources("main effect unmount/deps change");
			setRemoteStream(null); // Ensure remoteStream is reset on cleanup
			if (videoRef.current) {
				videoRef.current.srcObject = null; // Defensive: always clear video element
			}
			if (webRTCServiceRef.current) {
				webRTCServiceRef.current.closeConnection();
				webRTCServiceRef.current = null;
			}
			websocketService.removeControlMessageListener(
				handleWebSocketMessagesForThisSession
			);
			clearInterval(latencyInterval);
			//setIsLoading(false); // Stop loading on cleanup
			screenRecorder.setStream(null);
			if (screenRecorder.isRecording()) {
				screenRecorder.stopRecording();
			}
		};
	}, [location.search, cleanupLocalWebRTCResources]);

	useEffect(() => {
		const service = webRTCServiceRef.current;
		if (!pageSessionId || !service) return;

		if (!activeSession || activeSession.sessionId !== pageSessionId) {
			cleanupLocalWebRTCResources("context termination");
		}
	}, [activeSession, pageSessionId, cleanupLocalWebRTCResources]);

	// Set up touch-friendly environment and add wheel event listeners
	useEffect(() => {
		// Set touch-friendly styles
		document.body.style.touchAction = "manipulation";
		document.body.style.overscrollBehavior = "contain";

		// Add viewport meta tag for better touch handling
		let viewportMeta = document.querySelector('meta[name="viewport"]');
		if (!viewportMeta) {
			viewportMeta = document.createElement("meta");
			viewportMeta.setAttribute("name", "viewport");
			document.head.appendChild(viewportMeta);
		}
		viewportMeta.setAttribute(
			"content",
			"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
		);

		// Add wheel event listener for trackpad gestures
		if (videoRef.current) {
			videoRef.current.addEventListener("wheel", handleWheelEvent, {
				passive: false,
			});
		}

		// Setup keyboard listeners
		document.addEventListener("keydown", handleDocumentKeyDown);
		document.addEventListener("keyup", handleDocumentKeyUp);

		return () => {
			// Cleanup
			document.body.style.touchAction = "";
			document.body.style.overscrollBehavior = "";

			if (videoRef.current) {
				videoRef.current.removeEventListener("wheel", handleWheelEvent);
			}

			document.removeEventListener("keydown", handleDocumentKeyDown);
			document.removeEventListener("keyup", handleDocumentKeyUp);
		};
	}, [pageSessionId]);

	useEffect(() => {
		// Add global mouse event listeners when the component mounts
		const handleMouseMove = (event: MouseEvent) => {
			if (isGestureActive) {
				event.preventDefault();
				if (videoRef.current && pageSessionId && deviceIdFromUrl) {
					const currentCoords = getRelativeCoordinates(
						event.clientX,
						event.clientY
					);
					const startCoords = getRelativeCoordinates(
						gestureStartX,
						gestureStartY
					);

					const deltaX = event.clientX - gestureStartX;
					const deltaY = event.clientY - gestureStartY;

					if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
						setGestureStartX(event.clientX);
						setGestureStartY(event.clientY);

						websocketService.sendControlMessage({
							action: "swipe",
							deviceId: deviceIdFromUrl,
							sessionId: pageSessionId,
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

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isGestureActive, pageSessionId, deviceIdFromUrl]);

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
		if (!videoRef.current || !pageSessionId || !deviceIdFromUrl) return;

		// Prevent default scrolling behavior
		event.preventDefault();

		// Only process if movement is significant enough
		const threshold = 20; // Adjust based on sensitivity needed

		if (
			Math.abs(event.deltaX) > threshold ||
			Math.abs(event.deltaY) > threshold
		) {
			// Get current cursor position
			const rect = videoRef.current.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;

			// Calculate end position based on wheel deltas
			const scaleMultiplier = 3; // Amplify the gesture
			const endX = centerX + event.deltaX * scaleMultiplier;
			const endY = centerY + event.deltaY * scaleMultiplier;

			// Convert to relative coordinates
			const startCoords = getRelativeCoordinates(centerX, centerY);
			const endCoords = getRelativeCoordinates(endX, endY);

			// Calculate velocity
			const velocity =
				Math.sqrt(event.deltaX * event.deltaX + event.deltaY * event.deltaY) /
				100;

			console.log("Scroll swipe detected:", {
				start: startCoords,
				end: endCoords,
				deltaX: event.deltaX,
				deltaY: event.deltaY,
				velocity,
			});

			// Send swipe event
			websocketService.sendControlMessage({
				action: "swipe",
				deviceId: deviceIdFromUrl,
				sessionId: pageSessionId,
				payload: {
					startX: startCoords.relativeX,
					startY: startCoords.relativeY,
					endX: endCoords.relativeX,
					endY: endCoords.relativeY,
					velocity: velocity,
				},
			});
		}
	};

	// Handle keyboard events
	const handleDocumentKeyDown = (event: KeyboardEvent) => {
		if (!pageSessionId) return;

		websocketService.sendControlMessage({
			action: "keyboard",
			deviceId: deviceIdFromUrl,
			sessionId: pageSessionId,
			payload: {
				key: event.key,
				code: event.code,
				type: "keydown",
				ctrl: event.ctrlKey,
				alt: event.altKey,
				shift: event.shiftKey,
				meta: event.metaKey,
			},
		});
	};

	if (!pageSessionId || !deviceIdFromUrl) {
		return (
			<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
				<div className="bg-white rounded-2xl shadow-lg p-6 text-center">
					<h1 className="text-xl font-bold text-red-600">Greška</h1>
					<p className="text-gray-700 mt-2">
						Nije moguće učitati sesiju. Nedostaju ID uređaja ili sesije u URL-u.
					</p>
				</div>
			</div>
		);
	}
	const handleDocumentKeyUp = (event: KeyboardEvent) => {
		if (!pageSessionId) return;

		websocketService.sendControlMessage({
			action: "keyboard",
			deviceId: deviceIdFromUrl,
			sessionId: pageSessionId,
			payload: {
				key: event.key,
				code: event.code,
				type: "keyup",
				ctrl: event.ctrlKey,
				alt: event.altKey,
				shift: event.shiftKey,
				meta: event.metaKey,
			},
		});
	};

	// Handle video click
	const handleVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
		if (!videoRef.current || !pageSessionId || isGestureActive) return;

		const { relativeX, relativeY } = getRelativeCoordinates(
			event.clientX,
			event.clientY
		);

		websocketService.sendControlMessage({
			action: "mouse_click",
			deviceId: deviceIdFromUrl,
			sessionId: pageSessionId,
			payload: {
				x: relativeX,
				y: relativeY,
				button: "left",
			},
		});
	};

	// Unified gesture handling for both mouse and touch
	const handleGestureStart = (clientX: number, clientY: number) => {
		if (!videoRef.current || !pageSessionId) return;

		setIsGestureActive(true);
		setGestureStartTime(Date.now());
		setGestureStartX(clientX);
		setGestureStartY(clientY);
	};

	const handleGestureEnd = (clientX: number, clientY: number) => {
		if (!isGestureActive || !videoRef.current || !pageSessionId) {
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
				action: "mouse_click",
				deviceId: deviceIdFromUrl,
				sessionId: pageSessionId,
				payload: {
					x: relativeX,
					y: relativeY,
					button: "left",
				},
			});
		} else {
			// Handle as a swipe
			const startCoords = getRelativeCoordinates(gestureStartX, gestureStartY);
			const endCoords = getRelativeCoordinates(clientX, clientY);

			// Calculate velocity
			const velocity = distance / Math.max(duration, 1);

			console.log("Swipe detected:", {
				start: startCoords,
				end: endCoords,
				distance,
				duration,
				velocity,
			});

			websocketService.sendControlMessage({
				action: "swipe",
				deviceId: deviceIdFromUrl,
				sessionId: pageSessionId,
				payload: {
					startX: startCoords.relativeX,
					startY: startCoords.relativeY,
					endX: endCoords.relativeX,
					endY: endCoords.relativeY,
					velocity: velocity,
				},
			});
		}

		setIsGestureActive(false);
	};

	// Mouse event handlers
	const handleMouseDown = (event: React.MouseEvent<HTMLVideoElement>) => {
		if (event.button === 0) {
			// Left mouse button
			handleGestureStart(event.clientX, event.clientY);
		}

		// Add event listeners for mouse move and mouse up immediately
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		// Prevent default behavior to avoid issues
		event.preventDefault();
	};

	const handleMouseMove = (event: MouseEvent) => {
		if (isGestureActive) {
			event.preventDefault();

			// Ako je srednji klik aktivan, pošaljite swipe informacije u realnom vremenu
			if (videoRef.current && pageSessionId && deviceIdFromUrl) {
				const currentCoords = getRelativeCoordinates(
					event.clientX,
					event.clientY
				);
				const startCoords = getRelativeCoordinates(
					gestureStartX,
					gestureStartY
				);

				// Izračunajte razliku između početne i trenutne pozicije
				const deltaX = event.clientX - gestureStartX;
				const deltaY = event.clientY - gestureStartY;

				// Ako je pomak dovoljno velik, pošaljite swipe poruku
				if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
					// Resetirajte početnu poziciju za kontinuirani swipe
					setGestureStartX(event.clientX);
					setGestureStartY(event.clientY);

					websocketService.sendControlMessage({
						action: "swipe",
						deviceId: deviceIdFromUrl,
						sessionId: pageSessionId,
						payload: {
							startX: startCoords.relativeX,
							startY: startCoords.relativeY,
							endX: currentCoords.relativeX,
							endY: currentCoords.relativeY,
							velocity: 0.5, // Možete prilagoditi brzinu prema potrebi
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

		// Cleanup event listeners immediately
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
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

	// Assign remoteStream to video element when it changes
	// ne znam neki fazon begi da ne bude crn ekran
	useEffect(() => {
		if (videoRef.current && remoteStream) {
			videoRef.current.srcObject = remoteStream;
		}
	}, [remoteStream]);

	const getLatencyStatus = () => {
		if (latency === null) return { color: "gray", label: "N/A" };
		if (latency < 100) return { color: "green", label: "Good" };
		if (latency < 300) return { color: "red", label: "Bad" };
		return { color: "red", label: "Ultra Bad" };
	};

	const handleGoToFileBrowser = () => {
		if (pageSessionId && deviceIdFromUrl) {
			handleStopRecordingClick();
			console.log(
				`Navigating to File Browser for session: ${pageSessionId}, device: ${deviceIdFromUrl}`
			);
			navigate(
				`/file-browser?deviceId=${deviceIdFromUrl}&sessionId=${pageSessionId}`
			);
		} else {
			console.error(
				"Cannot navigate to file browser: missing deviceId or sessionId"
			);
		}
	};

	const handleStartRecordingClick = () => {
		stopwatch.start();
		screenRecorder.startRecording();
		setIsRecording(true);
		const recordingStart = {
			type: "recording_start",
			deviceId: deviceIdFromUrl,
			sessionId: pageSessionId
		}
		websocketService.sendControlMessage(recordingStart);
	};

	const handleStopRecordingClick = () => {
		stopwatch.pause();
		stopwatch.reset();
		screenRecorder.stopRecording();
		setIsRecording(false);
		const recordingStop = {
			type: "recording_stop",
			deviceId: deviceIdFromUrl,
			sessionId: pageSessionId
		}
		websocketService.sendControlMessage(recordingStop);
	};

	const latencyStatus = getLatencyStatus();

	screenRecorder.setOnFileSizeUpdate((size) => {
		setFileSize(size);
	})

	return (
		<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
			<div className="bg-white rounded-2xl shadow-lg p-6 max-w-5xl w-full space-y-4">
				<h1 className="text-2xl font-bold text-center text-gray-800">
					Remote Screen Display
				</h1>
				<div className="text-sm text-gray-600 text-center break-words whitespace-normal">
					<p>
						<span className="font-medium">Device ID:</span> {deviceIdFromUrl}
					</p>
					<p>
						<span className="font-medium">Session ID:</span> {pageSessionId}
					</p>
					<p className="flex items-center justify-center">
						<Wifi
							className={`text-${latencyStatus.color}-500 mr-2`}
							size={16}
						/>
						<span className="font-medium">Latency:</span>{" "}
						{latency !== null ? `${latency.toFixed(2)} ms` : "N/A"} (
						{latencyStatus.label})
					</p>
				</div>

				{(activeSession &&
					activeSession.sessionId === pageSessionId &&
					activeSession.status === "connected") ||
				remoteStream ? (
					<div className="text-center my-4">
						<button
							onClick={handleGoToFileBrowser}
							className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center justify-center mx-auto"
						>
							<FolderKanban size={20} className="mr-2" />
							Open File Browser
						</button>
					</div>
				) : null}

				<div className="flex justify-center mt-4 space-x-4">
					<button
						id="startRecordingBtn"
						onClick={handleStartRecordingClick}
						disabled={isRecording || !remoteStream}
						className={`px-4 py-2 rounded-lg font-medium text-white ${
							isRecording
								? "bg-gray-400 cursor-not-allowed"
								: "bg-blue-500 hover:bg-blue-600"
						}`}
					>
						{isRecording ? "Snimanje u toku..." : "Start Recording"}
					</button>
					<button
						id="stopRecordingBtn"
						onClick={handleStopRecordingClick}
						disabled={!isRecording}
						className={`px-4 py-2 rounded-lg font-medium text-white ${
							!isRecording
								? "bg-gray-400 cursor-not-allowed"
								: "bg-red-500 hover:bg-red-600"
						}`}
					>
						Stop Recording
					</button>
				</div>
				<p
					id="recordingStatus"
					className="text-sm text-gray-600 text-center mt-2"
				>
					{isRecording && "🔴 RECORDING"} 
					<br />
					{recordingStatus}
					<br />
					{stopwatch.hours + ":" + stopwatch.minutes + ":" + stopwatch.seconds}
					<br />
					{"Current file size: " + fileSize + " KB"}
				</p>

				{/* Kontejner za video ili loading ekran */}
				<div className="flex justify-center">
					{remoteStream ? (
						// Prikaz videa kada je stream aktivan
						<video
							ref={videoRef}
							onClick={handleVideoClick}
							onMouseDown={handleMouseDown}
							onTouchStart={handleTouchStart}
							onTouchMove={handleTouchMove}
							onTouchEnd={handleTouchEnd}
							tabIndex={0}
							className="rounded-xl shadow-lg border border-gray-300 cursor-pointer bg-black"
							autoPlay
							playsInline
							muted
							style={{
								display: "block",
								maxWidth: "100%",
								height: "auto",
								touchAction: "manipulation",
								pointerEvents: "auto",
								userSelect: "none",
								WebkitUserSelect: "none",
								//WebkitTapHighlightColor: "rgba(0,0,0,0)",
								outline: "none",
								cursor: "pointer",
							}}
						/>
					) : (
						<div
							className="flex flex-col items-center justify-center bg-white text-gray-800 rounded-xl shadow-lg border border-gray-300"
							style={{ width: "100%", maxWidth: "896px", aspectRatio: "16/9" }}
						>
							<Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
							<p className="text-lg font-medium">Waiting for remote screen...</p>
							<p className="text-sm text-gray-600 mt-2">
								Connecting to the device...
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default RemoteControlPage;
