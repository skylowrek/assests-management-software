import React from 'react';
import { Search, Plus, ArrowRightLeft, RefreshCw, X, CheckCircle, AlertTriangle, Eye, ExternalLink, ShieldCheck, FileText } from 'lucide-react';
import api from '../utils/api';
import { useAuthStore } from '../store/useAuthStore';
import { getExplorerUrl, getExplorerNetworkName, getAddressExplorerUrl } from '../utils/explorer';

const statusBadge = (status) => {
  const map = { assigned: 'badge-blue', minted: 'badge-success', revoked: 'badge-danger', transferred: 'badge-info' };
  return map[status] || 'badge-neutral';
};

const categoryLabel = (cat) => {
  const map = {
    hardware: 'Hardware', software_license: 'Software', access_credential: 'Access', physical: 'Physical', digital: 'Digital'
  };
  return map[cat] || cat;
};

const MintAssetModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = React.useState({ assetCode: '', name: '', category: 'hardware', description: '', location: '', ownerDid: '' });
  const [file, setFile] = React.useState(null);
  const [identities, setIdentities] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    api.get('/identities?limit=100')
      .then(r => setIdentities(r.data.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key]) payload.append(key, form[key]);
      });
      if (file) {
        payload.append('document', file);
      }
      
      const { data } = await api.post('/assets', payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setResult(data.data);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to mint asset. Check the asset code is unique.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" onMouseDown={e => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">Asset Minted</span>
            <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-success">
              <CheckCircle size={16} />
              Asset minted successfully on blockchain!
            </div>
            
            <div className="panel" style={{ padding: '1rem', marginTop: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#0f172a', fontWeight: 600 }}>
                <ShieldCheck size={18} style={{ color: '#10b981' }} />
                Blockchain Proof
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <div className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Network</div>
                  <div style={{ fontWeight: 500 }}>{getExplorerNetworkName()}</div>
                </div>
                <div>
                  <div className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Asset Code</div>
                  <div className="mono" style={{ display: 'block', marginTop: 4 }}>{result.asset?.assetCode}</div>
                </div>
                <div>
                  <div className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Token ID</div>
                  <div className="mono" style={{ display: 'block', marginTop: 4, fontWeight: 600 }}>{result.asset?.tokenId ? `#${result.asset.tokenId}` : 'Pending'}</div>
                </div>
                <div>
                  <div className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Transaction Hash</div>
                  <div className="mono" style={{ display: 'block', marginTop: 4, wordBreak: 'break-all', color: '#3b82f6' }}>
                    <a href={getExplorerUrl(result.txHash)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      {result.txHash}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <a href={getExplorerUrl(result.txHash)} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                View on Polygon Explorer <ExternalLink size={16} />
              </a>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Mint New Asset</span>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Asset Code *</label>
                <input className="form-input" required value={form.assetCode} onChange={e => setForm(f => ({ ...f, assetCode: e.target.value }))} placeholder="" />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="hardware">Hardware</option>
                  <option value="software_license">Software License</option>
                  <option value="access_credential">Access Credential</option>
                  <option value="physical">Physical Asset</option>
                  <option value="digital">Digital Asset</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Asset Name *</label>
                <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Asset description..." />
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Upload Proof / Document</label>
                <input 
                  type="file" 
                  className="form-input" 
                  onChange={e => setFile(e.target.files[0])} 
                  style={{ padding: '0.5rem' }} 
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Optional: Upload a certificate, license, image, or proof document. A real SHA-256 hash will be generated for blockchain integrity.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Office / Building" />
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Identity</label>
                <select className="form-select" value={form.ownerDid} onChange={e => setForm(f => ({ ...f, ownerDid: e.target.value }))}>
                  <option value="">Platform (Unassigned)</option>
                  {identities.map(id => (
                    <option key={id.did} value={id.did}>
                      {id.user?.name} ({id.user?.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading && <span className="spinner-sm" />}
              {loading ? 'Minting...' : 'Mint Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TransferModal = ({ asset, onClose, onSuccess }) => {
  const [identities, setIdentities] = React.useState([]);
  const [toDid, setToDid] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    api.get('/identities?limit=100')
      .then(r => setIdentities(r.data.data || []))
      .catch(() => {});
  }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/assets/${asset.id}/transfer`, { toDid });
      setDone(true);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Transfer Asset</span>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {done ? (
          <>
            <div className="modal-body">
              <div className="alert alert-success">
                <CheckCircle size={16} />
                Ownership transferred successfully on blockchain!
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleTransfer}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-error">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Asset</label>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  <strong>{asset.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({asset.assetCode})</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Transfer To (Identity) *</label>
                <select
                  className="form-select"
                  required
                  value={toDid}
                  onChange={e => setToDid(e.target.value)}
                >
                  <option value="">Select identity...</option>
                  {identities.map(id => (
                    <option key={id.did} value={id.did}>
                      {id.user?.name} ({id.user?.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="alert alert-warning">
                <AlertTriangle size={16} />
                This action will transfer ownership on the blockchain and is irreversible.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !toDid}>
                {loading && <span className="spinner-sm" />}
                {loading ? 'Transferring...' : 'Transfer Ownership'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
const SecureDocumentViewer = ({ assetId, onClose }) => {
  const [blobUrl, setBlobUrl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [integrityStatus, setIntegrityStatus] = React.useState('');
  const [requestStatus, setRequestStatus] = React.useState('idle');

  React.useEffect(() => {
    api.get(`/assets/${assetId}/view`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data);
        setBlobUrl(url);
        setIntegrityStatus(res.headers['x-document-integrity'] || 'unknown');
        setLoading(false);
      })
      .catch(async (err) => {
        let msg = 'Failed to load document';
        if (err.response?.data && err.response.data instanceof Blob) {
           try {
             const text = await err.response.data.text();
             const data = JSON.parse(text);
             msg = data.error?.message || msg;
           } catch (e) { }
        } else if (err.response?.status === 403) {
           msg = 'Access denied: Missing ASSET_VIEW permission';
        }
        setErrorMsg(msg);
        setLoading(false);
      });

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [assetId]);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ zIndex: 10000 }}>
      <div className="modal" style={{ width: '90%', maxWidth: '1000px', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Secure Document Viewer</h3>
            {integrityStatus && (
              <span style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'inline-block', color: integrityStatus === 'verified' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {integrityStatus === 'verified' ? '✓ Document integrity verified' : '⚠ Document integrity verification failed'}
              </span>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ flex: 1, padding: 0, position: 'relative', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <div className="loading-spinner-large" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          ) : errorMsg ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <div style={{ color: '#ef4444', fontWeight: '500', fontSize: '1.1rem', marginBottom: '1rem' }}>{errorMsg}</div>
              {errorMsg.includes('Missing ASSET_VIEW') && (
                <div style={{ marginTop: '1rem' }}>
                  {requestStatus === 'success' ? (
                    <div style={{ color: '#10b981', fontWeight: '600', padding: '0.5rem 1rem', background: '#d1fae5', borderRadius: '4px' }}>
                      Request Submitted! Admins will review your request.
                    </div>
                  ) : (
                    <button 
                      onClick={async () => {
                        setRequestStatus('loading');
                        try {
                          await api.post(`/assets/${assetId}/request-access`);
                          setRequestStatus('success');
                        } catch (err) {
                          setRequestStatus('idle');
                          alert(err.response?.data?.error?.message || 'Failed to request access');
                        }
                      }} 
                      disabled={requestStatus === 'loading'} 
                      className="btn btn-primary"
                    >
                      {requestStatus === 'loading' ? 'Requesting...' : 'Request Access'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : blobUrl ? (
            <iframe src={blobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Document Preview" />
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Preview unavailable</div>
          )}
        </div>
      </div>
    </div>
  );
};

const AssetDetailModal = ({ asset, onClose }) => {
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [viewDocAssetId, setViewDocAssetId] = React.useState(null);

  const docUrl = detail?.metadata?.find(m => m.key === '_documentUrl')?.value;
  const docHash = detail?.metadata?.find(m => m.key === '_documentHash')?.value;

  React.useEffect(() => {
    api.get(`/assets/${asset.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(asset))
      .finally(() => setLoading(false));
  }, [asset.id]);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500, padding: 0 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '1.5rem', borderBottom: 'none', paddingBottom: 0 }}>
          <button type="button" className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
          {loading ? (
            <div className="loading-row"><div className="loading-spinner-large" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>
          ) : (
            detail && (
              <div style={{ padding: '1rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      ASSET #{detail.assetCode}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Detailed record of digital asset.</p>
                  </div>
                  <span className={`status-badge status-${detail.status.toLowerCase()}`}>
                    {detail.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Physical Asset</div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)' }}>{categoryLabel(detail.category)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Digital Representation</div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {detail.tokenId ? `NFT #${detail.tokenId}` : 'Pending Mint'}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Ownership History</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-color)', marginTop: '6px' }} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary-color)', textTransform: 'uppercase' }}>Current Owner</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {detail.ownershipRecords?.[0] ? (
                            detail.ownershipRecords[0].owner?.name || detail.ownershipRecords[0].didRecord?.user?.name || detail.ownershipRecords[0].ownerDid
                          ) : 'Platform'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', marginTop: '6px' }} />
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Previous Owner</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                          {detail.ownershipRecords?.length > 1 
                            ? detail.ownershipRecords.slice(1).map(rec => rec.owner?.name || rec.didRecord?.user?.name || rec.ownerDid).join('\n')
                            : 'None'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Registered By</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{detail.creator?.name || 'Unknown'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Transferred By</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {detail.ownershipRecords?.[0]?.fromUser?.name || detail.ownershipRecords?.[0]?.fromDid || 'N/A'}
                    </div>
                  </div>
                </div>

                {docHash && (
                  <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <FileText size={16} color="var(--primary-color)" />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>Physical Document Attachment</span>
                    </div>
                    {docUrl && (
                      <div style={{ marginBottom: '1rem' }}>
                        <button type="button" onClick={() => setViewDocAssetId(detail.id)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                          View Document
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>SHA-256 Checksum</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      {docHash}
                    </div>
                  </div>
                )}
                
                {detail.mintTxHash && (
                   <div style={{ display: 'flex', justifyContent: 'center' }}>
                     <a href={getExplorerUrl(detail.mintTxHash)} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ border: '1px solid var(--border-color)', gap: '0.5rem' }}>
                       View Blockchain Tx <ExternalLink size={16} />
                     </a>
                   </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
      {viewDocAssetId && <SecureDocumentViewer assetId={viewDocAssetId} onClose={() => setViewDocAssetId(null)} />}
    </div>
  );
};

export const Assets = () => {
  const [assets, setAssets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [showMint, setShowMint] = React.useState(false);
  const [transferAsset, setTransferAsset] = React.useState(null);
  const [detailAsset, setDetailAsset] = React.useState(null);
  const user = useAuthStore(s => s.user);
  const canMint = user?.roles?.includes('admin') || user?.roles?.includes('manager');
  const canTransfer = user?.roles?.includes('admin') || user?.roles?.includes('manager');
  const LIMIT = 10;

  const fetchAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      const { data } = await api.get(`/assets?${params}`);
      setAssets(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  React.useEffect(() => {
    const t = setTimeout(fetchAssets, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchAssets]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Registry</h1>
          <p className="page-sub">Mint, assign, and transfer tokenized assets on the blockchain.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-icon" onClick={fetchAssets} title="Refresh"><RefreshCw size={15} /></button>
          {canMint && (
            <button className="btn btn-primary" onClick={() => setShowMint(true)}>
              <Plus size={15} />
              Mint Asset
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
            <div className="search-bar-icon"><Search size={15} /></div>
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="form-select" style={{ width: 'auto', minWidth: 120 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="minted">Minted</option>
            <option value="assigned">Assigned</option>
            <option value="transferred">Transferred</option>
            <option value="revoked">Revoked</option>
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            <option value="hardware">Hardware</option>
            <option value="software_license">Software</option>
            <option value="access_credential">Access</option>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{total} result{total !== 1 ? 's' : ''}</div>
        </div>

        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Category</th>
                <th>Current Owner</th>
                <th>Status</th>
                <th>Token ID</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-row" style={{ padding: 0 }}>
                      <div className="loading-spinner-large" style={{ width: 24, height: 24, borderWidth: 2 }} />
                      Loading assets...
                    </div>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <Plus size={32} className="empty-state-icon" />
                      <div className="empty-state-title">No assets found</div>
                      <div className="empty-state-sub">
                        {search || statusFilter || categoryFilter ? 'Try adjusting your filters.' : 'Mint your first asset to get started.'}
                      </div>
                      {canMint && !search && !statusFilter && !categoryFilter && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowMint(true)}>
                          <Plus size={14} /> Mint Asset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                assets.map(asset => {
                  const currentOwnerRec = asset.ownershipRecords?.[0];
                  const ownerName = currentOwnerRec?.didRecord?.user?.name || currentOwnerRec?.owner?.name;
                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{asset.name}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{asset.assetCode}</div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{categoryLabel(asset.category)}</span>
                      </td>
                      <td>
                        {ownerName ? (
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{ownerName}</span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Platform</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusBadge(asset.status)}`}>{asset.status}</span>
                      </td>
                      <td>
                        {asset.tokenId ? (
                          <span className="mono">{asset.tokenId}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title="View Details" onClick={() => setDetailAsset(asset)}>
                            <Eye size={14} />
                          </button>
                          {canTransfer && asset.status !== 'revoked' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setTransferAsset(asset)}>
                              <ArrowRightLeft size={13} /> Transfer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}
            </div>
            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {showMint && <MintAssetModal onClose={() => setShowMint(false)} onSuccess={fetchAssets} />}
      {transferAsset && <TransferModal asset={transferAsset} onClose={() => setTransferAsset(null)} onSuccess={fetchAssets} />}
      {detailAsset && <AssetDetailModal asset={detailAsset} onClose={() => setDetailAsset(null)} />}
    </div>
  );
};
