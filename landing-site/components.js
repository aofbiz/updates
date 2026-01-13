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
    waBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
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
