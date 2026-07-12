import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ====== ⚠️ あなたの Firebase 設定に書き換えてください ======
const firebaseConfig = {
    apiKey: "AIzaSy...", 
    authDomain: "the-running-academy-timer.firebaseapp.com",
    databaseURL: "https://the-running-academy-timer-default-rtdb.firebaseio.com",
    projectId: "the-running-academy-timer",
    storageBucket: "the-running-academy-timer.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 管理用変数
let timerInterval = null;
let startTime = 0;
let elapsedTime = 0;
let isRunning = false;
let currentRunners = [];

// --- タイマー同期ロジック ---
function initTimerSync() {
    onValue(ref(db, "timer"), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            isRunning = data.isRunning;
            startTime = data.startTime;
            elapsedTime = data.elapsedTime;
            
            if (isRunning) {
                document.getElementById("startBtn").classList.add("hidden");
                document.getElementById("stopBtn").classList.remove("hidden");
                if (!timerInterval) timerInterval = setInterval(updateDisplay, 10);
            } else {
                document.getElementById("startBtn").classList.remove("hidden");
                document.getElementById("stopBtn").classList.add("hidden");
                if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
                updateDisplay();
            }
        }
    });
}

function updateDisplay() {
    let time = elapsedTime;
    if (isRunning) time = Date.now() - startTime + elapsedTime;
    const ms = Math.floor((time % 1000) / 10);
    const s = Math.floor((time / 1000) % 60);
    const m = Math.floor((time / 60000) % 60);
    document.getElementById("stopwatchDisplay").innerText = 
        `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

window.startTimer = function() {
    if (!isRunning) {
        set(ref(db, "timer"), { isRunning: true, startTime: Date.now(), elapsedTime: elapsedTime });
    }
};

window.stopTimer = function() {
    if (isRunning) {
        set(ref(db, "timer"), { isRunning: false, startTime: 0, elapsedTime: Date.now() - startTime + elapsedTime });
    }
};

window.resetTimer = function() {
    if (confirm("タイマー、選手リスト、すべてのラップ記録を完全にリセットしますか？")) {
        set(ref(db, "timer"), { isRunning: false, startTime: 0, elapsedTime: 0 });
        set(ref(db, "runners"), null);
        set(ref(db, "records"), null);
    }
};

// --- 選手名管理（追加・削除）の同期 ---
function initRunnersSync() {
    onValue(ref(db, "runners"), (snapshot) => {
        const data = snapshot.val() || {};
        currentRunners = Object.keys(data).map(key => ({ id: key, name: data[key].name }));
        
        // 管理用リストの描画
        const manageList = document.getElementById("runnerManageList");
        manageList.innerHTML = "";
        
        // 計測用ボタンの描画
        const btnContainer = document.getElementById("runnerButtons");
        btnContainer.innerHTML = "";

        currentRunners.forEach(runner => {
            // 管理画面のリスト（削除ボタン付き）
            const li = document.createElement("li");
            li.className = "runner-manage-item";
            li.innerHTML = `<span>${runner.name}</span><button class="btn-delete-runner" onclick="deleteRunner('${runner.id}', '${runner.name}')">×</button>`;
            manageList.appendChild(li);

            // 計測用の個別タップボタン
            const btn = document.createElement("button");
            btn.className = "runner-tap-btn";
            btn.innerText = runner.name;
            btn.onclick = () => recordRunnerLap(runner.name);
            btnContainer.appendChild(btn);
        });

        // 選手リストが変わったら、表示カードの枠組みも更新する
        updateRecordsDisplay();
    });
}

window.addRunner = function() {
    const input = document.getElementById("newRunnerName");
    const name = input.value.trim();
    if (!name) return;
    const newRunnerRef = push(ref(db, "runners"));
    set(newRunnerRef, { name: name }).then(() => { input.value = ""; });
};

window.deleteRunner = function(id, name) {
    if (confirm(`${name} 選手を削除しますか？ (※これまでのラップ記録も削除されます)`)) {
        set(ref(db, `runners/${id}`), null);
        set(ref(db, `records/${name}`), null); // 選手個別の記録もリセット
    }
};

// --- 🌟 選手個別ラップ記録ロジック (直前ラップ自動計算) ---
window.recordRunnerLap = function(runnerName) {
    if (!isRunning && elapsedTime === 0) {
        alert("タイマーがスタートしていません");
        return;
    }
    
    let currentTotalTime = elapsedTime;
    if (isRunning) currentTotalTime = Date.now() - startTime + elapsedTime;

    const runnerRecordRef = ref(db, `records/${runnerName}`);
    
    runTransaction(runnerRecordRef, (currentData) => {
        if (!currentData) { currentData = { laps: [] }; }
        if (!currentData.laps) { currentData.laps = []; }
        
        const lapCount = currentData.laps.length + 1;
        let lastTotal = 0;
        
        // 配列の先頭[0]に最新データが入る設計にするため、前回の総タイムは[0]から取得
        if (currentData.laps.length > 0) {
            lastTotal = currentData.laps[0].totalTime;
        }
        
        // 🌟 ここで「今回の通過タイム」から「前回の通過タイム」を引いて、その人独自の直前ラップを計算！
        const lapTime = currentTotalTime - lastTotal;
        
        // 配列の「先頭」に新しい記録を突っ込む（画面で最新が一番上に来るようにするため）
        currentData.laps.unshift({
            lapNum: lapCount,
            lapTime: lapTime,
            totalTime: currentTotalTime,
            formattedLap: formatTime(lapTime),
            formattedTotal: formatTime(currentTotalTime)
        });
        
        return currentData;
    });
};

// --- 選手別カードの表示同期 ---
function updateRecordsDisplay() {
    // 選手データと「不明枠」をリアルタイム監視
    onValue(ref(db, "records"), (snapshot) => {
        const container = document.getElementById("recordsContainer");
        container.innerHTML = "";
        const data = snapshot.val() || {};
        
        // 登録されている選手名 + 「不明枠」を並べるリストを作成
        const displayNames = [...currentRunners.map(r => r.name), "（誰か不明・タイムのみ）"];
        
        displayNames.forEach(name => {
            const runnerData = data[name] || { laps: [] };
            
            const card = document.createElement("div");
            card.className = "runner-card";
            if (name === "（誰か不明・タイムのみ）") card.classList.add("unknown-card");
            
            let html = `<h3>${name}</h3>`;
            html += `<ul class="lap-list">`;
            
            if (runnerData.laps && runnerData.laps.length > 0) {
                runnerData.laps.forEach(lap => {
                    html += `<li>
                        <span>周回 ${lap.lapNum}</span>
                        <span>ラップ: <strong>${lap.formattedLap}</strong> (計 ${lap.formattedTotal})</span>
                    </li>`;
                });
            } else {
                html += `<li style="color:#aaa; border:none;">記録なし</li>`;
            }
            
            html += `</ul>`;
            card.innerHTML = html;
            container.appendChild(card);
        });
    });
}

function formatTime(time) {
    const ms = Math.floor((time % 1000) / 10);
    const s = Math.floor((time / 1000) % 60);
    const m = Math.floor((time / 60000) % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// 初期起動
initTimerSync();
initRunnersSync();