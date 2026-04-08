import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Organization } from '../../types';
import DashboardPage from './DashboardPage';
import LedgerPage from './LedgerPage';
import AccountsPage from './AccountsPage';
import UploadPage from './UploadPage';
import SettingsPage from './SettingsPage';
import UserManagementPage from './UserManagementPage';
import EMIPage from './EMIPage';
import ActivityLogsPage from './ActivityLogsPage';

type Page = 'dashboard' | 'upload' | 'ledger' | 'accounts' | 'users' | 'emi' | 'logs' | 'settings';

const NAV: { id: Page; label: string; icon: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: '📊' },
  { id: 'upload',    label: 'Upload',       icon: '⬆️' },
  { id: 'ledger',    label: 'Full Ledger',  icon: '📋' },
  { id: 'accounts',  label: 'Accounts',     icon: '🏦' },
  { id: 'emi',       label: 'EMI Tracker',  icon: '🚗' },
  { id: 'users',     label: 'Users',        icon: '👥', adminOnly: true },
  { id: 'logs',      label: 'Activity Logs',icon: '📝', adminOnly: true },
  { id: 'settings',  label: 'Settings',     icon: '⚙️' },
];

export const ENTITY_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#db2777'];

export default function RegularApp() {
  const { appUser, signOut } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    if (appUser?.orgId) {
      const fetchOrgName = async () => {
        try {
          const snap = await getDoc(doc(db, 'organizations', appUser.orgId!));
          if (snap.exists()) {
            setOrgName((snap.data() as Organization).name);
          }
        } catch (e) {
          console.error('Failed to fetch org name:', e);
        }
      };
      fetchOrgName();
    }
  }, [appUser?.orgId]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: '200px', flexShrink: 0, background: '#111827', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{orgName || 'Loading...'}</div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '2px' }}>Bank Reconciliation</div>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.filter(n => !n.adminOnly || appUser?.role === 'admin').map(({ id, label, icon }) => (
            <button key={id} onClick={() => setPage(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.6rem 0.75rem', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, textAlign: 'left',
              background: page === id ? '#1d4ed8' : 'transparent',
              color: page === id ? 'white' : '#9ca3af',
            }}>
              <span style={{ fontSize: '1rem' }}>{icon}</span> {label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#4b5563', textAlign: 'center' }}>
          v2.0 · Multi-tenant
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{appUser?.displayName}</span>
            <span style={{ margin: '0 0.4rem' }}>·</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'capitalize' }}>{appUser?.role}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{appUser?.email}</span>
            <button onClick={() => signOut()} style={{ padding: '0.35rem 0.9rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
              Sign Out
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          {page === 'dashboard' && <DashboardPage orgId={appUser!.orgId!} />}
          {page === 'upload'    && <UploadPage orgId={appUser!.orgId!} />}
          {page === 'ledger'    && <LedgerPage orgId={appUser!.orgId!} />}
          {page === 'accounts'  && <AccountsPage orgId={appUser!.orgId!} />}
          {page === 'emi'       && <EMIPage orgId={appUser!.orgId!} />}
          {page === 'users'     && <UserManagementPage orgId={appUser!.orgId!} />}
          {page === 'logs'      && <ActivityLogsPage orgId={appUser!.orgId!} />}
          {page === 'settings'  && <SettingsPage orgId={appUser!.orgId!} />}
        </div>
      </main>
    </div>
  );
}
