import {Route, Routes, useNavigate} from 'react-router-dom';
import Login, {LoginResponse} from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';
import Registration from "./pages/Registration/Registration.tsx";
import Home from "./pages/Home/Home.tsx";
import { RemoteControlProvider } from './contexts/RemoteControlContext.tsx';
import {Layout} from "./Layout";
import {useState} from "react";
import {UserContext} from "./contexts/UserContext";
import {User} from "./components/types/user";
import RemoteControlPage from './pages/RemoteScreen/RemoteScreen.tsx';
import SessionViewer from "./pages/Sessions/SessionViewer.tsx";
import { useParams } from 'react-router-dom';
import DeviceList from "./pages/Devices/DeviceList.tsx";
import RegisterUser from "./pages/Registration/RegisterUser.tsx";


function App() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const navigate = useNavigate();

    function handleLogin(loginResponse: LoginResponse) {
        setCurrentUser(loginResponse.user);
        localStorage.setItem("token", loginResponse.token);
        localStorage.setItem("user", JSON.stringify(loginResponse.user));
        navigate("/");
    }

    function handleLogout() {
        setCurrentUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    }

    return (
        <UserContext.Provider value={currentUser}>
            <RemoteControlProvider>
                <Routes>
                    <Route path="/login" element={<Login handleLogin={handleLogin}/>} />
                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout handleLogout={handleLogout}/>}>
                            <Route path="/" element={<Home />} />
                            <Route path="/dashboard" element={<DeviceDashboard />} />
                            <Route path="/registration" element={<Registration />} />
                            <Route path="/sessionview/:deviceId" element={<SessionViewerWrapper />} />
                            <Route path="/sessionview" element={<DeviceList />} />
                            <Route path="/remote-control" element={<RemoteControlPage />} />
                            <Route path="/register-user" element={<RegisterUser />} />
                        </Route>
                    </Route>
                </Routes>
            </RemoteControlProvider>
        </UserContext.Provider>
    );
}


const SessionViewerWrapper = () => {
    const { deviceId } = useParams<{ deviceId: string }>();
    console.log('Device ID:', deviceId);

    if (!deviceId) {
        return <div>Device ID nije pronađen.</div>;
    }

    return <SessionViewer deviceId={deviceId} />;
};
export default App;
