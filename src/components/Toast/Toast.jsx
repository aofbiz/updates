import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, X, Info, AlertTriangle } from 'lucide-react'

const Toast = ({ id, message, type, onDismiss }) => {
    const [isExiting, setIsExiting] = useState(false)

    const handleDismiss = () => {
        setIsExiting(true)
        setTimeout(() => {
            onDismiss(id)
        }, 300) // Match animation duration
    }

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} color="var(--success)" />
            case 'error': return <AlertCircle size={20} color="var(--danger)" />
            case 'warning': return <AlertTriangle size={20} color="var(--warning)" />
            case 'info': return <Info size={20} color="var(--accent-primary)" />
            default: return <Info size={20} color="var(--accent-primary)" />
        }
    }

    const getStyles = () => {
        const baseStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            background: 'rgba(0, 0, 0, 0.95)', // Use explicit white for contrast or var(--bg-card)
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid var(--border-color)',
            minWidth: '300px',
            maxWidth: '400px',
            marginBottom: '0.5rem',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }

        if (type === 'error') {
            baseStyle.borderLeft = '4px solid var(--danger)'
        } else if (type === 'success') {
            baseStyle.borderLeft = '4px solid var(--success)'
        } else if (type === 'warning') {
            baseStyle.borderLeft = '4px solid var(--warning)'
        } else {
            baseStyle.borderLeft = '4px solid var(--accent-primary)'
        }

        return baseStyle
    }

    return (
        <div style={getStyles()}>
            <div style={{ flexShrink: 0 }}>
                {getIcon()}
            </div>
            <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {message}
            </div>
            <button
                onClick={handleDismiss}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '0.5rem'
                }}
            >
                <X size={16} />
            </button>
            <style>
                {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
            </style>
        </div>
    )
}

export default Toast
