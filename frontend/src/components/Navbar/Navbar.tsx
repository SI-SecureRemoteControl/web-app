import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

export interface navbarProps {
    handleLogout: () => void;
}

const Navbar = ({ handleLogout }: navbarProps) => {
    const token = localStorage.getItem('token'); 
    let username = '';
    if (token) {
        const decoded: any = jwtDecode(token); 
        username = decoded?.username; 
    }
    return (
        <nav className="bg-gray-800 text-white px-6 py-4 shadow-md">
            <div className="flex justify-between items-center max-w-7xl mx-auto">
                <div className="flex space-x-6">
                    <Link to="/dashboard" className="hover:text-gray-300 transition">Dashboard</Link>
                    <Link to="/registration" className="hover:text-gray-300 transition">Device Registration</Link>
                    <Link to="/sessionview" className="hover:text-gray-300 transition">Sessions View</Link>
                    <Link to="/register-user" className="hover:text-gray-300 transition">Register Admin</Link>
                    <Link to="/session-settings" className="hover:text-gray-300 transition">Session Settings</Link>
                </div>

                <div className="ml-auto flex items-center space-x-2"> 
                    {username && (
                        <div className="text-sm text-gray-300">
                            Logged in as {username}
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 transition px-4 py-2 rounded text-sm flex items-center"
                    >
                        <LogOut className="mr-2 h-5 w-5" /> 
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
