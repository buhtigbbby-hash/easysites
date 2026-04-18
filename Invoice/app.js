// app.js

// Dynamic periods object
let invoicePeriods = {};

let html5QrCode;
let isScanning = false;
let currentPeriod = "";

const CACHE_KEY = "invoicePeriodsCacheV4";
const FETCH_TIME_KEY = "invoiceFetchTime";
const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${url}`,
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`                 
];

function shouldFetchNewData() {
    const lastFetch = localStorage.getItem(FETCH_TIME_KEY);
    if (!lastFetch) return true;
    
    // 現在時間
    const nowUTC = new Date();
    // 轉換為台北時間 (UTC+8) 用作換算基準
    let twTime = new Date(nowUTC.getTime() + 8 * 3600000); 
    
    let y = twTime.getUTCFullYear();
    let m = twTime.getUTCMonth();
    let d = twTime.getUTCDate();
    let h = twTime.getUTCHours();
    
    // 每個月的 25號早上 6點 (台北時間) 為界
    if (d < 25 || (d === 25 && h < 6)) {
        m -= 1;
        if (m < 0) { m = 11; y -= 1; }
    }
    
    // 把目標時間轉回 UTC 的確切毫秒 (台北的25號6點 = UTC的24號22點)
    let cutoffUTC = Date.UTC(y, m, 24, 22, 0, 0, 0); 
    
    return parseInt(lastFetch, 10) < cutoffUTC;
}

async function fetchFromProxies(targetUrl) {
    for (let proxy of PROXIES) {
        try {
            const res = await fetch(proxy(targetUrl), { cache: 'no-store' });
            if (!res.ok) continue;
            const text = await res.text();
            if (text.includes("<?xml") || text.includes("<rss")) {
                return text;
            }
        } catch (e) {
            console.warn("Proxy failed:", e);
        }
    }
    throw new Error("All proxies failed");
}

function renderPeriodsData() {
    periodSelect.innerHTML = '';
    const keys = Object.keys(invoicePeriods).sort((a,b) => b.localeCompare(a)); 
    keys.forEach((periodId, index) => {
        const title = invoicePeriods[periodId].name;
        const option = document.createElement("option");
        option.value = periodId;
        option.textContent = title + (index === 0 ? " (最新)" : "");
        periodSelect.appendChild(option);
        
        if (index === 0 && !currentPeriod) currentPeriod = periodId;
    });
    if(!currentPeriod && keys.length > 0) currentPeriod = keys[0];
    periodSelect.value = currentPeriod;
    updatePeriodInfo();
}

async function fetchInvoicePeriods() {
    if (!shouldFetchNewData()) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            invoicePeriods = JSON.parse(cached);
            renderPeriodsData();
            return; // 提早結束，完美利用快取
        }
    }
    
    try {
        periodSelect.innerHTML = '<option value="">網路連線載入中...</option>';
        const xmlText = await fetchFromProxies("https://invoice.etax.nat.gov.tw/invoice.xml");
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        const items = Array.from(xmlDoc.querySelectorAll("item")).slice(0, 2);
        
        invoicePeriods = {};
        
        items.forEach((item) => {
            const title = item.querySelector("title").textContent.trim();
            const link = item.querySelector("link").textContent.trim();
            const periodId = link.split("_")[1] || title.replace(/\D/g, '').substring(0, 5); 
            const desc = item.querySelector("description").textContent;
            
            const superMatches = desc.match(/特別獎：(\d{8})/);
            const specialMatches = desc.match(/特獎：(\d{8})/);
            const firstMatches = desc.match(/頭獎：([\d、]+)/);
            const addMatches = desc.match(/增開六獎：([\d、]+)/);
            
            invoicePeriods[periodId] = {
                name: title,
                super: superMatches ? superMatches[1] : "",
                special: specialMatches ? specialMatches[1] : "",
                first: firstMatches ? firstMatches[1].split("、") : [],
                additional: addMatches ? addMatches[1].split("、") : []
            };
        });
        
        localStorage.setItem(CACHE_KEY, JSON.stringify(invoicePeriods));
        localStorage.setItem(FETCH_TIME_KEY, Date.now().toString());
        currentPeriod = ""; 
        
        renderPeriodsData();
        
    } catch (err) {
        console.error("Fetch invoice data failed:", err);
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            showToast("網路異常，目前顯示離線快取號碼", "info");
            invoicePeriods = JSON.parse(cached);
            renderPeriodsData();
        } else {
            showToast("錯誤：無法載入最新資料，請檢查網路", "lose");
            periodSelect.innerHTML = '<option value="">請檢查網路或稍後再試</option>';
        }
    }
}

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const periodSelect = document.getElementById('period-select');
const cameraStatus = document.getElementById('camera-status');
const scanOverlay = document.querySelector('.scanner-overlay');
const resultCard = document.getElementById('result-card');
const scannerSection = document.getElementById('scanner-section');
const manualSection = document.getElementById('manual-section');
const actionWrapper = document.getElementById('action-wrapper');
const nextScanBtn = document.getElementById('next-scan-btn');

