const display = document.getElementById('display');

// සජීවීව වෙලාව සහ දිනය පෙන්වීම
function updateDateTime() {
    const now = new Date();
    
    // දිනය සකස් කිරීම
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    document.getElementById('current-date').innerText = now.toLocaleDateString('en-US', options);
    
    // වෙලාව සකස් කිරීම
    document.getElementById('current-time').innerText = now.toLocaleTimeString();
}

// තත්පරයෙන් තත්පරය වෙලාව Update කිරීම
setInterval(updateDateTime, 1000);
updateDateTime();

// ඩිස්ප්ලේ එකට අංක හෝ ලකුණු එකතු කිරීම
function appendValue(input) {
    display.value += input;
}

// Clear කිරීම
function clearDisplay() {
    display.value = '';
}

// අවසාන අංකය මකා දැමීම
function deleteLast() {
    display.value = display.value.slice(0, -1);
}

// ගණනය කිරීම
function calculateResult() {
    try {
        if (display.value !== '') {
            display.value = eval(display.value);
        }
    } catch (error) {
        display.value = 'Error';
    }
}
