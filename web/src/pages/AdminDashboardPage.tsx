import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, X, ChevronLeft, Loader2, Bell,
  CheckCircle2, RefreshCw, Circle, MessageCircle,
} from 'lucide-react';
import './AdminDashboard.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  updatedAt: string;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null };
  messages?: { id: string; sender: 'USER' | 'ADMIN'; body: string; createdAt: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function countUnread(tickets: Ticket[]) {
  let n = 0;
  for (const t of tickets) {
    if (t.status === 'CLOSED') continue;
    const msgs = t.messages ?? [];
    const lastAdmin = msgs.map(m => m.sender).lastIndexOf('ADMIN');
    n += msgs.filter((m, i) => m.sender === 'USER' && i > lastAdmin).length;
  }
  return n;
}

function fmtTime(d: string) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d: string) {
  const dt = new Date(d), today = new Date(), yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === yest.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
function groupByDate(msgs: NonNullable<Ticket['messages']>) {
  const g: { date: string; messages: typeof msgs }[] = [];
  msgs.forEach(m => {
    const d = new Date(m.createdAt).toDateString();
    const last = g[g.length - 1];
    if (last?.date === d) last.messages.push(m);
    else g.push({ date: d, messages: [m] });
  });
  return g;
}
function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setFilter]   = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [loadingTix, setLoadingTix] = useState(true);
  const [detailLoading, setDL]      = useState(false);
  const [tixErr, setTixErr]         = useState('');
  const [detailErr, setDetailErr]   = useState('');
  const [reply, setReply]           = useState('');
  const [replying, setReplying]     = useState(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const prevMsgCount = useRef<number>(0);

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedId) ?? null, [tickets, selectedId]);
  const unread = countUnread(tickets);

  const fetchTickets = useCallback(async (f = statusFilter, silent = false) => {
    if (!silent) setLoadingTix(true);
    setTixErr('');
    try {
      const res  = await fetch(`/api/admin/support/tickets?status=${f}`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTixErr(data.error || 'Failed'); return; }
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch { setTixErr('Network error'); }
    finally { if (!silent) setLoadingTix(false); }
  }, [statusFilter]);

  const fetchTicketDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) setDL(true);
    setDetailErr('');
    try {
      const res  = await fetch(`/api/admin/support/tickets/${id}`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDetailErr(data.error || 'Failed'); return; }
      const t = data?.ticket as Ticket | undefined;
      if (!t) { setDetailErr('Not found'); return; }
      setTickets(prev => prev.map(x => x.id === t.id ? t : x));
    } catch { setDetailErr('Network error'); }
    finally { if (!silent) setDL(false); }
  }, []);

  useEffect(() => { fetchTickets(statusFilter); }, [statusFilter]);
  useEffect(() => {
    const i = setInterval(() => fetchTickets(statusFilter, true), 10_000);
    return () => clearInterval(i);
  }, [fetchTickets, statusFilter]);
  useEffect(() => {
    if (!selectedId) return;
    const i = setInterval(() => fetchTicketDetail(selectedId, true), 5_000);
    return () => clearInterval(i);
  }, [fetchTicketDetail, selectedId]);
  useEffect(() => {
    const msgs = selectedTicket?.messages ?? [];
    if (msgs.length > prevMsgCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = msgs.length;
  }, [selectedTicket?.messages]);
  useEffect(() => { prevMsgCount.current = 0; }, [selectedId]);

  const handleSelect = (id: string) => { setSelectedId(id); fetchTicketDetail(id); };
  const handleBack = () => setSelectedId(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReply(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };
  const handleReply = async () => {
    if (!selectedTicket || !reply.trim() || replying) return;
    setReplying(true); setDetailErr('');
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) { setDetailErr((await res.json().catch(() => ({}))).error || 'Failed'); return; }
      setReply('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      await fetchTicketDetail(selectedTicket.id);
      await fetchTickets(statusFilter);
    } catch { setDetailErr('Network error'); }
    finally { setReplying(false); }
  };
  const handleStatus = async (next: 'OPEN' | 'CLOSED') => {
    if (!selectedTicket) return;
    await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: next }),
    });
    await fetchTicketDetail(selectedTicket.id);
    await fetchTickets(statusFilter);
  };

  const grouped = groupByDate(selectedTicket?.messages ?? []);

  return (
    <>
      <div className="adm">
        <div className="adm-hdr">
          <div>
            <p className="adm-brand">Apex · Markets</p>
            <h1 className="adm-title">Support Dashboard</h1>
          </div>
          {unread > 0 && (
            <div className="adm-bell" onClick={() => {}}>
              <Bell size={16} color="var(--ink-dim)" />
              <span className="adm-bell-badge">{unread}</span>
            </div>
          )}
        </div>

        <div className="adm-chat-grid">
          <div className={`adm-ticket-list${selectedId ? ' has-selection' : ''}`}>
            <div className="adm-ticket-head">
              <span className="adm-ticket-head-title">Conversations</span>
              <div className="adm-filter-toggle">
                {(['OPEN', 'CLOSED'] as const).map(s => (
                  <button key={s} className={`adm-filter-btn${statusFilter === s ? (s === 'OPEN' ? ' active-open' : ' active-closed') : ''}`} onClick={() => { setFilter(s); setSelectedId(null); }}>
                    {s === 'OPEN' ? 'Open' : 'Closed'}
                  </button>
                ))}
              </div>
            </div>
            <div className="adm-ticket-scroll">
              {tixErr && <p style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--red)' }}>{tixErr}</p>}
              {loadingTix ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: 8, color: 'var(--ink-faint)' }}><Loader2 size={16} className="adm-spin" /> Loading…</div>
              ) : tickets.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 8, color: 'var(--ink-faint)' }}><MessageCircle size={24} style={{ opacity: 0.3 }} /><p style={{ fontSize: '0.72rem' }}>No {statusFilter.toLowerCase()} tickets</p></div>
              ) : tickets.map(t => {
                const last = t.messages?.[t.messages.length - 1];
                const isSelected = selectedId === t.id;
                return (
                  <button key={t.id} className={`adm-ticket-item${isSelected ? ' sel' : ''}`} onClick={() => handleSelect(t.id)}>
                    <div className="adm-avatar" style={{ width: 34, height: 34, fontSize: '0.62rem', flexShrink: 0 }}>{initials(t.user?.name, t.user?.email)}</div>
                    <div className="adm-ticket-item-body">
                      <div className="adm-ticket-item-row1">
                        <p style={{ fontSize: '0.73rem', fontWeight: 700, color: isSelected ? '#38bdf8' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.user?.name || t.user?.email || 'Unknown'}</p>
                        <span style={{ fontSize: '0.55rem', color: 'var(--ink-faint)', flexShrink: 0, marginLeft: 6 }}>{fmtTime(t.updatedAt)}</span>
                      </div>
                      <p style={{ fontSize: '0.63rem', color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
                      {last && <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.sender === 'ADMIN' ? 'You: ' : ''}{last.body}</p>}
                    </div>
                    <Circle size={8} style={{ fill: t.status === 'OPEN' ? 'var(--accent)' : 'var(--line-strong)', color: t.status === 'OPEN' ? 'var(--accent)' : 'var(--line-strong)', flexShrink: 0, marginTop: 4 }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`adm-thread${!selectedTicket ? ' no-selection' : ''}`}>
            {!selectedTicket ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px', color: 'var(--ink-faint)' }}>
                <MessageCircle size={28} style={{ opacity: 0.25 }} />
                <p style={{ fontSize: '0.75rem', fontWeight: 500 }}>Select a conversation</p>
              </div>
            ) : (
              <>
                <div className="adm-thread-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="adm-back-btn" onClick={handleBack}><ChevronLeft size={16} /></button>
                    <div className="adm-avatar" style={{ width: 34, height: 34, fontSize: '0.62rem' }}>{initials(selectedTicket.user?.name, selectedTicket.user?.email)}</div>
                    <div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>{selectedTicket.user?.name || selectedTicket.user?.email || 'Unknown'}</p>
                      <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>{selectedTicket.user?.email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`adm-status ${selectedTicket.status === 'OPEN' ? 'ok' : 'grey'}`}>{selectedTicket.status === 'OPEN' ? '● Open' : 'Closed'}</span>
                    {selectedTicket.status === 'OPEN'
                      ? <button className="adm-status-btn" onClick={() => handleStatus('CLOSED')}><CheckCircle2 size={12} /> Close</button>
                      : <button className="adm-status-btn" onClick={() => handleStatus('OPEN')}><RefreshCw size={12} /> Reopen</button>}
                  </div>
                </div>
                <div className="adm-thread-msgs">
                  {detailLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 size={16} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>}
                  {detailErr && <p style={{ fontSize: '0.65rem', color: 'var(--red)', textAlign: 'center' }}>{detailErr}</p>}
                  {grouped.map(({ date, messages: dms }) => (
                    <div key={date}>
                      <div className="adm-divider"><div className="adm-divider-line" /><span className="adm-divider-label">{fmtDate(dms[0].createdAt)}</span><div className="adm-divider-line" /></div>
                      {dms.map(msg => {
                        const isAdm = msg.sender === 'ADMIN';
                        return (
                          <div key={msg.id} className={`adm-msg-row${isAdm ? ' admin' : ''}`}>
                            {!isAdm && <div className="adm-avatar" style={{ width: 26, height: 26, fontSize: '0.52rem', flexShrink: 0 }}>{initials(selectedTicket.user?.name, selectedTicket.user?.email)}</div>}
                            <div className={`adm-msg-col ${isAdm ? 'admin' : 'user'}`}>
                              <div className={`adm-bubble ${isAdm ? 'admin' : 'user'}`}>{msg.body}</div>
                              <span className="adm-msg-time">{isAdm ? 'You · ' : ''}{fmtTime(msg.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="adm-thread-input">
                  <textarea ref={textareaRef} value={reply} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1} placeholder="Reply… (Enter to send)" className="adm-textarea" />
                  <button className="adm-send-btn" disabled={!reply.trim() || replying} onClick={handleReply}>
                    {replying ? <Loader2 size={14} className="adm-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
