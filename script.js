(function () {
    'use strict';

    let display, calcNote, toast, savedModal, editModal, downloadModal, settingsModal, savedList, suggestionsBox;
    let savedRecords = [];
    let editingRecordId = null;

    const STORAGE_KEY = 'wm_calculator_records_v1';

    let currentLang = localStorage.getItem('wm_calc_lang') || 'si';
    let currentTheme = localStorage.getItem('wm_calc_theme') || 'dark';

    // Audio Context & Player State Variables
    let audioCtx = null;
    let isAudioPlaying = false;
    let audioLoopTimer = null;
    let currentSongIndex = 0;

    // 2026 Popular Sinhala Songs List
    const songPlaylist = [
        { title: "2026 Sinhala Hit 01 - මාගෙ ආදරේ (Mage Adare)", speed: 380, pattern: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63] },
        { title: "2026 Sinhala Hit 02 - හිතට දැනෙනා (Hithata Danena)", speed: 320, pattern: [293.66, 349.23, 440.00, 587.33, 440.00, 349.23] },
        { title: "2026 Sinhala Hit 03 - සුළඟක් වී (Sulangak Wee)", speed: 420, pattern: [329.63, 392.00, 493.88, 659.25, 493.88, 392.00] },
        { title: "2026 Sinhala Hit 04 - නිල් නෙතු (Nil Nethu)", speed: 350, pattern: [349.23, 440.00, 523.25, 698.46, 523.25, 440.00] }
    ];

    let currentPatternIndex = 0;

    const translations = {
        si: {
            placeholderNote: "විස්තරය (උදා: බඩු ලැයිස්තුව)...",
            viewHistory: "📜 Saved History බලන්න",
            exportShare: "📥 Export / Share",
            settingsTitle: "⚙️ Settings",
            themeLabel: "Dark Mode",
            audioLabel: "Music Player 🎵",
            langLabel: "භාෂාව (Language)",
            close: "වහන්න",
            closeGeneral: "Close",
            clearAll: "සියලුම History මකා දමන්න",
            savedHistoryTitle: "Saved Calculations History",
            editRecordTitle: "සංස්කරණය කරන්න",
            exportTitle: "Export / Share කරන්න",
            saveBtnText: "Save Changes",
            cancelBtnText: "Cancel",
            downloadText: "Download",
            shareText: "🔗 Share File"
        },
        en: {
            placeholderNote: "Note (e.g. Grocery List)...",
            viewHistory: "📜 View Saved History",
            exportShare: "📥 Export / Share",
            settingsTitle: "⚙️ Settings",
            themeLabel: "Dark Mode",
            audioLabel: "Music Player 🎵",
            langLabel: "Language",
            close: "Close",
            closeGeneral: "Close",
            clearAll: "Clear All History",
            savedHistoryTitle: "Saved Calculations History",
            editRecordTitle: "Edit Record",
            exportTitle: "Export or Share History",
            saveBtnText: "Save Changes",
            cancelBtnText: "Cancel",
            downloadText: "Download",
            shareText: "🔗 Share File"
        },
        ta: {
            placeholderNote: "விவரம் (எ.கா. பொருள் பட்டியல்)...",
            viewHistory: "📜 வரலாற்றைப் பார்க்கவும்",
            exportShare: "📥 ஏற்றுமதி / பகிரவும்",
            settingsTitle: "⚙️ அமைப்புகள்",
            themeLabel: "Dark Mode",
            audioLabel: "இசை இயக்கி 🎵",
            langLabel: "மொழி (Language)",
            close: "மூடு",
            closeGeneral: "மூடு",
            clearAll: "அனைத்தையும் நீக்கு",
            savedHistoryTitle: "சேமிக்கப்பட்ட வரலாறு",
            editRecordTitle: "பதிவை திருத்து",
            exportTitle: "ஏற்றுமதி அல்லது பகிரவும்",
            saveBtnText: "சேமிக்கவும்",
            cancelBtnText: "ரத்து செய்",
            downloadText: "பதிவிறக்க",
            shareText: "🔗 பகிரவும்"
        }
    };

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        display = document.getElementById('display');
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
        applyLanguage(currentLang);

        const unlockAudio = () => {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };

        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
    }

    /* ==================== MUSIC PLAYER SYNTHESIZER ==================== */
    function initAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
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
            gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.6);
        } catch (e) {
            console.error('Audio error:', e);
        }

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
        if (audioLoopTimer) {
            clearTimeout(audioLoopTimer);
            audioLoopTimer = null;
        }
        updatePlayerUI();
    }

    function playNextSong() {
        currentSongIndex = (currentSongIndex + 1) % songPlaylist.length;
        currentPatternIndex = 0;
        updatePlayerUI();
    }

    function playPrevSong() {
        currentSongIndex = (currentSongIndex - 1 + songPlaylist.length) % songPlaylist.length;
        currentPatternIndex = 0;
        updatePlayerUI();
    }

    function updatePlayerUI() {
        const songTitleElem = document.getElementById('player-song-title');
        const playBtn = document.getElementById('player-play-btn');

        if (songTitleElem) {
            songTitleElem.innerText = songPlaylist[currentSongIndex].title;
        }
        if (playBtn) {
            playBtn.innerText = isAudioPlaying ? '⏸️ Pause' : '▶️ Play';
        }
    }

    function setupSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        const closeSettingsBtn = document.getElementById('close-settings-btn');
        const closeSettingsX = document.getElementById('close-settings-x');
        const themeToggle = document.getElementById('theme-toggle');
        const langSelect = document.getElementById('language-select');

        // Player Controls
        const playBtn = document.getElementById('player-play-btn');
        const nextBtn = document.getElementById('player-next-btn');
        const prevBtn = document.getElementById('player-prev-btn');

        if (themeToggle) themeToggle.checked = currentTheme === 'dark';
        if (langSelect) langSelect.value = currentLang;

        updatePlayerUI();

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        }
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        }
        if (closeSettingsX) {
            closeSettingsX.addEventListener('click', () => settingsModal.classList.add('hidden'));
        }

        if (themeToggle) {
            themeToggle.addEventListener('change', (e) => {
                const selectedTheme = e.target.checked ? 'dark' : 'light';
                applyTheme(selectedTheme);
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (isAudioPlaying) {
                    stopMusic();
                } else {
                    startMusic();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => playNextSong());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => playPrevSong());
        }

        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                applyLanguage(e.target.value);
            });
        }
    }

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('wm_calc_theme', theme);
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('wm_calc_lang', lang);
        const t = translations[lang] || translations.si;

        if (calcNote) calcNote.placeholder = t.placeholderNote;

        const viewBtn = document.getElementById('view-btn');
        if (viewBtn) viewBtn.innerText = t.viewHistory;

        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) downloadBtn.innerText = t.exportShare;

        const setHead = document.getElementById('txt-settings-title');
        if (setHead) setHead.innerText = t.settingsTitle;

        const thmLbl = document.getElementById('txt-theme-label');
        if (thmLbl) thmLbl.innerText = t.themeLabel;

        const audLbl = document.getElementById('txt-audio-label');
        if (audLbl) audLbl.innerText = t.audioLabel;

        const lngLbl = document.getElementById('txt-lang-label');
        if (lngLbl) lngLbl.innerText = t.langLabel;

        const clsSet = document.getElementById('close-settings-btn');
        if (clsSet) clsSet.innerText = t.close;

        const clrAll = document.getElementById('clear-all-btn');
        if (clrAll) clrAll.innerText = t.clearAll;

        const clsMdl = document.getElementById('close-modal-btn');
        if (clsMdl) clsMdl.innerText = t.closeGeneral;

        const svdHead = document.getElementById('txt-saved-title');
        if (svdHead) svdHead.innerText = t.savedHistoryTitle;

        const edtHead = document.getElementById('txt-edit-title');
        if (edtHead) edtHead.innerText = t.editRecordTitle;

        const expHead = document.getElementById('txt-export-title');
        if (expHead) expHead.innerText = t.exportTitle;

        const svEdt = document.getElementById('save-edit-btn');
        if (svEdt) svEdt.innerText = t.saveBtnText;

        const cnlEdt = document.getElementById('cancel-edit-btn');
        if (cnlEdt) cnlEdt.innerText = t.cancelBtnText;

        const cnlDwn = document.getElementById('cancel-download-btn');
        if (cnlDwn) cnlDwn.innerText = t.cancelBtnText;

        const dwnTxt = document.getElementById('download-btn-text');
        if (dwnTxt) dwnTxt.innerText = t.downloadText;

        const shrTxt = document.getElementById('share-btn-text');
        if (shrTxt) shrTxt.innerText = t.shareText;
    }

    function updateClock() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        const d = document.getElementById('current-date');
        const t = document.getElementById('current-time');
        if (d) d.innerText = `${year}-${month}-${day}`;
        if (t) t.innerText = now.toLocaleTimeString();
    }

    function getCurrentDateFormatted() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function setupSearchableSuggestions() {
        if (!calcNote || !suggestionsBox) return;

        function showSuggestions(filterText = '') {
            const uniqueNotes = [...new Set(savedRecords.map(item => item.note))];
            const filtered = uniqueNotes.filter(note => 
                note && note.toLowerCase().includes(filterText.toLowerCase())
            );

            suggestionsBox.innerHTML = '';

            if (filtered.length === 0) {
                suggestionsBox.classList.add('hidden');
                return;
            }

            filtered.forEach(note => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'suggestion-item';
                itemDiv.innerText = note;

                itemDiv.addEventListener('click', () => {
                    calcNote.value = note;
                    suggestionsBox.classList.add('hidden');
                });

                suggestionsBox.appendChild(itemDiv);
            });

            suggestionsBox.classList.remove('hidden');
        }

        calcNote.addEventListener('focus', () => showSuggestions(calcNote.value.trim()));
        calcNote.addEventListener('input', () => showSuggestions(calcNote.value.trim()));

        document.addEventListener('click', (e) => {
            if (!calcNote.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.classList.add('hidden');
            }
        });
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
            const resultValStr = display.value.trim();
            const note = calcNote.value.trim() || 'General Calculation';

            if (!resultValStr || resultValStr === 'Error') {
                alert('කරුණාකර පළමුව නිවැරදි ගණනය කිරීමක් ඇතුළත් කරන්න!');
                return;
            }

            const formattedDate = getCurrentDateFormatted();
            const formattedTime = new Date().toLocaleTimeString();

            const existingIndex = savedRecords.findIndex(
                item => item.note.toLowerCase() === note.toLowerCase()
            );

            if (existingIndex !== -1) {
                const existingRecord = savedRecords[existingIndex];
                const oldVal = parseFloat(existingRecord.expression) || 0;
                const newVal = parseFloat(resultValStr) || 0;
                const totalVal = Math.round((oldVal + newVal) * 1e10) / 1e10;

                savedRecords[existingIndex] = {
                    ...existingRecord,
                    expression: String(totalVal),
                    date: formattedDate,
                    time: formattedTime
                };

                showToast(`➕ '${note}' සඳහා අගය එකතු විය! (${totalVal})`);
            } else {
                const record = {
                    id: Date.now(),
                    date: formattedDate,
                    time: formattedTime,
                    note: note,
                    expression: resultValStr
                };
                savedRecords.push(record);
                showToast('🎉 Data Saved Successfully!');
            }

            saveToStorage();
            calcNote.value = '';
            if (suggestionsBox) suggestionsBox.classList.add('hidden');
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
                        text: 'WM Calculator Data'
                    });
                    showToast('🎉 Shared Successfully!');
                    closeDownloadModal();
                } else if (navigator.share) {
                    let textSummary = `${getCurrentDateFormatted()} - WM Calculator Data\n\n`;
                    savedRecords.forEach(r => {
                        textSummary += `${r.note}: ${r.expression} (${r.date})\n`;
                    });
                    
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
            const t = translations[currentLang] || translations.si;
            btnText.innerText = isShare ? t.shareText : t.downloadText;
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
            <h2 style="text-align: center; color: #cc7000;">${currentDate} - WM Calculator History</h2>
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
        xml += `<DataEnterHistory title="${currentDate} - WM Calculator History">\n`;
        savedRecords.forEach(r => {
            xml += `  <Record>\n`;
            xml += `    <ID>${r.id}</ID>\n`;
            xml += `    <Description>${escapeHTML(r.note)}</Description>\n`;
            xml += `    <Value>${escapeHTML(String(r.expression))}</Value>\n`;
            xml += `    <Date>${r.date}</Date>\n`;
            xml += `    <Time>${r.time}</Time>\n`;
            xml += `  </Record>\n`;
        });
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
            </style>
        </head>
        <body>
            <h2>${currentDate} - WM Calculator History</h2>
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
                </style>
            </head>
            <body>
                <h2>${currentDate} - WM Calculator History</h2>
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
