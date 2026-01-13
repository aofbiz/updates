import React, { useEffect } from 'react'
import { CheckCircle, Download, AlertTriangle, RefreshCw, Info, Settings, ShieldCheck, Zap, Smartphone, Monitor } from 'lucide-react'
import { useUpdateManager } from '../../hooks/useUpdateManager'
import { Capacitor } from '@capacitor/core'

const WindowsIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 3.449L9.75 2.1L9.751 11.309L0 11.359V3.449ZM0 12.649L9.751 12.684V21.899L0 20.551V12.649ZM10.912 1.939L24 0V11.232L10.912 11.282V1.939ZM10.912 12.723L24 12.758V24L10.912 22.06V12.723Z" />
    </svg>
)

const AndroidIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.523 15.3414C17.523 15.1114 17.336 14.9254 17.107 14.9254C16.878 14.9254 16.692 15.1114 16.692 15.3414C16.692 15.5704 16.878 15.7574 17.107 15.7574C17.336 15.7574 17.523 15.5704 17.523 15.3414ZM6.893 15.3414C6.893 15.1114 6.706 14.9254 6.478 14.9254C6.249 14.9254 6.063 15.1114 6.063 15.3414C6.063 15.5704 6.249 15.7574 6.478 15.7574C6.706 15.7574 6.893 15.5704 6.893 15.3414ZM18.067 11.4554L19.982 8.1384C20.071 7.9854 20.021 7.7894 19.867 7.7004C19.714 7.6114 19.518 7.6624 19.429 7.8154L17.487 11.1814C15.936 10.4784 14.185 10.0844 12.316 10.0844C10.447 10.0844 8.696 10.4784 7.144 11.1814L5.203 7.8154C5.114 7.6624 4.918 7.6114 4.764 7.7004C4.61 7.7894 4.56 7.9854 4.649 8.1384L6.564 11.4554C3.899 12.9224 2.107 15.6594 2 18.8474H22.632C22.525 15.6594 20.732 12.9224 18.067 11.4554Z" />
    </svg>
)

