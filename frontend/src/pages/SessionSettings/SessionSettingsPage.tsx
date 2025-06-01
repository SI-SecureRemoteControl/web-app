// src/pages/SessionSettingsPage.tsx
import React, {useState, useEffect} from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export interface SessionConfig {
    maxSessionDuration: number;
    inactiveTimeout: number;
}
 
const SessionSettingsPage: React.FC = () => {

    const durationOptions = [5, 15, 30, 60, 120];
    const timeoutOptions = [3, 5, 10, 15, 20];

    const [maxSessionDuration, setMaxSessionDuration] = useState<number>(durationOptions[2] * 60);
    const [inactiveTimeout, setInactiveTimeout] = useState<number>(timeoutOptions[1] * 60);       
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetching, setIsFetching] = useState<boolean>(true);

    const fetchConfig = async () => {
        setIsFetching(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.COMM_LAYER_API_URL}/get-config`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if(!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch config: ${response.statusText}`);
            }

            const config: SessionConfig = await response.json();
            if(config.maxSessionDuration) {
                setMaxSessionDuration(config.maxSessionDuration);
            }
            if(config.inactiveTimeout) {
                setInactiveTimeout(config.inactiveTimeout);
            }
        } catch (error: any) {
            console.error('Error fetching config: ', error);
            toast.error(error.message || 'Could not load current configuration');
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSaveSettings = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);

        const settingsToSave: SessionConfig = {
            maxSessionDuration: Number(maxSessionDuration),
            inactiveTimeout: Number(inactiveTimeout),
        };
        
        try{
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.COMM_LAYER_API_URL || 'http://localhost:5000'}/update-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(settingsToSave),
            });

            if(!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to save settings: ${response.statusText}`);
            }

            const result = await response.json();
            toast.success(result.message || 'Settings updated successfully!');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast.error(error.message || 'Could not save settings.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-semibold mb-4">Session Settings</h1>
                <p>Loading configuration...</p>
            </div>
        );
    }
    return (
        <div className="p-6 max-w-lg mx-auto">
            <ToastContainer position="top-right" autoClose={3000} />
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Session Settings</h1>
            <form onSubmit={handleSaveSettings} className="space-y-6 bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                <div>
                    <label htmlFor="maxSessionDuration" className="block text-sm font-medium text-gray-700 mb-1">
                        Global Session Duration (minutes)
                    </label>
                    <select
                        id="maxSessionDuration"
                        value={maxSessionDuration / 60} // Convert seconds to minutes for display
                        onChange={(e) => setMaxSessionDuration(Number(e.target.value) * 60)} // Convert minutes to seconds for state
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isLoading}
                    >
                        {durationOptions.map(option => (
                            <option key={option} value={option}>
                                {option} minutes
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="inactiveTimeout" className="block text-sm font-medium text-gray-700 mb-1">
                        Inactive Timeout (minutes)
                    </label>
                    <select
                        id="inactiveTimeout"
                        value={inactiveTimeout / 60} // Convert seconds to minutes for display
                        onChange={(e) => setInactiveTimeout(Number(e.target.value) * 60)} // Convert minutes to seconds for state
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isLoading}
                    >
                        {timeoutOptions.map(option => (
                            <option key={option} value={option}>
                                {option} minutes
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <button
                        type="submit"
                        className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SessionSettingsPage;
