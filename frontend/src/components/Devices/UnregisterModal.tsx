import React from 'react';
import { X } from 'lucide-react';

interface UnregisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    unregisterKey: string;
}

export const UnregisterModal: React.FC<UnregisterModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    unregisterKey,
                                                                }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Device Unregistration Key</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                    <p className="font-mono text-center break-all">{unregisterKey}</p>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    Please save this key. You'll need it to unregister the device.
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};