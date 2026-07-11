import React, { useState } from 'react';
import Upload from './components/Upload';
import Download from './components/Download';

const MAX_FILE_SIZE_MB = Number(
  process.env.REACT_APP_MAX_FILE_SIZE_MB || (window.location.hostname === 'localhost' ? 50 : 4)
);

function App() {
  const [activeTab, setActiveTab] = useState('send');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-3">
            ShareFiles
          </h1>
          <p className="text-gray-600 text-lg">
            Share files securely with a 4-digit PIN
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('send')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${
                activeTab === 'send'
                  ? 'bg-blue-500 text-white border-b-4 border-blue-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Send File
              </div>
            </button>
            <button
              onClick={() => setActiveTab('receive')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${
                activeTab === 'receive'
                  ? 'bg-green-500 text-white border-b-4 border-green-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Receive File
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'send' ? <Upload /> : <Download />}
          </div>
        </div>

        {/* Footer Info */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure PIN access</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>24-hour expiry</span>
              </div>
              <div className="flex items-center justify-center gap-2">
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
