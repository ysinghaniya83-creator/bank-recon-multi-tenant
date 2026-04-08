import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { UserLog } from '../../types';

function formatTs(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  'upload':    { bg: '#eff6ff', color: '#2563eb' },
  'add':       { bg: '#f0fdf4', color: '#16a34a' },
  'edit':      { bg: '#fffbeb', color: '#d97706' },
  'delete':    { bg: '#fef2f2', color: '#dc2626' },
};

function actionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : { bg: '#f1f5f9', color: '#64748b' };
}

export default function ActivityLogsPage({ orgId }: { orgId: string }) {
  const { appUser } = useAuth();
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');

  // Only admin can access this page
  if (appUser?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Admin access required to view activity logs.</div>
      </div>
    );
  }

  useEffect(() => {
    const q = query(
      collection(db, 'userLogs'),
      where('orgId', '==', orgId),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserLog)));
      setLoading(false);
    }, () => setLoading(false));
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(timer); };
  }, [orgId]);

  // Unique user emails for filter dropdown
  const uniqueUsers = [...new Set(logs.map(l => l.userEmail).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    if (filterUser && l.userEmail !== filterUser) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.action?.toLowerCase().includes(q) && !l.details?.toLowerCase().includes(q) && !l.userEmail?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const S = {
    th: { padding: '0.65rem 1rem', textAlign: 'left' as const, fontWeight: 600, fontSize: '0.75rem', color: 'white', background: '#1e293b', whiteSpace: 'nowrap' as const },
    td: { padding: '0.6rem 1rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' as const },
    input: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box' as const },
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#64748b' }}>Loading activity logs...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Activity Logs</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Last 200 actions by your team (newest first)</p>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' as const }}>
        <input style={{ ...S.input, maxWidth: '280px' }} placeholder="Search action or details..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...S.input, maxWidth: '220px' }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">All Users</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>{filtered.length} log{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Logs Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Timestamp</th>
                <th style={S.th}>User</th>
                <th style={S.th}>Action</th>
                <th style={S.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    {logs.length === 0 ? 'No activity logged yet. Actions like uploading statements, adding transactions, etc. will appear here.' : 'No matching logs found.'}
                  </td>
                </tr>
              ) : filtered.map((log, i) => {
                const style = actionStyle(log.action || '');
                return (
                  <tr key={log.id} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' as const, color: '#64748b' }}>{formatTs(log.timestamp)}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8rem' }}>{log.userEmail || '—'}</div>
                    </td>
                    <td style={S.td}>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, background: style.bg, color: style.color }}>
                        {log.action || '—'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#374151', maxWidth: '400px' }}>{log.details || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {logs.length >= 200 && (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
          Showing most recent 200 logs.
        </p>
      )}
    </div>
  );
}
