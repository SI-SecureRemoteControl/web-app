import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { websocketService, registerFileBrowserListener } from '../../services/webSocketService';
import { FolderOpen, FileText, ArrowLeft, Upload, Download, RefreshCw } from 'lucide-react';
import axios from 'axios';
import JSZip from "jszip";

const uploadUrl = import.meta.env.VITE_API_UPLOAD_URL;

function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes === undefined || isNaN(bytes)) return '';

  const k = 1000;
  //bilo k=1024
  //da bude exact like android treba k=1000 ??
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(decimals)} ${sizes[i]}`;
}


type FileEntry = {
  name: string;
  type: 'file' | 'folder';
  size?: number;
};

const FileBrowser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const deviceId = params.get('deviceId') || '';
  const sessionId = params.get('sessionId') || '';

  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'files' | 'folder'>('files');

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
      console.log('setIsLoading(false) called.');
    }
  }, [deviceId, sessionId]);

  useEffect(() => {
    console.log('FileBrowser mounted with deviceId:', deviceId, 'sessionId:', sessionId);

    if (!deviceId || !sessionId) {
      console.error('Missing deviceId or sessionId, navigating to dashboard');
      navigate('/dashboard');
      return;
    }

    setCurrentPath('/');
    setEntries([]);
    setSelectedPaths([]);
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      requestBrowse('/');
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [deviceId, sessionId, navigate, requestBrowse]);

  useEffect(() => {
    const handleWebSocketMessage = (data: any) => {
      console.log('Received WebSocket message in FileBrowser:', data);

      if (data.type === 'browse_response') {
        console.log('browse_response received:', data);
        if (data.sessionId === sessionId && data.deviceId === deviceId) {
          console.log('browse_response matches sessionId and deviceId. Updating state.');
          setCurrentPath(data.path);
          setEntries(data.entries);
          setIsLoading(false);
        } else {
          console.warn('browse_response does not match sessionId or deviceId:', {
            expectedSessionId: sessionId,
            expectedDeviceId: deviceId,
            receivedSessionId: data.sessionId,
            receivedDeviceId: data.deviceId
          });
        }
      } else if (data.type === 'download_response') {
        const { downloadUrl } = data;
        if (downloadUrl) {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_self'; 
          link.download = downloadUrl.split('/').pop(); 
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else if (data.type === 'upload_status') {
        if (data.deviceId === deviceId && data.sessionId === sessionId) {
          const notificationMessage = data.status === 'success' ? data.message || 'Upload successful!' : data.message || 'Upload failed.';
          alert(notificationMessage);
          if (data.status === 'success') {
            requestBrowse(data.path);
          }
        }
      } else if (data.type === 'error' && data.sessionId === sessionId) {
        console.error('Received error from server:', data.message);
        setError(data.message || 'An error occurred');
        setIsLoading(false);
      }
    };

    registerFileBrowserListener(handleWebSocketMessage);
    console.log('FileBrowser WebSocket listener registered.');

    return () => {
      registerFileBrowserListener(() => { });
      console.log('FileBrowser WebSocket listener unregistered.');
    };
  }, [deviceId, sessionId]);

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
    window.location.reload();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(event.target.files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Please select files or a folder to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('deviceId', deviceId);
    formData.append('sessionId', sessionId);
    formData.append('path', currentPath);
    formData.append('uploadType', uploadMode);

    if (uploadMode === "folder") {
      const folderName = selectedFiles[0].webkitRelativePath.split("/")[0];
      const zip = new JSZip();

      const name = generateRandomFolderName();
      const parentFolder = zip.folder(name);

      const folder = parentFolder?.folder(folderName);

      Array.from(selectedFiles).forEach((file) => {
        const relativePath = file.webkitRelativePath.split("/").slice(1).join("/");
        folder?.file(relativePath, file);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      formData.append("files[]", zipBlob, name);
    } else {
      Array.from(selectedFiles).forEach((file) => {
        formData.append("files[]", file);
      });
    }
    try {
      setIsLoading(true);
      const response = await axios.post(uploadUrl, formData, {
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
    } finally {
      const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  const handleToggleUploadMode = () => {
    setUploadMode((prevMode) => (prevMode === 'files' ? 'folder' : 'files'));
  };

  useEffect(() => {
    const inputElement = document.querySelector('input[type="file"]');
    if (inputElement) {
      if (uploadMode === 'folder') {
        inputElement.setAttribute('webkitdirectory', 'true');
        inputElement.setAttribute('directory', 'true');
        inputElement.removeAttribute('multiple');
      } else {
        inputElement.removeAttribute('webkitdirectory');
        inputElement.removeAttribute('directory');
        inputElement.setAttribute('multiple', 'true');
      }
    }
  }, [uploadMode]);

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

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);

    if (!websocketService.getControlConnectionStatus()) {
      console.log('WebSocket disconnected, reconnecting...');
      websocketService.connectControlSocket();

      setTimeout(() => {
        requestBrowse(currentPath);
      }, 500);
    } else {
      requestBrowse(currentPath);
    }
  };

   /*useEffect(() => {
     handleRetry();
   }, [currentPath, entries]);*/

  useEffect(() => {
    console.log('isLoading state changed:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    console.log('FileBrowser component mounted');
    return () => {
      console.log('FileBrowser component unmounted');
    };
  }, []);

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'folder' ? -1 : 1;
  });

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
              <ArrowLeft className="mr-2" size={20} />
              
            </button>
          )}
          <button
            onClick={handleRetry}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
          >
            <RefreshCw className="mr-2" size={20} /> 
                     
            </button>
        </div>

        <div className="mb-4 flex items-center">
          <button
            onClick={handleToggleUploadMode}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
          >
            Toggle Upload Mode: {uploadMode === 'files' ? 'Files' : 'Folder'}
          </button>
        </div>

        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h2 className="font-semibold mb-2">Upload {uploadMode === 'files' ? 'Files' : 'Folder'}</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
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
              <Download className="mr-1" size={16} />
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
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No files or folders found in this directory.</p>
          </div>
        ) : (
          <ul className="border rounded-lg divide-y">
            {sortedEntries.map((entry) => (
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
                {entry.type === 'file' && entry.size !== undefined && (
                  <span className="text-sm text-gray-400 ml-4 w-24 text-center">
                    {formatFileSize(entry.size)}
                  </span>
                )}
                <button
                  onClick={() => handleDownloadSingle(entry.name)}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center"
                >
                  <Download className="mr-1" size={16} />
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

function generateRandomFolderName(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `web${timestamp}${randomString}`;
}

export default FileBrowser;