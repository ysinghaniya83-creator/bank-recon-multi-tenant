import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { AppUser, UserRole } from '../../types';

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  admin:   { bg: '#1e3a5f', color: '#60a5fa', border: '#1e40af' },
  editor:  { bg: '#052e16', color: '#4ade80', border: '#166534' },
  viewer:  { bg: '#1a1a3e', color: '#a5b4fc', border: '#3730a3' },
  pending: { bg: '#1c1208', color: '#fbbf24', border: '#92400e' },
};

function Avatar({ user }: { user: AppUser }) {
  return (
    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'white', fontWeight: 700, flexShrink: 0 }}>
      {(user.displayName || user.email)?.[0]?.toUpperCase()}
    </div>
  );
}

export default function UserManagementPage({ orgId }: { orgId: string }) {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  const isAdmin = appUser?.role === 'admin';

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'users'), where('orgId', '==', orgId));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => d.data() as AppUser);
      setUsers(list);
      setLoading(false);
    }, err => {
      console.error('UserManagementPage:', err);
      setLoading(false);
    });
    return unsub;
  }, [orgId]);

  const pending = users.filter(u => u.role === 'pending');
  const active  = users.filter(u => u.role !== 'pending');

  const approveUser = async (user: AppUser) => {
    const role = pendingRoles[user.uid] || 'editor';
    await updateDoc(doc(db, 'users', user.uid), { role });
  };

  const rejectUser = async (user: AppUser) => {
    if (!confirm(`Remove ${user.email}'s request?`)) return;
    await updateDoc(doc(db, 'users', user.uid), { orgId: null, role: 'pending' });
  };

  const changeRole = async (user: AppUser, role: UserRole) => {
    await updateDoc(doc(db, 'users', user.uid), { role });
  };

  const removeUser = async (user: AppUser) => {
    if (!confirm(`Remove ${user.email} from this company?`)) return;
    await updateDoc(doc(db, 'users', user.uid), { orgId: null, role: 'pending' });
  };

  const card: React.CSSProperties = { background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '1rem' };
  const th: React.CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' };
  const td: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' };

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
          <div style={{ fontWeight: 600 }}>Admin access required</div>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ color: '#64748b', padding: '2rem' }}>Loading users…</div>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>User Management</h2>
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{active.length} active · {pending.length} pending</p>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#d97706', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>{pending.length}</span>
            Pending Join Requests
          </h3>
          <div style={{ ...card, border: '1px solid #fde68a' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, background: '#fffbeb' }}>User</th>
                  <th style={{ ...th, background: '#fffbeb' }}>Assign Role</th>
                  <th style={{ ...th, background: '#fffbeb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(user => (
                  <tr key={user.uid}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Avatar user={user} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{user.displayName || '—'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <select
                        value={pendingRoles[user.uid] || 'editor'}
                        onChange={e => setPendingRoles(p => ({ ...p, [user.uid]: e.target.value as UserRole }))}
                        style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'white', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => approveUser(user)}
                          style={{ padding: '0.35rem 0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => rejectUser(user)}
                          style={{ padding: '0.35rem 0.7rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active users */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.75rem' }}>Active Members ({active.length})</h3>
        <div style={card}>
          {active.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>No active users yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Role</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map(user => {
                  const isSelf = user.uid === appUser?.uid;
                  return (
                    <tr key={user.uid}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar user={user} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>{user.displayName || '—'}</span>
                              {isSelf && <span style={{ fontSize: '0.7rem', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', padding: '0 0.4rem' }}>you</span>}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={td}>
                        {isSelf ? (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, ...ROLE_COLORS[user.role], padding: '0.2rem 0.6rem', borderRadius: '9999px', border: `1px solid ${ROLE_COLORS[user.role]?.border}` }}>{user.role}</span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={e => changeRole(user, e.target.value as UserRole)}
                            style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'white', cursor: 'pointer', outline: 'none' }}
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                      </td>
                      <td style={td}>
                        {!isSelf && (
                          <button
                            onClick={() => removeUser(user)}
                            style={{ padding: '0.35rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
