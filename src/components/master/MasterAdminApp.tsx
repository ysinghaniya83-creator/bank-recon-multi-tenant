import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import TenantsList from './TenantsList';
import TenantDetail from './TenantDetail';
import AllUsersPage from './AllUsersPage';

const S = {
  wrap: { display: 'flex', minHeight: '100vh', background: '#0f172a', color: 'white' } as React.CSSProperties,
  sidebar: { width: '220px', flexShrink: 0, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column' as const, minHeight: '100vh' },
  sidebarHeader: { padding: '1.25rem 1rem', borderBottom: '1px solid #334155' },
  sidebarLabel: { fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#475569', marginBottom: '0.25rem' },
  sidebarTitle: { color: 'white', fontWeight: 700, fontSize: '1rem' },
  nav: { padding: '0.75rem', display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const },
  header: { background: '#1e293b', borderBottom: '1px solid #334155', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  headerTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'white' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  email: { fontSize: '0.8rem', color: '#64748b' },
  signOutBtn: { padding: '0.4rem 0.9rem', background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 },
  content: { flex: 1, padding: '1.5rem', overflowY: 'auto' as const },
};

function NavItem({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem',
        borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none',
        background: isActive ? '#1e3a5f' : 'transparent',
        color: isActive ? 'white' : '#94a3b8',
        transition: 'all 0.15s',
      })}
    >
      {icon} {label}
    </NavLink>
  );
}

export default function MasterAdminApp({ onSwitchToApp }: { onSwitchToApp?: (orgId: string) => void }) {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const openPicker = async () => {
    setShowPicker(true);
    setLoadingOrgs(true);
    try {
      const snap = await getDocs(collection(db, 'organizations'));
      setOrgs(snap.docs.map(d => ({ id: d.id, name: (d.data() as { name: string }).name || d.id })));
    } catch (e) {
      console.error('Failed to load orgs:', e);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
    <div style={S.wrap}>
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarLabel}>Master Admin</div>
          <div style={S.sidebarTitle}>Control Panel</div>
        </div>
        <nav style={S.nav}>
          <NavItem to="/master/tenants" label="Tenants" icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          } />
          <NavItem to="/master/users" label="All Users" icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          } />
        </nav>
      </div>

      <div style={S.main}>
        <div style={S.header}>
          <div style={S.headerTitle}>Master Admin Console</div>
          <div style={S.headerRight}>
            <span style={S.email}>{currentUser?.email}</span>
            {onSwitchToApp && (
              <button onClick={openPicker} style={{ padding: '0.4rem 0.9rem', background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1d4ed8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>Switch to App</button>
            )}
            <button onClick={handleSignOut} style={S.signOutBtn}>Sign Out</button>
          </div>
        </div>
        <div style={S.content}>
          <Routes>
            <Route path="tenants" element={<TenantsList />} />
            <Route path="tenants/:orgId" element={<TenantDetail />} />
            <Route path="users" element={<AllUsersPage />} />
            <Route path="*" element={<TenantsList />} />
          </Routes>
        </div>
      </div>
    </div>

    {/* Tenant picker modal */}
    {showPicker && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', width: '380px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Select a Tenant</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Choose which organisation to view</div>
            </div>
            <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {loadingOrgs && <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Loading tenants…</div>}
            {!loadingOrgs && orgs.length === 0 && <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No tenants found.</div>}
            {orgs.map(org => (
              <button key={org.id} onClick={() => { setShowPicker(false); onSwitchToApp!(org.id); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
              >
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>{org.name}</div>
                  <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '1px' }}>{org.id}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
