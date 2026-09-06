import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './support.css';

type SupportMessage = {
  id: string;
  sender: 'USER' | 'ADMIN';
  body: string;
  createdAt: string;
};

type TicketStatus = 'OPEN' | 'CLOSED' | null;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDate(messages: SupportMessage[]) {
  const groups: { date: string; messages: SupportMessage[] }[] = [];
  messages.forEach((msg) => {
    const date = new Date(msg.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
  });
  return groups;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [status, setStatus] = useState<TicketStatus>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchThread = async (silent = false) => {
    try {
      const res = await fetch('/api/support/thread', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) setError(data.error || 'Failed to load support thread.');
        return;
      }
      setTicketId(data.ticketId ?? null);
      setStatus(data.status ?? null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      if (!silent) setError('Network error. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread().then(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchThread(true), 10_000);
    return () => clearInterval(interval);
  }, [ticketId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/support/thread/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to send message.');
        return;
      }
      if (data.ticketId) setTicketId(data.ticketId);
      if (data.status) setStatus(data.status);
      await fetchThread();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const grouped = groupByDate(messages);
  const isClosed = status === 'CLOSED';

  return (
    <div className="sp-wrap">
      <Link to="/dashboard" className="sp-back">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Dashboard
      </Link>

      <div className="sp-header">
        <div>
          <p className="sp-brand">Apex · Markets</p>
          <h1 className="sp-title">Support</h1>
          <p className="sp-sub">We usually reply within a few hours.</p>
        </div>
        {status && (
          <span className={`sp-status-badge ${status === 'OPEN' ? 'sp-status-open' : 'sp-status-closed'}`}>
            {status === 'OPEN' ? '● Open' : 'Closed'}
          </span>
        )}
      </div>

      <div className="sp-chat">
        {/* Header */}
        <div className="sp-chat-header">
          <div className="sp-chat-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div>
            <p className="sp-chat-name">Apex Markets Support</p>
            <p className="sp-chat-tagline">°live</p>
          </div>
          <div className="sp-online-dot" />
          <span className="sp-online-label">Online</span>
        </div>

        {/* Messages */}
        <div className="sp-messages">
          {loading && (
            <div className="sp-loading">
              <div className="sp-spinner" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="sp-empty">
              <div className="sp-empty-ico">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <p className="sp-empty-title">No messages yet</p>
              <p className="sp-empty-sub">Type below to start a conversation.</p>
            </div>
          )}

          {grouped.map(({ date, messages: dayMsgs }) => (
            <div key={date}>
              <div className="sp-divider">
                <div className="sp-divider-line" />
                <span className="sp-divider-label">{formatDateDivider(dayMsgs[0].createdAt)}</span>
                <div className="sp-divider-line" />
              </div>
              {dayMsgs.map((msg) => {
                const isUser = msg.sender === 'USER';
                return (
                  <div key={msg.id} className={`sp-msg-row ${isUser ? 'user' : 'admin'}`}>
                    {!isUser && (
                      <div className="sp-msg-admin-ico">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                      </div>
                    )}
                    <div className={`sp-bubble-wrap ${isUser ? 'user' : 'admin'}`}>
                      <div className={`sp-bubble ${isUser ? 'user' : 'admin'}`}>
                        {msg.body}
                      </div>
                      <span className="sp-bubble-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {isClosed && (
            <div className="sp-closed-notice">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Conversation closed · Start a new message to reopen
            </div>
          )}

          {error && <p className="sp-error">{error}</p>}
        </div>

        {/* Input */}
        <div className="sp-input-area">
          <div className="sp-input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isClosed || sending}
              rows={1}
              placeholder={isClosed ? 'Conversation is closed.' : 'Type a message… (Enter to send)'}
              className="sp-textarea"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || sending || isClosed}
              className="sp-send"
            >
              {sending ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sp-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="sp-input-hint">Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
