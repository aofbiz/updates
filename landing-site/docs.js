document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.doc-section');
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

    // Handle section switching
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('href').substring(1);

            // Update Active Nav
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Show Section
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                generateTOC(targetSection);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    // Handle Collapsibles
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const chevron = header.querySelector('.chevron');

            header.parentElement.classList.toggle('open');
            content.classList.toggle('open');

            if (content.classList.contains('open')) {
                gsap.to(chevron, { rotation: 0, duration: 0.3 });
            } else {
                gsap.to(chevron, { rotation: -90, duration: 0.3 });
            }
        });
    });

    // 2. Table of Contents Generator (Internal Page)
    function generateTOC(section) {
        const tocList = document.getElementById('page-toc');
        tocList.innerHTML = '';

        const headings = section.querySelectorAll('h3');
        headings.forEach((heading, index) => {
            const id = 'heading-' + index;
            heading.id = id;

            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + id;
            a.textContent = heading.textContent;

            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth' });
            });

            li.appendChild(a);
            tocList.appendChild(li);
        });
    }

    // Initialize first section TOC
    const initialSection = document.querySelector('.doc-section.active');
    if (initialSection) generateTOC(initialSection);

    // 3. Search Logic (Basic)
    const searchInput = document.getElementById('docs-search');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        // Implement searching across all sections if needed
        // For now, it just filters sidebar items
    });

    // 4. GSAP Reveal for content
    gsap.from('.docs-content', {
        opacity: 0,
        x: 20,
        duration: 0.8,
        ease: 'power3.out'
    });
});
