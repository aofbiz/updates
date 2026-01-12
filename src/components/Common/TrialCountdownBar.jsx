import React, { useState, useEffect } from 'react'
import { Clock, Crown, ArrowRight, AlertTriangle } from 'lucide-react'
import { useLicensing } from '../LicensingContext'

const TrialCountdownBar = () => {
    const { isTrialActive, isTrialExpired, timeLeft, isProUser, userMode } = useLicensing()
    const [timer, setTimer] = useState(timeLeft)

    useEffect(() => {
        if (!isTrialActive) return

        const interval = setInterval(() => {
            setTimer(prev => Math.max(0, prev - 1000))
        }, 1000)

        return () => clearInterval(interval)
    }, [isTrialActive])

    // Update timer if context timeLeft changes (e.g. on mount/refresh)
    useEffect(() => {
        setTimer(timeLeft)
    }, [timeLeft])

    if (!isTrialActive && !isTrialExpired) return null
    if (userMode === 'pro' && !isTrialActive) return null // Hide if fully pro (unless it's the trial window)

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000)
        const days = Math.floor(totalSeconds / (24 * 3600))
        const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (days > 0) return `${days}d ${hours}h left`
        if (hours > 0) return `${hours}h ${minutes}m left`
        return `${minutes}m ${seconds}s left`
    }

    const DURATION = 3 * 24 * 60 * 60 * 1000
    const percentage = Math.min(100, (timer / DURATION) * 100)

    // Color coding: Green (>66%) -> Orange (33-66%) -> Red (<33%)
    let color = 'var(--success)'
    if (percentage < 33) color = 'var(--danger)'
    else if (percentage < 66) color = 'var(--warning)'

    const handleUpgrade = () => {
        // Navigate to Profile page and scroll to license section
        window.dispatchEvent(new CustomEvent('navigate-to-view', {
            detail: { view: 'profile', section: 'license-plan-section' }
        }))
    }

    return (
        <div style={{
            position: 'sticky',
            top: 'var(--safe-area-top)',
            zIndex: 1000,
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            padding: '0.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        backgroundColor: isTrialExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {isTrialExpired ?
                            <AlertTriangle size={18} color="var(--danger)" /> :
                            <Clock size={18} color="var(--accent-primary)" />
                        }
                    </div>
                </div>

                {/* Centered Countdown - Bigger & Bolder */}
                {!isTrialExpired && (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: '150px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {formatTime(timer)}
                        </span>
                    </div>
                )}
                <button
                    onClick={handleUpgrade}
                    className="btn btn-primary"
                    style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Crown size={14} />
                    Upgrade Now
                    <ArrowRight size={14} />
                </button>
            </div>

            {/* Progress Bar */}
            {
                !isTrialExpired && (
                    <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: color,
                            transition: 'width 1s linear, background-color 0.5s ease'
                        }} />
                    </div>
                )
            }
        </div >
    )
}

export default TrialCountdownBar
