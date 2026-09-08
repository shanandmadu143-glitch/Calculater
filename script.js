document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const calcNote = document.getElementById('calc-note');
    const toast = document.getElementById('toast-message');
    const savedModal = document.getElementById('saved-modal');
    const editModal = document.getElementById('edit-modal');
    const savedList = document.getElementById('saved-list');
    
    let savedRecords = JSON.parse(localStorage.getItem('vasana_records')) || [];
    let editingRecordId = null;

    // Live Date & Time
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

    // Keypad Logic via Event Delegation
    document.querySelector('.buttons').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const val = target.getAttribute('data-val');
        const action = target.getAttribute('data-action');

        if (val !== null) {
            display.value += val;
        } else if (action === 'clear') {
            display.value = '';
        } else if (action === 'delete') {
            display.value = display.value.slice(0, -1);
        } else if (action === 'calculate') {
            if (display.value.trim() !== '') {
                try {
                    display.value = eval(display.value);
                } catch {
                    display.value = 'Error';
                }
            }
        }
    });

    // Save Calculation
    document.getElementById('save-btn').addEventListener('click', () => {
        const result = display.value.trim();
        const note = calcNote.value.trim() || 'General Calculation';

        if (!result || result === 'Error') {
            alert('කරුණාකර පළමුව ගණනය කිරීමක් ඇතුළත් කරන්න!');
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

    // Modal Controls
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

    // Render Saved Records List
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
                <div class="saved-item-info">
                    <div class="saved-item-title">${escapeXML(item.note)}</div>
                    <div style="color:#aaa; font-size:11px;">${item.date} | ${item.time}</div>
                    <div class="saved-item-result">${escapeXML(String(item.expression))}</div>
                </div>
                <div class="saved-item-actions">
                    <button class="action-btn edit-btn" data-id="${item.id}">✏️ Edit</button>
                    <button class="action-btn delete-btn" data-id="${item.id}">🗑️ Cut</button>
                </div>
            `;
            savedList.appendChild(div);
        });
    }

    // Handle Edit & Delete Actions inside Saved List
    savedList.addEventListener('click', (e) => {
        const id = Number(e.target.getAttribute('data-id'));
        if (!id) return;

        if (e.target.classList.contains('delete-btn')) {
            if (confirm('මෙම දත්තය ඉවත් කිරීමට ඔබට විශ්වාසද?')) {
                savedRecords = savedRecords.filter(item => item.id !== id);
                localStorage.setItem('vasana_records', JSON.stringify(savedRecords));
                renderSavedData();
            }
        } else if (e.target.classList.contains('edit-btn')) {
            const record = savedRecords.find(item => item.id === id);
            if (!record) return;

            editingRecordId = id;
            document.getElementById('edit-note').value = record.note;
            document.getElementById('edit-expression').value = record.expression;
            editModal.classList.remove('hidden');
        }
    });

    // Edit Modal Actions
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

    // XML Download
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

        const blob = new Blob([xmlContent], { type: 'text/xml' });
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
