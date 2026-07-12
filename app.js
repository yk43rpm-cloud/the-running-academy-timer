let startTime = 0;
let timerInterval = null;
let isRunning = false;
let isCountingDown = false;

// 選手データを管理する配列
let runners = [];

// 初期化：保存された名前があれば読み込み、なければ初期メンバーを登録
const savedRunners = localStorage.getItem('running_runners_v2');
if (savedRunners) {
    runners = JSON.parse(savedRunners);
} else {
    runners = [
        { id: 'R1', name: '選手 A', lapCount: 0, lastTime: 0, laps: [] },
        { id: 'R2', name: '選手 B', lapCount: 0, lastTime: 0, laps: [] },
        { id: 'R3', name: '選手 C', lapCount: 0, lastTime: 0, laps: [] }
    ];
}

const mainTimerDisplay = document.getElementById('main-timer');
const startBtn = document.getElementById('start-btn');
const countdownText = document.getElementById('countdown-text');
const pendingList = document.getElementById('pending-list');
const runnersContainer = document.getElementById('runners-container');
const newRunnerNameInput = document.getElementById('new-runner-name');

// 保存関数
function saveRunnersToStorage() {
    localStorage.setItem('running_runners_v2', JSON.stringify(runners));
}

// バイブレーション機能
function triggerVibration() {
    if (navigator.vibrate) navigator.vibrate(100);
}

// 電子ブザー音再生
function playBeep(isStartSound = false) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        if (isStartSound) {
            oscillator.frequency.value = 880;
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else {
            oscillator.frequency.value = 440;
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.stop(audioCtx.currentTime + 0.1);
        }
    } catch (e) { console.log(e); }
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

function updateTimer() {
    const elapsedTime = Date.now() - startTime;
    mainTimerDisplay.textContent = formatTime(elapsedTime);
}

// 選手一覧の画面表示を更新するメイン関数
function renderRunners() {
    runnersContainer.innerHTML = '';
    runners.forEach((runner, index) => {
        const card = document.createElement('div');
        card.className = 'runner-card';
        
        const latestSplit = runner.laps.length > 0 ? runner.laps[runner.laps.length - 1].split : '--:--.--';

        card.innerHTML = `
            <div class="runner-top-row">
                <div class="runner-controls">
                    <button class="btn-ctrl" onclick="moveRunner(${index}, -1)">▲</button>
                    <button class="btn-ctrl" onclick="moveRunner(${index}, 1)">▼</button>
                    <button class="btn-ctrl btn-del" onclick="deleteRunner(${index})">× 削除</button>
                </div>
            </div>
            <div class="runner-info">
                <span class="runner-name">${runner.name} <span class="split-mini">(Split: ${latestSplit})</span></span>
                <button class="btn btn-lap" onclick="handleLapClick('${runner.id}')">ラップ記録</button>
            </div>
            <ul class="lap-list">
                ${runner.laps.map(lap => `<li>L${lap.num} | Lap: ${lap.lapTime} / Split: ${lap.split}</li>`).join('')}
            </ul>
        `;
        runnersContainer.appendChild(card);
    });
    
    // 「誰か分からんボタン」の割り振り用ボタンリストもリフレッシュするために、保留中のアイテムを再配置するための参照
    updatePendingActionButtons();
}

// 選手追加ボタン
document.getElementById('add-runner-btn').addEventListener('click', () => {
    const name = newRunnerNameInput.value.trim();
    if (!name) return;
    const newId = 'R' + Date.now();
    runners.push({ id: newId, name: name, lapCount: 0, lastTime: 0, laps: [] });
    newRunnerNameInput.value = '';
    saveRunnersToStorage();
    renderRunners();
});

// 選手削除
window.deleteRunner = function(index) {
    if (confirm(`${runners[index].name} を削除しますか？`)) {
        runners.splice(index, 1);
        saveRunnersToStorage();
        renderRunners();
    }
};

// 選手並び替え
window.moveRunner = function(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= runners.length) return;
    const temp = runners[index];
    runners[index] = runners[targetIndex];
    runners[targetIndex] = temp;
    saveRunnersToStorage();
    renderRunners();
};

