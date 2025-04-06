export type DeviceStatus = 'active' | 'inactive' | 'pending';
export type NetworkType = 'wifi' | 'mobileData';

export interface Device {
    id?: string;
    name: string;
    model?: string;
    os?: string;
    registrationKey: string;
    status?: DeviceStatus;
    networkType?: NetworkType;
    ipAddress?: string;
    lastActive?: string;
    deregistrationKey?: string;
}