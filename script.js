const display = document.getElementById('display');
const calcNote = document.getElementById('calc-note');
let savedRecords = JSON.parse(localStorage.getItem('vasana_records')) || [];

// 1. දිනය සහ වෙලාව සජීවීව ක්‍රියාත්මක කිරීම
function updateDateTime() {
    const now = new Date();
    
    // දිනය
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('current-date').innerText = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    // වෙලාව
    document.getElementById('current-time').innerText = now.toLocaleTimeString();
}

setInterval(updateDateTime, 1000);
document.addEventListener('DOMContentLoaded', updateDateTime);

// 2. Calculator Buttons Functionality
function appendValue(input) {
    display.value += input;
}

function clearDisplay() {
    display.value = '';
}

function deleteLast() {
    display.value = display.value.slice(0, -1);
}

function calculateResult() {
    try {
        if (display.value !== '') {
            display.value = eval(display.value);
        }
    } catch (error) {
        display.value = 'Error';
    }
}

// 3. Data Save කිරීම සහ Animation ලබාදීම
function saveCalculation() {
    const note = calcNote.value.trim() || 'General Calculation';
    const result = display.value;

    if (!result || result === 'Error') {
        alert('කරුණාකර පළමුව ගණනය කිරීමක් ඇතුළත් කරන්න!');
        return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString();

    const record = {
        id: Date.now(),
        date: dateStr,
        time: timeStr,
        note: note,
        expression: result
    };

    savedRecords.push(record);
    localStorage.setItem('vasana_records', JSON.stringify(savedRecords));

    // Save Animation
    const saveBtn = document.getElementById('save-btn');
    saveBtn.classList.add('save-success');
    setTimeout(() => {
        saveBtn.classList.remove('save-success');
    }, 600);

    alert('දත්ත සාර්ථකව Save විය!');
    calcNote.value = '';
}

// 4. Save කරන ලද දත්ත පෙන්වීම (View Toggle)
function toggleSavedData() {
    const modal = document.getElementById('saved-modal');
    modal.classList.toggle('hidden');

    if (!modal.classList.contains('hidden')) {
        renderSavedData();
    }
}

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

function clearAllHistory() {
    if (confirm('සියලුම Save කළ දත්ත මකා දැමීමට ඔබට විශ්වාසද?')) {
        savedRecords = [];
        localStorage.removeItem('vasana_records');
        renderSavedData();
    }
}

// 5. Download XML (Save කරන ලද දිනයට අදාළව File Name එක සෑදේ)
function downloadXML() {
    if (savedRecords.length === 0) {
        alert('Download කිරීමට Save කරන ලද දත්ත කිසිවක් නොමැත!');
        return;
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // Build XML Content
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

    // Download Logic
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
