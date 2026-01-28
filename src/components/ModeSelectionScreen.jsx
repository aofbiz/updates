import { useState, useEffect } from 'react'
import {
    Check, Loader2, Zap, Globe, Lock, ShieldCheck,
    Smartphone, RefreshCw, Layers, Database, BarChart3, Cloud,
    FileText, ShoppingBag, LayoutDashboard, Sun, Moon, X, WifiOff
} from 'lucide-react'
import { useLicensing } from './LicensingContext'
import { useTheme } from './ThemeContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import '../login.css'

const ModeSelectionScreen = ({ onModeSelected }) => {
    const {
        setUserMode, rememberSelection, setRememberSelection,
        login, authError, setAuthError
    } = useLicensing()
    const { effectiveTheme, setTheme } = useTheme()
    const isOnline = useOnlineStatus()
    const [isLoading, setIsLoading] = useState(false)
    const [localError, setLocalError] = useState(null)
    const [activeMode, setActiveMode] = useState('pro') // Start with Pro to highlight premium

    // Check if user has cached credentials (can work offline)
    const hasCachedCredentials = Boolean(
        localStorage.getItem('allset_cached_identity') &&
        localStorage.getItem('allset_user_mode')
    )

    // Clear local errors when switching tabs, but preserve server-side authError if it just arrived
    useEffect(() => {
        setLocalError(null)
    }, [activeMode])

    const logoSrc = effectiveTheme === 'dark' ? './logo-dark.png' : './logo-light.png'

    const handleFreeMode = async () => {
        setIsLoading(true)
        setLocalError(null)
        try {
            await login('free', 'free')
        } catch (err) {
            console.error('Free login error:', err)
            setLocalError('Google sign-in required to open free version.')
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        setLocalError(null)
        try {
            await login('pro', null)
        } catch (err) {
            console.error('Login error:', err)
            setLocalError('Google sign-in failed. Please try again.')
            setIsLoading(false)
        }
    }

    const handleTrialLogin = async () => {
        setIsLoading(true)
        setLocalError(null)
        try {
            await login('pro', 'trial')
        } catch (err) {
            console.error('Trial login error:', err)
            setLocalError('Google sign-in failed. Please try again.')
            setIsLoading(false)
        }
    }

    const toggleTheme = () => {
        setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
    }

    const content = {
        pro: {
            badge: "ENTERPRISE READY",
            title: "Scale Without Limits",
            desc: "The ultimate business management suite with real-time cloud synchronization across all your devices.",
            features: [
                { icon: <Cloud size={18} />, text: "Cloud Sync & Backup" },
                { icon: <FileText size={18} />, text: "Quotations & Billing" },
                { icon: <Layers size={18} />, text: "Multi-item Inventory" },
                { icon: <BarChart3 size={18} />, text: "Pro Analytics" }
            ],
            accent: "pro"
        },
        free: {
            badge: "FREE FOREVER",
            title: "Simple. Lean. Powerful.",
            desc: "Everything you need to manage orders locally. Perfect for startups and solo entrepreneurs.",
            features: [
                { icon: <ShoppingBag size={18} />, text: "Order Management" },
                { icon: <Database size={18} />, text: "Local Data Engine" },
                { icon: <LayoutDashboard size={18} />, text: "Modern Dashboard" },
                { icon: <ShieldCheck size={18} />, text: "Privacy Focused" }
            ],
            accent: "free"
        }
    }

    const active = content[activeMode]

    return (
        <div className="login-stage">
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>

            <div className={`login-portal portal-${active.accent}`}>
                {/* Theme Toggle Floating Button */}
                <button
                    onClick={toggleTheme}
                    className="login-theme-toggle"
                    title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {effectiveTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Left Side: Show what they are getting */}
                <div className="portal-preview">
                    {/* Brand Identity Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '3.5rem' }}>
                        <img src={logoSrc} alt="Logo" style={{ height: '130px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1, letterSpacing: '-1px' }}>AllSet</h1>
                            <h2 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Management APP</h2>
                            <p style={{ fontSize: '0.85rem', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-primary)', margin: '6px 0 0', opacity: 0.8 }}>From Chaos to Clarity</p>
                        </div>
                    </div>

                    <div className="preview-content" key={activeMode}>
                        <div className="brand-badge" style={{ color: `var(--${activeMode}-accent)` }}>
                            {active.accent === 'pro' ? <Zap size={14} fill="currentColor" /> : <Layers size={14} />}
                            {active.badge}
                        </div>
                        <h1 className="preview-title">{active.title}</h1>
                        <p className="preview-desc">{active.desc}</p>

                        <div className="feature-grid">
                            {active.features.map((f, i) => (
                                <div key={i} className="feature-capsule" style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className="feature-icon" style={{ color: `var(--${activeMode}-accent)` }}>{f.icon}</div>
                                    <span>{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Logins */}
                <div className="portal-actions">
                    <div className="action-header">
                        <h3>Get Started</h3>
                        <p>Choose your experience to enter the system.</p>
                    </div>

                    <div className="mode-toggle-container">
                        <div className={`mode-toggle-track to-${activeMode}`}></div>
                        <button
                            className={`mode-btn ${activeMode === 'free' ? 'active' : ''}`}
                            onClick={() => setActiveMode('free')}
                        >
                            FREE
                        </button>
                        <button
                            className={`mode-btn ${activeMode === 'pro' ? 'active' : ''}`}
                            onClick={() => setActiveMode('pro')}
                        >
                            PRO
                        </button>
                    </div>

                    {/* Offline Notice for first-time users */}
                    {!isOnline && !hasCachedCredentials && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '1rem',
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            border: '1px solid rgba(251, 191, 36, 0.2)',
                            borderRadius: '12px',
                            marginBottom: '1.5rem',
                            color: '#fbbf24'
                        }}>
                            <WifiOff size={20} />
                            <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                                <strong>You're offline.</strong><br />
                                <span style={{ color: 'var(--text-muted)' }}>Connect to the internet to sign in for the first time.</span>
                            </div>
                        </div>
                    )}

                    {(localError || (authError && authError !== 'ACCOUNT_NOT_AUTHORIZED')) && (
                        <div style={{
                            color: 'var(--pro-accent)',
                            fontSize: '0.85rem',
                            marginBottom: '1.5rem',
                            textAlign: 'center',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(255, 46, 54, 0.05)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 46, 54, 0.1)'
                        }}>
                            {authError || localError}
                        </div>
                    )}

                    {authError === 'ACCOUNT_NOT_AUTHORIZED' && (
                        <div className="auth-modal-overlay" style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 1000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <div className="auth-modal-card" style={{
                                width: '100%',
                                maxWidth: '420px',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '24px',
                                border: '1px solid rgba(255, 46, 54, 0.3)',
                                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 46, 54, 0.1)',
                                padding: '2rem',
                                position: 'relative',
                                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}>
                                <button
                                    onClick={() => setAuthError(null)}
                                    style={{
                                        position: 'absolute',
                                        top: '1.25rem',
                                        right: '1.25rem',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: 'none',
                                        color: '#777',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <X size={18} />
                                </button>

                                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        backgroundColor: 'rgba(255, 46, 54, 0.1)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1rem',
                                        color: 'var(--pro-accent)'
                                    }}>
                                        <Lock size={30} />
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', color: 'white', margin: '0 0 0.5rem 0' }}>Access Restricted</h3>
                                    <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                                        Pro status is required to access this version. Your current account is not in our master database.
                                    </p>
                                </div>

                                <div style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                    borderRadius: '16px',
                                    padding: '1.25rem',
                                    marginBottom: '1.5rem',
                                    border: '1px solid rgba(59, 130, 246, 0.1)'
                                }}>
                                    <h4 style={{ color: '#eee', margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Globe size={16} color="var(--free-accent)" />
                                        Try the Free Version
                                    </h4>
                                    <button
                                        onClick={() => {
                                            setActiveMode('free')
                                            handleFreeMode()
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            backgroundColor: 'var(--free-accent)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                                        }}
                                    >
                                        Open Application (Free)
                                    </button>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>
                                        Need help? Contact support at <br />
                                        <a href="mailto:aofbizhelp@gmail.com" style={{ color: 'var(--pro-accent)', textDecoration: 'none', fontWeight: 500 }}>aofbizhelp@gmail.com</a>
                                    </p>
                                </div>
                            </div>

                            <style>{`
                                @keyframes fadeIn {
                                    from { opacity: 0; }
                                    to { opacity: 1; }
                                }
                                @keyframes slideUp {
                                    from { transform: translateY(30px); opacity: 0; }
                                    to { transform: translateY(0); opacity: 1; }
                                }
                            `}</style>
                        </div>
                    )}

                    <div className="action-zone" style={{ marginBottom: '1.5rem' }}>
                        {activeMode === 'pro' ? (
                            <button className="btn-google" onClick={handleGoogleLogin} disabled={isLoading || (!isOnline && !hasCachedCredentials)}>
                                {isLoading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Sign in with Google
                                    </>
                                )}
                            </button>
                        ) : (
                            <button className="btn-google" onClick={handleFreeMode} disabled={isLoading || (!isOnline && !hasCachedCredentials)}>
                                {isLoading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Sign in with Google
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="remember-zone" style={{ marginBottom: '1.5rem' }}>
                        <input
                            type="checkbox"
                            id="remember"
                            checked={rememberSelection}
                            onChange={(e) => setRememberSelection(e.target.checked)}
                        />
                        <label htmlFor="remember">Remember my selection</label>
                    </div>

                    <div style={{
                        width: '100%',
                        height: '1px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        margin: '2rem 0'
                    }}></div>

                    <div className="trial-dedicated-section">
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--pro-accent)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginBottom: '0.5rem'
                        }}>
                            <Zap size={14} fill="currentColor" />
                            New User Offer
                        </div>
                        <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>Don't have a license?</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                            Start a <b>3-day free trial</b> to experience the full cloud-synced Pro version immediately.
                        </p>

                        <button
                            onClick={handleTrialLogin}
                            disabled={isLoading || (!isOnline && !hasCachedCredentials)}
                            className="btn-trial-action"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                            Activate 3-Day Free Trial
                        </button>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '2.5rem', textAlign: 'center', opacity: 0.4 }}>
                        <p style={{ fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Powered by AllSet</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ModeSelectionScreen
