import Navbar from "./components/Navbar/Navbar";
import {ConnectionStatus} from "./components/RemoteControl/ConnectionStatus";
import {Outlet} from "react-router-dom";
import {NotificationToast} from "./components/Notifications/NotificationToast";
import {RequestManager} from "./components/RemoteControl/RequestManager";
import { useRemoteControl } from "./contexts/RemoteControlContext";
import { useEffect, useState } from "react";
import axios from "axios";

export interface LayoutProps {
    handleLogout: () => void;
}

export function Layout({handleLogout}: LayoutProps) {
    const { terminateSession, activeSession } = useRemoteControl();
    const [deviceName, setDeviceName] = useState<string | null>(null);

    useEffect(() => {
        if (activeSession?.deviceId) {
            axios.get(`/api/devices/${activeSession.deviceId}`)
                .then(response => setDeviceName(response.data.name))
                .catch(error => console.error("Failed to fetch device name:", error));
        } else {
            setDeviceName(null);
        }
    }, [activeSession?.deviceId]);

    const handleTerminateSession = () => {
        if (activeSession) {
            terminateSession(activeSession.sessionId);
        } else {
            console.error("No active session to terminate.");
        }
    };

    return (
        <>
            <Navbar handleLogout={handleLogout} />
            <div className="fixed top-16 right-4 z-50">
                <ConnectionStatus />
            </div>
            <NotificationToast />
            <RequestManager />
            <main>
                <Outlet/>
            </main>
            {activeSession && (
                <div className="fixed bottom-4 right-4 z-50 bg-white p-4 rounded shadow-lg flex items-center space-x-4">
                    <span className="text-gray-700 font-medium">
                        Connected to: {deviceName || "Loading..."}
                    </span>
                    <button
                        onClick={handleTerminateSession}
                        className="bg-red-500 text-white px-4 py-2 rounded shadow hover:bg-red-600"
                    >
                        Disconnect
                    </button>
                </div>
            )}
        </>
    );
}
