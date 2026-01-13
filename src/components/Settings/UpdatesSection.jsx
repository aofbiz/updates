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

                {status === 'available' && updateInfo && (
                    <div className="update-info-card" style={{
                        border: '1px solid var(--accent-primary)',
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        marginBottom: '1.5rem',
                        background: 'rgba(var(--accent-rgb), 0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    padding: '8px',
                                    borderRadius: '8px',
                                    background: 'var(--accent-primary)',
                                    color: '#fff'
                                }}>
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>New Version Available</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Found version v{updateInfo.version}</p>
                                </div>
                            </div>
                            <span style={{
                                background: 'var(--bg-secondary)',
                                padding: '4px 12px',
                                borderRadius: '100px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)'
                            }}>
                                New
                            </span>
                        </div>

                        {updateInfo.release_notes && (
                            <div className="release-notes" style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '0.75rem',
                                border: '1px solid var(--border-color)'
                            }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    <Info size={14} /> Release Notes
                                </h4>
                                <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                                    {updateInfo.release_notes}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {(status === 'downloading' || status === 'ready') && (
                    <div className="download-status" style={{
                        padding: '1.5rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '1rem',
                        border: '1px solid var(--border-color)',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                {status === 'downloading' ? 'Downloading Update...' : 'Ready to Install'}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {Math.round(progress)}%
                            </span>
                        </div>

                        {/* Download Stats Detail */}
                        {status === 'downloading' && downloadStats && (downloadStats.transferred > 0 || progress > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span>{formatBytes(downloadStats.transferred)} / {formatBytes(downloadStats.total)}</span>
                                <span>{formatSpeed(downloadStats.speed)}</span>
                            </div>
                        )}
                        <div style={{
                            height: '10px',
                            background: 'var(--border-color)',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div style={{
                                height: '100%',
                                background: 'var(--accent-primary)',
                                width: `${progress}%`,
                                transition: 'width 0.3s ease',
                                boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)'
                            }}></div>
                        </div>
                        {status === 'ready' && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ShieldCheck size={14} style={{ color: '#10b981' }} />
                                Verification complete. Click below to install and restart.
                            </p>
                        )}
                    </div>
                )}

                {/* Main Action Buttons */}
                <div className="update-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {status === 'available' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button
                                onClick={() => handleAction('apk')}
                                className="btn btn-secondary"
                                style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700
                                }}
                            >
                                <Smartphone size={24} />
                                Update Mobile (APK)
                            </button>
                            <button
                                onClick={() => handleAction('exe')}
                                className="btn btn-primary"
                                style={{
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700
                                }}
                            >
                                <Monitor size={24} />
                                Update Desktop (EXE)
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleAction()}
                            disabled={status === 'checking' || status === 'downloading'}
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
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                filter: (status === 'checking' || status === 'downloading') ? 'grayscale(0.5) opacity(0.7)' : 'none'
                            }}
                        >
                            {status === 'checking' ? (
                                <>
                                    <RefreshCw size={20} className="animate-spin" />
                                    Checking for updates...
                                </>
                            ) : status === 'downloading' ? (
                                <>
                                    <RefreshCw size={20} className="animate-spin" />
                                    Downloading Desktop Update...
                                </>
                            ) : status === 'ready' ? (
                                <>
                                    <Zap size={20} />
                                    Install & Restart Now
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={20} />
                                    Check for Updates
                                </>
                            )}
                        </button>
                    )}
                </div>

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
        </div>
    )
}

export default UpdatesSection
