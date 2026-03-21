// mobile.js
const invoicePeriods = {
    "11411": {
        name: "114年11-12月",
        super: "29731662",
        special: "98073356",
        first: ["31782240", "28377033", "62402170"],
        additional: []
    },
    "11409": {
        name: "114年09-10月",
        super: "27602226",
        special: "04043757",
        first: ["95040042", "58066022", "62890507"],
        additional: []
    },
    "11407": {
        name: "114年07-08月",
        super: "21981893",
        special: "39597522",
        first: ["09505831", "54219897", "17469638"],
        additional: []
    }
};

let html5QrCode;
let isScanning = false;
let currentPeriod = "11411";

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const periodSelect = document.getElementById('period-select');
const cameraStatus = document.getElementById('camera-status');
const scanOverlay = document.querySelector('.scanner-overlay');
const resultModal = document.getElementById('result-modal');
const resetBtn = document.getElementById('reset-btn');

const resultInvoiceNumber = document.getElementById('result-invoice-number');
const resultPeriod = document.getElementById('result-period');
const prizeInfoCard = document.getElementById('prize-info-card');
const prizeStatus = document.getElementById('prize-status');
const prizeName = document.getElementById('prize-name');
const prizeAmount = document.getElementById('prize-amount');

const infoSuper = document.getElementById('info-super');
const infoSpecial = document.getElementById('info-special');
const infoFirst = document.getElementById('info-first');
const infoAdditional = document.getElementById('info-additional');

// Bottom Nav & Tabs
const navItems = document.querySelectorAll('.nav-item');
const tabViews = document.querySelectorAll('.tab-view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Update Nav Active State
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Update View Display
        const targetId = item.dataset.target;
        tabViews.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) view.classList.add('active');
        });
        
        // Auto pause camera if moving away from scanner tab
        if (targetId !== 'view-scanner' && isScanning) {
            stopScanning();
        }
    });
});

function updatePeriodInfo() {
    const data = invoicePeriods[currentPeriod];
    infoSuper.innerText = data.super;
    infoSpecial.innerText = data.special;
    infoFirst.innerText = data.first.join('、');
    infoAdditional.innerText = data.additional.length > 0 ? data.additional.join('、') : "無";
}

periodSelect.addEventListener('change', (e) => {
    currentPeriod = e.target.value;
    updatePeriodInfo();
    // 自動重新對獎 (如有結果畫面打開的狀態)
    if (!resultModal.classList.contains('hidden')) {
        let currentTestingNum = resultInvoiceNumber.innerText.replace('-', '').replace(/\*/g, '');
        if(currentTestingNum.length === 10 || currentTestingNum.length === 3){
             checkInvoice(currentTestingNum, currentTestingNum.length === 3);
        }
    }
});

// ================ 虛擬鍵盤邏輯 ================
let currentInput = [];

function updateDisplay() {
    for (let i = 0; i < 3; i++) {
        const box = document.getElementById(`digit-${i}`);
        if (i < currentInput.length) {
            box.innerText = currentInput[i];
            box.classList.add('filled');
            box.classList.remove('active');
        } else if (i === currentInput.length) {
            box.innerText = '';
            box.classList.remove('filled');
            box.classList.add('active');
        } else {
            box.innerText = '';
            box.classList.remove('filled', 'active');
        }
    }
}

function handleKeyInput(key) {
    if (!resultModal.classList.contains('hidden')) {
        if (key === 'Enter' || key === 'enter') resetToInput();
        return;
    }
    
    if (key >= '0' && key <= '9') {
        if (currentInput.length < 3) {
            currentInput.push(key);
            updateDisplay();
            if (currentInput.length === 3) {
                checkInvoice(currentInput.join(''), true);
            }
        }
    } else if (key === 'backspace' || key === 'Backspace') {
        if (currentInput.length > 0) {
            currentInput.pop();
            updateDisplay();
        }
    } else if (key === 'clear') {
        currentInput = [];
        updateDisplay();
    }
}

document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        handleKeyInput(e.target.dataset.key);
    });
});

document.addEventListener('keydown', (e) => {
    // Check if modal open or keypad active to prevent interrupting select forms
    if (!resultModal.classList.contains('hidden') || document.getElementById('view-keypad').classList.contains('active')) {
        if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace' || e.key === 'Enter') {
            if (e.key === 'Backspace') e.preventDefault();
            handleKeyInput(e.key);
            
            let queryKey = e.key;
            if(e.key === 'Enter') queryKey = 'enter';
            if(e.key === 'Backspace') queryKey = 'clear';
            const btn = document.querySelector(`.key-btn[data-key="${queryKey}"]`);
            if(btn) {
                btn.classList.add('pressed');
                setTimeout(() => btn.classList.remove('pressed'), 150);
            }
        }
    }
});

function resetToInput() {
    resultModal.classList.add('hidden');
    currentInput = [];
    updateDisplay();
}
resetBtn.addEventListener('click', resetToInput);

// ================ 相機與掃描邏輯 ================
function initScanner() {
    html5QrCode = new Html5Qrcode("reader");
}

startBtn.addEventListener('click', startScanning);
stopBtn.addEventListener('click', stopScanning);

