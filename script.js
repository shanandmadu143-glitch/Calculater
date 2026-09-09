// Initial Data Model
let historyItems = [
    { id: '1', name: 'Supermarket Grocery Purchase & Supplies', amount: 12450.50, date: 'Sep 08, 2026' },
    { id: '2', name: 'Fuel - Bajaj CT 100', amount: 2500.00, date: 'Sep 07, 2026' },
    { id: '3', name: 'Restaurant Dinner', amount: 4800.00, date: 'Sep 06, 2026' },
    { id: '4', name: 'Internet & Utility Bill Payment', amount: 3200.75, date: 'Sep 05, 2026' }
];

const container = document.getElementById('historyContainer');
const itemCountBadge = document.getElementById('itemCount');

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    setupGlobalModalListeners();
});

// Currency Formatter Utility
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2
    }).format(amount);
}

// Render History Items
function renderHistory() {
    container.innerHTML = '';
    itemCountBadge.textContent = `${historyItems.length} Items`;

    if (historyItems.length === 0) {
        container.innerHTML = `<div class="empty-state">No saved history records found.</div>`;
        return;
    }

    historyItems.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';

        wrapper.innerHTML = `
            <div class="swipe-action swipe-action-edit">✏️ Edit</div>
            <div class="swipe-action swipe-action-delete">🗑️ Delete</div>
            <div class="history-card" id="card-${item.id}">
                <div class="card-info">
                    <div class="card-title">${escapeHtml(item.name)}</div>
                    <div class="card-date">${item.date}</div>
                </div>
                <div class="card-amount-wrap">
                    <div class="card-amount">${formatCurrency(item.amount)}</div>
                </div>
            </div>
        `;

        container.appendChild(wrapper);

        const cardElement = wrapper.querySelector('.history-card');
        bindSwipeGestures(cardElement, item);
    });
}

// Robust Pointer/Touch Event Handling for Swiping
function bindSwipeGestures(card, item) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const SWIPE_THRESHOLD = 90;

    const onPointerDown = (e) => {
        isDragging = true;
        startX = e.clientX || e.touches?.[0].clientX;
        card.style.transition = 'none'; // Disable transition during drag
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        currentX = e.clientX || e.touches?.[0].clientX;
        const diffX = currentX - startX;

        // Apply drag transform with subtle damping
        if (Math.abs(diffX) < 140) {
            card.style.transform = `translateX(${diffX}px)`;
        }
    };

    const onPointerEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const diffX = currentX - startX;
        card.style.transition = 'transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
        card.style.transform = 'translateX(0px)';

        // Swipe Action Threshold Checks
        if (diffX > SWIPE_THRESHOLD) {
            openEditModal(item);
        } else if (diffX < -SWIPE_THRESHOLD) {
            confirmDelete(item);
        }

        startX = 0;
        currentX = 0;
    };

    // Bind Pointer & Touch listeners
    card.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerEnd);

    card.addEventListener('touchstart', onPointerDown, { passive: true });
    card.addEventListener('touchmove', onPointerMove, { passive: true });
    card.addEventListener('touchend', onPointerEnd);
}

// Action Handlers
function confirmDelete(item) {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        historyItems = historyItems.filter(i => i.id !== item.id);
        renderHistory();
    }
}

function openEditModal(item) {
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemAmount').value = item.amount;
    
    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focus input automatically
    setTimeout(() => document.getElementById('editItemName').focus(), 100);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function handleSaveEdit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editItemId').value;
    const newName = document.getElementById('editItemName').value.trim();
    const newAmount = parseFloat(document.getElementById('editItemAmount').value);

    if (!newName || isNaN(newAmount)) return;

    historyItems = historyItems.map((item) => {
        if (item.id === id) {
            return { ...item, name: newName, amount: newAmount };
        }
        return item;
    });

    closeEditModal();
    renderHistory();
}

// Global Accessibility & Modal Handling
function setupGlobalModalListeners() {
    const modal = document.getElementById('editModal');
    
    // Close modal when pressing ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeEditModal();
        }
    });

    // Close modal when clicking on dark backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditModal();
        }
    });
}

// HTML Escaping Utility (XSS Prevention)
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (match) => {
        const escapeMap = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        };
        return escapeMap[match];
    });
}
