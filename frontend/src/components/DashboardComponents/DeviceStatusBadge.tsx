import React from 'react';
import { DeviceStatus } from '../types/device';

interface DeviceStatusBadgeProps {
    status: DeviceStatus;
}

const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-red-100 text-red-800',
};

export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({ status }) => {
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
      {status}
    </span>
    );
};