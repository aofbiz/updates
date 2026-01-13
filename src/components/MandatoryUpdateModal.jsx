import React from 'react'
import { AlertCircle, Download, Smartphone, Monitor, Info } from 'lucide-react'

const MandatoryUpdateModal = ({ info, onUpdate, progress, downloadStats }) => {
    if (!info) return null

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatSpeed = (bytesPerSec) => {
        return formatBytes(bytesPerSec) + '/s'
    }

    const handleAction = (platform = null) => {
        onUpdate(platform)
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999, // Extremely high Z-index to block everything
            padding: '2rem'
        }}>
            <div className="mandatory-update-card" style={{
                width: '100%',
                maxWidth: '500px',
                background: 'rgba(var(--bg-card-rgb, 20, 20, 20), 0.95)',
                border: '1px solid rgba(var(--accent-rgb), 0.3)',
                borderRadius: '2rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative Background Elements */}
                <div style={{
                    position: 'absolute',
                    top: '-20%',
                    left: '-20%',
                    width: '60%',
                    height: '60%',
                    background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, transparent 70%)',
                    zIndex: 0
                }}></div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 2rem',
                        background: 'rgba(var(--accent-rgb), 0.15)',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        boxShadow: '0 0 40px rgba(var(--accent-rgb), 0.3)'
                    }}>
                        <AlertCircle size={40} strokeWidth={2.5} />
                    </div>

                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        marginBottom: '1rem',
                        color: 'var(--text-primary)'
                    }}>
                        Required Update
                    </h2>

                    <p style={{
                        fontSize: '1.1rem',
                        color: 'rgba(var(--text-primary-rgb), 0.8)',
                        lineHeight: '1.6',
                        marginBottom: '2.5rem',
                        fontWeight: 500
                    }}>
                        A new version is required to continue. This update includes critical fixes and essential security improvements.
                    </p>

                    <div style={{
                        textAlign: 'left',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '1.5rem',
                        borderRadius: '1.5rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        marginBottom: '2.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            <Info size={14} /> <span>New Version</span>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            v{info.version}
                        </div>
                        {info.release_notes && (
                            <div style={{
                                marginTop: '1rem',
                                fontSize: '0.9rem',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                paddingTop: '1rem'
                            }}>
                                {info.release_notes}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button
                            onClick={() => handleAction('apk')}
                            style={{
                                padding: '1.25rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '1.25rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                            className="mandatory-btn-secondary"
                        >
                            <Smartphone size={24} />
                            Update Mobile
                        </button>
                        <button
                            onClick={() => handleAction('exe')}
                            style={{
                                padding: '1.25rem',
                                background: 'linear-gradient(135deg, var(--accent-primary) 0%, rgba(var(--accent-rgb), 0.8) 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '1.25rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                boxShadow: '0 10px 20px -5px rgba(var(--accent-rgb), 0.4)'
                            }}
                            className="mandatory-btn-primary"
                        >
                            <Monitor size={24} />
                            Update Desktop
                        </button>
                    </div>

                    {/* Download Progress UI */}
                    {downloadStats && (downloadStats.transferred > 0 || progress > 0) && (
                        <div style={{ marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <span>{formatBytes(downloadStats.transferred)} / {formatBytes(downloadStats.total)}</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: 'var(--accent-primary)',
                                    transition: 'width 0.2s ease-out'
                                }}></div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Speed: {formatSpeed(downloadStats.speed)}
                            </div>
                        </div>
                    )}

                    <p style={{
                        marginTop: '2rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        Your data and settings will remain safe.
                    </p>
                </div>

                <style>{`
                    @keyframes scaleIn {
                        from { transform: scale(0.9); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                    .mandatory-btn-primary:hover {
                        transform: translateY(-2px);
                        filter: brightness(1.1);
                        box-shadow: 0 15px 25px -5px rgba(var(--accent-rgb), 0.5);
                    }
                    .mandatory-btn-secondary:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.2);
                        transform: translateY(-2px);
                    }
                `}</style>
            </div>
        </div>
    )
}

export default MandatoryUpdateModal
