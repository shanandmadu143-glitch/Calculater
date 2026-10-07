(function () {
    'use strict';

    let display, livePreview, calcNote, savedModal, editModal, downloadModal, settingsModal, savedList, suggestionsBox;
    let savedRecords = [];
    let editingRecordId = null;
    let historyPage = 1;
    const HISTORY_PAGE_SIZE = 4;

    const STORAGE_KEY = 'wm_calculator_records_v4';

    let currentTheme = localStorage.getItem('wm_calc_theme') || 'theme-dark';
    let soundEnabled = localStorage.getItem('wm_calc_sound') !== 'false';

    // Synth Audio Engine Settings
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

    document.addEventListener('DOMContentLoaded', () => {
        initSplash();
        initApp();
    });

    /* 🌟 4 Seconds Loading Splash Screen Animation Logic */
    function initSplash() {
        const splashScreen = document.getElementById('splash-screen');
        const progressFill = document.getElementById('splash-progress-fill');
        const percentTxt = document.getElementById('splash-percent');
        
        if (!splashScreen || !progressFill || !percentTxt) return;

        const totalDuration = 4000; // 4 Seconds
        const intervalTime = 40;
        let elapsed = 0;

        const timer = setInterval(() => {
            elapsed += intervalTime;
            const percentage = Math.min(Math.floor((elapsed / totalDuration) * 100), 100);
            
            progressFill.style.width = `${percentage}%`;
            percentTxt.innerText = `${percentage}%`;

            if (elapsed >= totalDuration) {
                clearInterval(timer);
                splashScreen.classList.add('splash-fade-out');
                setTimeout(() => {
                    splashScreen.style.display = 'none';
                }, 800);
            }
        }, intervalTime);
    }


    function initMobileNavigation() {
        const navItems = document.querySelectorAll('.mobile-nav-item');
        const setActive = (name) => {
            navItems.forEach(item => item.classList.toggle('active', item.dataset.nav === name));
        };

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.nav;
                if (target === 'home' || target === 'calculator') {
                    setActive('home');
                    document.querySelector('.display-container')?.scrollIntoView({behavior:'smooth', block:'start'});
                    return;
                }
                if (target === 'history') {
                    setActive('history');
                    document.getElementById('view-btn')?.click();
                    return;
                }
                if (target === 'export') {
                    setActive('export');
                    document.getElementById('download-btn')?.click();
                    return;
                }
                if (target === 'settings') {
                    setActive('settings');
                    document.getElementById('settings-btn')?.click();
                }
            });
        });

        document.querySelectorAll('.modal .close-x,.modal .close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const active = document.querySelector('.mobile-nav-item.active');
                if (active && active.dataset.nav !== 'home') setActive('home');
            });
        });
    }

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

        updateRecordCount();
        updateClock();
        updateConnectionStatus();
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        setInterval(updateClock, 1000);
        bindEvents();
        setupProfessionalTools();
        setupKeyboardCalculator();
        hydrateIndexedDB();
        setupSearchableSuggestions();
        setupSettings();
        applyTheme(currentTheme);
        updateRecordCount();

        const sToggle = document.getElementById('sound-toggle');
        if (sToggle) sToggle.checked = soundEnabled;
    }

    /* Animated Auto-Dismiss Toast Notification System */
    function showToast(message, type = 'success', duration = 3000) {
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
        toast.style.setProperty('--duration', `${duration}ms`);

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '✨'}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-progress"></div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hide');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
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
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
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
        initMobileNavigation();
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

        /* Save Button Handling */
        document.getElementById('save-btn').addEventListener('click', () => {
            let resultValStr = display.value.trim().replace(/,/g, '');
            const note = calcNote.value.trim() || 'General Calculation';

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

            // Search for existing record by same note name
            const existingIndex = savedRecords.findIndex(r => String(r.note || '').toLowerCase() === note.toLowerCase());

            if (existingIndex !== -1) {
                // Accumulate to existing record Amount
                const currentVal = parseFloat(savedRecords[existingIndex].expression) || 0;
                const updatedVal = currentVal + newValue;

                savedRecords[existingIndex].expression = updatedVal.toString();
                savedRecords[existingIndex].date = formattedDate;
                savedRecords[existingIndex].time = formattedTime;

                showToast(`➕ '${note}' සඳහා පැරණි ගණනට අලුත් අගය එකතු විය! (${currentVal.toLocaleString('en-US')} + ${newValue.toLocaleString('en-US')} = ${updatedVal.toLocaleString('en-US')})`, 'info');
            } else {
                const record = {
                    id: Date.now(),
                    date: formattedDate,
                    time: formattedTime,
                    note: note,
                    expression: newValue.toString(),
                    amountKg: 0,
                    pieces: 0
                };
                savedRecords.push(record);
                showToast('🎉 සාර්ථකව සුරකින ලදී!', 'success');
            }

            saveToStorage();
            calcNote.value = '';
            display.value = '';
            livePreview.innerText = '';
        });

        document.getElementById('view-btn').addEventListener('click', () => {
            renderHistory();
            savedModal.classList.remove('hidden');
        });

        document.getElementById('close-modal-btn').addEventListener('click', () => savedModal.classList.add('hidden'));
        document.getElementById('history-search').addEventListener('input', () => {
            historyPage = 1;
            renderHistory();
        });
        document.getElementById('history-prev').addEventListener('click', () => {
            if (historyPage > 1) { historyPage--; renderHistory(); }
        });
        document.getElementById('history-next').addEventListener('click', () => {
            const q = document.getElementById('history-search').value.trim().toLowerCase();
            const filteredCount = savedRecords.filter(r => String(r.note || '').toLowerCase().includes(q) || String(r.expression || '').includes(q) || String(r.amountKg || '').includes(q)).length;
            const pages = Math.max(1, Math.ceil(filteredCount / HISTORY_PAGE_SIZE));
            if (historyPage < pages) { historyPage++; renderHistory(); }
        });

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

        /* Close Edit Modal */
        document.getElementById('close-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));
        document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.classList.add('hidden'));

        /* Save Edit Modal Action */
        document.getElementById('save-edit-btn').addEventListener('click', () => {
            if (!editingRecordId) return;
            const newNote = document.getElementById('edit-note').value.trim() || 'Calculation';
            const newExpr = document.getElementById('edit-expression').value.trim();
            const newKg = parseFloat(document.getElementById('edit-amount-kg').value) || 0;
            const newPieces = parseInt(document.getElementById('edit-pieces').value, 10) || 0;

            if (!newExpr || isNaN(parseFloat(newExpr))) {
                showToast('කරුණාකර නිවැරදි මුල් අගයක් ඇතුළත් කරන්න!', 'warning');
                return;
            }

            savedRecords = savedRecords.map(r => {
                if (r.id === editingRecordId) {
                    return {
                        ...r,
                        note: newNote,
                        expression: parseFloat(newExpr).toString(),
                        amountKg: newKg,
                        pieces: newPieces
                    };
                }
                return r;
            });

            saveToStorage();
            editModal.classList.add('hidden');
            renderHistory();
            showToast('සංස්කරණය කිරීම සාර්ථකයි!', 'success');
        });

        document.getElementById('download-btn').addEventListener('click', () => {
            if (savedRecords.length === 0) return showToast('Export කිරීමට දත්ත නොමැත!', 'warning');
            document.getElementById('export-filename').value = `WM_Report_${Date.now()}`;
            downloadModal.classList.remove('hidden');
        });

        document.getElementById('close-download-btn').addEventListener('click', () => downloadModal.classList.add('hidden'));
        document.getElementById('cancel-download-btn').addEventListener('click', () => downloadModal.classList.add('hidden'));

        document.getElementById('confirm-download-btn').addEventListener('click', () => processExport(false));
        document.getElementById('confirm-share-btn').addEventListener('click', () => processExport(true));
    }

    function generateExportHTML(title) {
        const rows = savedRecords.map((r, index) => {
            const valNum = parseFloat(r.expression) || 0;
            const kgVal = parseFloat(r.amountKg) || 0;
            const piecesVal = parseInt(r.pieces, 10) || 0;

            let kgDisplay = '-';
            if (kgVal > 0) {
                kgDisplay = `${kgVal.toLocaleString('en-US')} kg` + (piecesVal > 0 ? ` (කෑලි ${piecesVal})` : '');
            }

            return `
                <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                    <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-size: 13px;">${r.date} <br><span style="color:#9ca3af; font-size:11px;">${r.time}</span></td>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 700; font-size: 14px;">${escapeHTML(r.note)}</td>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #2563eb; font-weight: 700; font-size: 15px; text-align: right;">${valNum.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: 700; font-size: 14px; text-align: right;">${kgDisplay}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="font-family: 'Inter', sans-serif; padding: 25px; color: #1f2937; max-width: 800px; margin: auto; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ff9800; padding-bottom: 15px; margin-bottom: 20px;">
                    <div>
                        <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 800;">WM CALCULATOR PRO</h1>
                        <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Calculation Statement & History Report</p>
                    </div>
                    <div style="text-align: right; color: #6b7280; font-size: 12px;">
                        <div>Date: ${new Date().toLocaleDateString()}</div>
                        <div>Total Saved Items: ${savedRecords.length}</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                    <thead>
                        <tr style="background-color: #1f2937; color: #ffffff; text-align: left;">
                            <th style="padding: 12px 15px; font-size: 13px; font-weight: 600;">Date & Time</th>
                            <th style="padding: 12px 15px; font-size: 13px; font-weight: 600;">Description (නම)</th>
                            <th style="padding: 12px 15px; font-size: 13px; font-weight: 600; text-align: right;">Amount</th>
                            <th style="padding: 12px 15px; font-size: 13px; font-weight: 600; text-align: right;">Amount KG (කෑලි)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 600;">
                        Generated by WM Calculator Pro
                    </p>
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
                    savedRecords.map(r => `<record><date>${r.date}</date><time>${r.time}</time><note>${escapeHTML(r.note)}</note><amount>${r.expression}</amount><amountKg>${r.amountKg || 0}</amountKg><pieces>${r.pieces || 0}</pieces></record>`).join('') +
                    `</records>`;
            }
            contentBlob = new Blob([content], { type: mimeType });
        } else {
            mimeType = 'application/msword';
            extension = 'doc';
            let text = `WM CALCULATOR REPORT\n\n` + 
                savedRecords.map(r => `[${r.date} ${r.time}] ${r.note} -> Amount: ${r.expression} | Amount KG: ${r.amountKg || 0} kg (${r.pieces || 0} pieces)`).join('\n') +
                `\n\n----------------------------------------\nGenerated by WM Calculator Pro`;
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

    function appendCharacter(char) {
        if (display.value === 'Error') display.value = '';
        display.value += char;
        updateLivePreview();
    }

    function deleteLastChar() {
        display.value = display.value.slice(0, -1);
        updateLivePreview();
    }

    /* Secure arithmetic engine: no eval()/Function(), only numbers and + - * / */
    function safeEvaluate(expression) {
        const source = String(expression).replace(/\s+/g, '');
        const tokens = source.match(/(?:\d+(?:\.\d+)?|\.\d+|[()+\-*/])/g);
        if (!tokens || tokens.join('') !== source) throw new Error('Invalid expression');
        let pos = 0;
        function parseExpression() {
            let value = parseTerm();
            while (tokens[pos] === '+' || tokens[pos] === '-') {
                const op = tokens[pos++], rhs = parseTerm();
                value = op === '+' ? value + rhs : value - rhs;
            }
            return value;
        }
        function parseTerm() {
            let value = parseFactor();
            while (tokens[pos] === '*' || tokens[pos] === '/') {
                const op = tokens[pos++], rhs = parseFactor();
                if (op === '/' && rhs === 0) throw new Error('Division by zero');
                value = op === '*' ? value * rhs : value / rhs;
            }
            return value;
        }
        function parseFactor() {
            if (tokens[pos] === '+') { pos++; return parseFactor(); }
            if (tokens[pos] === '-') { pos++; return -parseFactor(); }
            if (tokens[pos] === '(') {
                pos++;
                const value = parseExpression();
                if (tokens[pos] !== ')') throw new Error('Missing parenthesis');
                pos++;
                return value;
            }
            const token = tokens[pos++];
            if (!token || !/^\d*\.?\d+$/.test(token)) throw new Error('Invalid number');
            return Number(token);
        }
        const result = parseExpression();
        if (pos !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid calculation');
        return result;
    }

    function updateLivePreview() {
        const val = display.value.trim();
        if (!val) { livePreview.innerText = ''; return; }
        try {
            const expr = val.replace(/×/g, '*').replace(/÷/g, '/');
            if (/^[0-9+\-*/. ]+$/.test(expr)) {
                const res = safeEvaluate(expr);
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
            const res = safeEvaluate(expr);
            if (isFinite(res)) {
                const rounded = Math.round(res * 1e10) / 1e10;
                display.value = rounded.toLocaleString('en-US');
                livePreview.innerText = '';
            } else display.value = 'Error';
        } catch {
            display.value = 'Error';
        }
    }

    /* Render Saved History UI List */
    function renderHistory() {
        if (!savedList) return;
        savedList.innerHTML = '';
        const searchTxt = (document.getElementById('history-search')?.value || '').trim().toLowerCase();

        const filtered = savedRecords.filter(r => {
            const note = String(r.note || '').toLowerCase();
            return note.includes(searchTxt) ||
                String(r.expression ?? '').includes(searchTxt) ||
                String(r.amountKg ?? '').includes(searchTxt);
        }).slice().reverse();

        const totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
        historyPage = Math.min(Math.max(1, historyPage), totalPages);

        const startIndex = (historyPage - 1) * HISTORY_PAGE_SIZE;
        const pageItems = filtered.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);

        const pageInfo = document.getElementById('history-page-info');
        const prev = document.getElementById('history-prev');
        const next = document.getElementById('history-next');
        if (pageInfo) pageInfo.textContent = `${historyPage} / ${totalPages}`;
        if (prev) prev.disabled = historyPage <= 1;
        if (next) next.disabled = historyPage >= totalPages;

        if (!pageItems.length) {
            savedList.innerHTML = '<div class="empty-history"><div>📭</div><strong>දත්ත කිසිවක් හමු නොවුණි</strong><span>Search එක වෙනස් කර බලන්න.</span></div>';
            return;
        }

        pageItems.forEach(item => {
            const valNum = Number.parseFloat(item.expression) || 0;
            const kgVal = Number.parseFloat(item.amountKg) || 0;
            const piecesVal = Number.parseInt(item.pieces, 10) || 0;
            const wrapper = document.createElement('div');
            wrapper.className = 'saved-item-wrapper';

            let kgHtml = '';
            if (kgVal > 0 || piecesVal > 0) {
                const pcsTxt = piecesVal > 0 ? ` • ${piecesVal} කෑලි` : '';
                kgHtml = `<div class="amount-badge kg-badge"><span class="badge-label">KG / Pieces</span><span class="badge-value-kg">⚖️ ${kgVal.toLocaleString('en-US')} kg${pcsTxt}</span></div>`;
            }

            wrapper.innerHTML = `
                <div class="swipe-background swipe-bg-right">✏️ Edit</div>
                <div class="swipe-background swipe-bg-left">🗑️ Delete</div>
                <div class="saved-item" data-id="${escapeHTML(item.id)}">
                    <div class="saved-item-header">
                        <span class="saved-item-title">${escapeHTML(item.note || 'Calculation')}</span>
                        <span class="saved-item-date">${escapeHTML(item.date || '')}<br>${escapeHTML(item.time || '')}</span>
                    </div>
                    <div class="saved-amounts-grid">
                        <div class="amount-badge"><span class="badge-label">Amount</span><span class="badge-value">${valNum.toLocaleString('en-US', {minimumFractionDigits: 2})}</span></div>
                        ${kgHtml}
                    </div>
                </div>`;
            setupSwipeGesture(wrapper.querySelector('.saved-item'), item);
            savedList.appendChild(wrapper);
        });
    }

    /* Swipe Gestures: Right Swipe = Edit Modal | Left Swipe = Delete Confirm */
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

            if (currentX > 110) currentX = 110;
            if (currentX < -110) currentX = -110;
            element.style.transform = `translateX(${currentX}px)`;
        };

        const end = () => {
            if (!isSwiping) return;
            isSwiping = false;
            element.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';

            if (!isScrolling) {
                if (currentX > 60) {
                    element.style.transform = 'translateX(0)';
                    editingRecordId = item.id;
                    document.getElementById('edit-note').value = item.note || '';
                    document.getElementById('edit-expression').value = item.expression || '';
                    document.getElementById('edit-amount-kg').value = item.amountKg || '';
                    document.getElementById('edit-pieces').value = item.pieces || '';
                    editModal.classList.remove('hidden');
                } else if (currentX < -60) {
                    element.style.transform = 'translateX(0)';
                    showConfirmDialog(
                        'දත්තය මකා දැමීම', 
                        `'${item.note}' දත්තය මකා දැමීමට ඔබට විශ්වාසද?`, 
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
            currentX = 0;
            currentY = 0;
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
                    savedRecords = data.map((r, i) => ({
                        id: r.id ?? (Date.now() + i),
                        date: String(r.date || ''),
                        time: String(r.time || ''),
                        note: String(r.note || 'Calculation'),
                        expression: String(r.expression ?? 0),
                        amountKg: Number.parseFloat(r.amountKg) || 0,
                        pieces: Number.parseInt(r.pieces, 10) || 0
                    })).filter(r => Number.isFinite(Number(r.expression)));
                    historyPage = 1;
                    saveToStorage();
                    showToast('🎉 Backup Restored Successfully!', 'success');
                    renderHistory();
                }
            } catch (err) {
                showToast('Invalid Backup File!', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
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

    const DB_NAME = 'wm-calculator-pro-db';
    const DB_STORE = 'records';
    let dbPromise = null;

    function openAppDB() {
        if (!('indexedDB' in window)) return Promise.resolve(null);
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(resolve => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        return dbPromise;
    }

    async function persistIndexedDB(records = savedRecords) {
        const db = await openAppDB();
        if (!db) return;
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(DB_STORE, 'readwrite');
                const store = tx.objectStore(DB_STORE);
                store.clear();
                records.forEach(r => store.put(r));
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (_) {}
    }

    async function hydrateIndexedDB() {
        const db = await openAppDB();
        if (!db) return;
        try {
            const records = await new Promise((resolve, reject) => {
                const tx = db.transaction(DB_STORE, 'readonly');
                const req = tx.objectStore(DB_STORE).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
            if (records.length && !savedRecords.length) {
                savedRecords = records;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecords));
                updateRecordCount();
            }
        } catch (_) {}
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecords));
            persistIndexedDB(savedRecords);
            updateRecordCount();
        } catch (err) {
            showToast('Storage එකට data save කිරීමට නොහැකි විය.', 'error');
        }
    }

    function updateRecordCount() {
        const el = document.getElementById('record-count');
        if (el) el.textContent = `${savedRecords.length} ${savedRecords.length === 1 ? 'record' : 'records'}`;
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        [savedModal, editModal, downloadModal, settingsModal].forEach(m => m?.classList.add('hidden'));
    });

    function updateConnectionStatus() {
        const online = navigator.onLine;
        document.body.classList.toggle('is-offline', !online);
        const text = document.getElementById('connection-text');
        if (text) text.textContent = online ? 'Online Ready' : 'Offline Ready';
    }

    let deferredInstallPrompt = null;
    function setupProfessionalTools() {
        const toolsModal = document.getElementById('app-tools-modal');
        const openBtn = document.getElementById('tools-btn');
        const closeX = document.getElementById('close-tools-x');
        const closeBtn = document.getElementById('close-tools-btn');
        const installBtn = document.getElementById('install-app-btn');
        const resetBtn = document.getElementById('reset-data-btn');
        const helpBtn = document.getElementById('keyboard-help-btn');
        const healthBtn = document.getElementById('health-check-btn');
        const result = document.getElementById('system-check-result');

        openBtn?.addEventListener('click', () => toolsModal?.classList.remove('hidden'));
        closeX?.addEventListener('click', () => toolsModal?.classList.add('hidden'));
        closeBtn?.addEventListener('click', () => toolsModal?.classList.add('hidden'));

        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredInstallPrompt = e;
        });

        installBtn?.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
                showToast('මෙම browser එකේ install option එක දැනට ලබාගත නොහැක.', 'info');
                return;
            }
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
        });

        resetBtn?.addEventListener('click', () => {
            showConfirmDialog('Local Data Reset', 'මෙම device එකේ saved records සියල්ල මකා දැමීමට ඔබට විශ්වාසද?', async () => {
                savedRecords = [];
                localStorage.removeItem(STORAGE_KEY);
                const db = await openAppDB();
                if (db) try { db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).clear(); } catch (_) {}
                updateRecordCount();
                renderHistory();
                showToast('Local data reset කළා.', 'info');
            });
        });

        helpBtn?.addEventListener('click', () => {
            showToast('⌨️ 0-9 / + - * / • Enter = Calculate • Backspace = Delete • Escape = Close', 'info', 5000);
        });

        healthBtn?.addEventListener('click', () => {
            const checks = [
                ['Secure calculation engine', true],
                ['IndexedDB storage', 'indexedDB' in window],
                ['Offline cache', 'serviceWorker' in navigator],
                ['Web Share', !!navigator.share],
                ['Local storage', (() => { try { localStorage.setItem('__wm_test','1'); localStorage.removeItem('__wm_test'); return true; } catch (_) { return false; } })()]
            ];
            result.innerHTML = checks.map(([name, ok]) => `${ok ? '✅' : '⚠️'} <strong>${name}</strong>: ${ok ? 'Ready' : 'Unavailable'}`).join('<br>');
            result.classList.remove('hidden');
        });
    }

    function setupKeyboardCalculator() {
        document.addEventListener('keydown', e => {
            if (e.target.matches('input,select,textarea')) return;
            if (/^[0-9.+\-*/]$/.test(e.key)) {
                e.preventDefault();
                appendCharacter(e.key);
            } else if (e.key === 'Enter' || e.key === '=') {
                e.preventDefault();
                calculateResult();
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                deleteLastChar();
            }
        });
    }

    function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
})();
