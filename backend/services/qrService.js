const QRCode = require('qrcode');

/**
 * Generates a QR Code Data URL for an event's voting page.
 * @param {number|string} eventId 
 * @param {string} baseUrl - e.g. http://localhost:3000
 * @returns {Promise<string>} Data URL string
 */
async function generateEventQRCode(eventId, baseUrl = '') {
    const targetUrl = `${baseUrl}/vote.html?event=${eventId}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            margin: 2,
            scale: 6,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });
        return {
            url: targetUrl,
            qrDataUrl
        };
    } catch (err) {
        console.error('Error generating QR code:', err);
        throw err;
    }
}

module.exports = {
    generateEventQRCode
};
