import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signIn();
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem' }}>
          🏦
        </div>
        <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Bank Reconciliation</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 2rem' }}>Multi-tenant finance platform</p>

        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            background: loading ? '#1e293b' : 'white', color: loading ? '#64748b' : '#1e293b',
            border: loading ? '1px solid #334155' : 'none', borderRadius: '10px', padding: '0.85rem 1.5rem',
            fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? (
            <>
              <span style={{ width: '18px', height: '18px', border: '2px solid #475569', borderTopColor: '#94a3b8', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Signing in...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
                <path d="M4.5 10.48A4.8 4.8 0 0 1 4.25 9c0-.51.09-1 .25-1.48V5.45H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.5.85 3.55l2.67-2.07z" fill="#FBBC05"/>
                <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35L14.6 2.8A7.99 7.99 0 0 0 1.83 5.45L4.5 7.52A4.77 4.77 0 0 1 8.98 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Access is granted by your organization's admin
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
