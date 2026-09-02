import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Edit, Trash2, Settings, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './AdminSettings.css';

interface DepositMethod {
  id: string;
  label: string;
  icon: string;
  address: string;
  network: string | null;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

type FormState = {
  label: string;
  icon: string;
  address: string;
  network: string;
  note: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  label: '',
  icon: '₿',
  address: '',
  network: '',
  note: '',
  isActive: true,
  sortOrder: 0,
};

const ICON_PRESETS = ['₿', 'Ξ', '◎', '💳', '🏦', 'T', '$', '🔗'];

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/deposit-methods/manage', {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMethods(data);
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load deposit methods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  // Focus trap + Escape handler for drawer
  useEffect(() => {
    if (!showForm) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    // Focus first input
    setTimeout(() => firstInputRef.current?.focus(), 50);

    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForm(false);
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (m: DepositMethod) => {
    setEditId(m.id);
    setForm({
      label: m.label,
      icon: m.icon,
      address: m.address,
      network: m.network ?? '',
      note: m.note ?? '',
      isActive: m.isActive,
      sortOrder: m.sortOrder,
    });
    setShowForm(true);
  };

  const updateField = (k: keyof FormState, v: string | boolean | number) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const saveMethod = async () => {
    if (!form.label.trim() || !form.address.trim()) {
      showToast('Label and address are required', false);
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        network: form.network.trim() || null,
        note: form.note.trim() || null,
        ...(editId ? { id: editId } : {}),
      };
      const res = await fetch('/api/admin/deposit-methods/manage', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      showToast(editId ? 'Method updated' : 'Method created');
      setShowForm(false);
      fetchMethods();
    } catch (e: any) {
      showToast(e.message || 'Failed to save', false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: DepositMethod) => {
    setToggling(m.id);
    try {
      const res = await fetch('/api/admin/deposit-methods/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: m.id, isActive: !m.isActive }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      showToast(m.isActive ? 'Method deactivated' : 'Method activated');
      fetchMethods();
    } catch (e: any) {
      showToast(e.message || 'Failed to toggle status', false);
    } finally {
      setToggling(null);
    }
  };

  const removeMethod = async (id: string) => {
    if (!confirm('Delete this deposit method? This action cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/deposit-methods/manage?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Delete failed');
      }
      showToast('Deposit method deleted');
      fetchMethods();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', false);
    } finally {
      setDeleting(null);
    }
  };

  const sortedMethods = [...methods].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return (
    <div className="adm">
      {/* Breadcrumb + Header */}
      <div className="adm-hdr">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button
              className="adm-back-btn"
              onClick={() => navigate('/dashboard/admin')}
              title="Back to Admin Dashboard"
              style={{ display: 'flex' }}
            >
              <ArrowLeft size={16} />
            </button>
            <p className="adm-brand">Apex · Admin</p>
          </div>
          <h1 className="adm-title">Settings</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 4 }}>
            Manage deposit methods and platform configuration
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.isAdmin && (
            <span
              className="adm-status ok"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.5rem' }}
            >
              <Shield size={10} />
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--red-l)',
            color: 'var(--red)',
            fontSize: '0.75rem',
            marginBottom: 16,
            border: '1px solid var(--red)',
          }}
        >
          <AlertTriangle size={14} />
          {fetchError}
          <button
            onClick={fetchMethods}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--red)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Deposit Methods Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>
              Deposit Methods
            </p>
            <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginTop: 2 }}>
              {methods.length} method{methods.length !== 1 ? 's' : ''} configured · shown to users on the deposit sheet
            </p>
          </div>
          <button className="adm-add-btn" onClick={openNew} disabled={loading}>
            <Plus size={12} />
            Add Method
          </button>
        </div>

        {loading ? (
          <div className="adm-empty">
            <Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} />
            <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 8 }}>
              Loading deposit methods…
            </p>
          </div>
        ) : methods.length === 0 ? (
          <div
            className="adm-empty"
            style={{ border: '1.5px dashed var(--line-strong)', cursor: 'pointer' }}
            onClick={openNew}
          >
            <Settings size={24} style={{ opacity: 0.2 }} />
            <p>No deposit methods configured</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginTop: 4 }}>
              Click to add your first method
            </p>
          </div>
        ) : (
          sortedMethods.map((m) => (
            <div key={m.id} className="adm-method-card">
              <div
                className="adm-card-stripe"
                style={{ background: m.isActive ? 'var(--accent)' : 'var(--line-strong)' }}
              />
              <div className="adm-method-ico">{m.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>
                    {m.label}
                  </p>
                  {m.network && (
                    <span className="adm-status grey" style={{ fontSize: '0.48rem' }}>
                      {m.network}
                    </span>
                  )}
                  <span
                    className={`adm-status ${m.isActive ? 'ok' : 'grey'}`}
                    style={{ fontSize: '0.48rem' }}
                  >
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="adm-method-addr">{m.address}</div>
                {m.note && (
                  <p
                    style={{
                      marginTop: 5,
                      fontSize: '0.6rem',
                      color: 'var(--gold)',
                      background: 'var(--gold-l)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      display: 'inline-block',
                    }}
                  >
                    ⚠️ {m.note}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <label
                  className="adm-toggle"
                  title={m.isActive ? 'Deactivate' : 'Activate'}
                  style={{ opacity: toggling === m.id ? 0.5 : 1, pointerEvents: toggling === m.id ? 'none' : 'auto' }}
                >
                  <input
                    type="checkbox"
                    checked={m.isActive}
                    onChange={() => toggleActive(m)}
                    disabled={toggling === m.id}
                  />
                  <span className="adm-toggle-track" />
                </label>
                <button className="adm-icon-btn" onClick={() => openEdit(m)} title="Edit">
                  <Edit size={13} />
                </button>
                <button
                  className="adm-icon-btn danger"
                  onClick={() => removeMethod(m.id)}
                  disabled={deleting === m.id}
                  title="Delete"
                >
                  {deleting === m.id ? (
                    <Loader2 size={13} className="adm-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Drawer / Modal */}
      {showForm && (
        <>
          <div className="adm-overlay" onClick={() => setShowForm(false)} />
          <div className="adm-drawer" ref={drawerRef} role="dialog" aria-modal="true">
            <div className="adm-drawer-handle" />
            <p className="adm-drawer-title">
              {editId ? 'Edit Deposit Method' : 'New Deposit Method'}
            </p>

            <div className="adm-field">
              <label className="adm-field-label">Icon</label>
              <div className="adm-icon-row">
                {ICON_PRESETS.map((ic) => (
                  <div
                    key={ic}
                    className={`adm-icon-pick${form.icon === ic ? ' sel' : ''}`}
                    onClick={() => updateField('icon', ic)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && updateField('icon', ic)}
                  >
                    {ic}
                  </div>
                ))}
                <input
                  ref={firstInputRef}
                  className="adm-input"
                  style={{ width: 72, padding: '6px 10px', textAlign: 'center' }}
                  value={form.icon}
                  maxLength={4}
                  onChange={(e) => updateField('icon', e.target.value)}
                  placeholder="Custom"
                />
              </div>
            </div>

            <div className="adm-field">
              <label className="adm-field-label">
                Label <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                className="adm-input"
                value={form.label}
                onChange={(e) => updateField('label', e.target.value)}
                placeholder="e.g. Bitcoin (BTC)"
              />
            </div>

            <div className="adm-field">
              <label className="adm-field-label">
                Address / Account Details <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <textarea
                className="adm-input"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Wallet address, IBAN, or payment details"
                rows={3}
              />
            </div>

            <div className="adm-row-2">
              <div className="adm-field">
                <label className="adm-field-label">Network (optional)</label>
                <input
                  className="adm-input"
                  value={form.network}
                  onChange={(e) => updateField('network', e.target.value)}
                  placeholder="e.g. ERC-20"
                />
              </div>
              <div className="adm-field">
                <label className="adm-field-label">Display Order</label>
                <input
                  className="adm-input"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => updateField('sortOrder', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            <div className="adm-field">
              <label className="adm-field-label">Warning Note (optional)</label>
              <input
                className="adm-input"
                value={form.note}
                onChange={(e) => updateField('note', e.target.value)}
                placeholder="e.g. Min deposit $50"
              />
            </div>

            <div className="adm-field">
              <label
                className="adm-checkbox-row"
                onClick={() => updateField('isActive', !form.isActive)}
              >
                <input type="checkbox" checked={form.isActive} readOnly />
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--ink)' }}>
                    Active
                  </p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 1 }}>
                    Show this method to users on the deposit sheet
                  </p>
                </div>
              </label>
            </div>

            <div className="adm-drawer-footer">
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="adm-btn-save" disabled={saving} onClick={saveMethod}>
                {saving ? (
                  <>
                    <Loader2 size={14} className="adm-spin" style={{ display: 'inline' }} />
                    &nbsp;Saving…
                  </>
                ) : editId ? (
                  'Save Changes'
                ) : (
                  'Create Method'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`adm-toast ${toast.ok ? 'ok' : 'err'}`}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}