function startScanning() {
    if (!html5QrCode) initScanner();
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .then(() => {
            isScanning = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            cameraStatus.textContent = '掃描中';
            cameraStatus.classList.add('active');
            scanOverlay.style.display = 'block';
        })
        .catch(err => {
            console.error("掃描啟動失敗", err);
            alert("相機啟動失敗，請確認相機權限。\n錯誤: " + err);
        });
}

function stopScanning() {
    if (html5QrCode && isScanning) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            cameraStatus.textContent = '未啟動';
            cameraStatus.classList.remove('active');
            scanOverlay.style.display = 'none';
        }).catch(err => console.error("停止失敗", err));
    }
}

let lastScannedCode = "";
let scanCooldown = false;

function onScanSuccess(decodedText) {
    if (!resultModal.classList.contains('hidden')) return;
    if (scanCooldown || decodedText === lastScannedCode) return;
    
    lastScannedCode = decodedText;
    scanCooldown = true;
    setTimeout(() => { scanCooldown = false; lastScannedCode = ""; }, 2500);

    if (decodedText.length >= 10 && /^[A-Z]{2}\d{8}/.test(decodedText)) {
        const invNumber = decodedText.substring(0, 10);
        checkInvoice(invNumber, false);
    } else {
        showToast("掃描失敗：非有效條碼", "lose");
    }
}

// ================ 核心對獎與 Web Audio API ================
const AudioContextContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextContext();

function playTone(freq, type, duration, startTime) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function playSound(isWin) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (isWin) {
        playTone(523.25, 'sine', 0.2, now);
        playTone(659.25, 'sine', 0.2, now + 0.1);
        playTone(783.99, 'sine', 0.2, now + 0.2);
        playTone(1046.50, 'sine', 0.6, now + 0.3);
    } else {
        playTone(392.00, 'triangle', 0.4, now);
        playTone(370.00, 'triangle', 0.4, now + 0.3);
        playTone(349.23, 'triangle', 0.4, now + 0.6);
        playTone(329.63, 'sawtooth', 1.0, now + 0.9);
    }
}

function checkInvoice(invoiceStr, isManual3Digits = false) {
    const periodData = invoicePeriods[currentPeriod];
    let numStr = isManual3Digits ? invoiceStr : invoiceStr.substring(2, 10);
    
    resultInvoiceNumber.innerText = isManual3Digits ? `***-**${numStr}` : `${invoiceStr.substring(0,2)}-${numStr}`;
    resultPeriod.innerText = periodData.name;
    
    let winLevel = -1;
    let winAmount = 0;
    let winName = "未中獎";
    let possibleBigPrize = false;

    if (isManual3Digits) {
        let matched6th = false;
        for (let first of periodData.first) { if (first.endsWith(numStr)) matched6th = true; }
        for (let add of periodData.additional) { if (add === numStr) matched6th = true; }
        if (periodData.super.endsWith(numStr) || periodData.special.endsWith(numStr)) { possibleBigPrize = true; }
        
        if (matched6th) { winLevel = 7; winName = "至少中六獎"; winAmount = "200+ (請核對完整號碼)"; }
        else if (possibleBigPrize) { winLevel = 1; winName = "可能中大獎"; winAmount = "請核對完整號碼"; }
    } else {
        if (numStr === periodData.super) { winLevel = 0; winName = "特別獎"; winAmount = "10,000,000"; }
        else if (numStr === periodData.special) { winLevel = 1; winName = "特獎"; winAmount = "2,000,000"; }
        else {
            const prizeAmounts = ["200,000", "40,000", "10,000", "4,000", "1,000", "200"];
            const prizeNames = ["頭獎", "二獎", "三獎", "四獎", "五獎", "六獎"];
            for (let first of periodData.first) {
                for (let matchLen = 8; matchLen >= 3; matchLen--) {
                    const tailStr = first.substring(8 - matchLen);
                    if (numStr.endsWith(tailStr)) {
                        const level = 2 + (8 - matchLen);
                        if (winLevel === -1 || level < winLevel) {
                            winLevel = level; winAmount = prizeAmounts[level - 2]; winName = prizeNames[level - 2];
                        }
                    }
                }
            }
            if (winLevel === -1 || winLevel > 7) {
                for (let add of periodData.additional) {
                    if (numStr.endsWith(add)) { winLevel = 7; winName = "增開六獎"; winAmount = "200"; }
                }
            }
        }
    }
    
    // Update UI overlay class (Bottom Sheet View)
    prizeInfoCard.classList.remove('win', 'lose');
    if (winLevel >= 0) {
        prizeInfoCard.classList.add('win');
        prizeStatus.innerText = "恭喜中獎！";
        prizeName.innerText = winName;
        prizeAmount.innerText = winAmount.includes('NT$') ? winAmount : `NT$ ${winAmount}`;
        playSound(true);
        resultModal.classList.remove('hidden');
    } else {
        playSound(false);
        showToast("❌ 未中獎：" + (isManual3Digits ? currentInput.join('') : numStr), "lose");
        if (isManual3Digits) {
            currentInput = [];
            updateDisplay();
        }
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fadeOut');
        toast.addEventListener('animationend', () => toast.remove());
    }, 1500);
}

// 初始化
initApp();

function initApp() {
    updatePeriodInfo();
    updateDisplay();
}
