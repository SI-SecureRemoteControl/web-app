import { Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';
import Registration from "./pages/Registration/Registration.tsx";
import Home from "./pages/Home/Home.tsx";
import Navbar from "./components/Navbar/Navbar.tsx";
import { RemoteControlProvider } from './contexts/RemoteControlContext.tsx';
import { NotificationToast } from './components/Notifications/NotificationToast.tsx';
import { RequestManager } from './components/RemoteControl/RequestManager.tsx';
import RemoteControlPage from './pages/RemoteScreen/RemoteScreen.tsx'; // Import the new component
import { ConnectionStatus } from './components/RemoteControl/ConnectionStatus.tsx';

function App() {
    const location = useLocation();
    const isAuthenticated = !!localStorage.getItem('token');

    const hideNavbarOnRoutes = ['/login'];
    const shouldShowNavbar = isAuthenticated && !hideNavbarOnRoutes.includes(location.pathname);

    return (
        <RemoteControlProvider>
            {shouldShowNavbar && (
                <>
                    <Navbar />
                    <div className="fixed top-16 right-4 z-50">
                        <ConnectionStatus />
                    </div>
                </>
            )}
            <NotificationToast />
            {isAuthenticated && <RequestManager />}

            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<DeviceDashboard />} />
                    <Route path="/registration" element={<Registration />} />
                    <Route path="/remote-control" element={<RemoteControlPage />} /> 
                </Route>
            </Routes>
        </RemoteControlProvider>
    );
}


export default App;
