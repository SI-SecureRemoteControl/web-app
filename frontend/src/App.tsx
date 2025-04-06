import './App.css';
import { Route, Routes } from "react-router-dom";
import Login from "./pages/Login/Login.tsx";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.tsx";
import Registration from "./pages/Registration/Registration.tsx";

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Registration />} />
                <Route path="/registration" element={<Registration />} />
            </Route>
        </Routes>
    );
}

export default App;
