import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || '/api';

function AdminLogin({ onLoginSuccess, onBack }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      setError('Please enter the admin password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to login');
      }

      onLoginSuccess(data.token);
    } catch (loginError) {
      setError(loginError.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Enter admin password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg px-6 py-3 font-semibold transition duration-200 ${
            loading ? 'cursor-not-allowed bg-gray-300 text-gray-500' : 'bg-slate-800 text-white hover:bg-slate-900'
          }`}
        >
          {loading ? 'Signing In...' : 'Login'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

export default AdminLogin;
