import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { websocketService } from '../../services/webSocketService';
import { FolderOpen, FileText } from 'lucide-react';

type FileEntry = {
  name: string;
  type: 'file' | 'folder';
  size?: number;
};

type BrowseResponse = {
  type: 'browse_response';
  deviceId: string;
  sessionId: string;
  path: string;
  entries: FileEntry[];
};

const FileBrowser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deviceIdParam = params.get('deviceId');
    const sessionIdParam = params.get('sessionId');

    if (deviceIdParam && sessionIdParam) {
      setDeviceId(deviceIdParam);
      setSessionId(sessionIdParam);

      websocketService.sendControlMessage({
        type: 'browse_request',
        deviceId: deviceIdParam,
        sessionId: sessionIdParam,
        path: '/'
      });
    } else {
      navigate('/dashboard');
    }
  }, [location, navigate]);

  useEffect(() => {
    const handleBrowseResponse = (data: BrowseResponse) => {
      if (data.type === 'browse_response' && data.deviceId === deviceId && data.sessionId === sessionId) {
        setCurrentPath(data.path);
        setEntries(data.entries);
      }
    };

    websocketService.addControlMessageListener(handleBrowseResponse);

    return () => {
      websocketService.removeControlMessageListener(handleBrowseResponse);
    };
  }, [deviceId, sessionId]);

  const handleFolderClick = (folderName: string) => {
    const newPath = `${currentPath}/${folderName}`.replace('//', '/');
    websocketService.sendControlMessage({
      type: 'browse_request',
      deviceId,
      sessionId,
      path: newPath
    });
  };

  const handleGoBack = () => {
    if (currentPath === '/') return;
    const newPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    websocketService.sendControlMessage({
      type: 'browse_request',
      deviceId,
      sessionId,
      path: newPath
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">File Browser</h1>
      {currentPath !== '/' && (
        <button
          onClick={handleGoBack}
          className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Back
        </button>
      )}
      <p className="mb-4">Current Path: {currentPath}</p>
      <ul className="border rounded p-4">
        {entries.map((entry) => (
          <li
            key={entry.name}
            className="mb-2 cursor-pointer hover:underline flex items-center space-x-2"
            onClick={() => entry.type === 'folder' && handleFolderClick(entry.name)}
          >
            {entry.type === 'folder' ? (
              <FolderOpen className="h-5 w-5 text-yellow-500" />
            ) : (
              <FileText className="h-5 w-5 text-gray-500" />
            )}
            <span>{entry.name}</span>
            {entry.type === 'file' && entry.size && (
              <span className="text-sm text-gray-400">({entry.size} bytes)</span>
            )}
          </li>
        ))}
      </ul>

    </div>
  );
};

export default FileBrowser;