const resultInvoiceNumber = document.getElementById('result-invoice-number');
const resultPeriod = document.getElementById('result-period');
const prizeDisplay = document.getElementById('prize-display');
const prizeStatus = document.getElementById('prize-status');
const prizeName = document.getElementById('prize-name');
const prizeAmount = document.getElementById('prize-amount');

// Period Info Elements
const infoSuper = document.getElementById('info-super');
const infoSpecial = document.getElementById('info-special');
const infoFirst = document.getElementById('info-first');
const infoAdditional = document.getElementById('info-additional');

// MOF Link Element
const mofLink = document.getElementById('mof-link');

function updatePeriodInfo() {
    if (!currentPeriod || !invoicePeriods[currentPeriod]) return;
    const data = invoicePeriods[currentPeriod];
    infoSuper.innerText = data.super || "-";
    infoSpecial.innerText = data.special || "-";
    infoFirst.innerText = (data.first && data.first.length > 0) ? data.first.join('、') : "-";
    infoAdditional.innerText = (data.additional && data.additional.length > 0) ? data.additional.join('、') : "無";
}

function initApp() {
    fetchInvoicePeriods();
    updateDisplay();
}

function initScanner() {
    html5QrCode = new Html5Qrcode("reader");
}

periodSelect.addEventListener('change', (e) => {
    currentPeriod = e.target.value;
    updatePeriodInfo();
    // 自動重新對獎 (如有畫面)
    if (!resultCard.classList.contains('hidden')) {
        checkInvoice(resultInvoiceNumber.innerText.replace('-', '').replace('*', ''));
    }
});

startBtn.addEventListener('click', startScanning);
stopBtn.addEventListener('click', stopScanning);

nextScanBtn.addEventListener('click', resetToInput);

// ================ 虛擬與實體鍵盤邏輯 ================
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
    if (!resultCard.classList.contains('hidden')) {
        if (key === 'Enter' || key === 'enter') resetToInput();
        return;
    }
    
    if (key >= '0' && key <= '9') {
        if (currentInput.length < 3) {
            currentInput.push(key);
            updateDisplay();
            if (currentInput.length === 3) {
                doManualCheck();
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

// UI Key buttons
document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        handleKeyInput(e.target.dataset.key);
    });
});

// Physical Keyboard binding
document.addEventListener('keydown', (e) => {
    // 過濾出我們要的按鍵 (不防礙 F5/Ctrl+R)
    if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace' || e.key === 'Enter') {
        // 防止 backspace 上一頁
        if (e.key === 'Backspace') {
            e.preventDefault();
        }
        
        handleKeyInput(e.key);
        
        // 視覺按壓回饋
        let queryKey = e.key;
        if(e.key === 'Enter') queryKey = 'enter';
        if(e.key === 'Backspace') queryKey = 'clear';
        const btn = document.querySelector(`.key-btn[data-key="${queryKey}"]`);
        if(btn) {
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 150);
        }
    }
});

