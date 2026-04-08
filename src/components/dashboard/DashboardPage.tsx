import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BankAccount, Transaction } from '../../types';
import Chart from 'chart.js/auto';

const ENTITY_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#db2777'];

function fmt(n: number | null | undefined, compact = false): string {
  const num = Number(n || 0);
  if (compact && Math.abs(num) >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }

export default function DashboardPage({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today());
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<Chart | null>(null);

  useEffect(() => {
    const q1 = query(collection(db, 'bankAccounts'), where('orgId', '==', orgId));
    const q2 = query(collection(db, 'transactions'), where('orgId', '==', orgId));
    let loaded1 = false, loaded2 = false;
    const unsub1 = onSnapshot(q1, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
      loaded1 = true; if (loaded1 && loaded2) setLoading(false);
    });
    const unsub2 = onSnapshot(q2, snap => {
      setTxns(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      loaded2 = true; if (loaded1 && loaded2) setLoading(false);
    });
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { unsub1(); unsub2(); clearTimeout(timer); };
  }, [orgId]);

  const entityStats = useMemo(() => {
    return accounts.map(acc => {
      const allTxns = txns.filter(t => t.accountId === acc.id);
      const opening_balance = Number(acc.openingBalance || 0);
      const beforeDate = allTxns.filter(t => t.date < date);
      const openingAdj = opening_balance
        + beforeDate.reduce((s, t) => s + (Number(t.credit) || 0), 0)
        - beforeDate.reduce((s, t) => s + (Number(t.debit) || 0), 0);
      const todayTxns = allTxns.filter(t => t.date === date);
      const credit = todayTxns.reduce((s, t) => s + (Number(t.credit) || 0), 0);
      const debit = todayTxns.reduce((s, t) => s + (Number(t.debit) || 0), 0);
      const net = credit - debit;
      const closing = openingAdj + net;
      let status = '— No Activity';
      if (credit > 0 || debit > 0) status = net >= 0 ? '▲ Surplus' : '▼ Deficit';
      return { ...acc, opening: openingAdj, credit, debit, net, closing, status, todayTxns };
    });
  }, [accounts, txns, date]);

  const grand = useMemo(() => ({
    opening: entityStats.reduce((s, e) => s + e.opening, 0),
    credit: entityStats.reduce((s, e) => s + e.credit, 0),
    debit: entityStats.reduce((s, e) => s + e.debit, 0),
    net: entityStats.reduce((s, e) => s + e.net, 0),
    closing: entityStats.reduce((s, e) => s + e.closing, 0),
  }), [entityStats]);

  const todayAllTxns = useMemo(() =>
    txns.filter(t => t.date === date).sort((a, b) => a.date > b.date ? 1 : -1),
    [txns, date]);

  const chartData = useMemo(() => {
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days.map(d => {
      const total = accounts.reduce((sum, acc) => {
        const base = Number(acc.openingBalance || 0);
        const rel = txns.filter(t => t.accountId === acc.id && t.date <= d);
        return sum + base
          + rel.reduce((s, t) => s + (Number(t.credit) || 0), 0)
          - rel.reduce((s, t) => s + (Number(t.debit) || 0), 0);
      }, 0);
      return { date: d.slice(5), total };
    });
  }, [accounts, txns]);

  useEffect(() => {
    if (!chartRef.current || !chartData.length) return;
    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current.getContext('2d')!, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.date),
        datasets: [{
          label: 'Total Closing Balance',
          data: chartData.map(d => d.total),
          borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)',
          borderWidth: 2, fill: true, tension: 0.4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `₹${Number(c.parsed.y).toLocaleString('en-IN')}` } } },
        scales: {
          y: { ticks: { callback: (v) => `₹${(Number(v) / 100000).toFixed(0)}L` }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      },
    });
    return () => { if (chartInst.current) chartInst.current.destroy(); };
  }, [chartData]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Executive Financial Dashboard</h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Opening = prev day closing · Credit & Debit = selected date · Closing = Opening + Credit − Debit</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.45rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: 'white' }} />
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
        {[
          { l: 'Total Opening', v: grand.opening, bg: '#475569', color: 'white' },
          { l: 'Total Credit In', v: grand.credit, bg: '#059669', color: 'white' },
          { l: 'Total Debit Out', v: grand.debit, bg: '#dc2626', color: 'white' },
          { l: 'Net Movement', v: grand.net, bg: grand.net >= 0 ? '#2563eb' : '#ea580c', color: 'white' },
          { l: 'Total Closing', v: grand.closing, bg: '#4f46e5', color: 'white' },
        ].map(s => (
          <div key={s.l} style={{ background: s.bg, borderRadius: '12px', padding: '1rem', color: s.color }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px' }}>{fmt(s.v, true)}</div>
          </div>
        ))}
      </div>

      {/* Entity table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Entity-wise Balance</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Date: {date}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: 'white' }}>
                {['#', 'Entity | Bank', 'Opening ₹', 'Credit In ₹', 'Debit Out ₹', 'Net ₹', 'Closing ₹', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === '#' || h === 'Status' ? 'center' : h.includes('₹') ? 'right' : 'left', fontWeight: 600, fontSize: '0.8rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No accounts configured. Add accounts in the Accounts tab.</td></tr>
              ) : entityStats.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '4px', height: '32px', borderRadius: '2px', background: ENTITY_COLORS[i % ENTITY_COLORS.length], flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>{e.accountName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{e.bankName}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{fmt(e.opening)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{e.credit > 0 ? fmt(e.credit) : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{e.debit > 0 ? fmt(e.debit) : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: e.net > 0 ? '#059669' : e.net < 0 ? '#dc2626' : '#94a3b8' }}>
                    {e.net !== 0 ? (e.net > 0 ? '+' : '') + fmt(e.net) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(e.closing)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      background: e.status.includes('Surplus') ? '#dcfce7' : e.status.includes('Deficit') ? '#fee2e2' : '#f1f5f9',
                      color: e.status.includes('Surplus') ? '#166534' : e.status.includes('Deficit') ? '#991b1b' : '#64748b',
                    }}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {accounts.length > 0 && (
                <tr style={{ background: '#1e293b', color: 'white', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '0.75rem 1rem' }}>GRAND TOTAL  (All Entities)</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmt(grand.opening)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#86efac' }}>{fmt(grand.credit)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#fca5a5' }}>{fmt(grand.debit)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: grand.net >= 0 ? '#86efac' : '#fca5a5' }}>{fmt(grand.net)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#bfdbfe' }}>{fmt(grand.closing)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart + Today's transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1.25rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>Balance Trend (14 days)</div>
          <div style={{ height: '180px' }}><canvas ref={chartRef} /></div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Transactions on {date}</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>({todayAllTxns.length} entries)</span>
          </div>
          {todayAllTxns.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#94a3b8', fontSize: '0.875rem' }}>
              No transactions for this date
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Entity</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#059669', fontSize: '0.7rem', textTransform: 'uppercase' }}>Credit</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#dc2626', fontSize: '0.7rem', textTransform: 'uppercase' }}>Debit</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAllTxns.map((t, i) => {
                    const acc = accounts.find(a => a.id === t.accountId);
                    return (
                      <tr key={t.id || i} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{acc?.accountName || '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#1e293b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span style={{ padding: '0.15rem 0.4rem', background: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontSize: '0.7rem' }}>{t.category || '—'}</span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#059669' }}>{t.credit ? fmt(t.credit) : '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{t.debit ? fmt(t.debit) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
