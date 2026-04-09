import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/auth/LoadingScreen';
import LoginScreen from './components/auth/LoginScreen';
import CompanyCodeScreen from './components/auth/CompanyCodeScreen';
import PendingApprovalScreen from './components/auth/PendingApprovalScreen';
import MasterAdminApp from './components/master/MasterAdminApp';
import RegularApp from './components/dashboard/RegularApp';

function AppRoutes() {
  const { currentUser, appUser, isMasterAdmin, loading } = useAuth();
  const [viewRegularApp, setViewRegularApp] = useState(false);

  if (loading) return <LoadingScreen />;

  if (!currentUser) return <LoginScreen />;

  if (isMasterAdmin && !viewRegularApp) {
    return (
      <Routes>
        <Route path="/master/*" element={<MasterAdminApp onSwitchToApp={() => setViewRegularApp(true)} />} />
        <Route path="*" element={<Navigate to="/master" replace />} />
      </Routes>
    );
  }

  if (!appUser) return <LoadingScreen />;

  // Master admin viewing regular app
  if (isMasterAdmin && viewRegularApp) {
    return <RegularApp onSwitchToMaster={() => setViewRegularApp(false)} />;
  }

  // No org yet → enter company invite code
  if (!appUser.orgId) return <CompanyCodeScreen />;

  // Org assigned but admin hasn't approved yet
  if (appUser.role === 'pending') return <PendingApprovalScreen />;

  // Fully active user
  return <RegularApp />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
