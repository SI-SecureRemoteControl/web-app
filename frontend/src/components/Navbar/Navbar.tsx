import { Link } from 'react-router-dom';

export interface navbarProps {
    handleLogout: () => void;
}

const Navbar = ({handleLogout}: navbarProps) => {

    return (
        <nav className="bg-gray-800 text-white px-6 py-4 shadow-md">
            <div className="flex justify-between items-center max-w-7xl mx-auto">
                <div className="flex space-x-6">
                    <Link to="/dashboard" className="hover:text-gray-300 transition">Dashboard</Link>
                    <Link to="/registration" className="hover:text-gray-300 transition">Device Registration</Link>
                    <Link to="/sessionview" className="hover:text-gray-300 transition">Sessions View</Link>
                </div>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 transition px-4 py-2 rounded text-sm"
                >
                    Logout
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
