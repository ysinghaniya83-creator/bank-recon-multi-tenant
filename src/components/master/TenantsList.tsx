import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Organization } from '../../types';
import { useNavigate } from 'react-router-dom';

const S = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
  heading: { fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: 0 } as React.CSSProperties,
  subtext: { color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' } as React.CSSProperties,
  primaryBtn: { padding: '0.6rem 1.25rem', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 } as React.CSSProperties,
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' as const, textAlign: 'left' as const, borderBottom: '1px solid #334155', background: '#172033' },
  td: { padding: '0.85rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' as const },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' } as React.CSSProperties,
  input: { width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' } as React.CSSProperties,
  cancelBtn: { padding: '0.55rem 1.1rem', background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' } as React.CSSProperties,
  createBtn: { padding: '0.55rem 1.1rem', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 } as React.CSSProperties,
};

export default function TenantsList() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const createTenant = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'organizations'), {
        name: newName.trim(),
        adminEmail: newEmail.trim() || null,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid,
      });
      setShowModal(false);
      setNewName('');
      setNewEmail('');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (org: Organization) => {
    const newStatus = org.status === 'active' ? 'suspended' : 'active';
    await updateDoc(doc(db, 'organizations', org.id), { status: newStatus });
  };

  const fmt = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      {/* Header row */}
      <div style={S.row}>
        <div>
          <h2 style={S.heading}>Tenants</h2>
          <p style={S.subtext}>{orgs.length} organizations</p>
        </div>
        <button onClick={() => setShowModal(true)} style={S.primaryBtn}>+ New Tenant</button>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : orgs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>
            No tenants yet. Click <strong style={{ color: 'white' }}>+ New Tenant</strong> to create one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Organization</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Created</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id}>
                  <td style={S.td}>
                    <div style={{ color: 'white', fontWeight: 500 }}>{org.name}</div>
                    {org.adminEmail && <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{org.adminEmail}</div>}
                  </td>
                  <td style={S.td}>
                    <span style={{
                      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      background: org.status === 'active' ? '#052e16' : '#300',
                      color: org.status === 'active' ? '#4ade80' : '#f87171',
                      border: `1px solid ${org.status === 'active' ? '#166534' : '#7f1d1d'}`,
                    }}>
                      {org.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: '#94a3b8' }}>{fmt(org.createdAt)}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/master/tenants/${org.id}`)}
                        style={{ padding: '0.35rem 0.75rem', background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1e40af', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => toggleStatus(org)}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, border: '1px solid',
                          background: org.status === 'active' ? '#300' : '#052e16',
                          color: org.status === 'active' ? '#f87171' : '#4ade80',
                          borderColor: org.status === 'active' ? '#7f1d1d' : '#166534',
                        }}
                      >
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={S.modal}>
            <h3 style={{ margin: '0 0 1.25rem', color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Create New Tenant</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={S.label}>Company Name *</label>
              <input
                style={S.input}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && createTenant()}
              />
            </div>

            <div style={{ marginBottom: '0.25rem' }}>
              <label style={S.label}>Admin Email (optional)</label>
              <input
                style={S.input}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="admin@acme.com"
                type="email"
              />
            </div>

            <div style={S.modalFooter}>
              <button onClick={() => setShowModal(false)} style={S.cancelBtn}>Cancel</button>
              <button onClick={createTenant} disabled={saving || !newName.trim()} style={{ ...S.createBtn, opacity: (saving || !newName.trim()) ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
