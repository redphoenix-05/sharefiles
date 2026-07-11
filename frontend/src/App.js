import React, { useState } from 'react';
import Upload from './components/Upload';
import Download from './components/Download';

const MAX_FILE_SIZE_MB = Number(
  process.env.REACT_APP_MAX_FILE_SIZE_MB || (window.location.hostname === 'localhost' ? 50 : 4)
);

function App() {
  const [activeTab, setActiveTab] = useState('send');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center sm:mb-10 lg:mb-12">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-800 sm:text-5xl">
            ShareFiles
          </h1>
          <p className="mx-auto max-w-xl text-sm text-gray-600 sm:text-base lg:text-lg">
            Share files securely with a 4-digit PIN
          </p>
        </div>

        {/* Main Card */}
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl shadow-blue-100/60">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('send')}
              className={`flex-1 px-3 py-4 text-center font-semibold transition-all duration-200 sm:px-6 ${
                activeTab === 'send'
                  ? 'bg-blue-500 text-white border-b-4 border-blue-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2">
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm sm:text-base">Send File</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('receive')}
              className={`flex-1 px-3 py-4 text-center font-semibold transition-all duration-200 sm:px-6 ${
                activeTab === 'receive'
                  ? 'bg-green-500 text-white border-b-4 border-green-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2">
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span className="text-sm sm:text-base">Receive File</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 sm:p-8">
            {activeTab === 'send' ? <Upload /> : <Download />}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mx-auto mt-6 max-w-2xl text-center sm:mt-8">
          <div className="rounded-2xl bg-white p-5 shadow-md shadow-blue-100/50 sm:p-6">
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50/50 px-4 py-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure PIN access</span>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50/50 px-4 py-3">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>24-hour expiry</span>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-xl bg-purple-50/50 px-4 py-3 sm:col-span-2 lg:col-span-1">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Max {MAX_FILE_SIZE_MB}MB per file</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
