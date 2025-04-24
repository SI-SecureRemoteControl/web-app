import React, { useState, FormEvent } from 'react';
import { Loader2, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react'; 

const API_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000'; 

interface AdminRegistrationResponse {
    message?: string;
    error?: string;
}

const AdminRegisterForm: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null); 
        setSuccessMessage(null); 
        setIsLoading(true);
    
        if (!username.trim() || !password.trim()) {
            setError('Korisničko ime i lozinka su obavezni.');
            setIsLoading(false);
            return;
        }
    
        const adminData = { username, password };
        const token = localStorage.getItem('token'); 
    
        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(adminData),
            });
    
            const result: AdminRegistrationResponse = await response.json();
    
            if (response.status === 404) {
                setError(result.message || result.error || 'Korisničko ime već postoji.');
                return;
            } else if (response.status === 400) {
                setError(result.message || result.error || 'Moraš unijeti korisničko ime i lozinku.');
            }
    
            if (!response.ok) {
                setError(result.message || result.error || `Greška: ${response.statusText} (${response.status})`);
                return;
            }
    
            setSuccessMessage(result.message || 'Admin uspješno registrovan!');
            setUsername('');
            setPassword('');
    
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Došlo je do nepoznate greške prilikom registracije.');
            }
            console.error('Greška prilikom registracije admina:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterAnother = () => {
        setSuccessMessage(null);
        setError(null);
        setUsername('');
        setPassword('');
    };

    return (
        <div className="max-w-md mx-auto mt-10">
            <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <UserPlus className="w-7 h-7 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-900">Registracija Admina</h1>
                </div>

                {successMessage ? (
                    <div className="space-y-4">
                        <div className="rounded-md bg-green-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <CheckCircle className="h-5 w-5 text-green-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-green-800">{successMessage}</p>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRegisterAnother}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Registruj Novog Admina
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-red-800">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="adminUsername" className="block text-sm font-medium text-gray-700">
                                Korisničko ime
                            </label>
                            <input
                                type="text"
                                id="adminUsername"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                                Lozinka
                            </label>
                            <input
                                type="password"
                                id="adminPassword"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username.trim() || !password.trim()} 
                            className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                isLoading || !username.trim() || !password.trim()
                                    ? 'bg-blue-300 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                                    Registrujem...
                                </>
                            ) : (
                                'Registruj Admina'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AdminRegisterForm;
