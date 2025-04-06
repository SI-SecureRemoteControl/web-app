import './App.css';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
//import Home from './pages/Home/Home.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';

function App() {

    const token = localStorage.getItem('token'); 

    return (
        <Routes>
            <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <Login />} />
            <Route element={<ProtectedRoute />}>
                <Route index element={<DeviceDashboard />} />
                <Route path="/dashboard" element={<DeviceDashboard />} />
            </Route>
        </Routes>
    );
}

export default App;