// カウントダウン始動
startBtn.addEventListener('click', () => {
    if (isCountingDown) return;
    if (!isRunning) {
        isCountingDown = true;
        startBtn.textContent = '準備中...';
        startBtn.style.backgroundColor = '#ccc';
        
        // タイマーリセット、各選手記録初期化
        runners.forEach(r => {
            r.lapCount = 0;
            r.lastTime = 0;
            r.laps = [];
        });
        pendingList.innerHTML = '';
        renderRunners();

        countdownText.textContent = '🔊 On your marks...';
        setTimeout(() => {
            countdownText.textContent = '3'; playBeep(false);
            setTimeout(() => {
                countdownText.textContent = '2'; playBeep(false);
                setTimeout(() => {
                    countdownText.textContent = '1'; playBeep(false);
                    setTimeout(() => {
                        countdownText.textContent = '🏃‍♂️ START!!'; playBeep(true);
                        startTime = Date.now();
                        timerInterval = setInterval(updateTimer, 10);
                        isRunning = true;
                        isCountingDown = false;
                        startBtn.textContent = 'ストップ';
                        startBtn.style.backgroundColor = '#ff4d4d';
                    }, 1000);
                }, 1000);
            }, 1000);
        }, 3000);
    } else {
        clearInterval(timerInterval);
        isRunning = false;
        countdownText.textContent = '';
        startBtn.textContent = 'カウントダウン始動';
        startBtn.style.backgroundColor = '#007bff';
    }
});

// 各選手の通常ラップボタンが押された時の処理
window.handleLapClick = function(runnerId) {
    if (startTime === 0 || isCountingDown) return;
    triggerVibration();
    const currentTotalTimeMs = Date.now() - startTime;
    recordTimeData(runnerId, currentTotalTimeMs);
};

// 実際にデータを記録する共通ロジック
function recordTimeData(runnerId, totalTimeMs) {
    const runner = runners.find(r => r.id === runnerId);
    if (!runner) return;

    const lapTimeMs = totalTimeMs - runner.lastTime;
    runner.lastTime = totalTimeMs;

    runner.lapCount++;
    runner.laps.push({
        num: runner.lapCount,
        lapTime: formatTime(lapTimeMs),
        split: formatTime(totalTimeMs)
    });
    
    renderRunners();
}

// 誰か分からんが今ゴールボタン
document.getElementById('quick-lap-btn').addEventListener('click', () => {
    if (startTime === 0 || isCountingDown) return;
    triggerVibration();
    const currentTotalTimeMs = Date.now() - startTime;
    const timeStr = formatTime(currentTotalTimeMs);
    
    const li = document.createElement('li');
    li.className = 'pending-item';
    li.dataset.timeMs = currentTotalTimeMs;
    li.innerHTML = `<span>⏱️ ${timeStr}</span><div class="assign-btn-group"></div>`;
    pendingList.appendChild(li);
    updatePendingActionButtons();
});

// 保留リスト内の割り当てボタンを最新の選手一覧に基づいて作り直す
function updatePendingActionButtons() {
    const items = pendingList.querySelectorAll('.pending-item');
    items.forEach(item => {
        const btnGroup = item.querySelector('.assign-btn-group');
        const timeMs = parseInt(item.dataset.timeMs);
        btnGroup.innerHTML = runners.map(r => `
            <button class="assign-btn" onclick="assignPendingTime('${r.id}', ${timeMs}, this)">${r.name}</button>
        `).join('');
    });
}

// 保留タイムを選手へ割り振る
window.assignPendingTime = function(runnerId, totalTimeMs, buttonEl) {
    triggerVibration();
    recordTimeData(runnerId, totalTimeMs);
    buttonEl.closest('.pending-item').remove();
};

// Excel保存（CSVダウンロード）機能
document.getElementById('download-csv-btn').addEventListener('click', () => {
    let csvContent = "\uFEFF"; // Excelの文字化けを防ぐおまじない(BOM)
    csvContent += "選手名,ラップ数,ラップタイム,スプリットタイム\n";
    
    runners.forEach(r => {
        if (r.laps.length === 0) {
            csvContent += `"${r.name}",記録なし,,\n`;
        } else {
            r.laps.forEach(lap => {
                csvContent += `"${r.name}",L${lap.num},${lap.lapTime},${lap.split}\n`;
            });
        }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `running_records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// 最初の一回、画面を描画
renderRunners();