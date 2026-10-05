/**
 * AnonVote — Retro Pixel Shuffle / Scramble Text Effect
 * 
 * 1. Uses 8-Bit Pixel Typography (Press Start 2P / Silkscreen).
 * 2. Runs shuffle on initial page load.
 * 3. Runs recurring shuffle at a periodic interval (every 4.5 seconds).
 * 4. Runs shuffle immediately when mouse hovers over logo element.
 */
function initShuffleLogo() {
    const brandTexts = document.querySelectorAll('.brand-text, .shuffle-text');
    const scrambleChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const RECURRING_INTERVAL_MS = 4500; // Periodic shuffle every 4.5s

    brandTexts.forEach(el => {
        const originalText = el.dataset.text || el.textContent.trim() || 'AnonVote';
        el.dataset.text = originalText;

        let interval = null;

        const scramble = () => {
            let iteration = 0;
            clearInterval(interval);

            interval = setInterval(() => {
                el.textContent = originalText
                    .split('')
                    .map((char, index) => {
                        if (char === ' ') return ' ';
                        if (index < iteration) {
                            return originalText[index];
                        }
                        return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
                    })
                    .join('');

                if (iteration >= originalText.length) {
                    clearInterval(interval);
                    el.textContent = originalText; // Ensure exact final text
                }

                iteration += 1 / 3;
            }, 35);
        };

        // 1. Initial Shuffle on load
        scramble();

        // 2. Periodic Recurring Shuffle Timer
        setInterval(scramble, RECURRING_INTERVAL_MS);

        // 3. Hover Shuffle Event Listener
        const container = el.closest('.brand') || el;
        container.addEventListener('mouseenter', scramble);
    });
}

// Auto initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShuffleLogo);
} else {
    initShuffleLogo();
}
