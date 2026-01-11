import { Info, ShieldCheck, Heart, Globe, Github, Mail, Zap, ExternalLink, Award, Users, CheckCircle } from 'lucide-react'
import { useLicensing } from './LicensingContext'
import { useTheme } from './ThemeContext'

const About = () => {
    const { isProUser, isTrialActive, timeLeft } = useLicensing()
    const { effectiveTheme } = useTheme()

    const APP_VERSION = 'v1.0.9'
    const RELEASE_DATE = 'January 2026'

    const openExternal = (url) => {
        if (window.electronAPI) {
            window.electronAPI.openExternal(url)
        } else {
            window.open(url, '_blank')
        }
    }

    const trialDaysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000))

    return (
        <div className="about-container animate-fade-in">
            {/* Premium Header Section */}
            <div className="about-header">
                <div className="about-header-content">
                    <div className="logo-wrapper">
                        <img
                            src={effectiveTheme === 'dark' ? './logo-dark.svg' : './logo.svg'}
                            alt="AOF Biz Logo"
                            className="about-logo"
                        />
                    </div>
                    <h1 className="about-title">AOF Biz</h1>
                    <p className="about-tagline">Professional Business Management Suite</p>

                    <div className="version-badge">
                        <Award size={14} />
                        <span>Build {APP_VERSION}</span>
                    </div>
                </div>
            </div>

            <div className="about-content">
                {/* Status Card */}
                <div className="about-card status-card">
                    <div className="card-header">
                        <ShieldCheck size={20} className="icon-accent" />
                        <h3>License Status</h3>
                    </div>
                    <div className="status-display">
                        {isProUser ? (
                            <div className="status-item pro">
                                <CheckCircle size={24} />
                                <div>
                                    <p className="status-label">Premium Active</p>
                                    <p className="status-sub">All features unlocked</p>
                                </div>
                            </div>
                        ) : isTrialActive ? (
                            <div className="status-item trial">
                                <Zap size={24} />
                                <div>
                                    <p className="status-label">Free Trial Active</p>
                                    <p className="status-sub">{trialDaysLeft} days remaining</p>
                                </div>
                            </div>
                        ) : (
                            <div className="status-item free">
                                <Info size={24} />
                                <div>
                                    <p className="status-label">Free Version</p>
                                    <p className="status-sub">Local management only</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mission Section */}
                <div className="about-card">
                    <div className="card-header">
                        <Users size={20} className="icon-info" />
                        <h3>Our Mission</h3>
                    </div>
                    <p className="card-text">
                        AOF Biz was built for the visionaries—the artisans and workshop owners who balance creativity with commerce.
                        We believe that administrative complexity shouldn't stifle your growth. Our mission is to provide
                        clarity through data, giving you the time back to focus on your masterpiece.
                    </p>
                </div>

                {/* Core Pillars */}
                <div className="feature-rows">
                    <div className="feature-row">
                        <div className="feature-icon-box">
                            <Heart size={20} />
                        </div>
                        <div className="feature-text">
                            <h4>Artisan Driven</h4>
                            <p>Tailored specifically for creative workshop workflows.</p>
                        </div>
                    </div>
                    <div className="feature-row">
                        <div className="feature-icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <Globe size={20} />
                        </div>
                        <div className="feature-text">
                            <h4>Always Synced</h4>
                            <p>Access your business data across mobile and desktop.</p>
                        </div>
                    </div>
                    <div className="feature-row">
                        <div className="feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <ShieldCheck size={20} />
                        </div>
                        <div className="feature-text">
                            <h4>Data Security</h4>
                            <p>Enterprise-grade encryption for your sensitive records.</p>
                        </div>
                    </div>
                </div>

                {/* Social & Contact */}
                <div className="about-card connect-card">
                    <div className="card-header">
                        <Globe size={20} />
                        <h3>Connect with Us</h3>
                    </div>
                    <div className="social-links">
                        <button onClick={() => openExternal('https://loojabrandings.com')} className="social-link">
                            <Globe size={20} />
                            <span>Website</span>
                            <ExternalLink size={14} className="link-arrow" />
                        </button>
                        <button onClick={() => openExternal('https://github.com/loojabrandings')} className="social-link">
                            <Github size={20} />
                            <span>GitHub</span>
                            <ExternalLink size={14} className="link-arrow" />
                        </button>
                        <button onClick={() => openExternal('mailto:loojabrandings@gmail.com')} className="social-link">
                            <Mail size={20} />
                            <span>Support Email</span>
                            <ExternalLink size={14} className="link-arrow" />
                        </button>
                    </div>
                </div>

                <div className="about-footer">
                    <p>© 2026 Loojabrandings. All rights reserved.</p>
                    <p className="footer-v">AOF-BIZ-OS-{APP_VERSION}</p>
                </div>
            </div>

            <style>{`
                .about-container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding-bottom: 2rem;
                }

                .about-header {
                    padding: 4rem 2rem 3rem;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    border-radius: 0 0 32px 32px;
                    margin-bottom: 2rem;
                    background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.05) 0%, transparent 100%);
                }

                .logo-wrapper {
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 1.5rem;
                    background: var(--bg-card);
                    padding: 1rem;
                    border-radius: 24px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    border: 1px solid var(--border-color);
                }

                .about-logo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .about-title {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: -1px;
                }

                .about-tagline {
                    color: var(--text-muted);
                    font-size: 0.95rem;
                    margin: 0.5rem 0 1.5rem;
                }

                .version-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                }

                .about-content {
                    padding: 0 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .about-card {
                    background: var(--bg-card);
                    border-radius: 20px;
                    padding: 1.5rem;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 1rem;
                }

                .card-header h3 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0;
                }

                .icon-accent { color: var(--accent-primary); }
                .icon-info { color: var(--info); }

                .card-text {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    line-height: 1.6;
                    margin: 0;
                }

                .status-display {
                    padding-top: 0.5rem;
                }

                .status-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: 16px;
                }

                .status-item.pro { background: rgba(16, 185, 129, 0.05); color: #10b981; }
                .status-item.trial { background: rgba(255, 46, 54, 0.05); color: var(--accent-primary); }
                .status-item.free { background: var(--bg-secondary); color: var(--text-muted); }

                .status-label {
                    font-weight: 800;
                    font-size: 1.1rem;
                    margin: 0;
                }

                .status-sub {
                    font-size: 0.8rem;
                    opacity: 0.7;
                    margin: 0;
                }

                .feature-rows {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .feature-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1rem;
                }

                .feature-icon-box {
                    min-width: 40px;
                    height: 40px;
                    background: rgba(var(--accent-rgb), 0.1);
                    color: var(--accent-primary);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .feature-text h4 {
                    margin: 0 0 2px 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                }

                .feature-text p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                }

                .social-links {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .social-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    width: 100%;
                    color: var(--text-primary);
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }

                .social-link:active {
                    transform: scale(0.98);
                    background: var(--bg-card-hover);
                }

                .link-arrow {
                    margin-left: auto;
                    opacity: 0.3;
                }

                .about-footer {
                    text-align: center;
                    padding-top: 2rem;
                    opacity: 0.5;
                }

                .about-footer p {
                    font-size: 0.75rem;
                    margin: 0;
                }

                .footer-v {
                    margin-top: 4px !important;
                    font-family: monospace;
                    letter-spacing: 1px;
                }

                @media (max-width: 600px) {
                    .about-header {
                        padding: 3rem 1.5rem 2rem;
                    }
                    .about-title {
                        font-size: 2rem;
                    }
                    .logo-wrapper {
                        width: 80px;
                        height: 80px;
                    }
                }
            `}</style>
        </div>
    )
}

export default About
