import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { BankAccount, EMILoan } from '../../types';

const FINANCIERS = ['AXIS BANK','TATA MOTORS FIN','HDFC BANK LTD','ICICI BANK','YESBANK','HINDUJA','IDFC BANK','MASS FIN','HDB FINANCE'];
const LOAN_CATEGORIES = ['Vehicle','Equipment','Office Loan','MSME','House Loan','Finance','Other'];

function fmt(n: number | null | undefined) {
  if (!n && n !== 0) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function nextEMIDate(loan: EMILoan): Date {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), loan.emiDayOfMonth);
  if (d <= today) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const emptyLoan: Omit<EMILoan, 'id' | 'orgId'> = {
  truckNo: '', make: '', model: '', year: new Date().getFullYear(), owner: '',
  financier: '', loanCategory: 'Vehicle',
  loanAmount: 0, loanTenure: 12, emiStartDate: new Date().toISOString().slice(0, 10),
  emiDayOfMonth: 1, emiAmount: 0, emisPaid: 0, remainingEmis: 12,
  emiEndDate: '', debitedAccount: '',
};

export default function EMIPage({ orgId }: { orgId: string }) {
  const { appUser } = useAuth();
  const [loans, setLoans] = useState<EMILoan[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterFin, setFilterFin] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Omit<EMILoan, 'id' | 'orgId'>>(emptyLoan);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const canEdit = appUser?.role === 'admin' || appUser?.role === 'editor';

  useEffect(() => {
    const q1 = query(collection(db, 'emiLoans'), where('orgId', '==', orgId));
    const q2 = query(collection(db, 'bankAccounts'), where('orgId', '==', orgId));
    const u1 = onSnapshot(q1, snap => { setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() } as EMILoan))); });
    const u2 = onSnapshot(q2, snap => { setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount))); setLoading(false); });
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { u1(); u2(); clearTimeout(timer); };
  }, [orgId]);

  const filtered = loans.filter(l => {
    if (search && !l.truckNo.toLowerCase().includes(search.toLowerCase()) && !l.owner.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && l.loanCategory !== filterCat) return false;
    if (filterFin && l.financier !== filterFin) return false;
    return true;
  });

  // Upcoming EMIs in next 7 days
  const upcomingEmis = loans
    .filter(l => l.remainingEmis > 0)
    .map(l => ({ loan: l, next: nextEMIDate(l), days: daysUntil(nextEMIDate(l)) }))
    .filter(e => e.days >= 0 && e.days <= 7)
    .sort((a, b) => a.days - b.days);

  // Summary stats
  const activeLoans = loans.filter(l => l.remainingEmis > 0).length;
  const monthlyTotal = loans.filter(l => l.remainingEmis > 0).reduce((s, l) => s + (l.emiAmount || 0), 0);
  const next7DaysTotal = upcomingEmis.reduce((s, e) => s + (e.loan.emiAmount || 0), 0);

  // Low balance warnings: accounts where sum of upcoming EMIs > inferred balance
  const lowBalanceWarnings = accounts.filter(acc => {
    const accountEmis = upcomingEmis.filter(e => e.loan.debitedAccount === acc.id && e.days <= 3);
    if (accountEmis.length === 0) return false;
    const totalUpcoming = accountEmis.reduce((s, e) => s + (e.loan.emiAmount || 0), 0);
    const balance = acc.openingBalance || 0;
    return totalUpcoming > balance;
  });

  // Financier breakdown
  const financierBreakdown: Record<string, { count: number; monthly: number }> = {};
  loans.filter(l => l.remainingEmis > 0).forEach(l => {
    if (!financierBreakdown[l.financier]) financierBreakdown[l.financier] = { count: 0, monthly: 0 };
    financierBreakdown[l.financier].count++;
    financierBreakdown[l.financier].monthly += l.emiAmount || 0;
  });

  const openAdd = () => { setForm({ ...emptyLoan }); setFormError(''); setEditId(null); setModal('add'); };
  const openEdit = (loan: EMILoan) => {
    const { id, orgId: _oid, ...rest } = loan;
    setForm(rest as Omit<EMILoan, 'id' | 'orgId'>);
    setEditId(id!);
    setFormError('');
    setModal('edit');
  };

  const validateForm = (): string => {
    if (!form.truckNo.trim()) return 'Loan ID / Truck No is required.';
    if (!form.financier) return 'Financier is required.';
    if (!form.loanAmount || form.loanAmount <= 0) return 'Loan amount must be positive.';
    if (!form.emiAmount || form.emiAmount <= 0) return 'EMI amount must be positive.';
    if (!form.emiStartDate) return 'EMI start date is required.';
    if (form.emiDayOfMonth < 1 || form.emiDayOfMonth > 28) return 'EMI day must be between 1 and 28.';
    return '';
  };

  const saveForm = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, orgId, updatedAt: serverTimestamp() };
      if (modal === 'add') {
        await addDoc(collection(db, 'emiLoans'), { ...payload, createdAt: serverTimestamp() });
      } else if (editId) {
        await updateDoc(doc(db, 'emiLoans', editId), payload);
      }
      setModal(null);
    } catch (e: any) {
      setFormError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLoan = async (id: string) => {
    await deleteDoc(doc(db, 'emiLoans', id));
    setDeleteConfirm(null);
  };

  const S = {
    card: { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem' } as React.CSSProperties,
    input: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const },
    th: { padding: '0.6rem 0.9rem', textAlign: 'left' as const, fontWeight: 600, fontSize: '0.75rem', color: 'white', background: '#1e293b', whiteSpace: 'nowrap' as const },
    td: { padding: '0.6rem 0.9rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' as const },
    label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' } as React.CSSProperties,
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#64748b' }}>Loading EMI data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>EMI / Loan Tracker</h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{activeLoans} active loan{activeLoans !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} style={{ padding: '0.55rem 1.1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            + Add Loan
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Active Loans', value: activeLoans.toString(), color: '#2563eb', bg: '#eff6ff' },
          { label: 'Monthly EMI Total', value: fmt(monthlyTotal), color: '#dc2626', bg: '#fef2f2' },
          { label: 'Due in Next 7 Days', value: fmt(next7DaysTotal), color: '#d97706', bg: '#fffbeb' },
        ].map(c => (
          <div key={c.label} style={{ ...S.card, background: c.bg, border: `1px solid ${c.color}22` }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>{c.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming EMI Schedule */}
      {upcomingEmis.length > 0 && (
        <div style={S.card}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>Upcoming EMIs (Next 7 Days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {upcomingEmis.map(({ loan, next, days }) => {
              const acc = accounts.find(a => a.id === loan.debitedAccount);
              const urgent = days <= 2;
              return (
                <div key={loan.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', background: urgent ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: `1px solid ${urgent ? '#fecaca' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {urgent && <span style={{ background: '#dc2626', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>URGENT</span>}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>{loan.truckNo}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{loan.financier} · {acc?.accountName || 'No account'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.9rem' }}>{fmt(loan.emiAmount)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Due {formatDate(next)} ({days === 0 ? 'Today' : `${days}d`})</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low Balance Warnings */}
      {lowBalanceWarnings.length > 0 && (
        <div style={{ background: '#fffbeb', borderRadius: '12px', border: '1px solid #fcd34d', padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#92400e' }}>⚠️ Low Balance Warnings</h3>
          {lowBalanceWarnings.map(acc => {
            const emiSum = upcomingEmis.filter(e => e.loan.debitedAccount === acc.id && e.days <= 3).reduce((s, e) => s + e.loan.emiAmount, 0);
            return (
              <div key={acc.id} style={{ fontSize: '0.85rem', color: '#78350f', marginBottom: '0.3rem' }}>
                <strong>{acc.accountName}</strong> — Balance: {fmt(acc.openingBalance)} · EMIs due in 3d: {fmt(emiSum)}
              </div>
            );
          })}
        </div>
      )}

      {/* Financier Breakdown */}
      {Object.keys(financierBreakdown).length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>Financier Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(financierBreakdown).map(([fin, data]) => (
              <div key={fin} style={{ ...S.card, padding: '0.9rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{fin}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginTop: '0.3rem' }}>{fmt(data.monthly)}<span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>/mo</span></div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{data.count} loan{data.count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loans Table */}
      <div>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <input style={{ ...S.input, maxWidth: '200px' }} placeholder="Search truck / owner..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...S.input, maxWidth: '160px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {LOAN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{ ...S.input, maxWidth: '180px' }} value={filterFin} onChange={e => setFilterFin(e.target.value)}>
            <option value="">All Financiers</option>
            {FINANCIERS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>{filtered.length} loan{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Loan ID','Owner','Financier','Category','Loan Amt','EMI Amt','Paid','Remaining','Next EMI','Account','Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No loans found{loans.length === 0 ? '. Add your first loan.' : '.'}</td></tr>
                ) : filtered.map((loan, i) => {
                  const acc = accounts.find(a => a.id === loan.debitedAccount);
                  const next = loan.remainingEmis > 0 ? nextEMIDate(loan) : null;
                  const days = next ? daysUntil(next) : null;
                  const isActive = loan.remainingEmis > 0;
                  return (
                    <tr key={loan.id} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{loan.truckNo}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{loan.make} {loan.model} {loan.year}</div>
                      </td>
                      <td style={S.td}>{loan.owner || '—'}</td>
                      <td style={S.td}><span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: '#eff6ff', color: '#2563eb', borderRadius: '4px' }}>{loan.financier}</span></td>
                      <td style={S.td}><span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: '#f0fdf4', color: '#16a34a', borderRadius: '4px' }}>{loan.loanCategory || '—'}</span></td>
                      <td style={S.td}>{fmt(loan.loanAmount)}</td>
                      <td style={{ ...S.td, fontWeight: 600, color: '#dc2626' }}>{fmt(loan.emiAmount)}</td>
                      <td style={S.td}>{loan.emisPaid}</td>
                      <td style={S.td}>
                        {isActive ? (
                          <span style={{ fontWeight: 600, color: '#d97706' }}>{loan.remainingEmis}</span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>✓ Paid</span>
                        )}
                      </td>
                      <td style={S.td}>
                        {next ? (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: days! <= 2 ? '#dc2626' : '#0f172a' }}>{formatDate(next)}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{days === 0 ? 'Today' : `${days}d`}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={S.td}><span style={{ fontSize: '0.75rem' }}>{acc?.accountName || '—'}</span></td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' as const }}>
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(loan)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.8rem', marginRight: '0.5rem' }}>✏️</button>
                            <button onClick={() => setDeleteConfirm(loan.id!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem' }}>🗑️</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{modal === 'add' ? 'Add New Loan' : 'Edit Loan'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#94a3b8' }}>×</button>
            </div>
            {formError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={S.label}>Loan ID / Truck No *</label>
                <input style={S.input} value={form.truckNo} onChange={e => setForm({ ...form, truckNo: e.target.value })} placeholder="e.g. MH-12-AB-1234" />
              </div>
              <div>
                <label style={S.label}>Owner Name</label>
                <input style={S.input} value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Owner name" />
              </div>
              <div>
                <label style={S.label}>Make</label>
                <input style={S.input} value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="e.g. Tata" />
              </div>
              <div>
                <label style={S.label}>Model</label>
                <input style={S.input} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. Prima 4028" />
              </div>
              <div>
                <label style={S.label}>Year</label>
                <input type="number" style={S.input} value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} min="2000" max="2030" />
              </div>
              <div>
                <label style={S.label}>Loan Category</label>
                <select style={S.input} value={form.loanCategory} onChange={e => setForm({ ...form, loanCategory: e.target.value })}>
                  {LOAN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Financier *</label>
                <select style={S.input} value={form.financier} onChange={e => setForm({ ...form, financier: e.target.value })}>
                  <option value="">Select financier...</option>
                  {FINANCIERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Debited Account</label>
                <select style={S.input} value={form.debitedAccount} onChange={e => setForm({ ...form, debitedAccount: e.target.value })}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName} | {a.bankName}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Loan Amount ₹ *</label>
                <input type="number" style={S.input} value={form.loanAmount || ''} onChange={e => setForm({ ...form, loanAmount: parseFloat(e.target.value) || 0 })} placeholder="0" min="0" />
              </div>
              <div>
                <label style={S.label}>Loan Tenure (months)</label>
                <input type="number" style={S.input} value={form.loanTenure || ''} onChange={e => setForm({ ...form, loanTenure: parseInt(e.target.value) || 1 })} min="1" />
              </div>
              <div>
                <label style={S.label}>EMI Amount ₹ *</label>
                <input type="number" style={S.input} value={form.emiAmount || ''} onChange={e => setForm({ ...form, emiAmount: parseFloat(e.target.value) || 0 })} placeholder="0" min="0" />
              </div>
              <div>
                <label style={S.label}>EMI Day of Month *</label>
                <input type="number" style={S.input} value={form.emiDayOfMonth} onChange={e => setForm({ ...form, emiDayOfMonth: parseInt(e.target.value) || 1 })} min="1" max="28" placeholder="1-28" />
              </div>
              <div>
                <label style={S.label}>EMI Start Date *</label>
                <input type="date" style={S.input} value={form.emiStartDate} onChange={e => setForm({ ...form, emiStartDate: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>EMI End Date</label>
                <input type="date" style={S.input} value={form.emiEndDate} onChange={e => setForm({ ...form, emiEndDate: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>EMIs Paid</label>
                <input type="number" style={S.input} value={form.emisPaid} onChange={e => setForm({ ...form, emisPaid: parseInt(e.target.value) || 0 })} min="0" />
              </div>
              <div>
                <label style={S.label}>Remaining EMIs</label>
                <input type="number" style={S.input} value={form.remainingEmis} onChange={e => setForm({ ...form, remainingEmis: parseInt(e.target.value) || 0 })} min="0" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveForm} disabled={saving} style={{ flex: 2, padding: '0.65rem', border: 'none', borderRadius: '8px', background: saving ? '#9ca3af' : '#2563eb', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add Loan' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '360px', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600, color: '#dc2626' }}>Delete Loan?</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteLoan(deleteConfirm)} style={{ flex: 1, padding: '0.6rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
