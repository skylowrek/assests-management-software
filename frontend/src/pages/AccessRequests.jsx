import React from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';

export const AccessRequests = () => {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(null);

  const fetchRequests = async () => {
    try {
      const { data } = await api.get('/assets/access-requests/pending');
      setRequests(data.data || []);
    } catch (err) {
      setError('Failed to load pending access requests');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this request and grant ASSET_VIEW permission?')) return;
    setActionLoading(id);
    try {
      await api.post(`/assets/access-requests/${id}/approve`);
      setRequests(requests.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to approve request: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    setActionLoading(id);
    try {
      await api.post(`/assets/access-requests/${id}/reject`);
      setRequests(requests.filter(r => r.id !== id));
    } catch (err) {
      alert('Failed to reject request: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Access Requests</h1>
          <p className="page-sub">Manage user requests to view asset documents.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Pending Requests</div>
            <div className="panel-sub">Approve or reject document viewing permissions</div>
          </div>
          <FileText size={15} style={{ color: 'var(--text-muted)' }} />
        </div>

        {loading ? (
          <div className="loading-row"><div className="loading-spinner-large" />Loading requests...</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
            <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-secondary)' }}>No pending requests</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>You're all caught up!</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested At</th>
                  <th>User</th>
                  <th>Asset</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{req.user?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.user?.email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{req.asset?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {req.asset?.assetCode}</div>
                    </td>
                    <td style={{ width: '150px' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-sm" 
                          style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }}
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          style={{ color: '#ef4444' }}
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
