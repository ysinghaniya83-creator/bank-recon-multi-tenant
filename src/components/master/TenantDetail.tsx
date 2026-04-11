import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AppUser, Organization, UserRole } from '../../types';
import { useParams, useNavigate } from 'react-router-dom';

const S = {
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' as const, textAlign: 'left' as const, borderBottom: '1px solid #334155', background: '#172033' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' as const },
  sectionTitle: { fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 0.75rem' } as React.CSSProperties,
};

function Avatar({ user }: { user: AppUser }) {
  if (user.photoURL) return <img src={user.photoURL} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0 }} />;
  return (
    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'white', fontWeight: 700, flexShrink: 0 }}>
      {user.email?.[0]?.toUpperCase()}
    </div>
  );
}

export default function TenantDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organization | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AppUser[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getDoc(doc(db, 'organizations', orgId)).then(d => {
      if (d.exists()) setOrg({ id: d.id, ...d.data() } as Organization);
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const q1 = query(collection(db, 'users'), where('orgId', '==', orgId));
    const unsub1 = onSnapshot(q1, snap => {
      setAssignedUsers(snap.docs.map(d => d.data() as AppUser));
      setLoading(false);
    });
    const q2 = query(collection(db, 'users'), where('orgId', '==', null));
    const unsub2 = onSnapshot(q2, snap => {
      setUnassignedUsers(snap.docs.map(d => d.data() as AppUser));
    });
    return () => { unsub1(); unsub2(); };
  }, [orgId]);

  const handleRoleChange = async (user: AppUser, role: UserRole) => {
    await updateDoc(doc(db, 'users', user.uid), { role });
  };

  const removeUser = async (user: AppUser) => {
    if (!confirm(`Remove ${user.email} from this tenant?`)) return;
    await updateDoc(doc(db, 'users', user.uid), { orgId: null, role: 'pending' });
  };

  const assignUser = async (user: AppUser, role: UserRole) => {
    await updateDoc(doc(db, 'users', user.uid), { orgId, role });
  };

  const generateInviteCode = async () => {
    if (!orgId || !org) return;
    setGeneratingCode(true);
    try {
      // Delete old code doc if exists
      if (org.inviteCode) {
        await deleteDoc(doc(db, 'orgCodes', org.inviteCode));
      }
      // Generate new random 8-char uppercase code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const newCode = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      // Save code mapping (readable by all authenticated users)
      await setDoc(doc(db, 'orgCodes', newCode), { orgId, orgName: org.name, adminSet: false });
      // Update org doc
      await updateDoc(doc(db, 'organizations', orgId), { inviteCode: newCode });
      setOrg(o => o ? { ...o, inviteCode: newCode } : o);
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyCode = () => {
    if (!org?.inviteCode) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (loading) return <div style={{ padding: '3rem', color: '#64748b' }}>Loading...</div>;
  if (!org) return <div style={{ padding: '3rem', color: '#ef4444' }}>Organization not found.</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
        <button onClick={() => navigate('/master/tenants')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}>
          Tenants
        </button>
        <span>›</span>
        <span style={{ color: 'white' }}>{org.name}</span>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: '0 0 0.25rem' }}>{org.name}</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{
            display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
            background: org.status === 'active' ? '#052e16' : '#300',
            color: org.status === 'active' ? '#4ade80' : '#f87171',
            border: `1px solid ${org.status === 'active' ? '#166534' : '#7f1d1d'}`,
          }}>
            {org.status === 'active' ? 'Active' : 'Suspended'}
          </span>
          <span style={{ color: '#475569', fontSize: '0.8rem' }}>ID: {org.id}</span>
        </div>
      </div>

      {/* Invite Code Card */}
      <div style={{ background: '#0f2027', border: '1px solid #1e4a6e', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
              Company Invite Code
            </div>
            {org.inviteCode ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.2em', color: 'white', fontFamily: 'monospace' }}>{org.inviteCode}</span>
                <button
                  onClick={copyCode}
                  style={{ padding: '0.3rem 0.75rem', background: codeCopied ? '#052e16' : '#1e3a5f', color: codeCopied ? '#4ade80' : '#60a5fa', border: `1px solid ${codeCopied ? '#166534' : '#1e40af'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                >
                  {codeCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <span style={{ color: '#475569', fontSize: '0.875rem' }}>No code generated yet</span>
            )}
            <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0.4rem 0 0' }}>Share this code with users to let them join this company</p>
          </div>
          <button
            onClick={generateInviteCode}
            disabled={generatingCode}
            style={{ padding: '0.5rem 1rem', background: generatingCode ? '#1e3a5f' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: generatingCode ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {generatingCode ? 'Generating…' : org.inviteCode ? '🔄 New Code' : '+ Generate Code'}
          </button>
        </div>
      </div>

      {/* Assigned users */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={S.sectionTitle}>Assigned Users ({assignedUsers.length})</h3>
        <div style={S.card}>
          {assignedUsers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>No users assigned yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={S.th}>User</th>
                  <th style={S.th}>Role</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedUsers.map(user => (
                  <tr key={user.uid}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Avatar user={user} />
                        <div>
                          <div style={{ color: 'white', fontWeight: 500 }}>{user.displayName || '—'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                        style={{ background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => removeUser(user)}
                        style={{ padding: '0.35rem 0.75rem', background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Unassigned users */}
      {unassignedUsers.length > 0 && (
        <div>
          <h3 style={{ ...S.sectionTitle, color: '#f59e0b' }}>Unassigned Users — Assign to this Tenant</h3>
          <div style={{ ...S.card, border: '1px solid #92400e' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, background: '#1c1208' }}>User</th>
                  <th style={{ ...S.th, background: '#1c1208' }}>Assign As</th>
                </tr>
              </thead>
              <tbody>
                {unassignedUsers.map(user => (
                  <tr key={user.uid}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Avatar user={user} />
                        <div>
                          <div style={{ color: 'white', fontWeight: 500 }}>{user.displayName || '—'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(['admin', 'editor', 'viewer'] as UserRole[]).map(role => (
                          <button
                            key={role}
                            onClick={() => assignUser(user, role)}
                            style={{
                              padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, border: '1px solid', textTransform: 'capitalize',
                              background: role === 'admin' ? '#1e3a5f' : role === 'editor' ? '#052e16' : '#1a1a3e',
                              color: role === 'admin' ? '#60a5fa' : role === 'editor' ? '#4ade80' : '#a5b4fc',
                              borderColor: role === 'admin' ? '#1e40af' : role === 'editor' ? '#166534' : '#3730a3',
                            }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
