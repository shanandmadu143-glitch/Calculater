(function () {
    'use strict';

    let display, livePreview, calcNote, toast, savedModal, editModal, downloadModal, settingsModal, savedList, suggestionsBox;
    let savedRecords = [];
    let editingRecordId = null;

    const STORAGE_KEY = 'wm_calculator_records_v3';

    let currentTheme = localStorage.getItem('wm_calc_theme') || 'theme-dark';
    let soundEnabled = localStorage.getItem('wm_calc_sound') !== 'false';

    // Audio State Variables
    let audioCtx = null;
    let masterGain = null;
    let isAudioPlaying = false;
    let audioLoopTimer = null;
    let currentSongIndex = 0;

    const songPlaylist = [
        { title: "2026 Sinhala Hit 01 - මාගෙ ආදරේ", speed: 380, pattern: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63] },
        { title: "2026 Sinhala Hit 02 - හිතට දැනෙනා", speed: 320, pattern: [293.66, 349.23, 440.00, 587.33, 440.00, 349.23] },
        { title: "2026 Sinhala Hit 03 - සුළඟක් වී", speed: 420, pattern: [329.63, 392.00, 493.88, 659.25, 493.88, 392.00] }
    ];

    let currentPatternIndex = 0;

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        display = document.getElementById('display');
        livePreview = document.getElementById('live-preview');
        calcNote = document.getElementById('calc-note');
        toast = document.getElementById('toast-message');
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

    function playClickSound() {
        if (!soundEnabled) return;
        if (navigator.vibrate) navigator.vibrate(15);

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) {}
    }

    function initAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
                masterGain = audioCtx.createGain();
                const vol = parseFloat(document.getElementById('player-volume').value) || 0.5;
                masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
                masterGain.connect(audioCtx.destination);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function triggerVisualizer() {
        const bars = document.querySelectorAll('.v-bar');
        bars.forEach(bar => {
            if (isAudioPlaying) {
                const h = Math.floor(Math.random() * 14) + 4;
                bar.style.height = `${h}px`;
            } else {
                bar.style.height = '4px';
            }
        });
    }

    function playNextMelodyStep() {
        if (!isAudioPlaying) return;

        initAudioContext();
        if (!audioCtx) return;

        const currentSong = songPlaylist[currentSongIndex];
        const freq = currentSong.pattern[currentPatternIndex];
        currentPatternIndex = (currentPatternIndex + 1) % currentSong.pattern.length;

        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
            triggerVisualizer();
        } catch (e) {}

        audioLoopTimer = setTimeout(playNextMelodyStep, currentSong.speed);
    }

    function startMusic() {
        initAudioContext();
        if (!isAudioPlaying) {
            isAudioPlaying = true;
            updatePlayerUI();
            playNextMelodyStep();
        }
    }

    function stopMusic() {
        isAudioPlaying = false;
        if (audioLoopTimer) clearTimeout(audioLoopTimer);
        triggerVisualizer();
        updatePlayerUI();
    }

    function updatePlayerUI() {
        const songTitleElem = document.getElementById('player-song-title');
        const playBtn = document.getElementById('player-play-btn');
        if (songTitleElem) songTitleElem.innerText = songPlaylist[currentSongIndex].title;
        if (playBtn) playBtn.innerText = isAudioPlaying ? '⏸️' : '▶️';
    }

    function setupSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const themeSelect = document.getElementById('theme-select');
        const soundToggle = document.getElementById('sound-toggle');
        const volumeInput = document.getElementById('player-volume');

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

        if (volumeInput) {
            volumeInput.addEventListener('input', (e) => {
                initAudioContext();
                if (masterGain && audioCtx) {
                    masterGain.gain.setValueAtTime(parseFloat(e.target.value), audioCtx.currentTime);
                }
            });
        }

        document.getElementById('player-play-btn').addEventListener('click', () => isAudioPlaying ? stopMusic() : startMusic());
        document.getElementById('player-next-btn').addEventListener('click', () => {
            currentSongIndex = (currentSongIndex + 1) % songPlaylist.length;
            currentPatternIndex = 0;
            updatePlayerUI();
        });
        document.getElementById('player-prev-btn').addEventListener('click', () => {
            currentSongIndex = (currentSongIndex - 1 + songPlaylist.length) % songPlaylist.length;
            currentPatternIndex = 0;
            updatePlayerUI();
        });

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

        document.getElementById('save-btn').addEventListener('click', () => {
            let resultValStr = display.value.trim().replace(/,/g, '');
            const note = calcNote.value.trim() || 'General Calculation';

            if (!resultValStr || resultValStr === 'Error') {
                alert('කරුණාකර නිවැරදි ගණනය කිරීමක් ඇතුළත් කරන්න!');
                return;
            }

            const now = new Date();
            const record = {
                id: Date.now(),
                date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
                time: now.toLocaleTimeString(),
                note: note,
                expression: resultValStr
            };

            savedRecords.push(record);
            saveToStorage();
            showToast('🎉 Data Saved Successfully!');
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
            if (confirm('සියලුම History මකා දැමීමට ඔබට විශ්වාසද?')) {
                savedRecords = [];
                saveToStorage();
                renderHistory();
            }
        });

        document.getElementById('close-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));
        document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));

        document.getElementById('save-edit-btn').addEventListener('click', () => {
            if (!editingRecordId) return;
            const newNote = document.getElementById('edit-note').value.trim();
            const newExpr = document.getElementById('edit-expression').value.trim();

            savedRecords = savedRecords.map(r => r.id === editingRecordId ? { ...r, note: newNote, expression: newExpr } : r);
            saveToStorage();
            editModal.classList.add('hidden');
            renderHistory();
        });

        document.getElementById('download-btn').addEventListener('click', () => {
            if (savedRecords.length === 0) return alert('Export කිරීමට දත්ත නොමැත!');
            document.getElementById('export-filename').value = `WM_Report_${Date.now()}`;
            downloadModal.classList.remove('hidden');
        });

        document.getElementById('close-download-btn').addEventListener('click', () => downloadModal.classList.add('hidden'));
        document.getElementById('cancel-download-btn').addEventListener('click', () => downloadModal.classList.add('hidden'));

        document.getElementById('confirm-download-btn').addEventListener('click', () => processExport(false));
        document.getElementById('confirm-share-btn').addEventListener('click', () => processExport(true));
    }

    async function processExport(isShare = false) {
        const fname = document.getElementById('export-filename').value.trim() || 'WM_Report';
        const format = document.getElementById('export-format').value;

        let contentBlob = null;
        let mimeType = 'text/plain';
        let extension = format;

        if (format === 'pdf' && window.html2pdf) {
            const tempDiv = document.createElement('div');
            tempDiv.style.padding = '20px';
            tempDiv.style.color = '#000';
            tempDiv.innerHTML = `<h2>WM Calculator History</h2><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;">
                <tr><th>Date</th><th>Note</th><th>Value</th></tr>` +
                savedRecords.map(r => `<tr><td>${r.date} ${r.time}</td><td>${escapeHTML(r.note)}</td><td>${r.expression}</td></tr>`).join('') +
                `</table>`;

            const opt = { margin: 10, filename: `${fname}.pdf` };
            
            if (isShare && navigator.share) {
                const pdfWorker = html2pdf().set(opt).from(tempDiv);
                contentBlob = await pdfWorker.output('blob');
                mimeType = 'application/pdf';
            } else {
                html2pdf().set(opt).from(tempDiv).save();
            }
        } else if (format === 'html' || format === 'xml') {
            mimeType = format === 'html' ? 'text/html' : 'text/xml';
            let content = '';
            if (format === 'html') {
                content = `<html><head><title>${fname}</title></head><body><h2>Calculation History</h2><table border="1"><tr><th>Date</th><th>Note</th><th>Value</th></tr>` +
                    savedRecords.map(r => `<tr><td>${r.date} ${r.time}</td><td>${escapeHTML(r.note)}</td><td>${r.expression}</td></tr>`).join('') +
                    `</table></body></html>`;
            } else {
                content = `<?xml version="1.0" encoding="UTF-8"?><records>` +
                    savedRecords.map(r => `<record><date>${r.date}</date><time>${r.time}</time><note>${escapeHTML(r.note)}</note><value>${r.expression}</value></record>`).join('') +
                    `</records>`;
            }
            contentBlob = new Blob([content], { type: mimeType });
        } else {
            mimeType = 'application/msword';
            extension = 'doc';
            let text = `WM Calculator Report\n\n` + savedRecords.map(r => `[${r.date} ${r.time}] ${r.note}: ${r.expression}`).join('\n');
            contentBlob = new Blob([text], { type: 'text/plain' });
        }

        if (isShare) {
            const file = new File([contentBlob], `${fname}.${extension}`, { type: mimeType });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'WM Calculator Report',
                        text: 'Here is my calculation history report.'
                    });
                    showToast('🔗 Shared successfully!');
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        showToast('Sharing failed. Downloading instead...');
                        downloadBlob(contentBlob, `${fname}.${extension}`);
                    }
                }
            } else {
                let summaryText = `WM Calculator History:\n` + savedRecords.slice(-5).map(r => `${r.note}: ${r.expression}`).join('\n');
                if (navigator.share) {
                    try {
                        await navigator.share({ title: fname, text: summaryText });
                        showToast('🔗 Shared text successfully!');
                    } catch (e) {}
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(summaryText);
                    showToast('📋 Copied report to clipboard!');
                } else {
                    downloadBlob(contentBlob, `${fname}.${extension}`);
                }
            }
        } else if (format !== 'pdf' || !window.html2pdf) {
            downloadBlob(contentBlob, `${fname}.${extension}`);
        }

        downloadModal.classList.add('hidden');
    }

    function downloadBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        showToast('📥 Download Completed!');
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
                } else {
                    livePreview.innerText = '';
                }
            } else {
                livePreview.innerText = '';
            }
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
            } else {
                display.value = 'Error';
            }
        } catch {
            display.value = 'Error';
        }
    }

    function renderHistory() {
        savedList.innerHTML = '';
        const searchTxt = document.getElementById('history-search').value.toLowerCase();

        const filtered = savedRecords.filter(r => {
            return r.note.toLowerCase().includes(searchTxt) || String(r.expression).includes(searchTxt);
        });

        let totalSum = 0;

        if (filtered.length === 0) {
            savedList.innerHTML = '<p style="color:#888; text-align:center; padding:15px;">දත්ත කිසිවක් හමු නොවුණි.</p>';
        } else {
            filtered.slice().reverse().forEach(item => {
                const valNum = parseFloat(item.expression) || 0;
                totalSum += valNum;

                const wrapper = document.createElement('div');
                wrapper.className = 'saved-item-wrapper';
                wrapper.innerHTML = `
                    <div class="swipe-background swipe-bg-left">✏️ Edit</div>
                    <div class="swipe-background swipe-bg-right">🗑️ Delete</div>
                    <div class="saved-item" data-id="${item.id}">
                        <div class="saved-item-title">${escapeHTML(item.note)}</div>
                        <div style="color:#888; font-size:11px;">${item.date} | ${item.time}</div>
                        <div class="saved-item-result">${valNum.toLocaleString('en-US')}</div>
                    </div>
                `;
                setupSwipeGesture(wrapper.querySelector('.saved-item'), item);
                savedList.appendChild(wrapper);
            });
        }

        document.getElementById('history-total-val').innerText = totalSum.toLocaleString('en-US', { minimumFractionDigits: 2 });
    }

    function setupSwipeGesture(element, item) {
        let startX = 0, currentX = 0, isSwiping = false;

        const start = (e) => { 
            startX = e.touches ? e.touches[0].clientX : e.clientX; 
            isSwiping = true; 
            element.style.transition = 'none'; 
        };
        const move = (e) => {
            if (!isSwiping) return;
            currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
            if (currentX > 100) currentX = 100;
            if (currentX < -100) currentX = -100;
            element.style.transform = `translateX(${currentX}px)`;
        };
        const end = () => {
            if (!isSwiping) return;
            isSwiping = false;
            element.style.transition = 'transform 0.2s';
            if (currentX > 60) {
                element.style.transform = 'translateX(0)';
                editingRecordId = item.id;
                document.getElementById('edit-note').value = item.note;
                document.getElementById('edit-expression').value = item.expression;
                editModal.classList.remove('hidden');
            } else if (currentX < -60) {
                element.style.transform = 'translateX(-100%)';
                setTimeout(() => {
                    if (confirm('මෙය මකා දැමීමට නිසැකද?')) {
                        savedRecords = savedRecords.filter(r => r.id !== item.id);
                        saveToStorage(); renderHistory();
                    } else element.style.transform = 'translateX(0)';
                }, 100);
            } else element.style.transform = 'translateX(0)';
            currentX = 0;
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
                    showToast('🎉 Backup Restored Successfully!');
                    renderHistory();
                }
            } catch (err) {
                alert('Invalid Backup File!');
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
                d.addEventListener('click', () => { calcNote.value = n; suggestionsBox.classList.add('hidden'); });
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
    function showToast(msg) { toast.innerText = msg; toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2200); }
    function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
})();
