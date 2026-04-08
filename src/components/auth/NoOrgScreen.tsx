import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function NoOrgScreen() {
  const { currentUser, refreshUser, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshUser();
    } finally {
      setRefreshing(false);
      window.location.reload();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#1e293b', borderRadius: '16px', padding: '2.5rem', border: '1px solid #334155', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ width: '64px', height: '64px', background: '#1e3a5f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <svg width="30" height="30" fill="none" stroke="#60a5fa" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', margin: '0 0 0.5rem' }}>No Company Assigned</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Signed in as <strong style={{ color: '#cbd5e1' }}>{currentUser?.email}</strong>
        </p>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
          The administrator will assign you to a company. Your access will be activated once the assignment is complete.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              width: '100%', padding: '0.7rem 1rem', background: refreshing ? '#1e40af' : '#2563eb',
              color: 'white', fontWeight: 600, borderRadius: '8px', border: 'none',
              cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'background 0.15s'
            }}
          >
            {refreshing ? 'Checking...' : 'Check Again'}
          </button>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '0.7rem 1rem', background: 'transparent',
              color: '#64748b', fontWeight: 500, borderRadius: '8px', border: '1px solid #334155',
              cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.15s'
            }}
          >
            Sign Out
          </button>
        </div>

        <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Last checked: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
