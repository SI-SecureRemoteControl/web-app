import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Device } from '../../components/types/device';
import { Smartphone, Circle } from 'lucide-react';

interface DeviceCardProps {
    device: Device;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device }) => {
    const navigate = useNavigate();

    const getDeviceIcon = () => {
        return <Smartphone className="w-6 h-6" />;
    };

    const formatLastSeen = (dateString?: string) => {
        if (!dateString) return 'unknown';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div
            onClick={() => navigate(`/sessionview/${device.deviceId}`)}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 cursor-pointer"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    <div className="text-gray-600">
                        {getDeviceIcon()}
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
                        <p className="text-sm text-gray-500">{device.deviceId || device._id}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <Circle
                        className={`w-3 h-3 ${
                            device.status === 'active' ? 'text-green-500' : 'text-gray-400'
                        } fill-current`}
                    />
                    <span className="ml-2 text-sm text-gray-600">
                        {device.status === 'active'
                            ? 'Online'
                            : `Last active ${formatLastSeen(device.lastActiveTime)}`}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DeviceCard;
