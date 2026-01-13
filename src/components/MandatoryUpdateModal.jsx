import React, { useState } from 'react'
import { AlertTriangle, Download, Zap, Smartphone, Monitor, Info, ShieldCheck, CheckCircle } from 'lucide-react'
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

const MandatoryUpdateModal = ({ info, onUpdate, onCancel, progress, downloadStats }) => {
    if (!info) return null

    // Derived status based on props
    const isDownloading = progress > 0 && progress < 100
    const isReady = progress === 100

    const currentStatus = isReady ? 'ready' : (isDownloading ? 'downloading' : 'available')
    const isMobile = Capacitor.getPlatform() !== 'web'

    const renderMarkup = (text) => {
        if (!text) return null

        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h4 style="margin: 1.5rem 0 0.5rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">$1</h4>')
            .replace(/^## (.*$)/gim, '<h3 style="margin: 1.5rem 0 0.5rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">$1</h3>')
            .replace(/^# (.*$)/gim, '<h2 style="margin: 2rem 0 1rem; color: var(--text-primary);">$1</h2>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Bullet points
            .replace(/^\s*[-*+]\s+(.*)$/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;">$1</li>')
            // New lines for points that are not bullets
            .replace(/\n(?!<li)/g, '<br />')

        return <div dangerouslySetInnerHTML={{ __html: html }} className="markup-content" />
    }
    // const isMobile = Capacitor.isNativePlatform() // Removed duplicate

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
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '2rem'
        }}>
            <div className="updates-container animate-fade-in" style={{
                background: 'var(--bg-card)',
                borderRadius: '1.25rem',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '550px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
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
                        background: 'rgba(255, 46, 54, 0.1)', // Red tint for mandatory
                        borderRadius: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255, 46, 54, 0.2)'
                    }}>
                        <AlertTriangle
                            size={32}
                            style={{ color: '#ef4444' }}
                        />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Mandatory Update Required</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                        The grace period for this update has expired. You must update to continue using AOF Biz.
                    </p>
                </div>

                {/* Content Area */}
                <div className="updates-content" style={{ padding: '2rem' }}>

                    {currentStatus === 'available' && (
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
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Found version v{info.version}</p>
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
                                    Required
                                </span>
                            </div>

                            {info.release_notes && (
                                <div className="release-notes" style={{
                                    marginTop: '1rem',
                                    padding: '1rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--border-color)',
                                    maxHeight: '120px',
                                    overflowY: 'auto'
                                }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <Info size={14} /> Release Notes
                                    </h4>
                                    <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                        {renderMarkup(info.release_notes)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(currentStatus === 'downloading' || currentStatus === 'ready') && (
                        <div className="download-status" style={{
                            padding: '1.5rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '1rem',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                        {currentStatus === 'downloading' ? 'Downloading Update...' : 'Ready to Install'}
                                    </span>
                                    {currentStatus === 'downloading' && (
                                        <button
                                            onClick={onCancel}
                                            style={{
                                                background: 'rgba(255, 46, 54, 0.1)',
                                                border: '1px solid rgba(255, 46, 54, 0.2)',
                                                color: 'rgba(255, 46, 54, 1)',
                                                padding: '1px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                    {Math.round(progress)}%
                                </span>
                            </div>

                            {currentStatus === 'downloading' && downloadStats && (downloadStats.transferred > 0 || progress > 0) && (
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
                            {currentStatus === 'ready' && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldCheck size={14} style={{ color: '#10b981' }} />
                                    Verification complete. App will restart automatically.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Main Action Buttons */}
                    <div className="update-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {currentStatus === 'available' ? (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                gap: '1rem'
                            }}>
                                {!isMobile && (
                                    <button
                                        onClick={() => handleAction('exe')}
                                        className="btn-hover-effect"
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            background: 'var(--accent-primary)',
                                            border: 'none',
                                            borderRadius: '0.75rem',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <WindowsIcon size={20} />
                                            Windows (EXE)
                                        </div>
                                        {info.exe_size && (
                                            <span style={{ fontSize: '0.7rem', opacity: 0.9, fontWeight: 600 }}>
                                                {formatBytes(info.exe_size)}
                                            </span>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleAction('apk')}
                                    className="btn-hover-effect"
                                    style={{
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        background: isMobile ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        border: isMobile ? 'none' : '1px solid var(--border-color)',
                                        borderRadius: '0.75rem',
                                        color: isMobile ? '#fff' : 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <AndroidIcon size={20} />
                                        Android (APK)
                                    </div>
                                    {info.apk_size && (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 600 }}>
                                            {formatBytes(info.apk_size)}
                                        </span>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                {currentStatus === 'downloading' ? 'Please wait, do not close the application.' : 'Installing...'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                .btn-hover-effect { transition: transform 0.2s, filter 0.2s; }
                .btn-hover-effect:hover { transform: translateY(-2px); filter: brightness(1.1); }
                .btn-hover-effect:active { transform: translateY(0); }
            `}</style>
        </div>
    )
}

export default MandatoryUpdateModal
