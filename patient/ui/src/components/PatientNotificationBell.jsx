import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { patientApi } from '../services/patientApi';

export function PatientNotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const result = await patientApi.getNotifications();
      setNotifications(result.notifications || []);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    const close = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => { window.clearInterval(interval); document.removeEventListener('mousedown', close); };
  }, []);

  const unread = notifications.filter((item) => !item.read).length;
  const markRead = async (notification) => {
    const id = notification._id;
    await patientApi.markNotificationRead(id).catch(() => {});
    setNotifications((items) => items.map((item) => (String(item._id) === String(id) ? { ...item, read: true } : item)));
    if (notification.encounter_id) {
      setOpen(false);
      navigate(notification.report_id
        ? `/report/${encodeURIComponent(notification.report_id)}`
        : `/timeline?consultation=${encodeURIComponent(notification.encounter_id)}`);
    }
  };
  const markAll = async () => {
    setLoading(true);
    await patientApi.markAllNotificationsRead().catch(() => {});
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setLoading(false);
  };

  return <div ref={wrapperRef} className="patient-notification-wrap">
    <button type="button" className="patient-notification-button" onClick={() => setOpen((value) => !value)} aria-label={`${unread} unread notifications`} aria-expanded={open}>
      <Bell size={19} />{unread > 0 && <span className="patient-notification-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="patient-notification-panel">
      <div className="patient-notification-heading"><strong>Notifications</strong>{unread > 0 && <button type="button" onClick={markAll} disabled={loading}><CheckCheck size={14} /> Mark all read</button>}</div>
      {notifications.length === 0 ? <p className="patient-notification-empty">No notifications yet.</p> : notifications.map((item) => <button key={item._id} type="button" className={`patient-notification-item ${item.read ? '' : 'unread'}`} onClick={() => markRead(item)}>
        <span className="patient-notification-icon"><FlaskConical size={16} /></span><span><strong>{item.title}</strong><small>{item.message}</small><time>{new Date(item.created_at).toLocaleString()}</time></span>
      </button>)}
    </div>}
  </div>;
}
