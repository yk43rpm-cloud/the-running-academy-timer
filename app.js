// 【重要】あなたのFirebaseコンソールに表示された設定（Config）をここに貼り付けます
// もし分からなければ、一旦このままで大丈夫です！
const firebaseConfig = {
    apiKey: "ここにAPIキーを入れます",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234:web:abcd"
};

// Firebaseの機能を読み込む（CDNという仕組みを使って直接繋ぎます）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 画面の要素（ボタンやタイマー文字）を取得
const startBtn = document.getElementById('start-btn');
const mainTimer = document.getElementById('main-timer');
const statusBadge = document.getElementById('status-badge');

let startTime = null;
let timerInterval = null;

// --- 🌟 1. 誰かが「一斉スタート」を押した時の処理 ---
startBtn.addEventListener('click', async () => {
    const now = Date.now(); // 現在の時刻（ミリ秒）を取得
    
    // Firebaseの「race/current」という場所にスタート時間を書き込む
    // これにより、すべての保護者のスマホに同時にスタート時間が送られます
    await setDoc(doc(db, "race", "current"), {
        startTime: now,
        status: "running"
    });
});

// --- 🌟 2. Firebaseの動きをリアルタイムで監視する処理 ---
// 別の保護者がスタートを押しても、一瞬で自分のスマホのタイマーが動き出します
onSnapshot(doc(db, "race", "current"), (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (data.status === "running") {
            startTime = data.startTime;
            statusBadge.innerText = "計測中";
            statusBadge.style.backgroundColor = "#ff4757"; // 赤色に
            
            // タイマーの表示更新を開始（10ミリ秒ごと）
            clearInterval(timerInterval);
            timerInterval = setInterval(updateTimer, 10);
        }
    }
});

// 画面のタイマーの数字を動かす関数
function updateTimer() {
    if (!startTime) return;
    const diff = Date.now() - startTime;
    mainTimer.innerText = formatTime(diff);
}

// ミリ秒を 「00:14.25」 のような陸上タイムの形式に変換するお助け関数
function formatTime(ms) {
    if (ms < 0) return "00:00.00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    
    const minStr = String(minutes).padStart(2, '0');
    const secStr = String(seconds).padStart(2, '0');
    const milStr = String(milliseconds).padStart(2, '0');
    
    return `${minStr}:${secStr}.${milStr}`;
}

// --- 🌟 3. 各選手の「ゴール」ボタンを押した時の処理 ---
// window.recordLap と書くことで、HTML側から呼び出せるようになります
window.recordLap = async function(runnerName) {
    if (!startTime) {
        alert("まだスタートしていません！");
        return;
    }
    
    const clickTime = Date.now();
    const timeDiff = clickTime - startTime; // 引き算で正確なタイムを計算！
    const formattedTime = formatTime(timeDiff);
    
    // 自分の画面にタイムを表示
    document.getElementById(`time-${runnerName}`).innerText = formattedTime;
    
    // 【未来への拡張】ここにFirebaseへ保存するコードを書けば、全員の画面にタイムが共有されます！
    console.log(`${runnerName}のタイム: ${formattedTime}`);
};