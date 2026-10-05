/**
 * AnonVote — Theme Switcher Controller
 * Controls Cream (#FFFDF2) & Black (#000000) Light/Dark Mode switching.
 * Persists theme preference across sessions in localStorage.
 */

const THEME_KEY = 'anonvote_theme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }

    const toggleBtns = document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn');
    toggleBtns.forEach(btn => {
        if (theme === 'light') {
            btn.innerHTML = '☀️ Light Mode';
            btn.setAttribute('aria-label', 'Switch to Dark Mode');
        } else {
            btn.innerHTML = '🌙 Dark Mode';
            btn.setAttribute('aria-label', 'Switch to Light Mode');
        }
    });
}

function initThemeToggle() {
    // 1. Get saved preference or default to dark mode
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    // 2. Attach click handlers to any theme toggle buttons on the page
    document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem(THEME_KEY, newTheme);
            applyTheme(newTheme);
        });
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
    initThemeToggle();
}
