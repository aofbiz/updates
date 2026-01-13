/**
 * AOF Biz - Shared Component Loader
 * Consolidates Navbar and Footer into JS to avoid CORS issues on local file access.
 */

const COMPONENTS = {
    navbar: `
    <nav class="navbar">
        <div class="container">
            <a href="index.html" class="logo">
                <div class="logo-wrapper">
                    <img src="logo-light.png" alt="AOF Biz Logo" class="logo-img logo-light">
                    <img src="logo-dark.png" alt="AOF Biz Logo" class="logo-img logo-dark">
                </div>
                <span>AOF <span class="accent">Biz</span></span>
            </a>
            <div class="nav-links" id="nav-links">
                <a href="index.html">Home</a>
                <a href="features.html">Features</a>
                <a href="index.html#about">About</a>
                <a href="download.html">Download</a>
                <a href="contact.html">Contact</a>
                <a href="download.html" class="btn btn-primary btn-sm mobile-only" style="margin-top: 1rem;">Get Started</a>
            </div>
            <div class="nav-actions">
                <button class="theme-toggle" id="theme-toggle" aria-label="Toggle Theme">
                    <i data-lucide="sun" class="sun"></i>
                    <i data-lucide="moon" class="moon"></i>
                </button>
                <a href="download.html" class="btn btn-primary btn-sm">Get Started</a>
                <button class="menu-toggle" id="menu-toggle" aria-label="Toggle Menu">
                    <i data-lucide="menu"></i>
                </button>
            </div>
        </div>
    </nav>`,

    footer: `
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-brand">
                    <a href="index.html" class="logo">
                        <div class="logo-wrapper">
                            <img src="logo-light.png" alt="AOF Biz Logo" class="logo-img logo-light">
                            <img src="logo-dark.png" alt="AOF Biz Logo" class="logo-img logo-dark">
                        </div>
                        <span>AOF <span class="accent">Biz</span></span>
                    </a>
                    <p>Revolutionizing frame business management with cutting-edge tools and intuitive design.</p>
                </div>
                <div class="footer-col">
                    <h4>Product</h4>
                    <ul>
                        <li><a href="features.html">All Features</a></li>
                        <li><a href="download.html">Download App</a></li>
                        <li><a href="download.html#pricing">Pricing Plans</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Company</h4>
                    <ul>
                        <li><a href="contact.html">Contact Us</a></li>
                        <li><a href="index.html#about">About Us</a></li>
                        <li><a href="privacy-policy.html">Privacy Policy</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Support</h4>
                    <ul>
                        <li><a href="contact.html">Help Center</a></li>
                        <li><a href="terms-of-service.html">Terms of Service</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 AOF Biz. All rights reserved. Crafted for Professionals.</p>
            </div>
        </div>
    </footer>`
};

document.addEventListener('DOMContentLoaded', () => {
    renderComponent('navbar-placeholder', COMPONENTS.navbar, initNavbar);
    renderComponent('footer-placeholder', COMPONENTS.footer);
    initBackToTop();
    initWhatsApp();
});

function initBackToTop() {
    // 1. Create Button
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to Top');
    btn.innerHTML = '<i data-lucide="arrow-up"></i>';
    document.body.appendChild(btn);

    // 2. Initialize Icon (since we manually added it)
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // 3. Scroll Logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });

    // 4. Click Logic
    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function initWhatsApp() {
    const waBtn = document.createElement('a');
    waBtn.href = 'https://wa.me/94750350109';
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
    waBtn.className = 'wa-float-btn';
    waBtn.setAttribute('aria-label', 'Chat on WhatsApp');
    waBtn.innerHTML = '<i data-lucide="message-circle"></i>';
    document.body.appendChild(waBtn);

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Injects HTML component into placeholder
 */
function renderComponent(placeholderId, html, callback) {
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;

    placeholder.innerHTML = html;

    // Re-initialize Lucide icons for injected content
    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (callback) callback();
}

/**
 * Initializes Navbar specific logic after injection
 */
function initNavbar() {
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    // 1. Highlight Active Link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 2. Mobile Menu Toggle
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.setAttribute('data-lucide', 'x');
            } else {
                icon.setAttribute('data-lucide', 'menu');
            }
            lucide.createIcons();
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const menuIcon = menuToggle.querySelector('i');
                menuIcon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            });
        });
    }

    // 3. Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Fix: Re-initialize Lucide icons specifically for the navbar after setup
    if (window.lucide) {
        window.lucide.createIcons();
    }
}
