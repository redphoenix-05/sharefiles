import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function Download() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareInfo, setShareInfo] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setPin(value);
      setError('');
    }
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');
    setShareInfo(null);

    try {
      const response = await axios.get(`${API_URL}/file/${pin}`);
      if (response.data.success) {
        setShareInfo(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid PIN or files not found');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');

    try {
      const response = await axios.get(`${API_URL}/download/${pin}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const fallbackName =
        shareInfo?.fileCount > 1 ? `sharefiles-${pin}.zip` : shareInfo?.files?.[0]?.filename;
      link.href = url;
      link.setAttribute('download', fallbackName || `sharefiles-${pin}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const remainingDownloads = Number(response.headers['x-remaining-downloads']);
      if (Number.isFinite(remainingDownloads)) {
        setShareInfo((current) => (current ? { ...current, remainingDownloads } : current));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download files');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const resetForm = () => {
    setPin('');
    setShareInfo(null);
    setError('');
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-800">Receive Files</h2>

      {!shareInfo ? (
        <>
          <form
            className="mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!loading && pin.length === 4) {
                handleVerifyPin();
              }
            }}
          >
            <label className="mb-2 block text-sm font-semibold text-gray-700">Enter 4-digit PIN</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pin}
                onChange={handlePinChange}
                placeholder="0000"
                maxLength="4"
                className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.35em] transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 sm:text-3xl"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">Enter the 4-digit PIN you received</p>
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className={`mt-6 w-full rounded-lg px-6 py-3 font-semibold transition duration-200 ${
                loading || pin.length !== 4
                  ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify PIN'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-start rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-red-700">
              <svg className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="break-words text-sm sm:text-base">{error}</span>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 sm:p-6">
            <div className="mb-4 flex items-center">
              <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Files Found!</h3>
                <p className="text-sm text-gray-600">Ready to download</p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Files:</span>
                <span className="font-semibold text-gray-800">{shareInfo.fileCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total size:</span>
                <span className="font-semibold text-gray-800">{formatFileSize(shareInfo.totalSize)}</span>
              </div>
              <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-600">Uploaded:</span>
                <span className="text-sm font-semibold text-gray-800 sm:text-right">{formatDate(shareInfo.createdAt)}</span>
              </div>
              <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-600">Expires:</span>
                <span className="text-sm font-semibold text-gray-800 sm:text-right">{formatDate(shareInfo.expiresAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Remaining downloads:</span>
                <span className="font-semibold text-gray-800">{shareInfo.remainingDownloads}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Included files</p>
            <div className="space-y-2">
              {shareInfo.files.map((file) => (
                <div
                  key={`${file.filename}-${file.size}`}
                  className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="break-all font-medium text-gray-800">{file.filename}</span>
                  <span className="text-gray-500">
                    {formatFileSize(file.size)} · {file.mimetype}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`flex-1 rounded-lg px-6 py-3 font-semibold transition duration-200 ${
                downloading ? 'cursor-not-allowed bg-gray-400' : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {downloading ? (
                <span className="flex items-center justify-center">
                  <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {shareInfo.fileCount > 1 ? 'Download Files' : 'Download File'}
                </span>
              )}
            </button>

            <button
              onClick={resetForm}
              className="rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition duration-200 hover:bg-gray-50 sm:w-auto"
            >
              Try Another PIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Download;
