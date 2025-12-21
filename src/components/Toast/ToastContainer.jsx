import React from 'react'
import { useToast } from './ToastContext'
import Toast from './Toast'

const ToastContainer = () => {
    const { toasts, removeToast } = useToast()

    return (
        <div
            style={{
                position: 'fixed',
                top: '1rem',
                right: '1rem',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                pointerEvents: 'none' // Allows clicking through the container area
            }}
        >
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onDismiss={removeToast}
                />
            ))}
        </div>
    )
}

export default ToastContainer
