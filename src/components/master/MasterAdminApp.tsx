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

export default function MasterAdminApp({ onSwitchToApp }: { onSwitchToApp?: () => void }) {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
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
              <button onClick={onSwitchToApp} style={{ padding: '0.4rem 0.9rem', background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1d4ed8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>Switch to App</button>
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
  );
}
