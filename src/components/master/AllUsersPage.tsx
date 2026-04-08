import { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AppUser, Organization, UserRole } from '../../types';
import { useNavigate } from 'react-router-dom';

const S = {
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' as const, textAlign: 'left' as const, borderBottom: '1px solid #334155', background: '#172033' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' as const },
};

export default function AllUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgs, setOrgs] = useState<Record<string, Organization>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as AppUser)));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'organizations'), snap => {
      const map: Record<string, Organization> = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Organization; });
      setOrgs(map);
    });
    return unsub;
  }, []);

  const handleRoleChange = async (user: AppUser, role: UserRole) => {
    await updateDoc(doc(db, 'users', user.uid), { role });
  };

  const handleRemove = async (user: AppUser) => {
    if (!confirm(`Remove ${user.email} from their tenant?`)) return;
    await updateDoc(doc(db, 'users', user.uid), { orgId: null, role: 'pending' });
  };

  const fmt = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const pendingCount = users.filter(u => !u.orgId).length;
  const filteredUsers = users.filter(u => {
    if (filter === 'unassigned') return !u.orgId;
    if (filter === 'assigned') return !!u.orgId;
    return true;
  });

  const tabs = [
    { key: 'all', label: `All (${users.length})` },
    { key: 'assigned', label: `Assigned (${users.length - pendingCount})` },
    { key: 'unassigned', label: `Unassigned (${pendingCount})` },
  ] as const;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: 0 }}>All Users</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {users.length} total · {pendingCount} unassigned
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '4px', width: 'fit-content', marginBottom: '1rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
              background: filter === t.key ? '#1e3a5f' : 'transparent',
              color: filter === t.key ? 'white' : '#64748b',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>User</th>
                <th style={S.th}>Tenant</th>
                <th style={S.th}>Role</th>
                <th style={S.th}>Created</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.uid}>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'white', fontWeight: 600, flexShrink: 0 }}>
                          {user.email?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ color: 'white', fontWeight: 500 }}>{user.displayName || '—'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={S.td}>
                    {user.orgId ? (
                      <button
                        onClick={() => navigate(`/master/tenants/${user.orgId}`)}
                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', padding: 0 }}
                      >
                        {orgs[user.orgId]?.name || user.orgId}
                      </button>
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={S.td}>
                    {user.orgId ? (
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                        style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ color: '#475569', fontSize: '0.875rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...S.td, color: '#94a3b8' }}>{fmt(user.createdAt)}</td>
                  <td style={S.td}>
                    {user.orgId ? (
                      <button
                        onClick={() => handleRemove(user)}
                        style={{ padding: '0.35rem 0.75rem', background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/master/tenants')}
                        style={{ padding: '0.35rem 0.75rem', background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1e40af', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
