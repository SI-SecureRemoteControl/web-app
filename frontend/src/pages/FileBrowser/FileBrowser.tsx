// src/pages/FileBrowser.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { websocketService } from '../../services/webSocketService';
import { FolderOpen, FileText, ArrowLeft, Upload, Download } from 'lucide-react';
import axios from 'axios';

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === undefined) return ''; 
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

type FileEntry = {
  name: string;
  type: 'file' | 'folder';
  size?: number;
};

const FileBrowser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse deviceId and sessionId directly from URL only once
  const params = new URLSearchParams(location.search);
  const deviceId = params.get('deviceId') || '';
  const sessionId = params.get('sessionId') || '';
  
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to send browse request
  const requestBrowse = useCallback((path: string) => {
    console.log(`Sending browse_request for path: ${path} (deviceId: ${deviceId}, sessionId: ${sessionId})`);
    setError(null);
    
    if (!deviceId || !sessionId) {
      setError('Missing deviceId or sessionId, cannot browse');
      console.error('Missing deviceId or sessionId, cannot browse');
      return;
    }
    
    const success = websocketService.sendControlMessage({
      type: 'browse_request',
      deviceId,
      sessionId,
      path,
    });
    
    if (!success) {
      setError('Failed to send browse request. Check WebSocket connection.');
      setIsLoading(false);
    }
  }, [deviceId, sessionId]);

  // Initialize component
  useEffect(() => {
    console.log('FileBrowser mounted with deviceId:', deviceId, 'sessionId:', sessionId);
    
    if (!deviceId || !sessionId) {
      console.error('Missing deviceId or sessionId, navigating to dashboard');
      navigate('/dashboard');
      return;
    }
    
    // Reset state when component mounts or URL params change
    setCurrentPath('/');
    setEntries([]);
    setSelectedPaths([]);
    setIsLoading(true);
    setError(null);
    
    // Send initial browse request with a slight delay to ensure WebSocket is ready
    const timer = setTimeout(() => {
      requestBrowse('/');
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [deviceId, sessionId, navigate, requestBrowse]);

  // Set up WebSocket message listener
  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      console.log('Received WebSocket message in FileBrowser:', data);
      
      if (data.type === 'browse_response' && data.sessionId === sessionId && data.deviceId === deviceId) {
        console.log('Handling browse_response:', data);
        setCurrentPath(data.path);
        setEntries(data.entries);
        setIsLoading(false);
      }
      else if (data.type === 'download_response') {
        const { downloadUrl } = data;
        if (downloadUrl) {
          window.open(downloadUrl, '_blank');
        }
      }
      else if (data.type === 'error' && data.sessionId === sessionId) {
        console.error('Received error from server:', data.message);
        setError(data.message || 'An error occurred');
        setIsLoading(false);
      }
    };

    console.log('Adding WebSocket listener for FileBrowser');
    websocketService.addControlMessageListener(handleWebSocketMessage);

    // Check WebSocket connection status
    const connectionStatus = websocketService.getControlConnectionStatus();
    console.log('WebSocket connection status:', connectionStatus);
    
    if (!connectionStatus) {
      console.log('WebSocket not connected, attempting to connect...');
      websocketService.connectControlSocket();
      
      // After connection attempt, retry the browse request
      setTimeout(() => {
        if (websocketService.getControlConnectionStatus()) {
          console.log('WebSocket now connected, retrying browse request');
          requestBrowse('/');
        } else {
          console.error('Failed to connect WebSocket');
          setError('Failed to establish WebSocket connection');
          setIsLoading(false);
        }
      }, 1000);
    }

    return () => {
      console.log('Removing WebSocket listener for FileBrowser');
      websocketService.removeControlMessageListener(handleWebSocketMessage);
    };
  }, [deviceId, sessionId, requestBrowse]);

  const handleFolderClick = (folderName: string) => {
    const newPath = `${currentPath}/${folderName}`.replace('//', '/');
    setIsLoading(true);
    requestBrowse(newPath);
  };

  const handleGoBack = () => {
    if (currentPath === '/') return;
    
    const newPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    setIsLoading(true);
    requestBrowse(newPath);
  };

  const handleBackToRemoteControl = () => {
    navigate(`/remote-control?deviceId=${deviceId}&sessionId=${sessionId}`);
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
      setIsLoading(true);
      const response = await axios.post('https://communicationlayer.railway.app/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200) {
        alert('Files and folders uploaded successfully!');
        requestBrowse(currentPath);
      }
    } catch (error) {
      console.error('Error uploading files or folders:', error);
      alert('Failed to upload files or folders.');
      setIsLoading(false);
    }
  };

  // Enable directory selection for file input
  useEffect(() => {
    const inputElement = document.querySelector('input[type="file"]');
    if (inputElement) {
      inputElement.setAttribute('webkitdirectory', 'true');
      inputElement.setAttribute('directory', 'true');
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

  // Manually retry loading if needed
  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    
    // Check WebSocket connection before retrying
    if (!websocketService.getControlConnectionStatus()) {
      console.log('WebSocket disconnected, reconnecting...');
      websocketService.connectControlSocket();
      
      // Give it a moment to connect before sending the request
      setTimeout(() => {
        requestBrowse(currentPath);
      }, 500);
    } else {
      requestBrowse(currentPath);
    }
  };

  // Log changes to isLoading state
  useEffect(() => {
    console.log('isLoading state changed:', isLoading);
  }, [isLoading]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">File Browser</h1>
          <button
            onClick={handleBackToRemoteControl}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
          >
            <ArrowLeft className="mr-2" size={18} />
            Back to Remote Control
          </button>
        </div>

        <div className="mb-4 flex items-center">
          <p className="text-gray-700 mr-2">Current Path:</p>
          <p className="font-mono bg-gray-100 p-1 rounded">{currentPath}</p>
        </div>
        
        <div className="mb-4 flex gap-2">
          {currentPath !== '/' && (
            <button
              onClick={handleGoBack}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
            >
              <ArrowLeft className="mr-2" size={18} />
              Parent Directory
            </button>
          )}
          
          <button
            onClick={handleRetry}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Refresh Directory
          </button>
        </div>

        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h2 className="font-semibold mb-2">Upload Files</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            <button
              onClick={handleUpload}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center justify-center"
            >
              <Upload className="mr-2" size={18} />
              Upload
            </button>
          </div>
        </div>

        {selectedPaths.length > 0 && (
          <div className="mb-4">
            <button
              onClick={handleDownloadSelected}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
            >
              <Download className="mr-2" size={18} />
              Download {selectedPaths.length} Selected
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
            <button 
              onClick={handleRetry}
              className="mt-2 text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading files...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No files or folders found in this directory.</p>
          </div>
        ) : (
          <ul className="border rounded-lg divide-y">
            {entries.map((entry) => (
              <li
                key={entry.name}
                className="p-3 hover:bg-gray-50 flex items-center"
              >
                <input
                  type="checkbox"
                  onChange={() => handleCheckboxChange(entry.name)}
                  checked={selectedPaths.includes(entry.name)}
                  className="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                {entry.type === 'folder' ? (
                  <FolderOpen className="h-5 w-5 text-yellow-500 mr-2" />
                ) : (
                  <FileText className="h-5 w-5 text-gray-500 mr-2" />
                )}
                <span 
                  className={`flex-1 ${entry.type === 'folder' ? 'cursor-pointer hover:text-indigo-700 font-medium' : ''}`}
                  onClick={() => entry.type === 'folder' && handleFolderClick(entry.name)}
                >
                  {entry.name}
                </span>
                <button
                  onClick={() => handleDownloadSingle(entry.name)}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center"
                >
                  <Download className="mr-1" size={16} />
                  Download
                </button>
                {entry.type === 'file' && entry.size !== undefined && (
                  <span className="text-sm text-gray-400 ml-2 w-24 text-right">
                    {formatFileSize(entry.size)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileBrowser;