import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const SQL_SCHEMA = `-- Firestore collections used by this app:
--
-- bankAccounts/{id}
--   orgId, accountName, bankName, accountNumber, currency, openingBalance, createdAt
--
-- transactions/{id}
--   orgId, accountId, date (YYYY-MM-DD), description, category
--   credit (number|null), debit (number|null), balance, sourcePdf, createdAt
--
-- orgSettings/{orgId}
--   orgId, backendUrl
--
-- Backend API (Render): POST /upload
--   FormData: file, account_id
--   Returns: { transactions: [...], transactions_count: N, pdf_type: "..." }`;

export default function SettingsPage({ orgId }: { orgId: string }) {
  const [backendUrl, setBackendUrl] = useState('https://bank-reconciliation-f5ip.onrender.com');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'orgSettings', orgId)).then(d => {
      if (d.exists() && d.data().backendUrl) setBackendUrl(d.data().backendUrl);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgId]);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'orgSettings', orgId), { orgId, backendUrl: backendUrl.trim() }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };
  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1rem' };

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Settings</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Backend API configuration</p>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem', fontWeight: 600, color: '#0f172a' }}>Backend API</h3>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
          The backend API (Render.com) handles PDF/image extraction. Configure the URL below.
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Backend URL</label>
          <input
            type="url"
            value={backendUrl}
            onChange={e => setBackendUrl(e.target.value)}
            placeholder="https://bank-reconciliation-f5ip.onrender.com"
            style={inputStyle}
            disabled={loading}
          />
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>Your Render.com deployment URL</p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          style={{ padding: '0.6rem 1.5rem', background: saved ? '#059669' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', opacity: saving || loading ? 0.7 : 1 }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.75rem', fontWeight: 600, color: '#0f172a' }}>Organization Info</h3>
        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: '#64748b', minWidth: '120px' }}>Org ID</span>
            <span style={{ fontFamily: 'monospace', color: '#374151', fontSize: '0.8rem', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{orgId}</span>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 0.75rem', fontWeight: 600, color: '#0f172a' }}>Firestore Schema Reference</h3>
        <pre style={{ background: '#111827', color: '#86efac', borderRadius: '8px', padding: '1.25rem', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.6 }}>{SQL_SCHEMA}</pre>
      </div>
    </div>
  );
}
