import './App.css';
import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
//import Home from './pages/Home/Home.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';

function App() {
    const token = localStorage.getItem('token');

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DeviceDashboard />} />
            </Route>
        </Routes>
    );
}

export default App;