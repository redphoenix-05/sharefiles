import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const MAX_FILE_SIZE_MB = Number(
  process.env.REACT_APP_MAX_FILE_SIZE_MB || (window.location.hostname === 'localhost' ? 50 : 4)
);

function Upload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (!file) return;

    const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setSelectedFile(file);
    setError('');
    setUploadSuccess(false);
    setPin('');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setPin(response.data.pin);
        setUploadSuccess(true);
      }
    } catch (err) {
      const responseError = err.response?.data?.error;
      const statusError = err.response?.status
        ? `Upload failed (${err.response.status})`
        : null;
      const networkError = err.request ? 'Upload failed. The server did not respond.' : null;

      setError(responseError || networkError || statusError || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadSuccess(false);
    setPin('');
    setError('');
  };

  if (uploadSuccess) {
    return (
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 sm:h-20 sm:w-20">
            <svg className="h-8 w-8 text-green-500 sm:h-10 sm:w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">Upload Successful!</h3>
          <p className="mb-6 text-sm text-gray-600 sm:text-base">Share this PIN to allow others to download your file</p>
        </div>

        <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 sm:p-6">
          <p className="text-sm text-gray-600 mb-2">Your 4-digit PIN</p>
          <div className="mb-2 text-4xl font-bold tracking-[0.3em] text-blue-600 sm:text-5xl">
            {pin}
          </div>
          <p className="text-xs text-gray-500">This PIN will expire in 24 hours</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex flex-col items-start justify-between gap-1 text-left text-sm sm:flex-row sm:items-center">
            <span className="text-gray-600">File:</span>
            <span className="max-w-full break-all font-semibold text-gray-800 sm:ml-2 sm:text-right">{selectedFile.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Size:</span>
            <span className="font-semibold text-gray-800">{formatFileSize(selectedFile.size)}</span>
          </div>
        </div>

        <button
          onClick={resetUpload}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
        >
          Upload Another File
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-800">Send a File</h2>

      {/* Drag and Drop Area */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-5 text-center transition-all duration-200 sm:p-8 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          onChange={handleFileSelect}
        />

        {!selectedFile ? (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400 sm:h-16 sm:w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="mb-2 text-sm text-gray-600 sm:text-base">Drag and drop your file here</p>
            <p className="text-gray-500 text-sm mb-4">or</p>
            <label
              htmlFor="fileInput"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg cursor-pointer transition duration-200"
            >
              Browse Files
            </label>
            <p className="text-gray-500 text-xs mt-4">Maximum file size: {MAX_FILE_SIZE_MB}MB</p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start space-x-3">
                  <svg className="mt-0.5 h-9 w-9 flex-shrink-0 text-blue-500 sm:h-10 sm:w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0 text-left">
                    <p className="break-all font-semibold text-gray-800">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="flex-shrink-0 text-red-500 transition hover:text-red-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`w-full font-semibold py-3 px-6 rounded-lg transition duration-200 ${
                uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {uploading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload File'
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-red-700">
          <svg className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="break-words text-sm sm:text-base">{error}</span>
        </div>
      )}
    </div>
  );
}

export default Upload;
