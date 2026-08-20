import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Edit, Trash2, Settings } from 'lucide-react';
import './AdminDashboard.css';

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
  label: string; icon: string; address: string;
  network: string; note: string; isActive: boolean; sortOrder: number;
};

const EMPTY_FORM: FormState = {
  label: '', icon: '₿', address: '', network: '', note: '', isActive: true, sortOrder: 0,
};
const ICON_PRESETS = ['₿', 'Ξ', '◎', '💳', '🏦', 'T', '$', '🔗'];

export default function AdminSettingsPage() {
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deposit-methods/manage', { credentials: 'include' });
      if (res.ok) setMethods(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  const openNew = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (m: DepositMethod) => {
    setEditId(m.id);
    setForm({ label: m.label, icon: m.icon, address: m.address, network: m.network ?? '', note: m.note ?? '', isActive: m.isActive, sortOrder: m.sortOrder });
    setShowForm(true);
  };
  const f = (k: keyof FormState, v: string | boolean | number) => setForm(p => ({ ...p, [k]: v }));

  const saveMethods = async () => {
    if (!form.label.trim() || !form.address.trim()) { showToast('Label and address required', false); return; }
    setSaving(true);
    try {
      const body = { ...form, network: form.network || null, note: form.note || null, ...(editId ? { id: editId } : {}) };
      const res = await fetch('/api/admin/deposit-methods/manage', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) { showToast(editId ? 'Method updated' : 'Method created'); setShowForm(false); fetchMethods(); }
      else showToast((await res.json()).error ?? 'Failed', false);
    } finally { setSaving(false); }
  };

  const toggleActive = async (m: DepositMethod) => {
    await fetch('/api/admin/deposit-methods/manage', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id: m.id, isActive: !m.isActive }),
    });
    fetchMethods();
  };

  const removeMethod = async (id: string) => {
    if (!confirm('Delete this deposit method?')) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/deposit-methods/manage?id=${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('Deleted'); fetchMethods(); } else showToast('Failed', false);
    setDeleting(null);
  };

  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">Settings</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>Deposit Methods</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginTop: 2 }}>Addresses shown to users on the deposit sheet</p>
          </div>
          <button className="adm-add-btn" onClick={openNew}><Plus size={12} /> Add Method</button>
        </div>

        {loading ? (
          <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
        ) : methods.length === 0 ? (
          <div className="adm-empty" style={{ border: '1.5px dashed var(--line-strong)' }}>
            <Settings size={24} style={{ opacity: 0.2 }} />
            <p>No deposit methods yet — add one above</p>
          </div>
        ) : methods.map(m => (
          <div key={m.id} className="adm-method-card">
            <div className="adm-card-stripe" style={{ background: m.isActive ? 'var(--accent)' : 'var(--line-strong)' }} />
            <div className="adm-method-ico">{m.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>{m.label}</p>
                {m.network && <span className="adm-status grey" style={{ fontSize: '0.48rem' }}>{m.network}</span>}
                <span className={`adm-status ${m.isActive ? 'ok' : 'grey'}`} style={{ fontSize: '0.48rem' }}>{m.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="adm-method-addr">{m.address}</div>
              {m.note && <p style={{ marginTop: 5, fontSize: '0.6rem', color: 'var(--gold)', background: 'var(--gold-l)', padding: '4px 8px', borderRadius: 6 }}>⚠️ {m.note}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <label className="adm-toggle" title={m.isActive ? 'Deactivate' : 'Activate'}>
                <input type="checkbox" checked={m.isActive} onChange={() => toggleActive(m)} />
                <span className="adm-toggle-track" />
              </label>
              <button className="adm-icon-btn" onClick={() => openEdit(m)}><Edit size={13} /></button>
              <button className="adm-icon-btn danger" onClick={() => removeMethod(m.id)} disabled={deleting === m.id}>
                {deleting === m.id ? <Loader2 size={13} className="adm-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <>
          <div className="adm-overlay" onClick={() => setShowForm(false)} />
          <div className="adm-drawer">
            <div className="adm-drawer-handle" />
            <p className="adm-drawer-title">{editId ? 'Edit Method' : 'New Deposit Method'}</p>
            <div className="adm-field">
              <label className="adm-field-label">Icon</label>
              <div className="adm-icon-row">
                {ICON_PRESETS.map(ic => (<div key={ic} className={`adm-icon-pick${form.icon === ic ? ' sel' : ''}`} onClick={() => f('icon', ic)}>{ic}</div>))}
                <input className="adm-input" style={{ width: 72, padding: '6px 10px', textAlign: 'center' }} value={form.icon} maxLength={4} onChange={e => f('icon', e.target.value)} placeholder="Custom" />
              </div>
            </div>
            <div className="adm-field"><label className="adm-field-label">Label *</label><input className="adm-input" value={form.label} onChange={e => f('label', e.target.value)} placeholder="e.g. Bitcoin (BTC)" /></div>
            <div className="adm-field"><label className="adm-field-label">Address / Account Details *</label><textarea className="adm-input" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Wallet address, IBAN, or payment details" /></div>
            <div className="adm-row-2">
              <div className="adm-field"><label className="adm-field-label">Network (optional)</label><input className="adm-input" value={form.network} onChange={e => f('network', e.target.value)} placeholder="e.g. ERC-20" /></div>
              <div className="adm-field"><label className="adm-field-label">Display Order</label><input className="adm-input" type="number" value={form.sortOrder} onChange={e => f('sortOrder', Number(e.target.value))} min={0} /></div>
            </div>
            <div className="adm-field"><label className="adm-field-label">Warning Note (optional)</label><input className="adm-input" value={form.note} onChange={e => f('note', e.target.value)} placeholder="e.g. Min deposit $50" /></div>
            <div className="adm-field">
              <label className="adm-checkbox-row" onClick={() => f('isActive', !form.isActive)}>
                <input type="checkbox" checked={form.isActive} readOnly />
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--ink)' }}>Active</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 1 }}>Show this method to users on the deposit sheet</p>
                </div>
              </label>
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="adm-btn-save" disabled={saving} onClick={saveMethods}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Method'}</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className={`adm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.ok ? '✓' : '✕'} {toast.msg}</div>}
    </div>
  );
}