function doManualCheck() {
    const input3 = currentInput.join('');
    if (input3.length !== 3) return;
    
    let matchedResults = [];
    
    for (const periodId in invoicePeriods) {
        const periodData = invoicePeriods[periodId];
        let matched6th = false;
        let possibleBigPrize = false;
        
        for (let first of periodData.first) { if (first.endsWith(input3)) matched6th = true; }
        for (let add of periodData.additional) { if (add === input3) matched6th = true; }
        if (periodData.super.endsWith(input3) || periodData.special.endsWith(input3)) possibleBigPrize = true;
        
        if (possibleBigPrize) {
            matchedResults.push({ periodData, winLevel: 1, winName: "可能中大獎", winAmount: "核對完整號碼" });
        } else if (matched6th) {
            matchedResults.push({ periodData, winLevel: 7, winName: "至少中六獎", winAmount: "200+" });
        }
    }
    
    if (matchedResults.length > 0) {
        actionWrapper.style.display = 'none';
        resultCard.classList.remove('hidden');
        resultInvoiceNumber.innerText = `***-**${input3}`;
        
        matchedResults.sort((a,b) => a.winLevel - b.winLevel);
        const bestMatch = matchedResults[0];
        
        const shortNames = matchedResults.map(m => `${m.periodData.name.substring(4)}(${m.winName})`).join('、');
        resultPeriod.innerText = matchedResults.length > 1 ? `2期內可能為: ${shortNames}` : bestMatch.periodData.name;
        
        updateResultUI(bestMatch.winLevel, bestMatch.winName, bestMatch.winAmount);
    } else {
        playSound(false);
        showToast("❌ 2期內皆未中獎：" + input3, "lose");
        currentInput = [];
        updateDisplay();
    }
}

function resetToInput() {
    resultCard.classList.add('hidden');
    actionWrapper.style.display = 'flex';
    
    // Clear Input
    currentInput = [];
    updateDisplay();
}

// ================ 相機與對獎 ================
function startScanning() {
    if (!html5QrCode) initScanner();
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    resultCard.classList.add('hidden');
    
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .then(() => {
            isScanning = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            cameraStatus.textContent = '相機掃描中';
            cameraStatus.classList.add('active');
            scanOverlay.style.display = 'block';
        })
        .catch(err => {
            console.error("掃描啟動失敗", err);
            alert("無法啟動相機，請確認是否給予相機權限。\n錯誤訊息: " + err);
        });
}

function stopScanning() {
    if (html5QrCode && isScanning) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            startBtn.style.display = 'flex';
            startBtn.innerText = '啟動相機';
            stopBtn.style.display = 'none';
            cameraStatus.textContent = '相機未開啟';
            cameraStatus.classList.remove('active');
            scanOverlay.style.display = 'none';
        }).catch(err => {
            console.error("停止相機失敗", err);
        });
    }
}

let lastScannedCode = "";
let scanCooldown = false;

function onScanSuccess(decodedText) {
    if (!resultCard.classList.contains('hidden')) return; // 當有中獎畫面擋住時，暫停處理新掃描
    if (scanCooldown || decodedText === lastScannedCode) return; // 冷卻防抖
    
    lastScannedCode = decodedText;
    scanCooldown = true;
    setTimeout(() => { scanCooldown = false; lastScannedCode = ""; }, 2500);

    if (decodedText.length >= 10 && /^[A-Z]{2}\d{8}/.test(decodedText)) {
        const invNumber = decodedText.substring(0, 10);
        checkInvoice(invNumber);
    } else {
        showToast("掃描失敗：非有效條碼", "lose");
    }
}

