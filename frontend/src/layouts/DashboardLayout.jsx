import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { APP_CONFIG } from '../config/constants';
import api from '../utils/api';
import {
  LayoutDashboard, Users, Package, ShieldCheck, Activity,
  Settings, LogOut, Bell, FileText, Key, Building2,
  Layers, ArrowLeftRight, ChevronRight
} from 'lucide-react';

// ─── Sidebar Item ─────────────────────────────────────────────────────────────
const SidebarItem = ({ to, icon: Icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
  >
    <Icon size={14} strokeWidth={1.75} />
    <span>{label}</span>
  </NavLink>
);

// ─── Notification Panel ───────────────────────────────────────────────────────
const NotificationPanel = ({ onClose }) => {
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.get('/notifications')
      .then(r => { setNotifications(r.data.data.notifications || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        <button className="notif-read-all-btn" onClick={markAllRead}>Mark all read</button>
      </div>
      <div className="notif-list">
        {loading ? (
          <div className="loading-row" style={{ padding: '1.5rem' }}>
            <span className="spinner-sm-dark" />
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">No notifications</div>
        ) : (
          notifications.slice(0, 8).map(n => (
            <div
              key={n.id}
              className={`notif-item${!n.isRead ? ' unread' : ''}`}
              onClick={() => markRead(n.id)}
            >
              <div className={`notif-item-dot${n.isRead ? ' read' : ''}`} />
              <div className="notif-item-body">
                <div className="notif-item-title">{n.title}</div>
                {n.body && <div className="notif-item-text">{n.body}</div>}
                <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Page Title from route ────────────────────────────────────────────────────
const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/dashboard/identities': 'Identities',
  '/dashboard/verification': 'Verification',
  '/dashboard/assets': 'Assets',
  '/dashboard/roles': 'Roles & Permissions',
  '/dashboard/audit': 'Audit Trail',
  '/dashboard/transactions': 'Transactions',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/administration': 'Administration',
  '/dashboard/settings': 'Settings',
};

// ─── Dashboard Layout ─────────────────────────────────────────────────────────
export const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  const pageTitle = PAGE_TITLES[location.pathname] || APP_CONFIG.BRAND_NAME;
  const isAdmin = user?.roles?.includes('admin');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  React.useEffect(() => {
    const fetchUnread = () => {
      api.get('/notifications')
        .then(r => setUnreadCount(r.data.data.unreadCount || 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!showNotifs) return;
    const handler = (e) => {
      if (!e.target.closest('.notif-wrapper')) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  return (
    <div className="layout-wrapper">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo" style={{ overflow: 'hidden', padding: 0 }}>
            <img src="/surakshavault-logo.jpg" alt="SurakshaVault Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="sidebar-brand">{APP_CONFIG.BRAND_NAME}</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />

          <div className="nav-section-label">Identity</div>
          <SidebarItem to="/dashboard/identities" icon={Users} label="Identities" />
          <SidebarItem to="/dashboard/verification" icon={ShieldCheck} label="Verification" />

          <div className="nav-section-label">Assets</div>
          <SidebarItem to="/dashboard/assets" icon={Package} label="Assets" />

          <div className="nav-section-label">Access</div>
          <SidebarItem to="/dashboard/roles" icon={Key} label="Roles & Permissions" />

          <div className="nav-section-label">Compliance</div>
          <SidebarItem to="/dashboard/audit" icon={Activity} label="Audit Trail" />
          <SidebarItem to="/dashboard/transactions" icon={ArrowLeftRight} label="Transactions" />

          <div className="nav-section-label">System</div>
          <SidebarItem to="/dashboard/notifications" icon={Bell} label="Notifications" />
          {isAdmin && <SidebarItem to="/dashboard/access-requests" icon={FileText} label="Access Requests" />}
          {isAdmin && <SidebarItem to="/dashboard/administration" icon={Building2} label="Administration" />}
          <SidebarItem to="/dashboard/settings" icon={Settings} label="Settings" />
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name || 'User'}</div>
              <div className="sidebar-user-email">{user?.email}</div>
              <div className="sidebar-user-role">
                {user?.roles?.map(r => (
                  <span key={r} className={`role-chip-${r}`}>{r}</span>
                ))}
              </div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <div className="main-header-breadcrumb">
            <strong>{pageTitle}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Network badge */}
            <div className="header-badge" style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
              <div className="header-badge-dot" style={{ backgroundColor: '#16a34a' }} />
              Sepolia Live
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }} className="notif-wrapper">
              <button
                className="notif-btn"
                onClick={() => setShowNotifs(v => !v)}
                aria-label="Notifications"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              {showNotifs && (
                <NotificationPanel onClose={() => setShowNotifs(false)} />
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="main-scroll">
          <div className="page-content animate-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};
