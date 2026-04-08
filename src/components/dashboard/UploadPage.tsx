import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BankAccount, Transaction } from '../../types';

const CATEGORIES = ['Sales Receipt','Purchase Payment','Salary','Rent','Utilities','Tax Payment','Loan Repayment','Bank Charges','Petty Cash','Transfer','Diesel','Driver','Stock Labour','Other'];

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function UploadPage({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selAcc, setSelAcc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Partial<Transaction>[]>([]);
  const [extractResult, setExtractResult] = useState<{ count: number; type: string } | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [backendUrl, setBackendUrl] = useState('https://bank-reconciliation-f5ip.onrender.com');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load accounts for this org
    const q = query(collection(db, 'bankAccounts'), where('orgId', '==', orgId));
    const unsub = onSnapshot(q, snap => {
      const accs = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
      setAccounts(accs);
      if (accs.length > 0 && !selAcc) setSelAcc(accs[0].id);
    });
    // Load backend URL from org settings
    getDoc(doc(db, 'orgSettings', orgId)).then(d => {
      if (d.exists() && d.data().backendUrl) setBackendUrl(d.data().backendUrl);
    }).catch(() => {});
    return unsub;
  }, [orgId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setPreview([]); setExtractResult(null); setErr(''); setSaved(false); }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview([]); setExtractResult(null); setErr(''); setSaved(false); }
  };

  const extract = async () => {
    if (!file || !selAcc) { setErr('Select an account and a file.'); return; }
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('account_id', selAcc);
      const res = await fetch(`${backendUrl}/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      const data = await res.json();
      setPreview(data.transactions || []);
      setExtractResult({ count: data.transactions_count || data.transactions?.length || 0, type: data.pdf_type || '' });
    } catch (e: any) {
      setErr(e.message || 'Extraction failed');
    } finally {
      setBusy(false);
    }
  };

  const saveToFirestore = async () => {
    if (!preview.length) return;
    try {
      const batch = preview.map(t =>
        addDoc(collection(db, 'transactions'), {
          ...t,
          orgId,
          accountId: selAcc,
          sourcePdf: file!.name,
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(batch);
      setSaved(true);
    } catch (e: any) {
      setErr(e.message || 'Failed to save');
    }
  };

  const inputStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: 'white' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Upload Bank Statement</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Upload PDF or image — transactions are extracted automatically by the backend</p>
      </div>

      {/* Account selector */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Entity / Bank Account</label>
        {accounts.length === 0 ? (
          <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>⚠️ No accounts found. Add accounts in the Accounts tab first.</p>
        ) : (
          <select value={selAcc} onChange={e => setSelAcc(e.target.value)} style={{ ...inputStyle, minWidth: '300px' }}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} | {a.bankName}</option>)}
          </select>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onClick={() => fileRef.current?.click()}
        style={{
          cursor: 'pointer', borderRadius: '12px', border: `2px dashed ${drag ? '#2563eb' : file ? '#059669' : '#cbd5e1'}`,
          padding: '3rem 2rem', textAlign: 'center',
          background: drag ? '#eff6ff' : file ? '#f0fdf4' : 'white',
          transition: 'all 0.15s',
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={onFileChange} />
        {file ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ fontWeight: 600, color: '#166534' }}>{file.name}</p>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>{(file.size / 1024).toFixed(1)} KB · click to change</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☁️</div>
            <p style={{ fontWeight: 600, color: '#374151' }}>Drop file here or click to browse</p>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>PDF · JPG · PNG · WEBP</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {['PDF → table extraction', 'Image → OCR', 'Multi-page ✓'].map(t => (
                <span key={t} style={{ padding: '0.2rem 0.6rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: '9999px', fontSize: '0.75rem' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.875rem' }}>{err}</div>
      )}

      {file && !extractResult && (
        <button onClick={extract} disabled={busy || accounts.length === 0} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
          background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, width: 'fit-content',
          opacity: busy || accounts.length === 0 ? 0.6 : 1,
        }}>
          {busy ? (
            <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Extracting…</>
          ) : '⬆️ Extract Transactions'}
        </button>
      )}

      {/* Preview table */}
      {extractResult && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Extraction Complete — {extractResult.count} transactions</span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{extractResult.type}</span>
            </div>
            {saved ? (
              <span style={{ padding: '0.4rem 0.9rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>✓ Saved to Firestore</span>
            ) : (
              <button onClick={saveToFirestore} style={{ padding: '0.4rem 0.9rem', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                ✓ Save to Database
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem' }}>Description</th>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem' }}>Category</th>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: '#dc2626', fontSize: '0.75rem' }}>Debit</th>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: '#059669', fontSize: '0.75rem' }}>Credit</th>
                  <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '0.75rem' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((t, i) => (
                  <tr key={i} style={{ background: i % 2 ? '#f8fafc' : 'white', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 1rem', color: '#64748b' }}>{t.date}</td>
                    <td style={{ padding: '0.5rem 1rem', color: '#1e293b', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <select
                        value={t.category || ''}
                        onChange={e => setPreview(prev => prev.map((r, j) => j === i ? { ...r, category: e.target.value } : r))}
                        style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', outline: 'none' }}
                      >
                        <option value="">None</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{t.debit ? fmt(t.debit) : '—'}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: '#059669' }}>{t.credit ? fmt(t.credit) : '—'}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>{t.balance ? fmt(t.balance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
