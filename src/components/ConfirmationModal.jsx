import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'default', // default (info), success, danger, warning
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isAlert = false // if true, only show OK button
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <AlertTriangle size={24} color="var(--error)" />;
            case 'warning': return <AlertTriangle size={24} color="var(--warning)" />;
            case 'success': return <CheckCircle size={24} color="var(--success)" />;
            default: return <Info size={24} color="var(--accent-primary)" />;
        }
    };

    const getButtonClass = () => {
        switch (type) {
            case 'danger': return 'btn-danger';
            case 'success': return 'btn-success'; // assuming btn-success exists or falls back
            default: return 'btn-primary';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{
                        padding: '1rem',
                        borderRadius: '50%',
                        backgroundColor: type === 'danger' ? 'rgba(239, 68, 68, 0.1)' :
                            type === 'warning' ? 'rgba(245, 158, 11, 0.1)' :
                                type === 'success' ? 'rgba(16, 185, 129, 0.1)' :
                                    'rgba(59, 130, 246, 0.1)'
                    }}>
                        {getIcon()}
                    </div>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    {title}
                </h3>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    {!isAlert && (
                        <button
                            className="btn btn-secondary"
                            onClick={onClose}
                            style={{ minWidth: '100px' }}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        className={`btn ${getButtonClass()}`}
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        style={{ minWidth: '100px' }}
                    >
                        {isAlert ? 'OK' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
