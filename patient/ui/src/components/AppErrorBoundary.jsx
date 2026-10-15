import React from 'react';

export class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#ebf5f8', color: '#18313a' }}>
        <div style={{ maxWidth: 560, padding: 28, borderRadius: 18, background: '#fff', boxShadow: '0 12px 32px rgba(24,49,58,.14)' }}>
          <h1 style={{ margin: '0 0 8px' }}>VaaniDoc could not open this page</h1>
          <p style={{ margin: '0 0 16px', color: '#526e7b' }}>Refresh the patient application after restarting its development server. If this continues, use the QR image upload or manual provider code.</p>
          <button type="button" onClick={() => window.location.assign('/welcome')} style={{ padding: '10px 16px', border: 0, borderRadius: 10, background: '#2292a0', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Open VaaniDoc homepage</button>
          {import.meta.env.DEV && <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: 12, color: '#b91c1c' }}>{this.state.error?.stack || String(this.state.error)}</pre>}
        </div>
      </div>
    );
  }
}
