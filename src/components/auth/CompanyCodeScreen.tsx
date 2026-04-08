import { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function CompanyCodeScreen() {
  const { currentUser, refreshUser, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !currentUser) return;

    setLoading(true);
    setError('');

    try {
      const codeDoc = await getDoc(doc(db, 'orgCodes', trimmed));
      if (!codeDoc.exists()) {
        setError('Invalid company code. Please ask your administrator for the correct code.');
        return;
      }

      const { orgId } = codeDoc.data() as { orgId: string; orgName: string };

      // Mark user as pending for this org
      await updateDoc(doc(db, 'users', currentUser.uid), { orgId, role: 'pending' });

      // Reload user state — App.tsx will now show PendingApprovalScreen
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#1e293b', borderRadius: '16px', padding: '2.5rem', border: '1px solid #334155' }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '64px', height: '64px', background: '#1e3a5f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="30" height="30" fill="none" stroke="#60a5fa" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', margin: '0 0 0.4rem' }}>Join Your Company</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Enter the invite code provided by your company administrator.
          </p>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Company Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="e.g. ABCD1234"
            maxLength={12}
            style={{
              width: '100%', padding: '0.75rem 1rem', background: '#0f172a', border: `1px solid ${error ? '#ef4444' : '#334155'}`,
              borderRadius: '8px', color: 'white', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.15em',
              outline: 'none', boxSizing: 'border-box', textAlign: 'center',
            }}
          />
          {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem' }}>{error}</p>}
        </div>

        <button
          onClick={handleJoin}
          disabled={loading || !code.trim()}
          style={{
            width: '100%', padding: '0.75rem', background: loading ? '#1e40af' : '#2563eb',
            color: 'white', fontWeight: 700, fontSize: '0.95rem', borderRadius: '8px', border: 'none',
            cursor: loading || !code.trim() ? 'not-allowed' : 'pointer', opacity: !code.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Submitting Request…' : 'Submit Join Request'}
        </button>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.78rem', margin: '1rem 0 0' }}>
          Signed in as <span style={{ color: '#94a3b8' }}>{currentUser?.email}</span>
        </p>

        <div style={{ borderTop: '1px solid #334155', marginTop: '1.5rem', paddingTop: '1.25rem', textAlign: 'center' }}>
          <button
            onClick={signOut}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
