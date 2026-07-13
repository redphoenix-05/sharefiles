import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const MAX_FILE_SIZE_MB = Number(process.env.REACT_APP_MAX_FILE_SIZE_MB || 150);
const MAX_FILES_PER_SHARE = Number(process.env.REACT_APP_MAX_FILES_PER_SHARE || 10);
const PIN_DOWNLOAD_LIMIT = Number(process.env.REACT_APP_PIN_DOWNLOAD_LIMIT || 10);
const SHARE_EXPIRY_HOURS = Number(process.env.REACT_APP_SHARE_EXPIRY_HOURS || 2);

function Upload() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pin, setPin] = useState('');
  const [shareSummary, setShareSummary] = useState(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (e) => {
    validateAndSetFiles(Array.from(e.target.files || []));
  };

  const validateAndSetFiles = (files) => {
    if (!files.length) return;

    if (files.length > MAX_FILES_PER_SHARE) {
      setError(`You can upload up to ${MAX_FILES_PER_SHARE} files at a time`);
      return;
    }

    const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxSize) {
      setError(`Total upload size must be less than ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setSelectedFiles(files);
    setError('');
    setUploadSuccess(false);
    setPin('');
    setShareSummary(null);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      validateAndSetFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      setError('Please select at least one file first');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setPin(response.data.pin);
        setShareSummary(response.data);
        setUploadSuccess(true);
      }
    } catch (err) {
      const responseError = err.response?.data?.error;
      const statusError = err.response?.status ? `Upload failed (${err.response.status})` : null;
      const networkError = err.request ? 'Upload failed. The server did not respond.' : null;

      setError(responseError || networkError || statusError || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const resetUpload = () => {
    setSelectedFiles([]);
    setUploadSuccess(false);
    setPin('');
    setShareSummary(null);
    setError('');
  };

  const totalSelectedSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

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
          <p className="mb-6 text-sm text-gray-600 sm:text-base">Share this PIN to allow others to download your files</p>
        </div>

        <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 sm:p-6">
          <p className="mb-2 text-sm text-gray-600">Your 4-digit PIN</p>
          <div className="mb-2 text-4xl font-bold tracking-[0.3em] text-blue-600 sm:text-5xl">{pin}</div>
          <p className="text-xs text-gray-500">
            This PIN expires in {SHARE_EXPIRY_HOURS} hours and can be used {PIN_DOWNLOAD_LIMIT} times
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <div className="flex flex-col items-start justify-between gap-1 text-left text-sm sm:flex-row sm:items-center">
            <span className="text-gray-600">Files:</span>
            <span className="font-semibold text-gray-800">{shareSummary?.fileCount || selectedFiles.length}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Total size:</span>
            <span className="font-semibold text-gray-800">
              {formatFileSize(shareSummary?.totalSize || totalSelectedSize)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-600">Remaining downloads:</span>
            <span className="font-semibold text-gray-800">{shareSummary?.remainingDownloads || PIN_DOWNLOAD_LIMIT}</span>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white/70 p-4 text-left">
          <p className="mb-3 text-sm font-semibold text-gray-700">Shared files</p>
          <div className="space-y-2">
            {(shareSummary?.files || selectedFiles).map((file) => (
              <div
                key={file.filename || `${file.name}-${file.size}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-all font-medium text-gray-800">{file.filename || file.name}</span>
                <span className="flex-shrink-0 text-gray-500">{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={resetUpload}
          className="w-full rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white transition duration-200 hover:bg-blue-600"
        >
          Upload Another Share
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-800">Send Files</h2>

      <div
        className={`relative rounded-lg border-2 border-dashed p-5 text-center transition-all duration-200 sm:p-8 ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
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
          multiple
          onChange={handleFileSelect}
        />

        {!selectedFiles.length ? (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400 sm:h-16 sm:w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="mb-2 text-sm text-gray-600 sm:text-base">Drag and drop your files here</p>
            <p className="mb-4 text-sm text-gray-500">or</p>
            <label
              htmlFor="fileInput"
              className="inline-block cursor-pointer rounded-lg bg-blue-500 px-6 py-2 font-semibold text-white transition duration-200 hover:bg-blue-600"
            >
              Browse Files
            </label>
            <p className="mt-4 text-xs text-gray-500">
              Up to {MAX_FILES_PER_SHARE} files, {MAX_FILE_SIZE_MB}MB total
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-left">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-800">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </p>
                    <p className="text-sm text-gray-500">{formatFileSize(totalSelectedSize)}</p>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {selectedFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 break-all font-medium text-gray-800">{file.name}</span>
                        <span className="flex-shrink-0 text-gray-500">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="flex-shrink-0 text-red-500 transition hover:text-red-700"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`w-full rounded-lg px-6 py-3 font-semibold transition duration-200 ${
                uploading ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {uploading ? (
                <span className="flex items-center justify-center">
                  <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload Files'
              )}
            </button>
            <p className="text-xs text-gray-500">
              Each PIN expires after {SHARE_EXPIRY_HOURS} hours and allows {PIN_DOWNLOAD_LIMIT} downloads.
            </p>
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
