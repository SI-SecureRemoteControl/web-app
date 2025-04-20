export interface SessionLog {
    id: string;
    deviceId: string;
    startTime: string;
    endTime: string;
    duration: string;
    adminId: string;
    actions?: SessionAction[];
}

export interface SessionAction {
    id: string;
    timestamp: string;
    action: string;
    details?: string;
}

export interface DateRange {
    startDate: string;
    endDate: string;
}

export interface FilterOptions {
    dateRange?: DateRange;
    adminId?: string;
}

export interface PaginationOptions {
    page: number;
    pageSize: number;
    totalPages: number;
}