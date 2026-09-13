import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Identities } from './pages/Identities';
import { Assets } from './pages/Assets';
import { Roles } from './pages/Roles';
import { AuditLogs } from './pages/Audit';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { Verification } from './pages/Verification';
import { Transactions } from './pages/Transactions';
import { Notifications } from './pages/Notifications';
import { Administration } from './pages/Administration';
import { AccessRequests } from './pages/AccessRequests';
import { LandingPage } from './pages/LandingPage';
import { APP_CONFIG } from './config/constants';

// ─── Login Page ───────────────────────────────────────────────────────────────

const Login = () => {
  const { loginWithDid, isLoading } = useAuthStore();

  const [did, setDid] = React.useState('');
  const [privateKey, setPrivateKey] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleDidLogin = async (e) => {
    e.preventDefault();
    if (!did || !privateKey) {
      setError('Please enter your DID and Private Key.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const api = (await import('./utils/api')).default;
      const challengeRes = await api.post('/auth/did-challenge', { did });
      const nonce = challengeRes.data.data.nonce;

      const { ethers } = await import('ethers');
      const wallet = new ethers.Wallet(privateKey);
      const message = `Sign this message to authenticate with ${APP_CONFIG.BRAND_NAME}. Nonce: ${nonce}`;
      const signature = await wallet.signMessage(message);

      const result = await loginWithDid(did, signature, nonce);
      if (!result.success) throw new Error(result.error);
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'DID Authentication failed.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel — branding and image */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo" style={{ overflow: 'hidden', padding: 0 }}>
            <img src="/surakshavault-logo.jpg" alt="SurakshaVault Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="login-brand-name">{APP_CONFIG.BRAND_NAME}</span>
        </div>

        <div className="login-hero">
          <h1 className="login-hero-title">
            Enterprise Identity<br/>& Asset Management
          </h1>
          <p className="login-hero-sub">
            Secure, role-based access to your organization's digital assets and decentralized identities — anchored on Ethereum.
          </p>
          <div className="login-features">
            {[
              { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'W3C Decentralized Identifiers' },
              { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Enterprise Role-Based Access Control' },
              { icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', label: 'Immutable Blockchain Audit Trail' },
            ].map(f => (
              <div key={f.label} className="login-feature">
                <div className="login-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={f.icon} />
                  </svg>
                </div>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-footer-left">
          {APP_CONFIG.BRAND_NAME} Platform v{APP_CONFIG.VERSION} · Enterprise Edition
        </div>
      </div>

      {/* Right panel — form */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-form-header">
            <h2 className="login-form-title">Sign in</h2>
            <p className="login-form-sub">
              Authenticate using your decentralized identity.
            </p>
          </div>

          {error && (
            <div className="login-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleDidLogin} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="did" className="login-label">Decentralized Identifier (DID)</label>
              <input
                id="did" type="text" className="login-input"
                value={did} onChange={e => setDid(e.target.value)}
                placeholder="did:ethr:11155111:0x..."
                required disabled={submitting}
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <label htmlFor="privateKey" className="login-label">Private Key</label>
              <div className="login-input-group">
                <input
                  id="privateKey"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={privateKey} onChange={e => setPrivateKey(e.target.value)}
                  placeholder="0x..."
                  required disabled={submitting}
                  autoComplete="current-password"
                />
                <button type="button" className="login-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Your key is used locally to sign the authentication challenge and is never transmitted.
              </p>
            </div>

            <button type="submit" className="login-btn" disabled={submitting || isLoading}>
              {submitting && <span className="spinner-sm" />}
              {submitting ? 'Verifying signature…' : 'Sign in with DID'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Protected Route ──────────────────────────────────────────────────────────

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div className="loading-spinner-large" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => {
  const { checkAuth, isAuthenticated } = useAuthStore();

  React.useEffect(() => { checkAuth(); }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        <Route path="/" element={<LandingPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="identities" element={<Identities />} />
          <Route path="verification" element={<Verification />} />
          <Route path="assets" element={<Assets />} />
          <Route path="roles" element={<Roles />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="access-requests" element={<AccessRequests />} />
          <Route path="administration" element={<Administration />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