const UpdatesSection = () => {
    const {
        status,
        updateInfo,
        progress,
        downloadStats,
        error,
        checkForUpdates,
        startDownload,
        cancelDownload,
        installUpdate,
        currentVersion
    } = useUpdateManager()

    const renderMarkup = (text) => {
        if (!text) return null

        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h4 style="margin: 1.5rem 0 0.5rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h4>')
            .replace(/^## (.*$)/gim, '<h3 style="margin: 1.5rem 0 0.5rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">$1</h3>')
            .replace(/^# (.*$)/gim, '<h2 style="margin: 2rem 0 1rem; color: var(--text-primary);">$1</h2>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Bullet points
            .replace(/^\s*[-*+]\s+(.*)$/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;">$1</li>')
            // New lines for points that are not bullets
            .replace(/\n(?!<li)/g, '<br />')

        // Wrap lists in <ul> for better styling
        if (html.includes('<li')) {
            // Very basic list wrapping - could be improved but sufficient for most release notes
            // We'll just leave it as is if it's too complex to wrap perfectly without a real parser
        }

        return <div dangerouslySetInnerHTML={{ __html: html }} className="markup-content" />
    }
    const isMobile = Capacitor.getPlatform() !== 'web'

    const formatBytes = (bytes) => {
        if (!bytes) return ''
        const s = String(bytes).trim()

        // If it already has a unit (e.g. "45 MB"), just return it
        if (/[a-zA-Z]/.test(s)) return s

        const b = parseFloat(s)
        if (isNaN(b) || b <= 0) return ''

        // If the number is small (e.g. < 10000), assume user entered MB directly
        if (b < 10000) return `${b} MB`

        // If it's a huge number, treat it as bytes and convert to MB
        const mb = (b / (1024 * 1024)).toFixed(1)
        return `${mb} MB`
    }

    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec) return '0 MB/s'
        const mb = (bytesPerSec / (1024 * 1024)).toFixed(1)
        return `${mb} MB/s`
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

                {/* Full-width Layout for Active Updates */}
                {(status === 'available' || status === 'downloading' || status === 'ready') && updateInfo ? (
                    <div className="update-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Status Info Card (Full Width) */}
                        <div style={{
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            background: 'rgba(var(--accent-rgb), 0.03)',
                            border: '1px solid rgba(var(--accent-rgb), 0.1)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        padding: '10px',
                                        borderRadius: '10px',
                                        background: 'var(--accent-primary)',
                                        color: '#fff'
                                    }}>
                                        <Zap size={24} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Update Available</h4>
                                        <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>v{currentVersion} → v{updateInfo.version}</p>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                    Released: {updateInfo.created_at ? new Date(updateInfo.created_at).toLocaleDateString() : 'Recently'}
                                </div>
                            </div>
                        </div>

                        {/* Download Progress (Full Width) */}
                        {(status === 'downloading' || status === 'ready') && (
                            <div className="download-status" style={{
                                padding: '1.5rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '1rem',
                                border: '1px solid var(--border-color)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                                            {status === 'downloading' ? 'Downloading Update...' : 'Update Downloaded'}
                                        </span>
                                        {status === 'downloading' && (
                                            <button
                                                onClick={cancelDownload}
                                                style={{
                                                    background: 'rgba(255, 46, 54, 0.1)',
                                                    border: '1px solid rgba(255, 46, 54, 0.2)',
                                                    color: 'rgba(255, 46, 54, 1)',
                                                    padding: '2px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => e.target.style.background = 'rgba(255, 46, 54, 0.2)'}
                                                onMouseOut={(e) => e.target.style.background = 'rgba(255, 46, 54, 0.1)'}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                        {Math.round(progress)}%
                                    </span>
                                </div>

                                {status === 'downloading' && downloadStats && (downloadStats.transferred > 0 || progress > 0) && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <span style={{ fontWeight: 600 }}>{formatBytes(downloadStats.transferred)} / {formatBytes(downloadStats.total)}</span>
                                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{formatSpeed(downloadStats.speed)}</span>
                                    </div>
                                )}
                                <div style={{
                                    height: '12px',
                                    background: 'var(--bg-primary)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        background: 'linear-gradient(90deg, var(--accent-primary) 0%, #ff4d4d 100%)',
                                        width: `${progress}%`,
                                        transition: 'width 0.3s ease',
                                        boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)'
                                    }}></div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons (Full Width) */}
                        <div className="action-buttons-stack" style={{
                            display: 'grid',
                            gridTemplateColumns: (status === 'available' && !isMobile) ? '1fr 1fr' : '1fr',
                            gap: '1rem'
                        }}>
                            {status === 'available' ? (
                                <>
                                    {!isMobile && (
                                        <button
                                            onClick={() => handleAction('exe')}
                                            className="btn btn-primary"
                                            style={{
                                                padding: '1.25rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.4rem',
                                                fontWeight: 800,
                                                fontSize: '1rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <WindowsIcon size={20} />
                                                Windows (EXE)
                                            </div>
                                            {updateInfo.exe_size && (
                                                <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>
                                                    {formatBytes(updateInfo.exe_size)}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleAction('apk')}
                                        className="btn btn-secondary"
                                        style={{
                                            padding: '1.25rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.4rem',
                                            fontWeight: 800,
                                            fontSize: '1rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <AndroidIcon size={20} />
                                            Android (APK)
                                        </div>
                                        {updateInfo.apk_size && (
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>
                                                {formatBytes(updateInfo.apk_size)}
                                            </span>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleAction()}
                                    disabled={status === 'checking' || status === 'downloading'}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.75rem',
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        opacity: (status === 'checking' || status === 'downloading') ? 0.7 : 1
                                    }}
                                >
                                    {status === 'ready' ? (
                                        <>
                                            <Zap size={22} /> Install & Restart Now
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={22} className={status === 'checking' ? 'animate-spin' : ''} />
                                            {status === 'checking' ? 'Checking...' : status === 'downloading' ? 'Downloading...' : 'Check Again'}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Release Notes (Now at bottom, Full Width) */}
                        <div className="notes-section">
                            <div style={{
                                background: 'var(--bg-secondary)',
                                borderRadius: '1rem',
                                border: '1px solid var(--border-color)',
                                padding: '1.5rem',
                            }}>
                                <h3 style={{
                                    margin: '0 0 1.25rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '1.1rem',
                                    fontWeight: 800
                                }}>
                                    <Info size={22} style={{ color: 'var(--accent-primary)' }} />
                                    What's New in v{updateInfo.version}
                                </h3>

                                {updateInfo.release_notes ? (
                                    <div className="release-notes-scroll" style={{
                                        fontSize: '0.95rem',
                                        lineHeight: '1.8',
                                        color: 'var(--text-secondary)',
                                        maxHeight: '350px',
                                        overflowY: 'auto',
                                        paddingRight: '0.5rem'
                                    }}>
                                        {renderMarkup(updateInfo.release_notes)}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No release notes available for this release.</p>
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
                .update-stack {
                    animation: fadeIn 0.4s ease-out;
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
                @media (max-width: 600px) {
                    .action-buttons-stack {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div >
    )
}

export default UpdatesSection
