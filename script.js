(function () {
    'use strict';

    let display, calcNote, toast, savedModal, editModal, downloadModal, savedList;
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
        downloadModal = document.getElementById('download-modal');
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
        // Keypad Click Event
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

        // Keyboard Shortcuts Event
        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'select') return;

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

        // Save Record Action
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

            showToast('🎉 Data Saved Successfully!');
            calcNote.value = '';
        });

        // View History Modal
        document.getElementById('view-btn').addEventListener('click', () => {
            renderHistory();
            savedModal.classList.remove('hidden');
        });

        // Close History Modal
        document.getElementById('close-modal-btn').addEventListener('click', () => {
            savedModal.classList.add('hidden');
        });

        // Clear History
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            if (confirm('සියලුම History මකා දැමීමට ඔබට විශ්වාසද?')) {
                savedRecords = [];
                saveToStorage();
                renderHistory();
            }
        });

        // History Actions
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

        // Edit Modal Events
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

        // Export Modal Events
        document.getElementById('download-btn').addEventListener('click', () => {
            if (savedRecords.length === 0) {
                alert('Download කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
                return;
            }
            downloadModal.classList.remove('hidden');
        });

        document.getElementById('close-download-btn').addEventListener('click', closeDownloadModal);
        document.getElementById('cancel-download-btn').addEventListener('click', closeDownloadModal);
        document.getElementById('confirm-download-btn').addEventListener('click', handleExport);
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

    function closeDownloadModal() {
        downloadModal.classList.add('hidden');
    }

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecords));
    }

    function handleExport() {
        const inputName = document.getElementById('export-filename').value.trim();
        const format = document.getElementById('export-format').value;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const fileName = inputName ? inputName : `Vasana_Calculator_${year}-${month}-${day}`;

        if (format === 'xml') {
            exportXML(fileName);
        } else if (format === 'word') {
            exportWord(fileName);
        } else if (format === 'pdf') {
            exportPDF(fileName);
        }

        closeDownloadModal();
    }

    function exportXML(fileName) {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<VasanaCalculatorRecords>\n`;
        savedRecords.forEach(r => {
            xml += `  <Record>\n`;
            xml += `    <ID>${r.id}</ID>\n`;
            xml += `    <Description>${escapeHTML(r.note)}</Description>\n`;
            xml += `    <Value>${escapeHTML(String(r.expression))}</Value>\n`;
            xml += `    <Date>${r.date}</Date>\n`;
            xml += `    <Time>${r.time}</Time>\n`;
            xml += `  </Record>\n`;
        });
        xml += `</VasanaCalculatorRecords>`;

        downloadBlob(xml, 'text/xml;charset=utf-8;', `${fileName}.xml`);
        showToast('📥 XML File Downloaded!');
    }

    function exportWord(fileName) {
        let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h2 { color: #d47a00; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #ff8c00; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h2>Vasana Calculator Saved Records</h2>
            <table>
                <thead>
                    <tr>
                        <th>විස්තරය / නම (Name/Note)</th>
                        <th>ගණන / අගය (Value)</th>
                        <th>දිනය (Date)</th>
                        <th>වෙලාව (Time)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        savedRecords.forEach(r => {
            htmlContent += `
                <tr>
                    <td>${escapeHTML(r.note)}</td>
                    <td><b>${escapeHTML(String(r.expression))}</b></td>
                    <td>${r.date}</td>
                    <td>${r.time}</td>
                </tr>
            `;
        });

        htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        downloadBlob(htmlContent, 'application/msword;charset=utf-8;', `${fileName}.doc`);
        showToast('📥 Word File Downloaded!');
    }

    function exportPDF(fileName) {
        if (typeof html2pdf === 'undefined') {
            alert('PDF Library load වී නොමැත. කරුණාකර Internet Connection එක පරීක්ෂා කරන්න.');
            return;
        }

        const pdfContainer = document.createElement('div');
        pdfContainer.style.padding = '20px';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.color = '#111';

        let rowsHTML = '';
        savedRecords.forEach(r => {
            rowsHTML += `
                <tr>
                    <td style="border: 1px solid #ccc; padding: 8px;">${escapeHTML(r.note)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; color: #d47a00;">${escapeHTML(String(r.expression))}</td>
                    <td style="border: 1px solid #ccc; padding: 8px;">${r.date}</td>
                    <td style="border: 1px solid #ccc; padding: 8px;">${r.time}</td>
                </tr>
            `;
        });

        pdfContainer.innerHTML = `
            <h2 style="text-align: center; color: #ff8c00; border-bottom: 2px solid #ff8c00; padding-bottom: 10px;">Vasana Calculator Saved History</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                <thead>
                    <tr style="background-color: #f4f4f4;">
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">විස්තරය / නම</th>
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">ගණන / අගය</th>
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">දිනය</th>
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">වෙලාව</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        `;

        const opt = {
            margin: 10,
            filename: `${fileName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(pdfContainer).save().then(() => {
            showToast('📥 PDF File Downloaded!');
        }).catch(err => {
            console.error('PDF export error:', err);
            alert('PDF Export කිරීමට නොහැකි විය.');
        });
    }

    function downloadBlob(content, type, fullFileName) {
        const blob = new Blob([content], { type: type });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fullFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }

    function showToast(msg) {
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2200);
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }
})();
