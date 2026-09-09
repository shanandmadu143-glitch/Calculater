let expression = '';
let historyItems = [
    { id: '1', name: 'සුපර්මාර්කට් බඩු ලැයිස්තුව', amount: 12450.50, date: '2026-09-08' },
    { id: '2', name: 'පෙට්‍රල් - Bajaj CT 100', amount: 2500.00, date: '2026-09-07' }
];

const exprDisplay = document.getElementById('calcExpression');
const resDisplay = document.getElementById('calcResult');
const historyContainer = document.getElementById('historyContainer');

// Calculator Logic
function appendNum(num) {
    expression += num;
    updateCalcDisplay();
}

function appendOp(op) {
    if (!expression && op !== '-') return;
    const last = expression.slice(-1);
    if (['+', '-', '*', '/', '%'].includes(last)) {
        expression = expression.slice(0, -1) + op;
    } else {
        expression += op;
    }
    updateCalcDisplay();
}

function clearCalc() {
    expression = '';
    resDisplay.textContent = '0.00';
    updateCalcDisplay();
}

function deleteDigit() {
    expression = expression.slice(0, -1);
    updateCalcDisplay();
}

function updateCalcDisplay() {
    exprDisplay.textContent = expression || '0';
}

function calculate() {
    try {
        if (!expression) return;
        const val = eval(expression.replace(/×/g, '*').replace(/÷/g, '/'));
        resDisplay.textContent = Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
    } catch (e) {
        resDisplay.textContent = 'Error';
    }
}

function saveCalculation() {
    const input = document.getElementById('noteInput');
    const note = input.value.trim() || 'ගණනය කිරීම';
    const amountVal = parseFloat(resDisplay.textContent.replace(/,/g, ''));

    if (isNaN(amountVal) || amountVal === 0) {
        alert('කරුණාකර ප්‍රථමයෙන් අගයක් ගණනය කරන්න.');
        return;
    }

    const item = {
        id: Date.now().toString(),
        name: note,
        amount: amountVal,
        date: new Date().toISOString().split('T')[0]
    };

    historyItems.unshift(item);
    input.value = '';
    renderHistory();
}

// History Render (Fixing Item Name and Amount Display + Swipe Actions)
function renderHistory() {
    historyContainer.innerHTML = '';
    document.getElementById('historyCount').textContent = `${historyItems.length} Items`;

    if (historyItems.length === 0) {
        historyContainer.innerHTML = '<div style="text-align:center; color:#7d7890; padding:20px;">Saved items කිසිවක් නැත.</div>';
        return;
    }

    historyItems.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';

        wrapper.innerHTML = `
            <div class="swipe-indicator swipe-edit">✏️ Edit</div>
            <div class="swipe-indicator swipe-delete">🗑️ Delete</div>
            <div class="saved-card" id="card-${item.id}">
                <div class="card-left">
                    <div class="saved-card-title">${item.name}</div>
                    <div class="saved-card-date">${item.date}</div>
                </div>
                <div class="card-right">
                    <div class="saved-card-value">LKR ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>
        `;

        historyContainer.appendChild(wrapper);
        bindSwipeEvents(wrapper.querySelector('.saved-card'), item);
    });
}

// Swipe Controls Logic (Right -> Edit | Left -> Delete)
function bindSwipeEvents(cardElement, item) {
    let startX = 0;
    let currentX = 0;

    cardElement.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    cardElement.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        let diffX = currentX - startX;

        if (Math.abs(diffX) < 120) {
            cardElement.style.transform = `translateX(${diffX}px)`;
        }
    }, { passive: true });

    cardElement.addEventListener('touchend', () => {
        let diffX = currentX - startX;
        cardElement.style.transform = 'translateX(0px)';

        // Swipe Right -> Edit
        if (diffX > 75) {
            openEditModal(item);
        } 
        // Swipe Left -> Delete
        else if (diffX < -75) {
            if (confirm(`"${item.name}" මකා දැමීමට ඔබට විශ්වාසද?`)) {
                historyItems = historyItems.filter(i => i.id !== item.id);
                renderHistory();
            }
        }

        startX = 0;
        currentX = 0;
    });
}

// Edit Modal Handling
function openEditModal(item) {
    document.getElementById('editId').value = item.id;
    document.getElementById('editName').value = item.name;
    document.getElementById('editAmount').value = item.amount;
    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function saveEdit() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const amount = parseFloat(document.getElementById('editAmount').value);

    if (!name || isNaN(amount)) return;

    historyItems = historyItems.map(i => i.id === id ? { ...i, name, amount } : i);
    closeEditModal();
    renderHistory();
}

// Run Initial Render
renderHistory();
