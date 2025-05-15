import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { websocketService } from '../../services/webSocketService';
import { FolderOpen, FileText } from 'lucide-react';
import axios from 'axios';

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
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

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

  useEffect(() => {
    const handleDownloadResponse = (data: any) => {
      if (data.type === 'download_response') {
        const { downloadUrl } = data;
        if (downloadUrl) {
          window.open(downloadUrl, '_blank');
        }
      }
    };

    websocketService.addControlMessageListener(handleDownloadResponse);

    return () => {
      websocketService.removeControlMessageListener(handleDownloadResponse);
    };
  }, []);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(event.target.files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Please select files or folders to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('deviceId', deviceId);
    formData.append('sessionId', sessionId);
    formData.append('path', currentPath);

    Array.from(selectedFiles).forEach((file) => {
      formData.append('files[]', file);
    });

    try {
      const response = await axios.post('https://communicationlayer.railway.app/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200) {
        alert('Files and folders uploaded successfully!');
        websocketService.sendControlMessage({
          type: 'browse_request',
          deviceId,
          sessionId,
          path: currentPath,
        });
      }
    } catch (error) {
      console.error('Error uploading files or folders:', error);
      alert('Failed to upload files or folders.');
    }
  };

  useEffect(() => {
    const inputElement = document.querySelector('input[type="file"]');
    if (inputElement) {
      inputElement.setAttribute('webkitdirectory', 'true');
    }
  }, []);

  const handleCheckboxChange = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleDownloadSelected = () => {
    if (selectedPaths.length === 0) {
      alert('Please select files or folders to download.');
      return;
    }

    const downloadRequest = {
      type: 'download_request',
      deviceId,
      sessionId,
      paths: selectedPaths,
    };

    websocketService.sendControlMessage(downloadRequest);
  };

  const handleDownloadSingle = (path: string) => {
    const downloadRequest = {
      type: 'download_request',
      deviceId,
      sessionId,
      paths: [path],
    };

    websocketService.sendControlMessage(downloadRequest);
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
      <div className="mb-4">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="mb-2"
        />
        <button
          onClick={handleUpload}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Upload
        </button>
      </div>
      {selectedPaths.length > 0 && (
        <button
          onClick={handleDownloadSelected}
          className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Download Selected
        </button>
      )}
      <ul className="border rounded p-4">
        {entries.map((entry) => (
          <li
            key={entry.name}
            className="mb-2 flex items-center space-x-2"
          >
            <input
              type="checkbox"
              onChange={() => handleCheckboxChange(entry.name)}
              className="mr-2"
            />
            {entry.type === 'folder' ? (
              <FolderOpen className="h-5 w-5 text-yellow-500" />
            ) : (
              <FileText className="h-5 w-5 text-gray-500" />
            )}
            <span className="flex-1 cursor-pointer hover:underline" onClick={() => entry.type === 'folder' && handleFolderClick(entry.name)}>
              {entry.name}
            </span>
            <button
              onClick={() => handleDownloadSingle(entry.name)}
              className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
            >
              Download
            </button>
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
