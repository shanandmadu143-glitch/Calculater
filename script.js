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

    function getCurrentDateFormatted() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function bindEvents() {
        const buttonsContainer = document.querySelector('.buttons');
        if (buttonsContainer) {
            buttonsContainer.addEventListener('click', (e) => {
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
        }

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

        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (savedRecords.length === 0) {
                    alert('Export / Share කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
                    return;
                }
                document.getElementById('export-filename').value = '';
                downloadModal.classList.remove('hidden');
            });
        }

        document.getElementById('close-download-btn').addEventListener('click', closeDownloadModal);
        document.getElementById('cancel-download-btn').addEventListener('click', closeDownloadModal);

        document.getElementById('confirm-download-btn').addEventListener('click', () => handleExport(false));
        document.getElementById('confirm-share-btn').addEventListener('click', () => handleExport(true));
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
            const wrapper = document.createElement('div');
            wrapper.className = 'saved-item-wrapper';

            wrapper.innerHTML = `
                <div class="swipe-background swipe-bg-left">✏️ Edit</div>
                <div class="swipe-background swipe-bg-right">🗑️ Delete</div>
                <div class="saved-item" data-id="${item.id}" data-expr="${escapeHTML(String(item.expression))}">
                    <div class="saved-item-title">${escapeHTML(item.note)}</div>
                    <div style="color:#aaa; font-size:11px;">${item.date} | ${item.time}</div>
                    <div class="saved-item-result">${escapeHTML(String(item.expression))}</div>
                </div>
            `;

            const card = wrapper.querySelector('.saved-item');
            setupSwipeGesture(card, item);

            savedList.appendChild(wrapper);
        });
    }

    function setupSwipeGesture(element, item) {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        const onTouchStart = (e) => {
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            isSwiping = true;
            element.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!isSwiping) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            currentX = x - startX;

            if (currentX > 120) currentX = 120;
            if (currentX < -120) currentX = -120;

            element.style.transform = `translateX(${currentX}px)`;
        };

        const onTouchEnd = () => {
            if (!isSwiping) return;
            isSwiping = false;
            element.style.transition = 'transform 0.25s ease';

            if (currentX > 75) {
                element.style.transform = 'translateX(0)';
                editingRecordId = item.id;
                document.getElementById('edit-note').value = item.note;
                document.getElementById('edit-expression').value = item.expression;
                editModal.classList.remove('hidden');
            } else if (currentX < -75) {
                element.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    if (confirm('මෙම දත්තය ඉවත් කිරීමට ඔබට විශ්වාසද?')) {
                        savedRecords = savedRecords.filter(r => r.id !== item.id);
                        saveToStorage();
                        renderHistory();
                    } else {
                        element.style.transform = 'translateX(0)';
                    }
                }, 100);
            } else {
                element.style.transform = 'translateX(0)';
                if (Math.abs(currentX) < 5) {
                    display.value = item.expression;
                    savedModal.classList.add('hidden');
                }
            }
            currentX = 0;
        };

        element.addEventListener('touchstart', onTouchStart, { passive: true });
        element.addEventListener('touchmove', onTouchMove, { passive: true });
        element.addEventListener('touchend', onTouchEnd);

        element.addEventListener('mousedown', onTouchStart);
        element.addEventListener('mousemove', (e) => { if (isSwiping) onTouchMove(e); });
        element.addEventListener('mouseup', onTouchEnd);
        element.addEventListener('mouseleave', () => { if (isSwiping) onTouchEnd(); });
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

    async function handleExport(isShare = false) {
        const inputName = document.getElementById('export-filename').value.trim();
        const format = document.getElementById('export-format').value;

        if (!inputName) {
            alert('කරුණාකර File එකට නමක් (File Name) ඇතුළත් කරන්න!');
            return;
        }

        const confirmBtn = isShare ? document.getElementById('confirm-share-btn') : document.getElementById('confirm-download-btn');
        const spinner = isShare ? document.getElementById('share-spinner') : document.getElementById('download-spinner');
        const btnText = isShare ? document.getElementById('share-btn-text') : document.getElementById('download-btn-text');

        confirmBtn.disabled = true;
        spinner.classList.remove('hidden');
        btnText.innerText = isShare ? 'Preparing...' : 'Downloading...';

        try {
            let blob, extension, mimeType;

            if (format === 'pdf') {
                extension = 'pdf';
                mimeType = 'application/pdf';
                blob = await generatePDFBlob();
            } else if (format === 'word') {
                extension = 'doc';
                mimeType = 'application/msword';
                blob = new Blob([getWordContent()], { type: `${mimeType};charset=utf-8;` });
            } else if (format === 'xml') {
                extension = 'xml';
                mimeType = 'text/xml';
                blob = new Blob([getXMLContent()], { type: `${mimeType};charset=utf-8;` });
            } else if (format === 'html') {
                extension = 'html';
                mimeType = 'text/html';
                blob = new Blob([getHTMLContent(inputName)], { type: `${mimeType};charset=utf-8;` });
            }

            const fullFileName = `${inputName}.${extension}`;

            if (isShare) {
                const file = new File([blob], fullFileName, { type: mimeType });

                let fileShareSupported = false;
                if (navigator.canShare) {
                    try {
                        fileShareSupported = navigator.canShare({ files: [file] });
                    } catch (e) {
                        fileShareSupported = false;
                    }
                }

                if (fileShareSupported && navigator.share) {
                    await navigator.share({
                        files: [file],
                        title: inputName,
                        text: 'Vasana Calculator Data'
                    });
                    showToast('🎉 Shared Successfully!');
                    closeDownloadModal();
                } else if (navigator.share) {
                    let textSummary = `${getCurrentDateFormatted()} - Data Enter History\n\n`;
                    savedRecords.forEach(r => {
                        textSummary += `${r.note}: ${r.expression} (${r.date})\n`;
                    });
                    textSummary += `\nApplication Make By :- WAYL Ranaweera`;
                    
                    await navigator.share({
                        title: inputName,
                        text: textSummary
                    });
                    showToast('🎉 Shared Text Summary Successfully!');
                    closeDownloadModal();
                } else {
                    alert('ඔබගේ Browser එක මගින් Share feature එක සහාය නොදක්වයි. Download කිරීම භාවිතා කරන්න.');
                }
            } else {
                const blobUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = blobUrl;
                downloadLink.download = fullFileName;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                
                showToast('🎉 File Downloaded Successfully!');
                closeDownloadModal();
            }

        } catch (err) {
            if (err.name !== 'AbortError') {
                alert('ක්‍රියාවලිය අසාර්ථක විය: ' + err.message);
            }
        } finally {
            confirmBtn.disabled = false;
            spinner.classList.add('hidden');
            btnText.innerText = isShare ? '🔗 Share File' : 'Download';
        }
    }

    async function generatePDFBlob() {
        const currentDate = getCurrentDateFormatted();
        const tempContainer = document.createElement('div');
        tempContainer.style.padding = '20px';
        tempContainer.style.fontFamily = 'Arial, sans-serif';

        let tableRows = '';
        savedRecords.forEach(r => {
            tableRows += `
                <tr>
                    <td style="border: 1px solid #ccc; padding: 10px;">${escapeHTML(r.note)}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;"><b>${escapeHTML(String(r.expression))}</b></td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${r.date}</td>
                    <td style="border: 1px solid #ccc; padding: 10px;">${r.time}</td>
                </tr>
            `;
        });

        tempContainer.innerHTML = `
            <h2 style="text-align: center; color: #cc7000;">${currentDate} - Data Enter History</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f4f4f4;">
                        <th style="border: 1px solid #ccc; padding: 10px;">විස්තරය / නම</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">ගණන / අගය</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">දිනය</th>
                        <th style="border: 1px solid #ccc; padding: 10px;">වෙලාව</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top: 30px; text-align: right; font-size: 11px; color: #666; font-style: italic;">
                Application Make By :- WAYL Ranaweera
            </div>
        `;

        if (window.html2pdf) {
            return await html2pdf().set({
                margin: 10,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(tempContainer).output('blob');
        } else {
            throw new Error('PDF generator library loading failed');
        }
    }

    function getXMLContent() {
        const currentDate = getCurrentDateFormatted();
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<DataEnterHistory title="${currentDate} - Data Enter History" createdBy="WAYL Ranaweera">\n`;
        savedRecords.forEach(r => {
            xml += `  <Record>\n`;
            xml += `    <ID>${r.id}</ID>\n`;
            xml += `    <Description>${escapeHTML(r.note)}</Description>\n`;
            xml += `    <Value>${escapeHTML(String(r.expression))}</Value>\n`;
            xml += `    <Date>${r.date}</Date>\n`;
            xml += `    <Time>${r.time}</Time>\n`;
            xml += `  </Record>\n`;
        });
        xml += `  <Footer>Application Make By :- WAYL Ranaweera</Footer>\n`;
        xml += `</DataEnterHistory>`;
        return xml;
    }

    function getWordContent() {
        const currentDate = getCurrentDateFormatted();
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
                .footer-text { margin-top: 30px; text-align: right; font-size: 11px; color: #666; font-style: italic; }
            </style>
        </head>
        <body>
            <h2>${currentDate} - Data Enter History</h2>
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
            <div class="footer-text">
                Application Make By :- WAYL Ranaweera
            </div>
        </body>
        </html>
        `;
        return htmlContent;
    }

    function getHTMLContent(fileName) {
        const currentDate = getCurrentDateFormatted();
        let tableRows = '';
        savedRecords.forEach(r => {
            tableRows += `
                <tr>
                    <td>${escapeHTML(r.note)}</td>
                    <td><b>${escapeHTML(String(r.expression))}</b></td>
                    <td>${r.date}</td>
                    <td>${r.time}</td>
                </tr>
            `;
        });

        return `
            <!DOCTYPE html>
            <html lang="si">
            <head>
                <meta charset="UTF-8">
                <title>${escapeHTML(fileName)}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h2 { text-align: center; color: #cc7000; border-bottom: 2px solid #cc7000; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 10px 14px; text-align: left; font-size: 14px; }
                    th { background-color: #f4f4f4; }
                    tr:nth-child(even) { background-color: #fafafa; }
                    .footer-text { margin-top: 30px; text-align: right; font-size: 12px; color: #666; font-style: italic; }
                </style>
            </head>
            <body>
                <h2>${currentDate} - Data Enter History</h2>
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
                        ${tableRows}
                    </tbody>
                </table>
                <div class="footer-text">
                    Application Make By :- WAYL Ranaweera
                </div>
            </body>
            </html>
        `;
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
