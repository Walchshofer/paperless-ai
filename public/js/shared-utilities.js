/**
 * Shared Utilities for Paperless-AI Frontend
 * Consolidates theme toggling, mobile menu handling, and GitHub stars fetching.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Management
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);

        // Handle toggle click
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            updateThemeIcon(next);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeToggle) return;
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    // 2. Mobile Menu Management
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (mobileMenuButton && sidebar && sidebarOverlay) {
        const toggleSidebar = (event) => {
            event.stopPropagation();
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');

            const icon = mobileMenuButton.querySelector('i');
            if (icon) {
                if (sidebar.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        };

        mobileMenuButton.addEventListener('click', toggleSidebar);
        
        sidebarOverlay.addEventListener('click', (event) => {
            event.stopPropagation();
            if (sidebar.classList.contains('active')) {
                toggleSidebar(event);
            }
        });

        sidebar.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // Handle links in sidebar
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        });
    }

    // 3. GitHub Stars Fetching
    const starCountEl = document.getElementById('starCount');
    // Check if fetch is disabled via global or data attribute (if available)
    const disableFetch = window.__DISABLE_GITHUB_FETCH__ || 
                         (document.body.dataset.disableGithubFetch === 'true');

    if (starCountEl && !disableFetch) {
        // Simple debounce or check if already fetched to avoid duplicate calls if multiple scripts run
        if (!window.__GITHUB_STARS_FETCHED__) {
            window.__GITHUB_STARS_FETCHED__ = true;
            fetch('https://api.github.com/repos/clusterzx/paperless-ai')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch');
                    return response.json();
                })
                .then(data => {
                    starCountEl.textContent = data.stargazers_count.toLocaleString();
                })
                .catch(err => {
                    // Fail silently/warn in console
                    console.warn('Failed to fetch GitHub stars:', err);
                });
        }
    }
});
