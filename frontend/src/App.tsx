import './App.css';
import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
//import Home from './pages/Home/Home.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';

function App() {

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DeviceDashboard />} />
                <Route path="/dashboard" element={<DeviceDashboard />} />
            </Route>
        </Routes>
    );
}

export default App;