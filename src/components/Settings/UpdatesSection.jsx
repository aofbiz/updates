import React, { useState } from 'react'
import { RefreshCw, Download, CheckCircle2, AlertCircle, Info, Zap, ShieldCheck, Smartphone, Monitor } from 'lucide-react'

const UpdatesSection = ({ updateManager }) => {
    const {
        status,
        progress,
        updateInfo,
        supabaseUpdate,
        currentVersion,
        error,
        autoUpdate,
        setAutoUpdate,
        checkForUpdates,
        startDownload,
        installUpdate
    } = updateManager

    const [isChecking, setIsChecking] = useState(false)

    const handleManualCheck = async () => {
        setIsChecking(true)
        await checkForUpdates()
        setIsChecking(false)
    }

    const openExternal = (url) => {
        if (window.electronAPI) {
            window.electronAPI.openExternal(url)
        } else {
            window.open(url, '_blank')
        }
    }

    const renderStatus = () => {
        switch (status) {
            case 'checking':
                return (
                    <div className="update-status-card checking">
                        <RefreshCw size={24} className="animate-spin" />
                        <div>
                            <h4>Scanning for updates...</h4>
                            <p>Connecting to Supabase & GitHub to verify the latest build.</p>
                        </div>
                    </div>
                )
            case 'available':
                return (
                    <div className="update-status-card available">
                        <div style={{ display: 'flex', gap: '1.25rem', width: '100%' }}>
                            <Zap size={24} color="var(--accent-primary)" />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h4>Version {updateInfo?.version} is available</h4>
                                        <p>A new release with fresh features and improvements is ready.</p>
                                    </div>
                                    <span className="badge" style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}>IMPORTANT</span>
                                </div>

                                {updateInfo?.releaseNotes && (
                                    <div className="release-notes-box">
                                        <strong>Change Log:</strong>
                                        <div className="notes-content">
                                            {updateInfo.releaseNotes.split('\n').map((line, i) => (
                                                <p key={i}>{line}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    {window.electronAPI ? (
                                        <button className="btn btn-primary" onClick={startDownload}>
                                            <Download size={18} />
                                            Download and Install
                                        </button>
                                    ) : (
                                        <>
                                            {supabaseUpdate?.apk_link && (
                                                <button className="btn btn-primary" onClick={() => openExternal(supabaseUpdate.apk_link)}>
                                                    <Smartphone size={18} />
                                                    Download APK
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {supabaseUpdate?.exe_link && !window.electronAPI && (
                                        <button className="btn btn-outline" onClick={() => openExternal(supabaseUpdate.exe_link)}>
                                            <Monitor size={18} />
                                            Get for PC
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            case 'downloading':
                return (
                    <div className="update-status-card downloading">
                        <Download size={24} className="animate-bounce" />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <h4>Downloading Build...</h4>
                                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{Math.round(progress)}%</span>
                            </div>
                            <div className="update-progress-bar">
                                <div className="update-progress-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p>You can continue using the app. We'll notify you when it's ready.</p>
                        </div>
                    </div>
                )
            case 'ready':
                return (
                    <div className="update-status-card ready">
                        <CheckCircle2 size={24} color="var(--success)" />
                        <div style={{ flex: 1 }}>
                            <h4>Update Downloaded!</h4>
                            <p>The new version is staged and ready. Restart the application to complete the installation.</p>
                        </div>
                        <button className="btn btn-primary" onClick={installUpdate}>
                            <RefreshCw size={18} />
                            Restart App
                        </button>
                    </div>
                )
            case 'none':
                return (
                    <div className="update-status-card up-to-date">
                        <CheckCircle2 size={24} color="var(--success)" />
                        <div>
                            <h4>The system is up to date</h4>
                            <p>You are running the latest version of AOF Biz (v{currentVersion}).</p>
                        </div>
                    </div>
                )
            case 'idle':
            default:
                if (error) {
                    return (
                        <div className="update-status-card error">
                            <AlertCircle size={24} color="var(--danger)" />
                            <div>
                                <h4>Connection Issue</h4>
                                <p>{error}</p>
                            </div>
                            <button className="btn btn-outline btn-sm" onClick={handleManualCheck} style={{ marginLeft: 'auto' }}>Retry</button>
                        </div>
                    )
                }
                return (
                    <div className="update-status-card up-to-date" style={{ opacity: 0.7 }}>
                        <Info size={24} />
                        <div>
                            <h4>Check for updates</h4>
                            <p>Last checked: Just now</p>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="updates-container animate-fade-in">
            <div className="updates-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3>Software Updates</h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px' }}>
                            Current: v{currentVersion}
                        </span>
                    </div>
                    <p>Manage your application lifecycle and security patches.</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={handleManualCheck}
                    disabled={status === 'checking' || status === 'downloading' || isChecking}
                >
                    <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                    Check for Updates
                </button>
            </div>

            <div className="updates-content">
                {renderStatus()}

                <div className="updates-settings-grid">
                    <div className="update-config-card">
                        <div className="config-header">
                            < Zap size={20} color="var(--accent-primary)" />
                            <span>Update Preferences</span>
                        </div>
                        <label className="config-item">
                            <div className="config-info">
                                <strong>Background Download</strong>
                                <p>Automatically fetch updates when they become available.</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={autoUpdate}
                                    onChange={(e) => setAutoUpdate(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </div>
                        </label>
                    </div>

                    <div className="update-config-card">
                        <div className="config-header">
                            <ShieldCheck size={20} color="var(--success)" />
                            <span>Integrity Check</span>
                        </div>
                        <div className="config-item">
                            <div className="config-info">
                                <strong>Trusted Source</strong>
                                <p>Signed releases delivered via Supabase & GitHub SSL.</p>
                            </div>
                            <div style={{ color: 'var(--success)' }}><CheckCircle2 size={18} /></div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .updates-container {
                    padding: 1rem 0;
                }
                .updates-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .updates-header h3 { font-size: 1.25rem; font-weight: 800; margin: 0; }
                .updates-header p { color: var(--text-muted); font-size: 0.9rem; margin: 0.25rem 0 0 0; }

                .update-status-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    padding: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .update-status-card.ready { border-color: var(--success); background: rgba(var(--success-rgb), 0.05); }
                .update-status-card.available { border-color: var(--accent-primary); background: rgba(var(--accent-rgb), 0.03); }
                .update-status-card.error { border-color: var(--danger); background: rgba(var(--danger-rgb), 0.05); }
                
                .update-status-card h4 { margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); }
                .update-status-card p { margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.9rem; }

                .release-notes-box {
                    margin-top: 1.5rem;
                    padding: 1.25rem;
                    border-radius: 12px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid var(--border-color);
                }
                .release-notes-box strong { font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
                .notes-content { margin-top: 0.75rem; max-height: 200px; overflow-y: auto; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }

                .update-progress-bar {
                    width: 100%;
                    height: 10px;
                    background: var(--bg-secondary);
                    border-radius: 10px;
                    margin: 1rem 0;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }
                .update-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent-primary), #ff6b6b);
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .updates-settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                .update-config-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 1.5rem;
                }

                .config-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border-color);
                    font-weight: 700;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: var(--text-muted);
                }

                .config-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                }

                .config-info strong { font-size: 0.95rem; display: block; margin-bottom: 0.35rem; color: var(--text-primary); }
                .config-info p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                    flex-shrink: 0;
                }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #333;
                    transition: .4s;
                    border-radius: 24px;
                    border: 1px solid var(--border-color);
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 16px; width: 16px;
                    left: 3px; bottom: 3px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .toggle-slider { background-color: var(--accent-primary); border-color: var(--accent-primary); }
                input:checked + .toggle-slider:before { transform: translateX(20px); }
            `}</style>
        </div>
    )
}

export default UpdatesSection
