import React, { useState, useEffect, useCallback } from 'react'
import {
    Shield, Zap, CheckCircle, Save, Camera, Store, FileText,
    Smartphone, RefreshCw, Crown, MessageCircle, Loader2,
    Mail, Globe, MapPin, Phone, Building2, Info, AlertCircle,
    Facebook, Instagram, Youtube, ShieldCheck
} from 'lucide-react'
import { useLicensing } from './LicensingContext'
import { useTheme } from './ThemeContext'
import { useToast } from './Toast/ToastContext'
import { getSettings, saveSettings } from '../utils/storage'
import { ProFeatureBadge } from './ProFeatureLock'
import ConfirmationModal from './ConfirmationModal'

const Profile = ({ onUpdateSettings }) => {
    const {
        userMode, setUserMode, resetSelection, isProUser, isFreeUser,
        activateTrial, isTrialActive, isTrialExpired, timeLeft,
        identityUser, licenseStatus, login, logout
    } = useLicensing()
    const { effectiveTheme } = useTheme()
    const { addToast } = useToast()

    const logoSrc = effectiveTheme === 'dark' ? './logo-dark.svg' : './logo.svg'

    const [settings, setSettings] = useState({
        businessName: '',
        businessTagline: '',
        businessAddress: '',
        businessPhone: '',
        businessWhatsapp: '',
        businessEmail: '',
        businessWebsite: '',
        businessLogo: null,
        socialFb: '',
        socialInsta: '',
        socialYoutube: '',
        socialTiktok: ''
    })
    const [loading, setLoading] = useState(true)
    const [detailsChanged, setDetailsChanged] = useState(false)
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', type: 'default', confirmText: 'Confirm', onConfirm: null
    })

    // Load Settings function
    const loadSettings = useCallback(async () => {
        const savedSettings = await getSettings()
        if (savedSettings) {
            setSettings(prev => ({
                ...prev,
                businessName: savedSettings.businessName || '',
                businessTagline: savedSettings.businessTagline || '',
                businessAddress: savedSettings.businessAddress || '',
                businessPhone: savedSettings.businessPhone || '',
                businessWhatsapp: savedSettings.businessWhatsapp || '',
                businessEmail: savedSettings.businessEmail || '',
                businessWebsite: savedSettings.businessWebsite || '',
                businessLogo: savedSettings.businessLogo || null,
                socialFb: savedSettings.socialFb || '',
                socialInsta: savedSettings.socialInsta || '',
                socialYoutube: savedSettings.socialYoutube || '',
                socialTiktok: savedSettings.socialTiktok || ''
            }))
        }
        setLoading(false)
    }, [])

    // Load Settings on Mount
    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    // Listen for cloud sync updates
    useEffect(() => {
        const handleSync = () => {
            console.log('Profile: Sync update detected, refreshing settings...')
            loadSettings()
        }
        window.addEventListener('sync:settings', handleSync)
        return () => window.removeEventListener('sync:settings', handleSync)
    }, [loadSettings])

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }))
        setDetailsChanged(true)
    }

    const handleLogoUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 500000) { // 500KB limit
                addToast('Image too large. Max 500KB.', 'error')
                return
            }
            const reader = new FileReader()
            reader.onloadend = () => {
                handleChange('businessLogo', reader.result)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveDetails = async () => {
        try {
            const currentSettings = await getSettings() || {}
            const newSettings = {
                ...currentSettings,
                ...settings
            }
            await saveSettings(newSettings)
            if (onUpdateSettings) onUpdateSettings(newSettings)
            setDetailsChanged(false)
            addToast('Business details updated successfully', 'success')
        } catch (error) {
            console.error('Failed to save business details:', error)
            addToast('Failed to save business details', 'error')
        }
    }

    const handleResetDefaults = () => {
        showConfirm(
            "Reset Branding?",
            "This will restore your Business Name, Tagline, and Logo to the application's default branding. This action cannot be undone.",
            () => {
                const defaults = {
                    businessName: 'AOF Biz - Managment App',
                    businessTagline: 'From Chaos To Clarity',
                    businessLogo: null
                }
                setSettings(prev => ({ ...prev, ...defaults }))
                setDetailsChanged(true)
                addToast('Reset to default branding. Click "Save" to apply.', 'info')
                closeConfirm()
            },
            'warning',
            'Reset to Defaults'
        )
    }

    const showConfirm = (title, message, onConfirm, type = 'default', confirmText = 'Confirm') => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, type, confirmText })
    }

    const closeConfirm = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
    }

    const LicensingSection = () => {
        const [isVerifying, setIsVerifying] = useState(false)
        const handleLogin = async () => {
            setIsVerifying(true)
            try {
                await login()
            } catch (err) {
                addToast('Login failed. Please try again.', 'error')
            } finally {
                setIsVerifying(false)
            }
        }

        const handleLogout = async () => {
            try {
                await logout()
                addToast('Signed out from Identity.', 'info')
            } catch (err) {
                addToast('Logout failed.', 'error')
            }
        }

        const handleWhatsApp = () => {
            const message = encodeURIComponent("I'd like to purchase an AOF Biz PRO license for my Google account.")
            window.open(`https://wa.me/94750350109?text=${message}`, '_blank')
        }

        const formatTimeLeft = (ms) => {
            const totalSeconds = Math.floor(ms / 1000)
            const days = Math.floor(totalSeconds / (24 * 3600))
            const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
            if (days > 0) return `${days}d ${hours}h left`
            return `${hours}h left`
        }

        return (
            <div className="animate-fade-in">
                <div className="card mb-6" style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: isProUser
                        ? 'linear-gradient(135deg, var(--bg-card), rgba(var(--accent-rgb), 0.1))'
                        : 'var(--bg-card)'
                }}>
                    {isProUser && (
                        <div style={{
                            position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1
                        }}>
                            <Crown size={120} fill="var(--accent-primary)" stroke="none" />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ flex: '1', minWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
                                    {isProUser ? 'Pro Plan Active' : 'Free Plan'}
                                </h3>
                                {isTrialActive && <span className="badge badge-warning">Trial Active</span>}
                                {!isProUser && isTrialExpired && <span className="badge badge-danger">Trial Expired</span>}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                                {isProUser
                                    ? 'Unlock the full potential of your business with cloud sync and advanced tools.'
                                    : 'Upgrade now to access Inventory Management, Expense Tracking, and Professional Invoicing.'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {isTrialActive ? (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                        <Zap size={18} /> {formatTimeLeft(timeLeft)}
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>of trial remaining</span>
                                </div>
                            ) : !isProUser && !isTrialExpired && (
                                <button
                                    className="btn"
                                    onClick={activateTrial}
                                    style={{
                                        backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                                        border: '1px solid var(--accent-primary)',
                                        color: 'var(--text-primary)',
                                        padding: '0.6rem 1.2rem',
                                        fontWeight: 600,
                                        boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.1)'
                                    }}
                                >
                                    <Zap size={16} color="var(--accent-primary)" fill="var(--accent-primary)" /> Start 3-Day Trial
                                </button>
                            )}

                            <div style={{
                                width: '56px', height: '56px', borderRadius: '14px',
                                backgroundColor: isProUser ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: isProUser ? 'var(--accent-primary)' : 'var(--text-muted)'
                            }}>
                                {isProUser ? <Crown size={32} fill="var(--accent-primary)" /> : <Shield size={32} />}
                            </div>
                        </div>
                    </div>

                    {isProUser && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600 }}>
                                <CheckCircle size={16} /> Verified License
                            </div>
                            <button
                                onClick={() => {
                                    showConfirm('Switch to Free Mode', 'Running in Free mode will restrict access to Expenses, Inventory, and Advanced Reports. Continue?', () => {
                                        setUserMode('free')
                                        addToast('Switched to Free mode', 'info')
                                    })
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.8rem', opacity: 0.8 }}
                            >
                                <RefreshCw size={14} /> Switch to Free
                            </button>
                        </div>
                    )}
                </div>

                {(!isProUser || isTrialActive) && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                            {/* Left Side: How to Upgrade */}
                            <div style={{
                                padding: '2rem',
                                borderRight: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-primary)' }}>
                                    <div style={{ padding: '0.6rem', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', borderRadius: '12px' }}>
                                        <MessageCircle size={24} />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Unlock Pro Features</h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[
                                        { step: 1, text: "Sign in with your Google account" },
                                        { step: 2, text: "Send your email to our sales team" },
                                        { step: 3, text: "We activate Pro status for your identity" },
                                        { step: 4, text: "Restart app to enjoy unlimited sync" }
                                    ].map((s) => (
                                        <div key={s.step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                            <span style={{
                                                width: '24px', height: '24px', borderRadius: '50%',
                                                backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                                                color: 'var(--accent-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 800, flexShrink: 0
                                            }}>{s.step}</span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>{s.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="btn btn-primary mt-auto"
                                    style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700 }}
                                    onClick={handleWhatsApp}
                                >
                                    <MessageCircle size={18} /> Contact Sales via WhatsApp
                                </button>
                            </div>

                            {/* Right Side: Identity Verification */}
                            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: identityUser ? 'var(--success)' : 'var(--accent-primary)' }}>
                                    <div style={{ padding: '0.6rem', backgroundColor: identityUser ? 'rgba(16, 185, 129, 0.1)' : 'rgba(var(--accent-rgb), 0.1)', borderRadius: '12px' }}>
                                        {identityUser ? <CheckCircle size={24} /> : <Shield size={24} />}
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                        {identityUser ? 'Identity Verified' : 'Sign In Required'}
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                                    {identityUser ? (
                                        <div style={{
                                            padding: '1.25rem',
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: 'var(--accent-primary)', color: 'white'
                                                }}>
                                                    {identityUser.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Linked Account</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{identityUser.email}</div>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {licenseStatus === 'pro' ? (
                                                    <div style={{ color: 'var(--success)', fontWeight: 600 }}>Pro status is active for this account.</div>
                                                ) : (
                                                    <div>Your account has Free status. Contact sales to upgrade.</div>
                                                )}
                                            </div>

                                            <button
                                                className="btn btn-secondary btn-sm mt-2"
                                                onClick={handleLogout}
                                                style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}
                                            >
                                                Sign Out
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                Sign in with your Google account to link your business identity and activate your Pro license.
                                            </p>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleLogin}
                                                disabled={isVerifying}
                                                style={{
                                                    width: '100%', padding: '1rem', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', gap: '0.75rem', fontSize: '1rem', fontWeight: 700
                                                }}
                                            >
                                                {isVerifying ? <Loader2 size={18} className="animate-spin" /> : (
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
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )/* END of identity section */}

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                        onClick={() => {
                            showConfirm('Reset Preferences', 'This will reset your plan and theme preferences and reload the app. Your data remains safe. Continue?', () => {
                                resetSelection()
                                localStorage.removeItem('aof_theme')
                                window.location.reload()
                            })
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            opacity: 0.7,
                            backgroundColor: 'transparent'
                        }}
                    >
                        <RefreshCw size={14} /> Reset Trial & Plan Preferences
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }} className="animate-fade-in">
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={closeConfirm}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
            />

            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Profile</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>Manage your business identity and account subscription</p>
                </div>
            </header>

            <section style={{ marginBottom: '3rem' }}>
                {/* Full-Width Digital Business Card */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{
                        position: 'relative',
                        padding: '2.5rem',
                        borderRadius: '32px',
                        background: effectiveTheme === 'dark'
                            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.7) 100%)',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2rem',
                        overflow: 'hidden'
                    }}>
                        {/* Card Background Glow */}
                        <div style={{
                            position: 'absolute', top: '-50px', right: '-50px', width: '250px', height: '250px',
                            background: 'var(--accent-primary)', filter: 'blur(100px)', opacity: 0.1, pointerEvents: 'none'
                        }}></div>

                        {/* Top Row: Logo & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{
                                    width: '100px', height: '100px', borderRadius: '24px',
                                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                                }}>
                                    {settings.businessLogo ? (
                                        <img src={settings.businessLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <img src={logoSrc} alt="Default Logo" style={{ width: '70%', height: '70%', objectFit: 'contain', opacity: 0.8 }} />
                                    )}
                                </div>
                                <div>
                                    <h3 style={{
                                        margin: 0, fontSize: '2.2rem', fontWeight: 900,
                                        color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1.1
                                    }}>
                                        {settings.businessName || (isFreeUser ? "AOF Biz - Managment App" : "Your Business")}
                                    </h3>
                                    <p style={{
                                        margin: '8px 0 0', fontSize: '1.1rem', fontStyle: 'italic',
                                        color: 'var(--text-secondary)', opacity: 0.8
                                    }}>
                                        {settings.businessTagline || (isFreeUser ? "From Chaos To Clarity" : "Your Brand Tagline")}
                                    </p>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: '100px', color: '#10b981', fontSize: '0.8rem', fontWeight: 800,
                                textTransform: 'uppercase', letterSpacing: '1px'
                            }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    backgroundColor: '#10b981', boxShadow: '0 0 12px #10b981',
                                    animation: 'pulse 2s infinite'
                                }}></div>
                                SYSTEM ONLINE
                            </div>
                        </div>

                        {/* Middle Row: Contact & Reach Info */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '1.5rem',
                            padding: '1.5rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {/* Address */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <MapPin size={18} color="var(--accent-primary)" style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Address</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{settings.businessAddress || 'Not set'}</div>
                                </div>
                            </div>
                            {/* Contact */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <Phone size={18} color="var(--accent-primary)" style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Contact</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{settings.businessPhone || (isFreeUser ? "0750 350 109" : 'Not set')}</div>
                                </div>
                            </div>
                            {/* WhatsApp */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <MessageCircle size={18} color="#25D366" style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>WhatsApp</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{settings.businessWhatsapp || (isFreeUser ? "0750 350 109" : 'Not set')}</div>
                                </div>
                            </div>
                            {/* Email */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <Mail size={18} color="var(--accent-primary)" style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Email</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{settings.businessEmail || 'Not set'}</div>
                                </div>
                            </div>
                            {/* Website */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <Globe size={18} color="var(--accent-primary)" style={{ marginTop: '3px' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Website</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{settings.businessWebsite || 'Not set'}</div>
                                </div>
                            </div>
                            {/* Social presence summary */}
                            {(settings.socialFb || settings.socialInsta || settings.socialYoutube || settings.socialTiktok) && (
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <Zap size={18} color="var(--accent-primary)" style={{ marginTop: '3px' }} />
                                    <div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Social Presence</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                                {settings.socialFb && (
                                                    <div title="Facebook" style={{ color: '#1877F2', display: 'flex' }}>
                                                        <Facebook size={18} fill="currentColor" fillOpacity={0.1} />
                                                    </div>
                                                )}
                                                {settings.socialInsta && (
                                                    <div title="Instagram" style={{ color: '#E1306C', display: 'flex' }}>
                                                        <Instagram size={18} />
                                                    </div>
                                                )}
                                                {settings.socialYoutube && (
                                                    <div title="YouTube" style={{ color: '#FF0000', display: 'flex' }}>
                                                        <Youtube size={18} fill="currentColor" fillOpacity={0.1} />
                                                    </div>
                                                )}
                                                {settings.socialTiktok && (
                                                    <div title="TikTok" style={{ color: 'var(--text-primary)', display: 'flex' }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V15a6.9 6.9 0 0 1-1.08 3.77 7.009 7.009 0 0 1-9.91.8c-1.39-1.21-2.22-2.91-2.29-4.71a7.013 7.013 0 0 1 4.75-6.79l.57-.18v4.22c-.41.13-.82.28-1.2.49A3.01 3.01 0 0 0 6.01 15c0 1.65 1.35 3 3 3a3 3 0 0 0 3-3V0h.52zm0 0" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Row: Identity & Socials */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem',
                            paddingTop: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    backgroundColor: isProUser ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: isProUser ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    border: `1px solid ${isProUser ? 'var(--accent-primary)' : 'var(--border-color)'}`
                                }}>
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {identityUser ? identityUser.email : 'Guest Session'}
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: isProUser ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {isProUser ? (isTrialActive ? 'PRO TRIAL ACTIVE' : 'PRO PLAN ACTIVE') : 'FREE PLAN'}
                                    </div>
                                </div>
                            </div>




                        </div>

                        <style>{`
                            @keyframes pulse {
                                0% { transform: scale(1); opacity: 1; }
                                50% { transform: scale(1.5); opacity: 0.5; }
                                100% { transform: scale(1); opacity: 1; }
                            }
                        `}</style>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                    {/* Identity Card */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Building2 size={22} color="var(--accent-primary)" /> Identity & Branding
                            </h2>
                            {isFreeUser && <ProFeatureBadge />}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: '120px', height: '120px', borderRadius: '24px',
                                    backgroundColor: 'var(--bg-secondary)', border: '2px dashed var(--border-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                                }}>
                                    {settings.businessLogo ? (
                                        <img src={settings.businessLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <img src={logoSrc} alt="Default Logo" style={{ width: '70%', height: '70%', objectFit: 'contain', opacity: 0.5 }} />
                                    )}
                                </div>
                                {isProUser && (
                                    <label style={{
                                        position: 'absolute', bottom: '-8px', right: '-8px', cursor: 'pointer',
                                        backgroundColor: 'var(--accent-primary)', color: 'white', padding: '0.5rem',
                                        borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex'
                                    }}>
                                        <Camera size={18} />
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                    </label>
                                )}
                            </div>

                            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Business Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. AOF Biz"
                                        value={isFreeUser ? "AOF Biz - Managment App" : settings.businessName}
                                        onChange={(e) => handleChange('businessName', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Tagline / Slogan</label>
                                    <input
                                        type="text"
                                        placeholder="From Chaos To Clarity."
                                        value={isFreeUser ? "From Chaos To Clarity." : settings.businessTagline}
                                        onChange={(e) => handleChange('businessTagline', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Integrated Action Buttons */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.75rem',
                            marginTop: '1rem',
                            paddingTop: '1.5rem',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            <button
                                onClick={handleResetDefaults}
                                disabled={isFreeUser}
                                className="btn btn-secondary"
                                style={{ background: 'transparent', fontSize: '0.85rem' }}
                            >
                                <RefreshCw size={14} /> Reset Defaults
                            </button>
                            <button
                                onClick={handleSaveDetails}
                                disabled={!detailsChanged || isFreeUser}
                                className="btn btn-primary"
                                style={{ fontSize: '0.85rem' }}
                            >
                                <Save size={14} /> Save Changes
                            </button>
                        </div>
                    </div>

                    {/* Contact Details Card */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Phone size={22} color="var(--accent-primary)" /> Logistics & Reach
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <MapPin size={14} /> Business Address
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter full physical address"
                                    value={isFreeUser ? "" : settings.businessAddress}
                                    onChange={(e) => handleChange('businessAddress', e.target.value)}
                                    disabled={isFreeUser}
                                    className="form-input"
                                    style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Phone size={14} /> Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="07XX XXX XXX"
                                        value={isFreeUser ? "0750 350 109" : settings.businessPhone}
                                        onChange={(e) => handleChange('businessPhone', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Mail size={14} /> Business Email
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="hello@yourbusiness.com"
                                        value={isFreeUser ? "" : settings.businessEmail}
                                        onChange={(e) => handleChange('businessEmail', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Globe size={14} /> Website URL
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="https://yourwebsite.com"
                                        value={isFreeUser ? "" : settings.businessWebsite}
                                        onChange={(e) => handleChange('businessWebsite', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <MessageCircle size={14} /> WhatsApp Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="07XX XXX XXX"
                                        value={isFreeUser ? "0750 350 109" : settings.businessWhatsapp}
                                        onChange={(e) => handleChange('businessWhatsapp', e.target.value)}
                                        disabled={isFreeUser}
                                        className="form-input"
                                        style={isFreeUser ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <label className="form-label" style={{ marginBottom: '0.75rem' }}>Social Media Links</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Facebook size={16} color="white" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Facebook URL"
                                            value={isFreeUser ? "" : settings.socialFb}
                                            onChange={(e) => handleChange('socialFb', e.target.value)}
                                            disabled={isFreeUser}
                                            className="form-input"
                                            style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Instagram size={16} color="white" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Instagram URL"
                                            value={isFreeUser ? "" : settings.socialInsta}
                                            onChange={(e) => handleChange('socialInsta', e.target.value)}
                                            disabled={isFreeUser}
                                            className="form-input"
                                            style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Youtube size={16} color="white" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="YouTube URL"
                                            value={isFreeUser ? "" : settings.socialYoutube}
                                            onChange={(e) => handleChange('socialYoutube', e.target.value)}
                                            disabled={isFreeUser}
                                            className="form-input"
                                            style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V15a6.9 6.9 0 0 1-1.08 3.77 7.009 7.009 0 0 1-9.91.8c-1.39-1.21-2.22-2.91-2.29-4.71a7.013 7.013 0 0 1 4.75-6.79l.57-.18v4.22c-.41.13-.82.28-1.2.49A3.01 3.01 0 0 0 6.01 15c0 1.65 1.35 3 3 3a3 3 0 0 0 3-3V0h.52zm0 0" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="TikTok URL"
                                            value={isFreeUser ? "" : settings.socialTiktok}
                                            onChange={(e) => handleChange('socialTiktok', e.target.value)}
                                            disabled={isFreeUser}
                                            className="form-input"
                                            style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="license-plan-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Crown size={24} color="var(--accent-primary)" />
                    <h2 style={{ margin: 0 }}>License & Plan</h2>
                </div>
                <LicensingSection />
            </section>

            {isFreeUser && (
                <div style={{
                    marginTop: '4rem', padding: '2rem', backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)',
                    display: 'flex', gap: '1.5rem', alignItems: 'center'
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <AlertCircle size={32} color="var(--warning)" />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Free Mode Restrictions</h4>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Branding features like custom logos and business names are disabled. Invoices will carry "AOF Biz" branding until a Pro license is activated.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Profile
