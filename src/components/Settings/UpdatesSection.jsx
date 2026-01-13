import React, { useEffect } from 'react'
import { CheckCircle, Download, AlertTriangle, RefreshCw, Info, Settings, ShieldCheck, Zap, Smartphone, Monitor } from 'lucide-react'
import { useUpdateManager } from '../../hooks/useUpdateManager'

const UpdatesSection = () => {
    const {
        status,
        updateInfo,
        progress,
        downloadStats,
        error,
        checkForUpdates,
        startDownload,
        installUpdate,
        currentVersion
    } = useUpdateManager()

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

    useEffect(() => {
        // Only auto-check if we are in 'idle' state (first load of this section)
        if (status === 'idle') {
            checkForUpdates(true)
        }
    }, [status, checkForUpdates])

    const handleAction = (platform = null) => {
        if (status === 'available') {
            startDownload(platform)
        } else if (status === 'ready') {
            installUpdate()
        } else {
            checkForUpdates()
        }
    }

    return (
        <div className="updates-container animate-fade-in" style={{
            background: 'var(--bg-card)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div className="updates-header" style={{
                padding: '2rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.05) 0%, transparent 100%)',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    margin: '0 auto 1.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)'
                }}>
                    <RefreshCw
                        size={32}
                        className={status === 'checking' || status === 'downloading' ? 'animate-spin' : ''}
                        style={{ color: 'var(--accent-primary)' }}
                    />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Software Updates</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Current Version: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>v{currentVersion}</span>
                </p>
            </div>

            {/* Content Area */}
            <div className="updates-content" style={{ padding: '2rem' }}>
                {status === 'error' && (
                    <div className="status-banner error" style={{
                        background: 'rgba(255, 46, 54, 0.05)',
                        border: '1px solid rgba(255, 46, 54, 0.2)',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        color: 'var(--accent-primary)'
                    }}>
                        <AlertTriangle size={24} />
                        <div>
                            <p style={{ fontWeight: 700, margin: 0 }}>Update Check Failed</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>{error || 'Something went wrong while checking for updates.'}</p>
                        </div>
                    </div>
                )}

                {status === 'up-to-date' && (
                    <div className="status-banner success" style={{
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        color: '#10b981'
                    }}>
                        <CheckCircle size={24} />
                        <div>
                            <p style={{ fontWeight: 700, margin: 0 }}>AOF Biz is up to date</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.8, margin: 0 }}>You are running the latest version: v{currentVersion}</p>
                        </div>
                    </div>
                )}

                {/* Split Layout for Active Updates */}
                {(status === 'available' || status === 'downloading' || status === 'ready') && updateInfo ? (
                    <div className="update-grid">
                        {/* LEFT COLUMN: Release Notes */}
                        <div className="notes-column">
                            <div style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: '1rem',
                                border: '1px solid var(--border-color)',
                                padding: '1.5rem',
                                height: '100%'
                            }}>
                                <h3 style={{
                                    margin: '0 0 1rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '1.1rem'
                                }}>
                                    <Info size={20} style={{ color: 'var(--accent-primary)' }} />
                                    What's New in v{updateInfo.version}
                                </h3>

                                {updateInfo.release_notes ? (
                                    <div className="release-notes-scroll" style={{
                                        fontSize: '0.9rem',
                                        lineHeight: '1.7',
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'pre-line',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        paddingRight: '0.5rem'
                                    }}>
                                        {updateInfo.release_notes}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No release notes available.</p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Actions & Status */}
                        <div className="actions-column">
                            {/* Status info card */}
                            <div style={{
                                padding: '1.25rem',
                                borderRadius: '1rem',
                                background: 'rgba(var(--accent-rgb), 0.03)',
                                border: '1px solid rgba(var(--accent-rgb), 0.1)',
                                marginBottom: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <div style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        background: 'var(--accent-primary)',
                                        color: '#fff'
                                    }}>
                                        <Zap size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Update Available</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>v{currentVersion} → v{updateInfo.version}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Download Progress */}
                            {(status === 'downloading' || status === 'ready') && (
                                <div className="download-status" style={{
                                    padding: '1.25rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '1rem',
                                    border: '1px solid var(--border-color)',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                            {status === 'downloading' ? 'Downloading...' : 'Ready to Install'}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                            {Math.round(progress)}%
                                        </span>
                                    </div>

                                    {status === 'downloading' && downloadStats && (downloadStats.transferred > 0 || progress > 0) && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>{formatBytes(downloadStats.transferred)} / {formatBytes(downloadStats.total)}</span>
                                            <span>{formatSpeed(downloadStats.speed)}</span>
                                        </div>
                                    )}
                                    <div style={{
                                        height: '8px',
                                        background: 'var(--border-color)',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            background: 'var(--accent-primary)',
                                            width: `${progress}%`,
                                            transition: 'width 0.3s ease'
                                        }}></div>
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="action-buttons-stack" style={{ display: 'grid', gap: '1rem' }}>
                                {status === 'available' ? (
                                    <>
                                        <button
                                            onClick={() => handleAction('exe')}
                                            className="btn btn-primary"
                                            style={{
                                                padding: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.75rem',
                                                fontWeight: 700
                                            }}
                                        >
                                            <Monitor size={20} />
                                            Update PC (EXE)
                                        </button>
                                        <button
                                            onClick={() => handleAction('apk')}
                                            className="btn btn-secondary"
                                            style={{
                                                padding: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.75rem',
                                                fontWeight: 700
                                            }}
                                        >
                                            <Smartphone size={20} />
                                            Update Mobile (APK)
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction()}
                                        disabled={status === 'checking' || status === 'downloading'}
                                        className="btn btn-primary"
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.75rem',
                                            fontWeight: 700,
                                            opacity: (status === 'checking' || status === 'downloading') ? 0.7 : 1
                                        }}
                                    >
                                        {status === 'ready' ? (
                                            <>
                                                <Zap size={20} /> Install & Restart
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={20} className={status === 'checking' ? 'animate-spin' : ''} />
                                                {status === 'checking' ? 'Checking...' : status === 'downloading' ? 'Downloading...' : 'Check Again'}
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Default/Idle Layout (Centered) */
                    <div className="center-layout" style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <button
                            onClick={() => handleAction()}
                            disabled={status === 'checking'}
                            className="btn btn-primary"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                fontSize: '1rem',
                                fontWeight: 700,
                                opacity: status === 'checking' ? 0.7 : 1
                            }}
                        >
                            <RefreshCw size={20} className={status === 'checking' ? 'animate-spin' : ''} />
                            {status === 'checking' ? 'Checking for Updates...' : 'Check for Updates'}
                        </button>
                    </div>
                )}

                <div className="footer-notes" style={{
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <p>All your data and settings are protected during the update process.</p>
                    <p>Update source: AOF Biz Master Server</p>
                </div>
            </div>

            <style>{`
                .update-grid {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 2rem;
                    align-items: start;
                }
                @media (max-width: 900px) {
                    .update-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .release-notes-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .release-notes-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .release-notes-scroll::-webkit-scrollbar-thumb {
                    background: var(--border-color);
                    border-radius: 3px;
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(var(--accent-rgb), 0); }
                    100% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0); }
                }
            `}</style>
        </div >
    )
}

export default UpdatesSection
