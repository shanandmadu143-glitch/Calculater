let expression = '';
let historyItems = [
    { id: '1', name: 'සුපර්මාර්කට් බඩු ලැයිස්තුව', amount: 12450.50, date: '2026-09-08' },
    { id: '2', name: 'පෙට්‍රල් - Bajaj CT 100', amount: 2500.00, date: '2026-09-07' }
];

const exprDisplay = document.getElementById('expressionDisplay');
const resDisplay = document.getElementById('resultDisplay');
const historyContainer = document.getElementById('historyContainer');

// Calculator Functions
function appendNum(num) {
    expression += num;
    updateDisplay();
}

function appendOperator(op) {
    if (expression === '' && op !== '-') return;
    const lastChar = expression.slice(-1);
    if (['+', '-', '*', '/', '%'].includes(lastChar)) {
        expression = expression.slice(0, -1) + op;
    } else {
        expression += op;
    }
    updateDisplay();
}

function clearCalculator() {
    expression = '';
    resDisplay.textContent = '0.00';
    updateDisplay();
}

function deleteLastDigit() {
    expression = expression.slice(0, -1);
    updateDisplay();
}

function updateDisplay() {
    exprDisplay.textContent = expression || '0';
}

function calculateResult() {
    try {
        if (!expression) return;
        const evalResult = eval(expression.replace(/×/g, '*').replace(/÷/g, '/'));
        resDisplay.textContent = Number(evalResult).toLocaleString('en-US', { minimumFractionDigits: 2 });
    } catch (e) {
        resDisplay.textContent = 'Error';
    }
}

// Save Current Calculation to History
function saveCurrentCalculation() {
    const titleInput = document.getElementById('recordTitle');
    const noteText = titleInput.value.trim() || 'ගණනය කිරීම';
    const amountVal = parseFloat(resDisplay.textContent.replace(/,/g, ''));

    if (isNaN(amountVal) || amountVal === 0) {
        alert('කරුණාකර පළමුව ගණනය කිරීමක් සිදු කරන්න.');
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        name: noteText,
        amount: amountVal,
        date: new Date().toISOString().split('T')[0]
    };

    historyItems.unshift(newItem);
    titleInput.value = '';
    renderHistory();
}

// Render History List
function renderHistory() {
    historyContainer.innerHTML = '';
    document.getElementById('historyCount').textContent = `${historyItems.length} Items`;

    if (historyItems.length === 0) {
        historyContainer.innerHTML = '<div style="text-align:center; color:#6b7280; margin-top:20px; font-size:13px;">Saved history නැත.</div>';
        return;
    }

    historyItems.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.innerHTML = `
            <div class="swipe-action swipe-edit">✏️ Edit</div>
            <div class="swipe-action swipe-delete">🗑️ Delete</div>
            <div class="history-card">
                <div>
                    <div class="card-title">${item.name}</div>
                    <div class="card-date">${item.date}</div>
                </div>
                <div class="card-amount">LKR ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
        `;

        historyContainer.appendChild(wrapper);
        bindSwipe(wrapper.querySelector('.history-card'), item);
    });
}

// Swipe Gesture Logic
function bindSwipe(card, item) {
    let startX = 0;
    let currentX = 0;

    card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchmove', e => {
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        if (Math.abs(diff) < 120) card.style.transform = `translateX(${diff}px)`;
    }, { passive: true });

    card.addEventListener('touchend', () => {
        let diff = currentX - startX;
        card.style.transform = 'translateX(0px)';
        if (diff > 70) openEditModal(item);
        else if (diff < -70 && confirm(`"${item.name}" මකා දැමීමට අවශ්‍යද?`)) {
            historyItems = historyItems.filter(i => i.id !== item.id);
            renderHistory();
        }
        startX = 0; currentX = 0;
    });
}

// Modal Logic
function openEditModal(item) {
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemAmount').value = item.amount;
    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function handleSaveEdit(e) {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const name = document.getElementById('editItemName').value;
    const amount = parseFloat(document.getElementById('editItemAmount').value);

    historyItems = historyItems.map(i => i.id === id ? { ...i, name, amount } : i);
    closeEditModal();
    renderHistory();
}

renderHistory();
