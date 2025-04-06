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
            {/* Ako korisnik nije prijavljen, preusmerava na /login */}
            <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            {/* Zaštićene rute */}
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DeviceDashboard />} />
            </Route>
            {/* Catch-all za nepostojeće rute */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default App;