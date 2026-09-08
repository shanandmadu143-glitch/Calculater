document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const calcNote = document.getElementById('calc-note');
    const toast = document.getElementById('toast-message');
    const savedModal = document.getElementById('saved-modal');
    const editModal = document.getElementById('edit-modal');
    const savedList = document.getElementById('saved-list');
    
    let savedRecords = JSON.parse(localStorage.getItem('vasana_records')) || [];
    let editingRecordId = null;

    // 1. Live Clock & Date
    function updateDateTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        document.getElementById('current-date').innerText = `${year}-${month}-${day}`;
        document.getElementById('current-time').innerText = now.toLocaleTimeString();
    }
    setInterval(updateDateTime, 1000);
    updateDateTime();

    // 2. Safe Mathematical Expression Evaluator
    function safeEvaluate(expression) {
        const cleaned = expression.replace(/×/g, '*').replace(/÷/g, '/');
        if (!/^[0-9+\-*/. ]+$/.test(cleaned)) return 'Error';
        try {
            const func = new Function(`return (${cleaned})`);
            const result = func();
            if (!isFinite(result) || isNaN(result)) return 'Error';
            // Round floating-point errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
            return Math.round(result * 1e10) / 1e10;
        } catch {
            return 'Error';
        }
    }

    // 3. Calculator UI Actions
    function appendCharacter(char) {
        if (display.value === 'Error') display.value = '';
        display.value += char;
    }

    function clearDisplay() {
        display.value = '';
    }

    function deleteLastChar() {
        if (display.value === 'Error') {
            display.value = '';
        } else {
            display.value = display.value.slice(0, -1);
        }
    }

    function computeResult() {
        if (display.value.trim() === '') return;
        display.value = safeEvaluate(display.value);
    }

    // Keypad Click Event Delegation
    document.querySelector('.buttons').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const val = target.getAttribute('data-val');
        const action = target.getAttribute('data-action');

        if (val !== null) {
            appendCharacter(val);
        } else if (action === 'clear') {
            clearDisplay();
        } else if (action === 'delete') {
            deleteLastChar();
        } else if (action === 'calculate') {
            computeResult();
        }
    });

    // Keyboard Event Listener
    document.addEventListener('keydown', (e) => {
        if (document.activeElement === calcNote || 
            document.activeElement === document.getElementById('edit-note') || 
            document.activeElement === document.getElementById('edit-expression')) {
            return; // Ignore calculator hotkeys when typing in text fields
        }

        if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.'].includes(e.key)) {
            appendCharacter(e.key);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            computeResult();
        } else if (e.key === 'Backspace') {
            deleteLastChar();
        } else if (e.key === 'Escape') {
            clearDisplay();
        }
    });

    // 4. Save Record
    document.getElementById('save-btn').addEventListener('click', () => {
        const result = display.value.trim();
        const note = calcNote.value.trim() || 'General Calculation';

        if (!result || result === 'Error') {
            alert('කරුණාකර පළමුව නිවැරදි ගණනය කිරීමක් ඇතුළත් කරන්න!');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const record = {
            id: Date.now(),
            date: `${year}-${month}-${day}`,
            time: now.toLocaleTimeString(),
            note: note,
            expression: result
        };

        savedRecords.push(record);
        localStorage.setItem('vasana_records', JSON.stringify(savedRecords));

        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);

        calcNote.value = '';
    });

    // 5. View Saved Modal Operations
    document.getElementById('view-btn').addEventListener('click', () => {
        renderSavedData();
        savedModal.classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        savedModal.classList.add('hidden');
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (confirm('සියලුම Save කළ දත්ත මකා දැමීමට ඔබට විශ්වාසද?')) {
            savedRecords = [];
            localStorage.removeItem('vasana_records');
            renderSavedData();
        }
    });

    function renderSavedData() {
        savedList.innerHTML = '';

        if (savedRecords.length === 0) {
            savedList.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">තවම කිසිදු දත්තයක් Save කර නොමැත.</p>';
            return;
        }

        savedRecords.slice().reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'saved-item';
            div.innerHTML = `
                <div class="saved-item-info" data-expr="${escapeXML(String(item.expression))}" title="Click to copy value to display">
                    <div class="saved-item-title">${escapeXML(item.note)}</div>
                    <div style="color:#aaa; font-size:11px;">${item.date} | ${item.time}</div>
                    <div class="saved-item-result">${escapeXML(String(item.expression))}</div>
                </div>
                <div class="saved-item-actions">
                    <button type="button" class="action-btn edit-btn" data-id="${item.id}">✏️ Edit</button>
                    <button type="button" class="action-btn delete-btn" data-id="${item.id}">🗑️ Cut</button>
                </div>
            `;
            savedList.appendChild(div);
        });
    }

    // Saved Items Click Handler (Copy To Screen / Delete / Edit)
    savedList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const infoArea = e.target.closest('.saved-item-info');

        if (deleteBtn) {
            const id = Number(deleteBtn.getAttribute('data-id'));
            if (confirm('මෙම දත්තය ඉවත් කිරීමට ඔබට විශ්වාසද?')) {
                savedRecords = savedRecords.filter(item => item.id !== id);
                localStorage.setItem('vasana_records', JSON.stringify(savedRecords));
                renderSavedData();
            }
        } else if (editBtn) {
            const id = Number(editBtn.getAttribute('data-id'));
            const record = savedRecords.find(item => item.id === id);
            if (!record) return;

            editingRecordId = id;
            document.getElementById('edit-note').value = record.note;
            document.getElementById('edit-expression').value = record.expression;
            editModal.classList.remove('hidden');
        } else if (infoArea) {
            const expr = infoArea.getAttribute('data-expr');
            if (expr) {
                display.value = expr;
                savedModal.classList.add('hidden');
            }
        }
    });

    // Edit Modal Logic
    document.getElementById('close-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);

    function closeEditModal() {
        editingRecordId = null;
        editModal.classList.add('hidden');
    }

    document.getElementById('save-edit-btn').addEventListener('click', () => {
        if (!editingRecordId) return;

        const newNote = document.getElementById('edit-note').value.trim();
        const newExpression = document.getElementById('edit-expression').value.trim();

        if (!newExpression) {
            alert('අගය හිස්ව තැබිය නොහැක!');
            return;
        }

        savedRecords = savedRecords.map(item => {
            if (item.id === editingRecordId) {
                return {
                    ...item,
                    note: newNote || 'General Calculation',
                    expression: newExpression
                };
            }
            return item;
        });

        localStorage.setItem('vasana_records', JSON.stringify(savedRecords));
        closeEditModal();
        renderSavedData();
    });

    // 6. Download XML Logic
    document.getElementById('download-btn').addEventListener('click', () => {
        if (savedRecords.length === 0) {
            alert('Download කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<VasanaCalculatorRecords>\n`;

        savedRecords.forEach(item => {
            xmlContent += `  <Record>\n`;
            xmlContent += `    <ID>${item.id}</ID>\n`;
            xmlContent += `    <Date>${item.date}</Date>\n`;
            xmlContent += `    <Time>${item.time}</Time>\n`;
            xmlContent += `    <Description>${escapeXML(item.note)}</Description>\n`;
            xmlContent += `    <Value>${escapeXML(String(item.expression))}</Value>\n`;
            xmlContent += `  </Record>\n`;
        });

        xmlContent += `</VasanaCalculatorRecords>`;

        const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Vasana_Calculator_${year}-${month}-${day}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function escapeXML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
});
