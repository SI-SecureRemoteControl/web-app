import './App.css';
import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login/Login.tsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.tsx';
import DeviceDashboard from './pages/Dashboard/DashboardPage.tsx';
import Registration from "./pages/Registration/Registration.tsx";
import Home from "./pages/Home/Home.tsx";

function App() {

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home/>}/>
                <Route path="/dashboard" element={<DeviceDashboard />} />
                <Route path="/registration" element={<Registration />} />
            </Route>
        </Routes>
    );
}

export default App;
