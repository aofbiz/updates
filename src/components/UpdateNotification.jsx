import React from 'react'
import { Zap, X, ArrowRight } from 'lucide-react'

const UpdateNotification = ({ info, onGoToUpdate, onClose }) => {
    if (!info) return null

    return (
        <div className="update-notification-popup" style={{
            position: 'fixed',
            bottom: 'calc(2rem + var(--safe-area-bottom))',
            right: 'calc(1.5rem + var(--safe-area-right))',
            width: '340px',
            background: 'rgba(var(--bg-card-rgb, 20, 20, 20), 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(var(--accent-rgb), 0.3)',
            borderRadius: '1.5rem',
            padding: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            animation: 'slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'transform 0.3s ease, border-color 0.3s ease'
        }}>
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    zIndex: 1
                }}
                className="close-hover"
            >
                <X size={14} />
            </button>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    minWidth: '48px',
                    background: 'rgba(var(--accent-rgb), 0.15)',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    boxShadow: 'inset 0 0 10px rgba(var(--accent-rgb), 0.2)'
                }}>
                    <Zap size={24} fill="currentColor" strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Update Available</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'rgba(var(--text-primary-rgb), 0.7)', lineHeight: '1.5', fontWeight: 500 }}>
                        Version <span style={{ color: 'var(--accent-primary)', fontWeight: 800 }}>v{info.version}</span> is ready for you with new features.
                    </p>
                </div>
            </div>

            <button
                onClick={onGoToUpdate}
                style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, rgba(var(--accent-rgb), 0.8) 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '1rem',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                    boxShadow: '0 8px 16px -4px rgba(var(--accent-rgb), 0.4)'
                }}
                className="action-btn-hover"
            >
                Update Now
                <ArrowRight size={18} strokeWidth={2.5} />
            </button>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%) translateY(40px); opacity: 0; }
                    to { transform: translateX(0) translateY(0); opacity: 1; }
                }
                .close-hover:hover {
                    background: rgba(var(--accent-rgb), 0.2);
                    color: var(--text-primary);
                    transform: rotate(90deg);
                }
                .action-btn-hover:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 20px -4px rgba(var(--accent-rgb), 0.5);
                    filter: brightness(1.1);
                }
                .action-btn-hover:active {
                    transform: translateY(0) scale(0.98);
                }
                .update-notification-popup:hover {
                    border-color: rgba(var(--accent-rgb), 0.6);
                }
            `}</style>
        </div>
    )
}

export default UpdateNotification
