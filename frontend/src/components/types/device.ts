export type DeviceStatus = 'active' | 'inactive' | 'pending';
export type NetworkType = 'wifi' | 'mobileData';

export interface Device {
    _id: string,
    deviceId?: string;
    name: string;
    model?: string;
    os?: string;
    registrationKey: string;
    status?: DeviceStatus;
    networkType?: NetworkType;
    ipAddress?: string;
    lastActiveTime?: string;
    deregistrationKey?: string;
}