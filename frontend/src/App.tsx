import { Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
import DisplayManageReq from './pages/DisplayAndManageReq/DisplayManageReq.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';
import Registration from "./pages/Registration/Registration.tsx";
import Home from "./pages/Home/Home.tsx";
import Navbar from "./components/Navbar/Navbar.tsx"

function App() {
    const location = useLocation();
    const isAuthenticated = !!localStorage.getItem('token');

    const hideNavbarOnRoutes = ['/login'];
    const shouldShowNavbar = isAuthenticated && !hideNavbarOnRoutes.includes(location.pathname);

    return (
        <>
            {shouldShowNavbar && <Navbar />}

            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/dashboard" element={<DeviceDashboard />} />
                    <Route path="/registration" element={<Registration />} />
                </Route>
                <Route path="/remotecontrol" element={<DisplayManageReq />} />
            </Routes>
        </>
    );
}

export default App;
