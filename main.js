document.addEventListener('DOMContentLoaded', () => {
    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);

    // 1. Scroll Progress Bar
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        document.querySelector('.scroll-progress').style.width = scrolled + "%";
    });

    // 2. Navbar Scroll Effect
    const nav = document.querySelector('.premium-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // 3. Hero Animations
    const heroTl = gsap.timeline();

    heroTl.from('.badge-new', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    }).from('.hero-title', {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    }, '-=0.5').from('.hero-description', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    }, '-=0.6').from('.hero-actions .btn', {
        scale: 0.9,
        opacity: 0,
        duration: 0.6,
        stagger: 0.2,
        ease: 'back.out(1.7)'
    }, '-=0.4').from('.hero-stats .stat-item', {
        y: 10,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out'
    }, '-=0.3').from('.main-mockup', {
        x: 100,
        opacity: 0,
        duration: 1.5,
        ease: 'power4.out'
    }, '-=1.2').from('.floating-bubble', {
        scale: 0,
        opacity: 0,
        duration: 0.8,
        stagger: 0.3,
        ease: 'back.out(2)'
    }, '-=0.8');

    // 4. Parallax Effect on Mockup
    window.addEventListener('mousemove', (e) => {
        const mockup = document.querySelector('.mockup-parallax');
        const bubbles = document.querySelectorAll('.floating-bubble');

        const x = (window.innerWidth / 2 - e.pageX) / 40;
        const y = (window.innerHeight / 2 - e.pageY) / 40;

        gsap.to(mockup, {
            rotationY: x * 0.5,
            rotationX: -y * 0.5,
            duration: 1,
            ease: 'power2.out'
        });

        bubbles.forEach((bubble, i) => {
            const factor = (i + 1) * 1.5;
            gsap.to(bubble, {
                x: x * factor,
                y: y * factor,
                duration: 1.2,
                ease: 'power2.out'
            });
        });
    });

    // 5. Scroll Reveal Animations
    const revealElements = [
        { selector: '.section-intro', y: 40 },
        { selector: '.feature-card-v2', y: 60, stagger: 0.15 },
        { selector: '.docs-split > div', y: 50, stagger: 0.3 },
        { selector: '.pricing-plan', y: 80, stagger: 0.2 },
        { selector: '.download-card', y: 60 }
    ];

    revealElements.forEach(item => {
        const elements = document.querySelectorAll(item.selector);

        if (item.stagger) {
            gsap.from(elements, {
                scrollTrigger: {
                    trigger: elements[0],
                    start: 'top 85%',
                },
                y: item.y,
                opacity: 0,
                duration: 1,
                stagger: item.stagger,
                ease: 'power3.out'
            });
        } else {
            elements.forEach(el => {
                gsap.from(el, {
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 85%',
                    },
                    y: item.y,
                    opacity: 0,
                    duration: 1,
                    ease: 'power3.out'
                });
            });
        }
    });

    // 6. Mobile Menu Logic (Placeholders)
    const mobileBtn = document.querySelector('.mobile-menu-toggle');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            alert('Mobile menu feature coming soon in full release!');
        });
    }

    // 7. Auto-counter for stats (subtle)
    const stats = [
        { label: 'Faster Checkout', start: 0, end: 50, suffix: '%' },
        { label: 'Sync Uptime', start: 0, end: 99.9, suffix: '%' }
    ];

    // We could add a counter animation here if needed, but keeping it clean for now.
});
