import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BankAccount } from '../../types';

const COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#db2777'];

function fmt(n: number | null | undefined) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function AccountsPage({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ accountName: '', bankName: '', accountNumber: '', currency: 'INR', openingBalance: 0 });

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'bankAccounts'), where('orgId', '==', orgId));
    const unsub = onSnapshot(
      q,
      snap => {
        setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
        setLoading(false);
      },
      err => {
        console.error('AccountsPage:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [orgId]);

  const addAccount = useCallback(async () => {
    if (!form.accountName || !form.bankName) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'bankAccounts'), {
        ...form,
        orgId,
        openingBalance: Number(form.openingBalance) || 0,
        createdAt: serverTimestamp(),
      });
      setForm({ accountName: '', bankName: '', accountNumber: '', currency: 'INR', openingBalance: 0 });
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }, [form, orgId]);

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#64748b' }}>Loading accounts...</div>;
  if (error) return <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '50vh', gap: '0.5rem' }}><span style={{ color: '#ef4444', fontWeight: 600 }}>Permission Error</span><span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{error}</span><span style={{ color: '#64748b', fontSize: '0.78rem' }}>Update Firestore rules to allow bankAccounts collection</span></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Bank Accounts / Entities</h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{accounts.length} entities configured</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          + Add Entity
        </button>
      </div>

      {accounts.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏦</div>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No accounts yet</p>
          <p style={{ fontSize: '0.875rem' }}>Add your bank accounts to start tracking balances</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {accounts.map((a, i) => (
            <div key={a.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                  {a.bankName?.slice(0, 2).toUpperCase() || 'BK'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{a.accountName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{a.bankName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Account No.</span>
                  <span style={{ fontWeight: 500 }}>{a.accountNumber || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Currency</span>
                  <span style={{ fontWeight: 500 }}>{a.currency || 'INR'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', marginTop: '0.25rem' }}>
                  <span style={{ color: '#374151', fontWeight: 500 }}>Opening Balance</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>{fmt(a.openingBalance)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Add Entity / Account</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94a3b8' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { l: 'Entity Name *', k: 'accountName', t: 'text', p: 'Kishan Enterprise' },
                { l: 'Bank Name *', k: 'bankName', t: 'text', p: 'ICICI' },
                { l: 'Account Number', k: 'accountNumber', t: 'text', p: '778605500007' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{f.l}</label>
                  <input type={f.t} placeholder={f.p} value={(form as any)[f.k]} onChange={e => setForm({ ...form, [f.k]: e.target.value })} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Opening Balance ₹</label>
                <input type="number" placeholder="0" value={form.openingBalance || ''} onChange={e => setForm({ ...form, openingBalance: Number(e.target.value) || 0 })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addAccount} disabled={saving || !form.accountName || !form.bankName}
                style={{ flex: 1, padding: '0.6rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, opacity: (saving || !form.accountName || !form.bankName) ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
