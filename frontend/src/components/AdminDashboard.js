import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function AdminDashboard({ token, onLogout }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadShares = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_URL}/admin/shares`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load shares');
        }

        setShares(data.shares || []);
      } catch (loadError) {
        setError(loadError.message || 'Failed to load shares');
      } finally {
        setLoading(false);
      }
    };

    loadShares();
  }, [token]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
          <p className="text-sm text-gray-500">All uploaded shares and their PINs</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Logout
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-gray-600">Loading shares...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : shares.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-gray-600">No uploaded shares found.</div>
      ) : (
        <div className="space-y-4">
          {shares.map((share) => (
            <div key={share.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">PIN</p>
                  <p className="text-2xl font-bold tracking-[0.2em] text-slate-800">{share.pin}</p>
                </div>
                <div className="text-sm text-gray-600 sm:text-right">
                  <p>{share.fileCount} file{share.fileCount > 1 ? 's' : ''}</p>
                  <p>{formatFileSize(share.totalSize)}</p>
                  <p>{share.remainingDownloads} downloads left</p>
                </div>
              </div>

              <div className="mb-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <div className="rounded-lg bg-white px-3 py-2">
                  <span className="font-semibold text-gray-800">Created:</span>{' '}
                  {new Date(share.createdAt).toLocaleString()}
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  <span className="font-semibold text-gray-800">Expires:</span>{' '}
                  {new Date(share.expiresAt).toLocaleString()}
                </div>
              </div>

              <div className="space-y-2">
                {share.files.map((file) => (
                  <div
                    key={`${share.id}-${file.storageId}`}
                    className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="break-all font-medium text-gray-800">{file.filename}</span>
                    <span className="text-gray-500">
                      {formatFileSize(file.size)} | {file.mimetype}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
