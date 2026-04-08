import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function PendingApprovalScreen() {
  const { currentUser, appUser, refreshUser, signOut } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!appUser?.orgId) return;
    getDoc(doc(db, 'organizations', appUser.orgId)).then(d => {
      if (d.exists()) setOrgName(d.data().name);
    });
  }, [appUser?.orgId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#1e293b', borderRadius: '16px', padding: '2.5rem', border: '1px solid #334155', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', background: '#1c2d1c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.8rem' }}>
          ⏳
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', margin: '0 0 0.5rem' }}>
          Request Pending
        </h1>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
          Your request to join <strong style={{ color: '#60a5fa' }}>{orgName || 'the company'}</strong> has been submitted.
        </p>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
          The company admin will approve your request and assign your role. You will gain access once approved.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              width: '100%', padding: '0.7rem 1rem', background: refreshing ? '#1e40af' : '#2563eb',
              color: 'white', fontWeight: 600, borderRadius: '8px', border: 'none',
              cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
            }}
          >
            {refreshing ? 'Checking…' : 'Check Approval Status'}
          </button>
          <button
            onClick={signOut}
            style={{
              width: '100%', padding: '0.6rem', background: 'transparent', color: '#64748b',
              border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            Sign Out
          </button>
        </div>

        <p style={{ color: '#334155', fontSize: '0.75rem', marginTop: '1.25rem' }}>
          {currentUser?.email}
        </p>
      </div>
    </div>
  );
}
