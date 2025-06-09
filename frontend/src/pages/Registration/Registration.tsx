// src/pages/Registration/Registration.tsx

import React, { useState } from 'react';
import { Smartphone, Loader2, ClipboardCopy, CheckCircle } from 'lucide-react';

interface RegistrationResponse {
    registrationKey: string;
    deviceId: string;
}

const Registration = () => {
    const [deviceName, setDeviceName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [registrationData, setRegistrationData] = useState<RegistrationResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const url: string = import.meta.env.VITE_BASE_URL + '/devices/registration';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ deviceName }),
            });

            if (!response.ok) {
                throw new Error('Registration failed');
            }

            const data = await response.json();
            setRegistrationData(data);
        } catch (error) {
            console.error('Error registering device:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (registrationData?.registrationKey) {
            await navigator.clipboard.writeText(registrationData.registrationKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center space-x-3 mb-8">
                        <Smartphone className="w-8 h-8 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Device Registration</h1>
                    </div>

                    {!registrationData ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700">
                                    Device Name
                                </label>
                                <input
                                    type="text"
                                    id="deviceName"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Enter device name"
                                    required
                                />
                                <p className="mt-2 text-sm text-gray-500">
                                    Enter a descriptive name for the Android device
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !deviceName.trim()}
                                className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                    isLoading || !deviceName.trim()
                                        ? 'bg-blue-300 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                        Registering...
                                    </>
                                ) : (
                                    'Register Device'
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="rounded-md bg-green-50 p-4">
                                <div className="flex">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-green-800">
                                            Device registered successfully
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Device Name</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={deviceName}
                                        className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Registration Key</label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <input
                                            type="text"
                                            readOnly
                                            value={registrationData.registrationKey}
                                            className="block w-full rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={copyToClipboard}
                                            className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 hover:bg-gray-100"
                                        >
                                            {copied ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <ClipboardCopy className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setRegistrationData(null);
                                    setDeviceName('');
                                }}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                                Register Another Device
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Registration;
