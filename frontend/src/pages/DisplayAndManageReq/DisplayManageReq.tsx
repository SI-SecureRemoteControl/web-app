import { RemoteRequestProvider, useRemoteRequests } from '../../contexts/RemoteRequestContext';
import RemoteRequestInbox from '../../components/RemoteReqMod/RemoteRequestInbox';
import {useEffect} from "react";

// Demo component to simulate incoming requests
function DemoRequests() {
    const { addRequest } = useRemoteRequests();

    useEffect(() => {
        // Simulate a new request coming
        const timer = setTimeout(() => {
            addRequest({
                id: 'demo-1',
                deviceName: 'Laptop-XPS-15',
                timestamp: new Date(),
                status: 'pending'
            });
        }, 3000);

        // Simulate another request after 6 seconds
        const timer2 = setTimeout(() => {
            addRequest({
                id: 'demo-2',
                deviceName: 'Desktop-WIN11-Dev',
                timestamp: new Date(),
                status: 'pending'
            });
        }, 6000);

        return () => {
            clearTimeout(timer);
            clearTimeout(timer2);
        };
    }, [addRequest]);

    return null;
}

function DisplayManageReq() {
    return (
        <RemoteRequestProvider>
            <div className="min-h-screen bg-gray-100">
                <nav className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16 items-center">
                            <div className="flex-1">
                                <h1 className="text-xl font-semibold">IT Admin Dashboard</h1>
                            </div>
                            <div>
                                <RemoteRequestInbox />
                            </div>
                        </div>
                    </div>
                </nav>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <p>Demo requests will appear in the inbox after 3 and 6 seconds...</p>
                </main>
            </div>
            <DemoRequests />
        </RemoteRequestProvider>
    );
}

export default DisplayManageReq;