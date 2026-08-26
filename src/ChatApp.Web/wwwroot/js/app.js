// ChatApp - Browser-side helpers
window.chatApp = window.chatApp || {};

// Toast helpers
chatApp.toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    info: (msg) => showToast(msg, 'info')
};

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Clipboard
chatApp.clipboard = {
    copy: (text) => navigator.clipboard.writeText(text)
};

// Theme
chatApp.theme = {
    set: (theme) => {
        if (theme === 'system') {
            const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('theme', theme);
    },
    get: () => localStorage.getItem('theme') || 'system',
    init: () => {
        const saved = chatApp.theme.get();
        chatApp.theme.set(saved);
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (chatApp.theme.get() === 'system') chatApp.theme.set('system');
        });
    }
};

// Scroll to bottom of messages container
chatApp.scrollToBottom = (containerId) => {
    const el = document.getElementById(containerId);
    if (el) el.scrollTop = el.scrollHeight;
};

// Trigger click on an element by id (used to programmatically open file picker)
chatApp.clickElement = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.click();
};

// Open URL in new tab (safe wrapper around window.open)
chatApp.openUrl = (url) => {
    window.open(url, '_blank');
};

// Init on load
(function () {
    chatApp.theme.init();
})();
