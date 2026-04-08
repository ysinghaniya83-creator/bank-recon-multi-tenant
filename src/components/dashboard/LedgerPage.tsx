import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BankAccount, Transaction } from '../../types';

const CATEGORIES = ['Sales Receipt','Purchase Payment','Salary','Rent','Utilities','Tax Payment','Loan Repayment','Bank Charges','Petty Cash','Transfer','Diesel','Driver','Stock Labour','Other'];
const PER = 25;

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LedgerPage({ orgId }: { orgId: string }) {
  const { appUser } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ acc: '', cat: '', from: '', to: '', q: '' });
  const [pg, setPg] = useState(1);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyAdd = { accountId: '', date: new Date().toISOString().slice(0, 10), description: '', category: '', credit: '', debit: '' };
  const [addForm, setAddForm] = useState(emptyAdd);
  const [addError, setAddError] = useState('');

  const canEdit = appUser?.role === 'admin' || appUser?.role === 'editor';

  useEffect(() => {
    const q1 = query(collection(db, 'bankAccounts'), where('orgId', '==', orgId));
    const q2 = query(collection(db, 'transactions'), where('orgId', '==', orgId));
    let l1 = false, l2 = false;
    const u1 = onSnapshot(q1, snap => { setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount))); l1 = true; if (l1 && l2) setLoading(false); });
    const u2 = onSnapshot(q2, snap => { setTxns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).sort((a, b) => b.date.localeCompare(a.date))); l2 = true; if (l1 && l2) setLoading(false); });
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { u1(); u2(); clearTimeout(timer); };
  }, [orgId]);

  const filtered = txns.filter(t => {
    if (filter.acc && t.accountId !== filter.acc) return false;
    if (filter.cat && t.category !== filter.cat) return false;
    if (filter.from && t.date < filter.from) return false;
    if (filter.to && t.date > filter.to) return false;
    if (filter.q && !t.description?.toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  });

  const pages = Math.ceil(filtered.length / PER) || 1;
  const rows = filtered.slice((pg - 1) * PER, pg * PER);

  const exportCSV = useCallback(() => {
    const hdr = 'Date,Entity,Description,Category,Credit In,Debit Out,Balance,Source\n';
    const body = filtered.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      return `${t.date},"${acc?.accountName || ''}","${t.description || ''}","${t.category || ''}",${t.credit || ''},${t.debit || ''},${t.balance || ''},"${t.sourcePdf || ''}"`;
    }).join('\n');
    const url = URL.createObjectURL(new Blob([hdr + body], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'ledger.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, accounts]);

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'transactions', editRow.id), {
        date: editRow.date,
        description: editRow.description,
        category: editRow.category || null,
        credit: editRow.credit,
        debit: editRow.debit,
      });
      setEditRow(null);
    } finally {
      setSaving(false);
    }
  };

  const saveAdd = async () => {
    setAddError('');
    const credit = parseFloat(addForm.credit);
    const debit = parseFloat(addForm.debit);
    const hasCredit = addForm.credit !== '' && !isNaN(credit) && credit > 0;
    const hasDebit = addForm.debit !== '' && !isNaN(debit) && debit > 0;
    if (!addForm.accountId) { setAddError('Select an entity.'); return; }
    if (!addForm.date) { setAddError('Date is required.'); return; }
    if (!addForm.description.trim()) { setAddError('Description is required.'); return; }
    if (!addForm.category) { setAddError('Category is required.'); return; }
    if (!hasCredit && !hasDebit) { setAddError('Fill either Credit or Debit amount.'); return; }
    if (hasCredit && hasDebit) { setAddError('Fill only one: Credit OR Debit.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        orgId,
        accountId: addForm.accountId,
        date: addForm.date,
        description: addForm.description.trim(),
        category: addForm.category,
        credit: hasCredit ? credit : null,
        debit: hasDebit ? debit : null,
        balance: null,
        sourcePdf: 'manual',
        createdAt: serverTimestamp(),
        createdBy: appUser?.uid,
      });
      setAddForm(emptyAdd);
      setAddModal(false);
    } catch (e: any) {
      setAddError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const S = {
    card: { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' } as React.CSSProperties,
    th: { padding: '0.65rem 1rem', textAlign: 'left' as const, fontWeight: 600, fontSize: '0.75rem', color: 'white', background: '#1e293b', whiteSpace: 'nowrap' as const },
    td: { padding: '0.6rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' as const },
    input: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const },
    filterGrid: { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'end' } as React.CSSProperties,
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><div style={{ color: '#64748b' }}>Loading transactions...</div></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Full Transaction Ledger</h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{filtered.length} of {txns.length} transactions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {canEdit && (
            <button onClick={() => { setAddForm(emptyAdd); setAddError(''); setAddModal(true); }} style={{ padding: '0.55rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              + Add Transaction
            </button>
          )}
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filterGrid}>
        <input style={S.input} placeholder="Search description…" value={filter.q} onChange={e => { setFilter({ ...filter, q: e.target.value }); setPg(1); }} />
        <select style={S.input} value={filter.acc} onChange={e => { setFilter({ ...filter, acc: e.target.value }); setPg(1); }}>
          <option value="">All Entities</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} | {a.bankName}</option>)}
        </select>
        <select style={S.input} value={filter.cat} onChange={e => { setFilter({ ...filter, cat: e.target.value }); setPg(1); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" style={S.input} value={filter.from} onChange={e => { setFilter({ ...filter, from: e.target.value }); setPg(1); }} placeholder="From" />
        <input type="date" style={S.input} value={filter.to} onChange={e => { setFilter({ ...filter, to: e.target.value }); setPg(1); }} placeholder="To" />
      </div>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Entity | Bank</th>
                <th style={S.th}>Description</th>
                <th style={S.th}>Category</th>
                <th style={{ ...S.th, textAlign: 'right', color: '#86efac' }}>Credit In ₹</th>
                <th style={{ ...S.th, textAlign: 'right', color: '#fca5a5' }}>Debit Out ₹</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No transactions found</td></tr>
              ) : rows.map((t, i) => {
                const acc = accounts.find(a => a.id === t.accountId);
                return (
                  <tr key={t.id || i} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                    <td style={{ ...S.td, color: '#64748b', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8rem' }}>{acc?.accountName || '—'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{acc?.bankName || ''}</div>
                    </td>
                    <td style={{ ...S.td, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{t.description}</td>
                    <td style={S.td}><span style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontSize: '0.75rem' }}>{t.category || '—'}</span></td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: '#059669' }}>{t.credit ? fmt(t.credit) : '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{t.debit ? fmt(t.debit) : '—'}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <button onClick={() => setEditRow({ ...t })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', fontSize: '0.875rem', color: '#64748b' }}>
            <span>Showing {(pg - 1) * PER + 1}–{Math.min(pg * PER, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button disabled={pg <= 1} onClick={() => setPg(p => p - 1)} style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: pg <= 1 ? 'default' : 'pointer', opacity: pg <= 1 ? 0.4 : 1 }}>‹</button>
              <span style={{ padding: '0.35rem 0.75rem' }}>{pg}/{pages}</span>
              <button disabled={pg >= pages} onClick={() => setPg(p => p + 1)} style={{ padding: '0.35rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: pg >= pages ? 'default' : 'pointer', opacity: pg >= pages ? 0.4 : 1 }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Edit Transaction</h3>
              <button onClick={() => setEditRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94a3b8' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {([{ l: 'Date', k: 'date', t: 'date' }, { l: 'Description', k: 'description', t: 'text' }] as { l: string; k: keyof Transaction; t: string }[]).map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{f.l}</label>
                  <input type={f.t} value={String(editRow[f.k] || '')} onChange={e => setEditRow({ ...editRow, [f.k]: e.target.value })}
                    style={{ ...S.input, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Category</label>
                <select value={editRow.category || ''} onChange={e => setEditRow({ ...editRow, category: e.target.value })} style={{ ...S.input }}>
                  <option value="">None</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {([{ l: 'Credit In ₹', k: 'credit' }, { l: 'Debit Out ₹', k: 'debit' }] as { l: string; k: 'credit' | 'debit' }[]).map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{f.l}</label>
                  <input type="number" value={editRow[f.k] ?? ''} onChange={e => setEditRow({ ...editRow, [f.k]: e.target.value ? Number(e.target.value) : null })}
                    style={{ ...S.input, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setEditRow(null)} style={{ flex: 1, padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: '0.6rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Add Transaction</h3>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94a3b8' }}>×</button>
            </div>
            {addError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{addError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Entity / Account *</label>
                <select value={addForm.accountId} onChange={e => setAddForm({ ...addForm, accountId: e.target.value })} style={{ ...S.input }}>
                  <option value="">Select entity...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} | {a.bankName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Date *</label>
                <input type="date" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} style={{ ...S.input, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Description *</label>
                <input type="text" value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} placeholder="Enter description..." style={{ ...S.input, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Category *</label>
                <select value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} style={{ ...S.input }}>
                  <option value="">Select category...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#059669', marginBottom: '0.3rem' }}>Credit In ₹</label>
                  <input type="number" value={addForm.credit} onChange={e => setAddForm({ ...addForm, credit: e.target.value })} placeholder="0.00" min="0" step="0.01" style={{ ...S.input, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.3rem' }}>Debit Out ₹</label>
                  <input type="number" value={addForm.debit} onChange={e => setAddForm({ ...addForm, debit: e.target.value })} placeholder="0.00" min="0" step="0.01" style={{ ...S.input, boxSizing: 'border-box' }} />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Fill only one: Credit OR Debit</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveAdd} disabled={saving} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: '8px', background: saving ? '#9ca3af' : '#059669', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
