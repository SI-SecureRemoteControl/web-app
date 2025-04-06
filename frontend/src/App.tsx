import './App.css';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
import Home from './pages/Home/Home.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';
import { useEffect } from 'react';

function App() {
    const navigate = useNavigate();
    useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
        navigate('/dashboard');
    } else {
        navigate('/login');
    }
    }, [navigate]);
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home />} />
            </Route>
            <Route path="/dashboard" element={<DeviceDashboard />} />
        </Routes>
    );
}

export default App;