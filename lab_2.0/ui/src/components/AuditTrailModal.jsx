import React, { useState, useEffect } from 'react';
import { FileText, X, ShieldCheck, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function AuditTrailModal({ isOpen, onClose, resourceId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && resourceId) {
      setLoading(true);
      fetch(`/api/lab/audit-events/${resourceId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setEvents(data.events);
          }
        })
        .catch((err) => console.error('Failed to load audit events:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, resourceId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--lavender-soft)', padding: '0.6rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--neo-raised-sm)', border: '1px solid var(--border-subtle)' }}>
              <FileText size={22} color="var(--hospital-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--main-text)' }}>Immutable Security Audit Trail</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>
                Verifiable logs of actor, action, timestamp, and bounded access state
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-text)' }}>Loading audit events...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-text)' }}>No audit records found for this resource.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {events.map((evt) => {
                const isExpiredAction = evt.action.includes('EXPIRE');
                return (
                  <div
                    key={evt._id}
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      boxShadow: 'var(--neo-raised-sm)',
                      padding: '0.95rem 1.15rem',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge-pill low">
                          {evt.actor_type}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--main-text)', fontFamily: 'var(--font-mono)' }}>
                          {evt.action}
                        </strong>
                      </div>
                      <span className={evt.outcome === 'SUCCESS' ? 'badge-pill normal' : 'badge-pill high'}>
                        {evt.outcome}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-text)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Resource: {evt.resource_type} ({evt.resource_id.slice(-6)})</span>
                      <span>{new Date(evt.timestamp).toLocaleTimeString()} · {new Date(evt.timestamp).toLocaleDateString()}</span>
                    </div>

                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          background: 'var(--surface-inset)',
                          border: '1px solid var(--border-inset)',
                          padding: '0.55rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--hospital-blue)',
                          whiteSpace: 'pre-wrap',
                          boxShadow: 'var(--neo-inset-sm)',
                        }}
                      >
                        {JSON.stringify(evt.details, null, 2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button className="btn-clinical outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
