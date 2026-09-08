(function () {
    'use strict';

    let display, calcNote, toast, savedModal, editModal, savedList;
    let savedRecords = [];
    let editingRecordId = null;

    const STORAGE_KEY = 'vasana_app_records_v2';

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        display = document.getElementById('display');
        calcNote = document.getElementById('calc-note');
        toast = document.getElementById('toast-message');
        savedModal = document.getElementById('saved-modal');
        editModal = document.getElementById('edit-modal');
        savedList = document.getElementById('saved-list');

        try {
            savedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            savedRecords = [];
        }

        updateClock();
        setInterval(updateClock, 1000);
        bindEvents();
    }

    function updateClock() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        const d = document.getElementById('current-date');
        const t = document.getElementById('current-time');
        if (d && t) {
            d.innerText = `${year}-${month}-${day}`;
            t.innerText = now.toLocaleTimeString();
        }
    }

    function bindEvents() {
        // Keypad Buttons Click
        document.querySelector('.buttons').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const val = btn.getAttribute('data-val');
            const action = btn.getAttribute('data-action');

            if (val !== null) {
                appendCharacter(val);
            } else if (action === 'clear') {
                display.value = '';
            } else if (action === 'delete') {
                deleteLastChar();
            } else if (action === 'calculate') {
                calculateResult();
            }
        });

        // Keyboard Typing Listener
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === calcNote || 
                document.activeElement === document.getElementById('edit-note') || 
                document.activeElement === document.getElementById('edit-expression')) {
                return;
            }

            if ((e.key >= '0' && e.key <= '9') || ['+', '-', '*', '/', '.'].includes(e.key)) {
                appendCharacter(e.key);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                calculateResult();
            } else if (e.key === 'Backspace') {
                deleteLastChar();
            } else if (e.key === 'Escape') {
                display.value = '';
            }
        });

        // Save Button Click
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
            saveToStorage();

            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 2000);
            calcNote.value = '';
        });

        // View Saved History Modal
        document.getElementById('view-btn').addEventListener('click', () => {
            renderHistory();
            savedModal.classList.remove('hidden');
        });

        document.getElementById('close-modal-btn').addEventListener('click', () => {
            savedModal.classList.add('hidden');
        });

        document.getElementById('clear-all-btn').addEventListener('click', () => {
            if (confirm('සියලුම History මකා දැමීමට ඔබට විශ්වාසද?')) {
                savedRecords = [];
                saveToStorage();
                renderHistory();
            }
        });

        // History Actions (Edit / Delete / Copy)
        savedList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const infoArea = e.target.closest('.saved-item-info');

            if (deleteBtn) {
                const id = Number(deleteBtn.getAttribute('data-id'));
                if (confirm('මෙම දත්තය ඉවත් කිරීමට ඔබට විශ්වාසද?')) {
                    savedRecords = savedRecords.filter(item => item.id !== id);
                    saveToStorage();
                    renderHistory();
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

        // Edit Modal Actions
        document.getElementById('close-edit-btn').addEventListener('click', closeEdit);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEdit);

        document.getElementById('save-edit-btn').addEventListener('click', () => {
            if (!editingRecordId) return;

            const newNote = document.getElementById('edit-note').value.trim();
            const newExpr = document.getElementById('edit-expression').value.trim();

            if (!newExpr) {
                alert('අගය හිස්ව තැබිය නොහැක!');
                return;
            }

            savedRecords = savedRecords.map(item => item.id === editingRecordId ? {
                ...item,
                note: newNote || 'General Calculation',
                expression: newExpr
            } : item);

            saveToStorage();
            closeEdit();
            renderHistory();
        });

        // Download XML
        document.getElementById('download-btn').addEventListener('click', exportXML);
    }

    function appendCharacter(char) {
        if (display.value === 'Error') display.value = '';
        display.value += char;
    }

    function deleteLastChar() {
        if (display.value === 'Error') {
            display.value = '';
        } else {
            display.value = display.value.slice(0, -1);
        }
    }

    function calculateResult() {
        if (!display.value.trim()) return;
        try {
            const expr = display.value.replace(/×/g, '*').replace(/÷/g, '/');
            if (!/^[0-9+\-*/. ]+$/.test(expr)) {
                display.value = 'Error';
                return;
            }
            const res = Function(`'use strict'; return (${expr})`)();
            display.value = isFinite(res) ? Math.round(res * 1e10) / 1e10 : 'Error';
        } catch {
            display.value = 'Error';
        }
    }

    function renderHistory() {
        savedList.innerHTML = '';
        if (savedRecords.length === 0) {
            savedList.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">තවම කිසිදු දත්තයක් Save කර නොමැත.</p>';
            return;
        }

        savedRecords.slice().reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'saved-item';
            div.innerHTML = `
                <div class="saved-item-info" data-expr="${escapeHTML(String(item.expression))}" title="Click to copy to display">
                    <div class="saved-item-title">${escapeHTML(item.note)}</div>
                    <div style="color:#aaa; font-size:11px;">${item.date} | ${item.time}</div>
                    <div class="saved-item-result">${escapeHTML(String(item.expression))}</div>
                </div>
                <div>
                    <button type="button" class="action-btn edit-btn" data-id="${item.id}">✏️ Edit</button>
                    <button type="button" class="action-btn delete-btn" data-id="${item.id}">🗑️ Cut</button>
                </div>
            `;
            savedList.appendChild(div);
        });
    }

    function closeEdit() {
        editingRecordId = null;
        editModal.classList.add('hidden');
    }

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecords));
    }

    function exportXML() {
        if (savedRecords.length === 0) {
            alert('Download කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<VasanaCalculatorRecords>\n`;
        savedRecords.forEach(r => {
            xml += `  <Record>\n`;
            xml += `    <ID>${r.id}</ID>\n`;
            xml += `    <Date>${r.date}</Date>\n`;
            xml += `    <Time>${r.time}</Time>\n`;
            xml += `    <Description>${escapeHTML(r.note)}</Description>\n`;
            xml += `    <Value>${escapeHTML(String(r.expression))}</Value>\n`;
            xml += `  </Record>\n`;
        });
        xml += `</VasanaCalculatorRecords>`;

        const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Vasana_Calculator_${year}-${month}-${day}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }
})();
