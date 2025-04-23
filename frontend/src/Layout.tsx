import Navbar from "./components/Navbar/Navbar";
import {ConnectionStatus} from "./components/RemoteControl/ConnectionStatus";
import {Outlet} from "react-router-dom";
import {NotificationToast} from "./components/Notifications/NotificationToast";
import {RequestManager} from "./components/RemoteControl/RequestManager";

export interface LayoutProps {
    handleLogout: () => void;
}

export function Layout({handleLogout}: LayoutProps) {
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
        </>
    )
}
