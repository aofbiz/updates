import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)

        // For errors, force duration to be null (persistent) unless explicitly overridden
        const finalDuration = type === 'error' ? null : duration

        setToasts((prevToasts) => [
            { id, message, type, duration: finalDuration },
            ...prevToasts,
        ])

        if (finalDuration) {
            setTimeout(() => {
                removeToast(id)
            }, finalDuration)
        }
    }, [])

    const removeToast = useCallback((id) => {
        setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    )
}

export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}
