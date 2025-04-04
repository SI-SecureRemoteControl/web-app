import {Outlet, useNavigate} from "react-router-dom";
import {useEffect} from "react";

export default function ProtectedRoute() {
    const token : string | null = localStorage.getItem("token");
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            navigate("/login");
        }
    })

    return <Outlet/>;
}