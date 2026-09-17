(function () {
    'use strict';

    let display, livePreview, calcNote, savedModal, editModal, downloadModal, settingsModal, savedList, suggestionsBox;
    let savedRecords = [];
    let editingRecordId = null;

    const STORAGE_KEY = 'wm_calculator_records_v4';

    let currentTheme = localStorage.getItem('wm_calc_theme') || 'theme-dark';
    let soundEnabled = localStorage.getItem('wm_calc_sound') !== 'false';

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        display = document.getElementById('display');
        livePreview = document.getElementById('live-preview');
        calcNote = document.getElementById('calc-note');
        savedModal = document.getElementById('saved-modal');
        editModal = document.getElementById('edit-modal');
        downloadModal = document.getElementById('download-modal');
        settingsModal = document.getElementById('settings-modal');
        savedList = document.getElementById('saved-list');
        suggestionsBox = document.getElementById('custom-suggestions');

        try {
            savedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            savedRecords = [];
        }

        updateClock();
        setInterval(updateClock, 1000);
        bindEvents();
        setupSearchableSuggestions();
        setupSettings();
        applyTheme(currentTheme);

        const sToggle = document.getElementById('sound-toggle');
        if (sToggle) sToggle.checked = soundEnabled;
    }

    /* Toast Notification System */
    function showToast(message, type = 'success', duration = 2500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = { success: '✨', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `animated-toast toast-${type}`;
        toast.innerHTML = `<span>${icons[type] || '✨'}</span><span>${message}</span>`;

        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    function showConfirmDialog(title, message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';

        overlay.innerHTML = `
            <div class="custom-alert-box">
                <div class="custom-alert-icon">⚠️</div>
                <div class="custom-alert-title">${title}</div>
                <div class="custom-alert-msg">${message}</div>
                <div class="custom-alert-actions">
                    <button class="custom-alert-btn btn-alert-cancel" id="alert-cancel-btn">අවලංගු කරන්න</button>
                    <button class="custom-alert-btn btn-alert-confirm" id="alert-confirm-btn">ඔවු, මකන්න</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('alert-cancel-btn').onclick = () => overlay.remove();
        document.getElementById('alert-confirm-btn').onclick = () => {
            overlay.remove();
            onConfirm();
        };
    }

    function playClickSound() {
        if (!soundEnabled) return;
        if (navigator.vibrate) navigator.vibrate(12);

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(850, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch (e) {}
    }

    function setupSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const themeSelect = document.getElementById('theme-select');
        const soundToggle = document.getElementById('sound-toggle');

        if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));
        document.getElementById('close-settings-x').addEventListener('click', () => settingsModal.classList.add('hidden'));

        if (themeSelect) {
            themeSelect.value = currentTheme;
            themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
        }

        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                soundEnabled = e.target.checked;
                localStorage.setItem('wm_calc_sound', soundEnabled);
            });
        }

        document.getElementById('export-json-btn').addEventListener('click', exportBackupJSON);
        document.getElementById('import-json-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', importBackupJSON);
    }

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('wm_calc_theme', theme);
        document.body.className = theme;
    }

    function updateClock() {
        const now = new Date();
        document.getElementById('current-date').innerText = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        document.getElementById('current-time').innerText = now.toLocaleTimeString();
    }

    function bindEvents() {
        document.querySelector('.buttons').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            playClickSound();
            const val = btn.getAttribute('data-val');
            const action = btn.getAttribute('data-action');

            if (val !== null) appendCharacter(val);
            else if (action === 'clear') { display.value = ''; livePreview.innerText = ''; }
            else if (action === 'delete') deleteLastChar();
            else if (action === 'calculate') calculateResult();
        });

        // Main Calculator Save Logic
        document.getElementById('save-btn').addEventListener('click', () => {
            let resultValStr = display.value.trim().replace(/,/g, '');
            const note = calcNote.value.trim() || 'General Item';

            if (!resultValStr || resultValStr === 'Error') {
                showToast('කරුණාකර නිවැරදි ගණනය කිරීමක් ඇතුළත් කරන්න!', 'warning');
                return;
            }

            const newValue = parseFloat(resultValStr);
            if (isNaN(newValue)) {
                showToast('ඇතුළත් කළ අගය නිවැරදි නැත!', 'error');
                return;
            }

            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const formattedTime = now.toLocaleTimeString();

            // Create record structure with Amount and optional Amount KG / Pieces
            const record = {
                id: Date.now(),
                date: formattedDate,
                time: formattedTime,
                note: note,
                amount: newValue,
                amountKg: 0,
                pieces: 0
            };

            savedRecords.push(record);
            saveToStorage();

            showToast(`🎉 '${note}' සාර්ථකව Save විය!`, 'success');

            calcNote.value = '';
            display.value = '';
            livePreview.innerText = '';
        });

        document.getElementById('view-btn').addEventListener('click', () => {
            renderHistory();
            savedModal.classList.remove('hidden');
        });

        document.getElementById('close-modal-btn').addEventListener('click', () => savedModal.classList.add('hidden'));
        document.getElementById('history-search').addEventListener('input', renderHistory);

        document.getElementById('clear-all-btn').addEventListener('click', () => {
            showConfirmDialog(
                'සියල්ල මකා දැමීම', 
                'Saved History එකෙහි ඇති සියලුම දත්ත මකා දැමීමට ඔබට විශ්වාසද?', 
                () => {
                    savedRecords = [];
                    saveToStorage();
                    renderHistory();
                    showToast('History සාර්ථකව මකා දැමීය!', 'info');
                }
            );
        });

        // Edit Modal Events
        document.getElementById('close-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));
        document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));

        document.getElementById('save-edit-btn').addEventListener('click', () => {
            if (!editingRecordId) return;

            const newNote = document.getElementById('edit-note').value.trim() || 'General Item';
            const newAmount = parseFloat(document.getElementById('edit-amount').value) || 0;
            const newAmountKg = parseFloat(document.getElementById('edit-amount-kg').value) || 0;
            const newPieces = parseInt(document.getElementById('edit-pieces').value, 10) || 0;

            savedRecords = savedRecords.map(r => {
                if (r.id === editingRecordId) {
                    return {
                        ...r,
                        note: newNote,
                        amount: newAmount,
                        amountKg: newAmountKg,
                        pieces: newPieces
                    };
                }
                return r;
            });

            saveToStorage();
            editModal.classList.add('hidden');
            renderHistory();
            showToast('දත්තයන් සාර්ථකව සංස්කරණය විය!', 'success');
        });

        // Download Modal Events
        document.getElementById('download-btn').addEventListener('click', () => {
            if (savedRecords.length === 0) return showToast('Export කිරීමට දත්ත නොමැත!', 'warning');
            document.getElementById('export-filename').value = `WM_Report_${Date.now()}`;
            downloadModal.classList.remove('hidden');
        });

        document.getElementById('close-download-btn').addEventListener('click', () => downloadModal.classList.add('hidden'));
        document.getElementById('confirm-download-btn').addEventListener('click', () => processExport(false));
        document.getElementById('confirm-share-btn').addEventListener('click', () => processExport(true));
    }

    function appendCharacter(char) {
        if (display.value === 'Error') display.value = '';
        display.value += char;
        updateLivePreview();
    }

    function deleteLastChar() {
        display.value = display.value.slice(0, -1);
        updateLivePreview();
    }

    function updateLivePreview() {
        const val = display.value.trim();
        if (!val) { livePreview.innerText = ''; return; }
        try {
            const expr = val.replace(/×/g, '*').replace(/÷/g, '/');
            if (/^[0-9+\-*/. ]+$/.test(expr)) {
                const res = Function(`'use strict'; return (${expr})`)();
                if (isFinite(res)) {
                    livePreview.innerText = '= ' + Number(res).toLocaleString('en-US');
                } else livePreview.innerText = '';
            } else livePreview.innerText = '';
        } catch (e) {
            livePreview.innerText = '';
        }
    }

    function calculateResult() {
        if (!display.value.trim()) return;
        try {
            const expr = display.value.replace(/×/g, '*').replace(/÷/g, '/');
            const res = Function(`'use strict'; return (${expr})`)();
            if (isFinite(res)) {
                const rounded = Math.round(res * 1e10) / 1e10;
                display.value = rounded.toLocaleString('en-US');
                livePreview.innerText = '';
            } else display.value = 'Error';
        } catch {
            display.value = 'Error';
        }
    }

    /* Render History Cards */
    function renderHistory() {
        savedList.innerHTML = '';
        const searchTxt = document.getElementById('history-search').value.toLowerCase();

        const filtered = savedRecords.filter(r => {
            return r.note.toLowerCase().includes(searchTxt) || 
                   String(r.amount).includes(searchTxt) || 
                   String(r.amountKg).includes(searchTxt);
        });

        if (filtered.length === 0) {
            savedList.innerHTML = '<p style="color:#9ca3af; text-align:center; padding:20px; font-size:13px;">දත්ත කිසිවක් හමු නොවුණි.</p>';
            return;
        }

        filtered.slice().reverse().forEach(item => {
            const mainAmt = parseFloat(item.amount) || 0;
            const kgAmt = parseFloat(item.amountKg) || 0;
            const pcsAmt = parseInt(item.pieces, 10) || 0;

            const wrapper = document.createElement('div');
            wrapper.className = 'saved-item-wrapper';
            wrapper.innerHTML = `
                <div class="swipe-background swipe-bg-left">✏️ Edit</div>
                <div class="swipe-background swipe-bg-right">🗑️ Delete</div>
                <div class="saved-item" data-id="${item.id}">
                    <div class="saved-item-header">
                        <span class="saved-item-title">${escapeHTML(item.note)}</span>
                        <span class="saved-item-date">${item.date} | ${item.time}</span>
                    </div>
                    <div class="saved-values-box">
                        <div class="val-row">
                            <span class="val-label">Amount (මුල් ගණන):</span>
                            <span class="val-amount">${mainAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                        </div>
                        <div class="val-row">
                            <span class="val-label">Amount KG (අලුත් අගය):</span>
                            <div>
                                <span class="val-kg">${kgAmt > 0 ? kgAmt.toLocaleString('en-US') + ' kg' : '0.00 kg'}</span>
                                ${pcsAmt > 0 ? `<span class="val-pcs">${pcsAmt} කෑලි</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            setupSwipeGesture(wrapper.querySelector('.saved-item'), item);
            savedList.appendChild(wrapper);
        });
    }

    /* Touch & Mouse Swipe Gesture Engine (Right: Edit, Left: Delete) */
    function setupSwipeGesture(element, item) {
        let startX = 0, startY = 0, currentX = 0, currentY = 0, isSwiping = false, isScrolling = false;

        const start = (e) => {
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            isSwiping = true;
            isScrolling = false;
            element.style.transition = 'none';
        };

        const move = (e) => {
            if (!isSwiping) return;

            let touchX = e.touches ? e.touches[0].clientX : e.clientX;
            let touchY = e.touches ? e.touches[0].clientY : e.clientY;

            currentX = touchX - startX;
            currentY = touchY - startY;

            if (!isScrolling && Math.abs(currentY) > Math.abs(currentX)) {
                isScrolling = true;
                element.style.transform = 'translateX(0)';
                return;
            }

            if (isScrolling) return;

            if (currentX > 90) currentX = 90;
            if (currentX < -90) currentX = -90;
            element.style.transform = `translateX(${currentX}px)`;
        };

        const end = () => {
            if (!isSwiping) return;
            isSwiping = false;
            element.style.transition = 'transform 0.2s ease-out';

            if (!isScrolling) {
                if (currentX > 55) { // Right Swipe -> EDIT
                    element.style.transform = 'translateX(0)';
                    openEditModal(item);
                } else if (currentX < -55) { // Left Swipe -> DELETE
                    element.style.transform = 'translateX(0)';
                    showConfirmDialog(
                        'මකා දැමීම', 
                        `'${item.note}' දත්තය මකා දැමීමට නිසැකද?`, 
                        () => {
                            savedRecords = savedRecords.filter(r => r.id !== item.id);
                            saveToStorage(); 
                            renderHistory();
                            showToast('දත්තය මකා දමන ලදී!', 'info');
                        }
                    );
                } else {
                    element.style.transform = 'translateX(0)';
                }
            }
            currentX = 0; currentY = 0;
        };

        if ('ontouchstart' in window) {
            element.addEventListener('touchstart', start, {passive:true});
            element.addEventListener('touchmove', move, {passive:true});
            element.addEventListener('touchend', end);
        } else {
            element.addEventListener('mousedown', start);
            element.addEventListener('mousemove', (e) => isSwiping && move(e));
            element.addEventListener('mouseup', end);
        }
    }

    function openEditModal(item) {
        editingRecordId = item.id;
        document.getElementById('edit-note').value = item.note || '';
        document.getElementById('edit-amount').value = item.amount || 0;
        document.getElementById('edit-amount-kg').value = item.amountKg || '';
        document.getElementById('edit-pieces').value = item.pieces || '';
        editModal.classList.remove('hidden');
    }

    /* Export Generator (PDF, HTML, Doc, XML) */
    function generateExportHTML(title) {
        const rows = savedRecords.map((r, index) => {
            const mainAmt = parseFloat(r.amount) || 0;
            const kgAmt = parseFloat(r.amountKg) || 0;
            const pcsAmt = parseInt(r.pieces, 10) || 0;

            return `
                <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 12px;">${r.date}<br><span style="color:#9ca3af; font-size:10px;">${r.time}</span></td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 700; font-size: 13px;">${escapeHTML(r.note)}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #16a34a; font-weight: 700; font-size: 13px; text-align: right;">${mainAmt.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #0284c7; font-weight: 700; font-size: 13px; text-align: right;">${kgAmt > 0 ? kgAmt.toLocaleString('en-US') + ' kg' : '-'}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #d97706; font-weight: 600; font-size: 12px; text-align: center;">${pcsAmt > 0 ? pcsAmt : '-'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="font-family: 'Inter', sans-serif; padding: 20px; color: #1f2937; max-width: 800px; margin: auto; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 18px;">
                    <div>
                        <h1 style="margin: 0; color: #111827; font-size: 22px; font-weight: 800;">WM CALCULATOR PRO</h1>
                        <p style="margin: 3px 0 0 0; color: #6b7280; font-size: 12px;">Saved History & Dual Amount Report</p>
                    </div>
                    <div style="text-align: right; color: #6b7280; font-size: 11px;">
                        <div>Date: ${new Date().toLocaleDateString()}</div>
                        <div>Total Records: ${savedRecords.length}</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #1f2937; color: #ffffff; text-align: left;">
                            <th style="padding: 10px 12px; font-size: 12px; font-weight: 600;">Date & Time</th>
                            <th style="padding: 10px 12px; font-size: 12px; font-weight: 600;">Description (Note)</th>
                            <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: right;">Amount</th>
                            <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: right;">Amount KG</th>
                            <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: center;">Pieces (කෑලි)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                    <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600;">Generated by WM Calculator System</p>
                </div>
            </div>
        `;
    }

    async function processExport(isShare = false) {
        const fname = document.getElementById('export-filename').value.trim() || 'WM_Report';
        const format = document.getElementById('export-format').value;

        let contentBlob = null;
        let mimeType = 'text/plain';
        let extension = format;

        if (format === 'pdf' && window.html2pdf) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = generateExportHTML(fname);

            const opt = { 
                margin: 8, 
                filename: `${fname}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            if (isShare) {
                const pdfWorker = html2pdf().set(opt).from(tempDiv);
                contentBlob = await pdfWorker.output('blob');
                mimeType = 'application/pdf';
            } else {
                html2pdf().set(opt).from(tempDiv).save();
                downloadModal.classList.add('hidden');
                showToast('📥 PDF Download සාර්ථකයි!', 'success');
                return;
            }
        } else if (format === 'html' || format === 'xml') {
            mimeType = format === 'html' ? 'text/html' : 'text/xml';
            let content = '';
            if (format === 'html') {
                content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${fname}</title></head><body>${generateExportHTML(fname)}</body></html>`;
            } else {
                content = `<?xml version="1.0" encoding="UTF-8"?><records>` +
                    savedRecords.map(r => `<record><date>${r.date}</date><note>${escapeHTML(r.note)}</note><amount>${r.amount}</amount><amountKg>${r.amountKg}</amountKg><pieces>${r.pieces}</pieces></record>`).join('') +
                    `</records>`;
            }
            contentBlob = new Blob([content], { type: mimeType });
        } else {
            mimeType = 'application/msword';
            extension = 'doc';
            let text = `WM CALCULATOR REPORT\n\n` + 
                savedRecords.map(r => `[${r.date}] ${r.note} -> Amount: ${r.amount} | Amount KG: ${r.amountKg} kg | Pieces: ${r.pieces}`).join('\n');
            contentBlob = new Blob([text], { type: 'text/plain' });
        }

        if (isShare) {
            const file = new File([contentBlob], `${fname}.${extension}`, { type: mimeType });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: fname, text: 'WM Calculator History Report' });
                    showToast('🔗 Share කිරීම සාර්ථකයි!', 'success');
                } catch (err) {
                    if (err.name !== 'AbortError') downloadBlob(contentBlob, `${fname}.${extension}`);
                }
            } else {
                downloadBlob(contentBlob, `${fname}.${extension}`);
            }
        } else {
            downloadBlob(contentBlob, `${fname}.${extension}`);
        }

        downloadModal.classList.add('hidden');
    }

    function downloadBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        showToast('📥 Download Completed!', 'success');
    }

    function exportBackupJSON() {
        const blob = new Blob([JSON.stringify(savedRecords, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `wm_calc_backup_${Date.now()}.json`);
    }

    function importBackupJSON(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) {
                    savedRecords = data;
                    saveToStorage();
                    showToast('🎉 Backup Restored Successfully!', 'success');
                    renderHistory();
                }
            } catch (err) {
                showToast('Invalid Backup File!', 'error');
            }
        };
        reader.readAsText(file);
    }

    function setupSearchableSuggestions() {
        function showSuggestions(text) {
            const unique = [...new Set(savedRecords.map(i => i.note))].filter(n => n && n.toLowerCase().includes(text.toLowerCase()));
            suggestionsBox.innerHTML = '';
            if (!unique.length) { suggestionsBox.classList.add('hidden'); return; }
            unique.forEach(n => {
                const d = document.createElement('div');
                d.className = 'suggestion-item'; d.innerText = n;
                d.addEventListener('click', () => { 
                    calcNote.value = n; 
                    suggestionsBox.classList.add('hidden'); 
                });
                suggestionsBox.appendChild(d);
            });
            suggestionsBox.classList.remove('hidden');
        }

        calcNote.addEventListener('focus', () => showSuggestions(calcNote.value));
        calcNote.addEventListener('input', () => showSuggestions(calcNote.value));

        document.addEventListener('click', (e) => {
            if (!calcNote.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.classList.add('hidden');
            }
        });
    }

    function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecords)); }
    function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
})();
