// Local Storage Initialization
let savedRecords = [];
try {
    savedRecords = JSON.parse(localStorage.getItem('vasana_records')) || [];
} catch (e) {
    savedRecords = [];
}

// 1. Live Time & Date Update
function updateDateTime() {
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement && timeElement) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        dateElement.innerText = `${year}-${month}-${day}`;
        timeElement.innerText = now.toLocaleTimeString();
    }
}

setInterval(updateDateTime, 1000);
window.onload = updateDateTime;

// 2. Calculator Core Functions
function appendValue(input) {
    const display = document.getElementById('display');
    if (display) {
        display.value += input;
    }
}

function clearDisplay() {
    const display = document.getElementById('display');
    if (display) {
        display.value = '';
    }
}

function deleteLast() {
    const display = document.getElementById('display');
    if (display) {
        display.value = display.value.slice(0, -1);
    }
}

function calculateResult() {
    const display = document.getElementById('display');
    if (display && display.value !== '') {
        try {
            display.value = eval(display.value);
        } catch (error) {
            display.value = 'Error';
        }
    }
}

// 3. Save Functionality with Thank You Popup
function saveCalculation() {
    const display = document.getElementById('display');
    const calcNote = document.getElementById('calc-note');
    const toast = document.getElementById('toast-message');

    const result = display ? display.value.trim() : '';
    const note = (calcNote && calcNote.value.trim()) ? calcNote.value.trim() : 'General Calculation';

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

    // Display Thank You Toast Overlay
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);
    }

    if (calcNote) calcNote.value = '';
}

// 4. Saved Records View Modal Controls
function openSavedModal() {
    renderSavedData();
    const modal = document.getElementById('saved-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSavedModal() {
    const modal = document.getElementById('saved-modal');
    if (modal) modal.classList.add('hidden');
}

function renderSavedData() {
    const listContainer = document.getElementById('saved-list');
    if (!listContainer) return;

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

function clearAllHistory() {
    if (confirm('සියලුම Save කළ දත්ත මකා දැමීමට ඔබට විශ්වාසද?')) {
        savedRecords = [];
        localStorage.removeItem('vasana_records');
        renderSavedData();
    }
}

// 5. Download XML Functionality
function downloadXML() {
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
}

function escapeXML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
