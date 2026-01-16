import React, { useState, useEffect } from 'react'
import { Phone, Mail, MessageCircle, Shield, ArrowRight, AlertTriangle, Send, User, ChevronDown } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { getIdentityUser } from '../utils/licenseServer'

const WhatsAppIcon = ({ size = 20, color = 'currentColor' }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={color}
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
)

const Contact = () => {
    const { effectiveTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('inquiry')

    // Common fields
    const [userName, setUserName] = useState('')
    const [userEmail, setUserEmail] = useState('')

    // Inquiry fields
    const [inquirySubject, setInquirySubject] = useState('')
    const [inquiryMessage, setInquiryMessage] = useState('')

    // Report fields
    const [reportCategory, setReportCategory] = useState('Bug')
    const [reportDescription, setReportDescription] = useState('')

    useEffect(() => {
        const loadUser = async () => {
            const user = await getIdentityUser()
            if (user) {
                setUserName(user.user_metadata?.full_name || '')
                setUserEmail(user.email || '')
            }
        }
        loadUser()
    }, [])

    const developerEmail = 'aofbizhelp@gmail.com'

    const openExternal = (url) => {
        if (window.electronAPI) {
            window.electronAPI.openExternal(url)
        } else {
            // Use window.location.href for mailto to avoid empty tabs
            // Use window.open for regular web links
            if (url.startsWith('mailto:')) {
                window.location.href = url
            } else {
                window.open(url, '_blank')
            }
        }
    }

    const handleInquirySubmit = (e) => {
        e.preventDefault()
        const subject = encodeURIComponent(`From App : ${inquirySubject}`)
        const body = encodeURIComponent(`Name: ${userName}\nEmail: ${userEmail}\n\nMessage:\n${inquiryMessage}`)
        openExternal(`mailto:${developerEmail}?subject=${subject}&body=${body}`)
    }

    const handleReportSubmit = (e) => {
        e.preventDefault()
        const subject = encodeURIComponent(` App report : ${reportCategory}`)
        const body = encodeURIComponent(`Name: ${userName}\nEmail: ${userEmail}\nCategory: ${reportCategory}\n\nDescription:\n${reportDescription}`)
        openExternal(`mailto:${developerEmail}?subject=${subject}&body=${body}`)
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
            <div className="page-header">
                <div className="page-header-info">
                    <h1>Contact Support</h1>
                    <p>Need help? We're here for you. Reach out to us for any issues or feedback.</p>
                </div>
            </div>

            {/* Toggle Container */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '2rem'
            }}>
                <div style={{
                    display: 'flex',
                    backgroundColor: 'var(--bg-card)',
                    padding: '4px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    position: 'relative',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: activeTab === 'inquiry' ? '4px' : '50%',
                        width: 'calc(50% - 4px)',
                        height: 'calc(100% - 8px)',
                        backgroundColor: 'var(--accent-primary)',
                        borderRadius: '12px',
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        zIndex: 0
                    }} />
                    <button
                        onClick={() => setActiveTab('inquiry')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: 'none',
                            background: 'none',
                            color: activeTab === 'inquiry' ? '#fff' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            zIndex: 1,
                            transition: 'color 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <MessageCircle size={18} /> General Inquiry
                    </button>
                    <button
                        onClick={() => setActiveTab('report')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: 'none',
                            background: 'none',
                            color: activeTab === 'report' ? '#fff' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            zIndex: 1,
                            transition: 'color 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <AlertTriangle size={18} /> Report an Issue
                    </button>
                </div>
            </div>

            {/* Sliding Form Container */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '24px',
                minHeight: '450px'
            }}>
                <div style={{
                    display: 'flex',
                    width: '200%',
                    transform: `translateX(${activeTab === 'inquiry' ? '0' : '-50%'})`,
                    transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Inquiry Form */}
                    <div style={{ width: '50%', padding: '0.5rem' }}>
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>General Inquiry</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Send us a message about any questions or suggestions you have.</p>
                            </div>

                            <form onSubmit={handleInquirySubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Your Name"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Registered Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="Your Email"
                                            value={userEmail}
                                            readOnly
                                            style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'rgba(var(--accent-rgb), 0.02)' }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Subject</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="What is this regarding?"
                                        value={inquirySubject}
                                        onChange={(e) => setInquirySubject(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '2rem' }}>
                                    <label className="form-label">Message</label>
                                    <textarea
                                        className="form-input"
                                        style={{ minHeight: '120px', resize: 'vertical' }}
                                        placeholder="How can we help you today?"
                                        value={inquiryMessage}
                                        onChange={(e) => setInquiryMessage(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                    <Send size={18} /> Send Inquiry
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Report Form */}
                    <div style={{ width: '50%', padding: '0.5rem' }}>
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Report an Issue</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Help us fix technical problems by providing details of what happened.</p>
                            </div>

                            <form onSubmit={handleReportSubmit}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Your Name"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Registered Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="Your Email"
                                            value={userEmail}
                                            readOnly
                                            style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'rgba(var(--accent-rgb), 0.02)' }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem', position: 'relative' }}>
                                    <label className="form-label">Issue Category</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            className="form-input"
                                            style={{ appearance: 'none', cursor: 'pointer' }}
                                            value={reportCategory}
                                            onChange={(e) => setReportCategory(e.target.value)}
                                            required
                                        >
                                            <option value="Bug">Bug</option>
                                            <option value="Licence issue">Licence issue</option>
                                            <option value="Feature malfunction">Feature malfunction</option>
                                        </select>
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '2rem' }}>
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-input"
                                        style={{ minHeight: '140px', resize: 'vertical' }}
                                        placeholder="Please describe the issue in detail..."
                                        value={reportDescription}
                                        onChange={(e) => setReportDescription(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
                                    <AlertTriangle size={18} /> Submit Report
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Support Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', display: 'flex', gap: '8px' }}>
                        <Phone size={20} />
                        <WhatsAppIcon size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Quick Help</h3>
                        <button
                            onClick={() => openExternal('https://wa.me/94750350109')}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', textAlign: 'left' }}
                        >
                            +94 75 035 0109
                        </button>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                        <Mail size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Email Directly</h3>
                        <button
                            onClick={() => openExternal(`mailto:${developerEmail}`)}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', textAlign: 'left' }}
                        >
                            {developerEmail}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Contact
