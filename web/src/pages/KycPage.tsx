import { useState, useEffect, useCallback, useRef } from 'react';
import './kyc.css';

type Submission = {
  id: string;
  status: string;
  documentType: string;
  frontUrl: string | null;
  backUrl: string | null;
  selfieUrl: string | null;
  notes: string | null;
  submittedAt: string;
};

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

async function uploadToCloudinary(file: File): Promise<string> {
     const form = new FormData();
     form.append('file', file);
     const res = await fetch('/api/user/kyc/upload', {
       method: 'POST',
       credentials: 'include',
       body: form,
     });
     if (!res.ok) {
       const d = await res.json().catch(() => ({}));
       throw new Error(d.error ?? 'Upload failed');
     }
     const d = await res.json();
     return d.url;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── upload tile ── */
function UploadTile({ label, hint, required, value, onChange }: {
  label: string; hint: string; required?: boolean;
  value: string; onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('image/')) return setErr('Images only (JPG/PNG)');
    if (file.size > 8 * 1024 * 1024) return setErr('Max 8 MB');
    setBusy(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`ky-tile ${value ? 'done' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        id={`ky-${label}`}
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <img className="ky-tile-preview" src={value} alt={label} />
      ) : (
        <span className="ky-tile-ico">{busy ? '' : '＋'}</span>
      )}
      {busy && <div className="ky-tile-spin" />}
      <label htmlFor={`ky-${label}`} className="ky-tile-body">
        <span className="ky-tile-lbl">
          {label} {required && <em>*</em>}
        </span>
        <span className="ky-tile-hint">{value ? 'Tap to replace' : hint}</span>
        {busy && <span className="ky-tile-hint">Uploading…</span>}
        {err && <span className="ky-tile-err">{err}</span>}
      </label>
    </div>
  );
}

export default function KycPage() {
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('NONE');
  const [submission, setSubmission] = useState<Submission | null>(null);

  const [docType, setDocType] = useState('PASSPORT');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [selfie, setSelfie] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchKyc = useCallback(async () => {
    try {
      const res = await fetch('/api/user/kyc', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setKycStatus(d.kycStatus ?? 'NONE');
        setSubmission(d.submission ?? null);
        if (d.submission?.documentType) setDocType(d.submission.documentType);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  const canSubmit = !!front && !!selfie && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/user/kyc', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontUrl: front, backUrl: back || null, selfieUrl: selfie, documentType: docType }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Submission failed');
      setMsg({ ok: true, text: 'Documents submitted for review' });
      fetchKyc();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="ky-wrap">
        <div className="ky-inner">
          <div className="ky-skeleton" style={{ height: 60 }} />
          <div className="ky-skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  const step = kycStatus === 'APPROVED' ? 3 : kycStatus === 'PENDING' ? 2 : 1;

  return (
    <div className="ky-wrap">
      <div className="ky-inner">

        {/* ══ header ══ */}
        <div className="ky-head">
          <p className="ky-eyebrow"><span className="ky-eyebrow-pip" />Apex · Mkts — Compliance</p>
          <h1 className="ky-title">Identity Verification</h1>
        </div>

        {/* ══ status tracker ══ */}
        <section className="ky-card">
          <div className="ky-steps">
            {['Documents', 'In Review', 'Verified'].map((s, i) => (
              <div className={`ky-step ${step > i ? 'on' : ''} ${step === i + 1 && kycStatus !== 'APPROVED' ? 'now' : ''}`} key={s}>
                <span className="ky-step-dot">{step > i + 1 || kycStatus === 'APPROVED' ? '✓' : i + 1}</span>
                <span className="ky-step-lbl">{s}</span>
              </div>
            ))}
          </div>

          {kycStatus === 'PENDING' && submission && (
            <p className="ky-status-line gold">
              Submitted {fmtDate(submission.submittedAt)} — usually reviewed within 1–2 business days.
            </p>
          )}
          {kycStatus === 'APPROVED' && (
            <p className="ky-status-line pos">Your identity is verified. Full platform access unlocked.</p>
          )}
          {kycStatus === 'REJECTED' && submission?.notes && (
            <p className="ky-status-line neg">Rejected: {submission.notes}</p>
          )}
        </section>

        {/* ══ form (NONE or REJECTED) ══ */}
        {(kycStatus === 'NONE' || kycStatus === 'REJECTED') && (
          <section className="ky-card">
            <header className="ky-card-head">
              <h2>{kycStatus === 'REJECTED' ? 'Resubmit Documents' : 'Upload Documents'}</h2>
            </header>

            <div className="ky-form">
              <div className="ky-field">
                <label className="ky-lbl">Document Type</label>
                <div className="ky-doc-tabs">
                  {['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'].map(t => (
                    <button key={t} className={`ky-doc-tab ${docType === t ? 'on' : ''}`} onClick={() => setDocType(t)}>
                      {t === 'PASSPORT' ? 'Passport' : t === 'NATIONAL_ID' ? 'National ID' : 'Driver’s License'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ky-tiles">
                <UploadTile label="Front of Document" hint="Photo page, clear & glare-free" required value={front} onChange={setFront} />
                <UploadTile label="Back of Document" hint="Optional but recommended" value={back} onChange={setBack} />
                <UploadTile label="Selfie" hint="Plain background, face visible" required value={selfie} onChange={setSelfie} />
              </div>

              {msg && <p className={`ky-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}

              <button className="ky-submit" onClick={submit} disabled={!canSubmit}>
                {submitting ? 'SUBMITTING…' : 'SUBMIT FOR REVIEW'}
              </button>

              <p className="ky-privacy">
                🔒 Documents are encrypted in transit and stored securely. They are used solely for identity verification and never shared with third parties.
              </p>
            </div>
          </section>
        )}

        {/* ══ approved card ══ */}
        {kycStatus === 'APPROVED' && (
          <section className="ky-card">
            <div className="ky-verified">
              <span className="ky-verified-ico">✓</span>
              <p className="ky-verified-title">Identity Verified</p>
              <p className="ky-verified-sub">
                {submission?.documentType === 'PASSPORT' ? 'Passport' : 'Document'} verified
                {submission ? ` on ${fmtDate(submission.reviewedAt ?? submission.submittedAt)}` : ''}.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
