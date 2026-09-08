const display = document.getElementById('display');

// ඩිස්ප්ලේ එකට අංක හෝ ලකුණු එකතු කිරීම
function appendValue(input) {
    display.value += input;
}

// ඩිස්ප්ලේ එක සම්පූර්ණයෙන්ම clear කිරීම
function clearDisplay() {
    display.value = '';
}

// අවසානයට යොදපු අංකය/ලකුණ ඉවත් කිරීම
function deleteLast() {
    display.value = display.value.slice(0, -1);
}

// උත්තරය တွက်တွက် කිරීම
function calculateResult() {
    try {
        if (display.value !== '') {
            display.value = eval(display.value);
        }
    } catch (error) {
        display.value = 'Error';
    }
}