function checkInvoice(invoiceStr) {
    const letters = invoiceStr.substring(0, 2);
    const numStr = invoiceStr.substring(2, 10);
    
    resultInvoiceNumber.innerText = `${letters}-${numStr}`;
    
    let matchedResults = [];
    const prizeAmounts = ["200,000", "40,000", "10,000", "4,000", "1,000", "200"];
    const prizeNames = ["頭獎", "二獎", "三獎", "四獎", "五獎", "六獎"];
    
    for (const periodId in invoicePeriods) {
        const periodData = invoicePeriods[periodId];
        let winLevel = -1;
        let winAmount = 0;
        let winName = "未中獎";
        
        if (numStr === periodData.super) {
            winLevel = 0; winName = "特別獎"; winAmount = "10,000,000";
        }
        else if (numStr === periodData.special) {
            winLevel = 1; winName = "特獎"; winAmount = "2,000,000";
        }
        else {
            for (let first of periodData.first) {
                for (let matchLen = 8; matchLen >= 3; matchLen--) {
                    const tailStr = first.substring(8 - matchLen);
                    if (numStr.endsWith(tailStr)) {
                        const level = 2 + (8 - matchLen);
                        if (winLevel === -1 || level < winLevel) {
                            winLevel = level;
                            winAmount = prizeAmounts[level - 2];
                            winName = prizeNames[level - 2];
                        }
                    }
                }
            }
            if (winLevel === -1 || winLevel > 7) {
                for (let add of periodData.additional) {
                    if (numStr.endsWith(add)) {
                        winLevel = 7; winName = "增開六獎"; winAmount = "200";
                    }
                }
            }
        }
        if (winLevel >= 0) {
            matchedResults.push({ periodData, winLevel, winName, winAmount });
        }
    }
    
    if (matchedResults.length > 0) {
        matchedResults.sort((a,b) => a.winLevel - b.winLevel);
        const bestMatch = matchedResults[0];
        
        const shortNames = matchedResults.map(m => `${m.periodData.name.substring(4)}(${m.winName})`).join('、');
        resultPeriod.innerText = matchedResults.length > 1 ? `2期內可能為: ${shortNames}` : bestMatch.periodData.name;
        
        actionWrapper.style.display = 'none';
        resultCard.classList.remove('hidden');
        updateResultUI(bestMatch.winLevel, bestMatch.winName, bestMatch.winAmount);
    } else {
        playSound(false);
        showToast("❌ 2期內皆未中獎：" + numStr, "lose");
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

// ================ 音效產生器 (Web Audio API) ================
const AudioContextContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextContext();

function playTone(freq, type, duration, startTime) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.05); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function playSound(isWin) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    
    if (isWin) {
        // 中獎：歡呼琶音 (C Major Arpeggio Tada)
        playTone(523.25, 'sine', 0.2, now);        // C5
        playTone(659.25, 'sine', 0.2, now + 0.1);  // E5
        playTone(783.99, 'sine', 0.2, now + 0.2);  // G5
        playTone(1046.50, 'sine', 0.6, now + 0.3); // C6
    } else {
        // 未中獎：失落音效 (Womp Womp)
        playTone(392.00, 'triangle', 0.4, now);       // G4
        playTone(370.00, 'triangle', 0.4, now + 0.3); // Gb4
        playTone(349.23, 'triangle', 0.4, now + 0.6); // F4
        playTone(329.63, 'sawtooth', 1.0, now + 0.9); // E4
    }
}

function updateResultUI(winLevel, winName, winAmount) {
    prizeDisplay.classList.remove('win', 'lose');
    
    if (winLevel >= 0) {
        prizeDisplay.classList.add('win');
        prizeStatus.innerText = "恭喜中獎！";
        prizeName.innerText = winName;
        prizeAmount.innerText = `NT$ ${winAmount}`;
        playSound(true);
    } else {
        prizeDisplay.classList.add('lose');
        prizeStatus.innerText = "下次再努力...";
        prizeName.innerText = "未中獎";
        prizeAmount.innerText = "運氣累積中";
        playSound(false);
    }
}

initApp();
