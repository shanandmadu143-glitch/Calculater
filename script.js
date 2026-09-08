document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const calcNote = document.getElementById('calc-note');
    const toast = document.getElementById('toast-message');

    // Load saved records from localStorage
    let savedRecords = JSON.parse(localStorage.getItem('vasana_records')) || [];

    // 1. Live Time and Date
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

    // 2. Save Button Click Logic
    document.getElementById('save-btn').addEventListener('click', () => {
        const note = calcNote.value.trim() || 'General Calculation';
        const result = display.value.trim();

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

        // Show "Thank You" message and auto-hide after 2s
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);

        calcNote.value = '';
    });

    // 3. View Saved Modal Controls
    const modal = document.getElementById('saved-modal');
    
    document.getElementById('view-btn').addEventListener('click', () => {
        renderSavedData();
        modal.classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Render Saved Records List
    function renderSavedData() {
        const listContainer = document.getElementById('saved-list');
        listContainer.innerHTML = '';

        if (savedRecords.length === 0) {
            listContainer.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">තවම කිසිදු දත්තයක් Save කර නොමැත.</p>';
            return;
        }

        savedRecords.slice().reverse().forEach(item => {
            const div = document.createElement('div');
            div.className = 'saved-item';
            div.innerHTML = `
                <div class="saved-item-title">${item.note}</div>
                <div>${item.date} | ${item.time}</div>
                <div class="saved-item-result">ගණන/උත්තරය: ${item.expression}</div>
            `;
            listContainer.appendChild(div);
        });
    }

    // Clear All Records Logic
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        if (confirm('සියලුම Save කළ දත්ත මකා දැමීමට ඔබට විශ්වාසද?')) {
            savedRecords = [];
            localStorage.removeItem('vasana_records');
            renderSavedData();
        }
    });

    // 4. Download XML File Logic
    document.getElementById('download-btn').addEventListener('click', () => {
        if (savedRecords.length === 0) {
            alert('Download කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayDate = `${year}-${month}-${day}`;

        let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<VasanaCalculatorRecords>\n`;

        savedRecords.forEach(item => {
            xmlContent += `  <Record>\n`;
            xmlContent += `    <ID>${item.id}</ID>\n`;
            xmlContent += `    <Date>${item.date}</Date>\n`;
            xmlContent += `    <Time>${item.time}</Time>\n`;
            xmlContent += `    <Description>${escapeXML(item.note)}</Description>\n`;
            xmlContent += `    <Value>${escapeXML(item.expression)}</Value>\n`;
            xmlContent += `  </Record>\n`;
        });

        xmlContent += `</VasanaCalculatorRecords>`;

        const blob = new Blob([xmlContent], { type: 'text/xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Vasana_Calculator_${todayDate}.xml`;
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

// Calculator Keypad Functions
function appendValue(input) {
    const display = document.getElementById('display');
    display.value += input;
}

function clearDisplay() {
    const display = document.getElementById('display');
    display.value = '';
}

function deleteLast() {
    const display = document.getElementById('display');
    display.value = display.value.slice(0, -1);
}

function calculateResult() {
    const display = document.getElementById('display');
    try {
        if (display.value !== '') {
            display.value = eval(display.value);
        }
    } catch (error) {
        display.value = 'Error';
    }
}
