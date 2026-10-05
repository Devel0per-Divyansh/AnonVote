(function () {
    function showRuntimeWarning() {
        const existing = document.getElementById('runtimeWarning');
        if (existing) return;

        const body = document.body;
        if (!body) return;

        const warning = document.createElement('div');
        warning.id = 'runtimeWarning';
        warning.style.cssText = [
            'position: fixed',
            'top: 16px',
            'left: 50%',
            'transform: translateX(-50%)',
            'max-width: 680px',
            'width: calc(100% - 32px)',
            'padding: 12px 16px',
            'border-radius: 12px',
            'background: rgba(181, 52, 52, 0.1)',
            'border: 1px solid rgba(220, 96, 96, 0.55)',
            'color: #f8d7da',
            'font: 600 14px/1.5 sans-serif',
            'z-index: 10000',
            'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15)'
        ].join(';');

        warning.innerHTML = [
            '<strong>App startup required.</strong> ',
            'Open the project with the local server: <code>npm start</code> and then visit <code>http://localhost:3000</code>.'
        ].join('');

        body.appendChild(warning);
    }

    if (location.protocol === 'file:') {
        showRuntimeWarning();

        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                showRuntimeWarning();
            }, { once: true });
        });
    }
})();
