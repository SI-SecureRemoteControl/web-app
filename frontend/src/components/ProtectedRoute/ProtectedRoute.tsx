import { Outlet, Navigate } from "react-router-dom";

export default function ProtectedRoute() {
    const token: string | null = localStorage.getItem("token");

    if (!token) {
        return <Navigate to="/login" />;
    }

    return <Outlet />;
}