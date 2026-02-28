'use strict';

// ===== 定数 =====
const MAX_ANGLE   = 25;   // 鐘の最大角度（度）
const SHARE_URL   = 'https://gzer0-dev.github.io/joya/';

// 連続数ごとの成功ウィンドウ（角度）: max(2, 20 - combo * 0.85)
// combo0: 20°, combo5: 15.75°, combo10: 11.5°, combo15: 7.25°, combo21: 2.15°, combo22+: 2°
function getSuccessWindow(combo) {
  return Math.max(2, 20 - combo * 0.85);
}

// 周期: 固定2秒（スコアの爆発感が楽しさのため、速度変化なし）
const BELL_PERIOD = 2.0;

// 視覚レベル (0〜4)
function getLevel(combo) {
  if (combo < 3)  return 0;
  if (combo < 6)  return 1;
  if (combo < 10) return 2;
  if (combo < 15) return 3;
  return 4;
}

// ランク（コンボ数で判定）
function getRank(combo) {
  if (combo >= 18) return 'SS';
  if (combo >= 13) return 'S';
  if (combo >= 10) return 'A';
  if (combo >= 7)  return 'B';
  if (combo >= 4)  return 'C';
  return 'D';
}

// 判定ラベル（成功した場合の飾り文字）
function getHitLabel(absAngle) {
  if (absAngle <= 3)  return { text: 'PERFECT!!', color: '#ff4cf4' };
  if (absAngle <= 8)  return { text: 'GREAT!',    color: '#4cf4ff' };
  return                     { text: 'GOOD',       color: '#4cff88' };
}

// 次の退散数（2^combo、comboはヒット後の値）
function calcBonnoGain(combo) {
  return Math.pow(2, combo - 1);
}

// タイミングバー背景グラデーション
function buildBarGradient(combo) {
  const win  = getSuccessWindow(combo);
  const lp   = ((25 - win) / 50) * 100;   // 左端%
  const rp   = ((25 + win) / 50) * 100;   // 右端%
  const danger = 'rgba(160,20,0,0.55)';
  const safe   = 'rgba(200,160,0,0.45)';
  return `linear-gradient(to right, ${danger} 0%, ${danger} ${lp}%, ${safe} ${lp}%, ${safe} ${rp}%, ${danger} ${rp}%, ${danger} 100%)`;
}

// 次のボーナス表示
function buildNextBonus(combo) {
  const next = calcBonnoGain(combo + 1);
  return `次: +${next.toLocaleString()}`;
}

const BONNO_LIST = [
  '嫉妬','怒り','貪欲','無知','傲慢','猜疑','執着','怠慢',
  '嘘','恨み','後悔','焦り','羨望','暴食','恐怖','絶望',
  '妄想','欲望','憎悪','不安','怨念','自惚れ','懶惰','色欲',
  '強欲','愚痴','偏見','迷い','驕り','苦悩','虚栄','孤独',
  'SNS依存','いいね欲しい','スマホ中毒','ネット炎上','バズりたい',
  'フォロワー数自慢','課金衝動','エナドリ飲み過ぎ','徹夜ゲーム',
  '推し課金','匿名煽り','リプ乞食','ストーリー監視','タイムライン中毒',
  '承認欲求','炎上見物','出前依存','Netflixイッキ見','サブスク乱立',
  '積みゲー','積ん読','朝活詐欺','ダイエット先延ばし','二度寝',
  '残業自慢','マウント取り','古参アピール','VTuber推し','ガチャ依存',
  'ランキング執着','ブランド依存','見栄','他責思考','自己嫌悪',
  '完璧主義','比較癖','睡眠不足自慢','現実逃避','将来が怖い',
  '無計画な衝動買い','既読無視する','約束を忘れる','時間を守らない',
  '断れない','優柔不断','気が短い','プライドが高い','頑固',
  'おせっかい','心配しすぎ','依存体質','ネガティブ思考','自己中',
];

// ===== ゲーム状態 =====
let state = {
  phase: 'start',
  angle: 0,
  elapsed: 0,
  lastTime: null,
  rafId: null,
  combo: 0,
  bonnoTotal: 0,   // 退散した煩悩の総数（スコア）
  lastBonno: '',
  highScore: 0,
};

// ===== DOM =====
const screens = {
  start:  document.getElementById('screen-start'),
  game:   document.getElementById('screen-game'),
  result: document.getElementById('screen-result'),
};
const els = {
  scoreDisplay:     document.getElementById('score-display'),
  comboDisplay:     document.getElementById('combo-display'),
  highscoreDisplay: document.getElementById('highscore-display'),
  bonnoName:        document.getElementById('bonno-name'),
  bellWrapper:      document.getElementById('bell-wrapper'),
  bellImg:          document.getElementById('bell-img'),
  judgmentText:     document.getElementById('judgment-text'),
  timingPointer:    document.getElementById('timing-pointer'),
  timingBar:        document.getElementById('timing-bar'),
  timingReq:        document.getElementById('timing-req'),
  nextBonus:        document.getElementById('next-bonus'),
  particleContainer: document.getElementById('particle-container'),
  btnStart:         document.getElementById('btn-start'),
  btnHit:           document.getElementById('btn-hit'),
  btnReplay:        document.getElementById('btn-replay'),
  btnShare:         document.getElementById('btn-share'),
  startHighscore:   document.getElementById('start-highscore'),
  resultTitle:      document.getElementById('result-title'),
  resultRank:       document.getElementById('result-rank'),
  resultScore:      document.getElementById('result-score'),
  resultMaxCombo:   document.getElementById('result-max-combo'),
  resultLastBonno:  document.getElementById('result-last-bonno'),
  newRecord:        document.getElementById('new-record'),
  resultHighscore:  document.getElementById('result-highscore'),
  confettiContainer: document.getElementById('confetti-container'),
};

// ===== Web Audio =====
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBellSound(isSuccess, absAngle) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (!isSuccess) {
      // ミス: 低くこもった鐘
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      og.gain.setValueAtTime(0.4, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(og); og.connect(gain);
      osc.start(now); osc.stop(now + 0.8);
      return;
    }

    const baseFreq = absAngle <= 3 ? 220 : absAngle <= 8 ? 200 : 180;
    const decayTime = absAngle <= 3 ? 3.0 : absAngle <= 8 ? 2.0 : 1.2;
    const partials   = [1, 2.756, 5.404, 8.933];
    const amplitudes = [1, 0.5, 0.25, 0.12];

    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const og  = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);
      og.gain.setValueAtTime(amplitudes[i] * 0.4, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + decayTime);
      osc.connect(og); og.connect(gain);
      osc.start(now); osc.stop(now + decayTime);
    });
  } catch (e) { /* AudioContext 未対応 */ }
}

// ===== ハイスコア =====
function loadHighScore() {
  return parseInt(localStorage.getItem('joya_hs2') || '0', 10);
}
function saveHighScore(s) {
  localStorage.setItem('joya_hs2', String(s));
}

// ===== アニメーションループ =====
function animationLoop(timestamp) {
  if (state.phase !== 'game') return;

  if (state.lastTime === null) state.lastTime = timestamp;
  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  // 位相を毎フレーム積み上げることでコンボ変化時のワープを防ぐ
  state.bellPhase += (dt / BELL_PERIOD) * Math.PI * 2;
  const angle = Math.sin(state.bellPhase) * MAX_ANGLE;
  state.angle  = angle;

  // 鐘の回転
  els.bellWrapper.style.transform = `rotate(${angle}deg)`;

  // ポインター位置 (angle: -25〜+25 → 0〜100%)
  const pct = (angle / MAX_ANGLE) * 50 + 50;
  els.timingPointer.style.left = `${pct}%`;

  state.rafId = requestAnimationFrame(animationLoop);
}

// ===== 視覚レベル更新 =====
function applyLevel(combo) {
  const lv = getLevel(combo);
  document.body.dataset.level = lv;
}

// ===== タイミングバー更新 =====
function updateTimingBar(combo) {
  els.timingBar.style.background = buildBarGradient(combo);
  els.nextBonus.textContent = buildNextBonus(combo);

  const win = getSuccessWindow(combo);
  let reqText;
  if (win >= 14)      reqText = '【広い】中央付近で成功';
  else if (win >= 10) reqText = '【普通】中央で成功';
  else if (win >= 6)  reqText = '【狭い】ほぼ中央のみ';
  else if (win >= 3)  reqText = '【激狭】中央ぴったり！';
  else                reqText = '【神の領域】';
  els.timingReq.textContent = reqText;
}

// ===== ヒット処理 =====
function onHit() {
  if (state.phase !== 'game') return;

  const absAngle = Math.abs(state.angle);
  const window   = getSuccessWindow(state.combo);
  const isSuccess = absAngle <= window;

  if (isSuccess) {
    handleSuccess(absAngle);
  } else {
    handleMiss();
  }
}

function handleSuccess(absAngle) {
  state.combo++;
  const gain = calcBonnoGain(state.combo);
  state.bonnoTotal += gain;

  // 煩悩名
  const bonno = BONNO_LIST[Math.floor(Math.random() * BONNO_LIST.length)];
  state.lastBonno = bonno;
  els.bonnoName.textContent = `${bonno}を退散！ +${gain.toLocaleString()}`;

  // 判定ラベル
  const { text, color } = getHitLabel(absAngle);
  showJudgment(text, color, 'show-hit');

  // パーティクル
  spawnParticles(absAngle);

  // スコア・コンボ表示
  els.scoreDisplay.textContent = state.bonnoTotal.toLocaleString();
  els.comboDisplay.textContent = state.combo;
  els.comboDisplay.classList.remove('bump');
  void els.comboDisplay.offsetWidth;
  els.comboDisplay.classList.add('bump');

  // 鐘の光エフェクト
  els.bellImg.classList.remove('hit');
  void els.bellImg.offsetWidth;
  els.bellImg.classList.add('hit');
  setTimeout(() => els.bellImg.classList.remove('hit'), 200);

  // レベルアップ
  applyLevel(state.combo);
  updateTimingBar(state.combo);

  playBellSound(true, absAngle);
}

function handleMiss() {
  if (state.rafId) cancelAnimationFrame(state.rafId);

  showJudgment('MISS...', '#ff3333', 'show-miss');
  playBellSound(false, MAX_ANGLE);

  // 赤フラッシュ + シェイク
  screens.game.classList.add('miss-flash');
  els.bellWrapper.classList.add('shake');

  setTimeout(() => {
    screens.game.classList.remove('miss-flash');
    els.bellWrapper.classList.remove('shake');
    endGame();
  }, 700);
}

function showJudgment(text, color, cls) {
  els.judgmentText.textContent = text;
  els.judgmentText.style.color = color;
  els.judgmentText.className = 'judgment-text';
  void els.judgmentText.offsetWidth;
  els.judgmentText.classList.add(cls);
}

// ===== パーティクル =====
function spawnParticles(absAngle) {
  const count  = absAngle <= 3 ? 16 : absAngle <= 8 ? 10 : 5;
  const colors = absAngle <= 3
    ? ['#ff4cf4', '#fff', '#ffaaff', '#ffe066']
    : absAngle <= 8
    ? ['#4cf4ff', '#aaffff', '#fff', '#ffe066']
    : ['#4cff88', '#aaffaa', '#fff'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / count) * 360 + Math.random() * (360 / count);
    const dist  = 35 + Math.random() * 65;
    const size  = 4 + Math.random() * 5;
    p.style.cssText = `
      --angle: ${angle}deg;
      --dist: ${dist}px;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
    `;
    els.particleContainer.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

// ===== 画面遷移 =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  state.phase = name;
}

// ===== ゲーム開始 =====
function startGame() {
  if (state.rafId) cancelAnimationFrame(state.rafId);

  state = {
    phase: 'game',
    angle: 0,
    bellPhase: 0,
    lastTime: null,
    rafId: null,
    combo: 0,
    bonnoTotal: 0,
    lastBonno: '',
    highScore: loadHighScore(),
  };

  document.body.dataset.level = '0';

  els.scoreDisplay.textContent    = '0';
  els.comboDisplay.textContent    = '0';
  els.highscoreDisplay.textContent = state.highScore.toLocaleString();
  els.bonnoName.textContent       = '鐘が中央に来たら叩け！';
  els.judgmentText.textContent    = '';
  els.judgmentText.className      = 'judgment-text';
  els.bellWrapper.style.transform = 'rotate(0deg)';

  updateTimingBar(0);
  showScreen('game');
  state.rafId = requestAnimationFrame(animationLoop);
}

// ===== ゲーム終了 =====
function endGame() {
  state.phase = 'result';
  document.body.dataset.level = '0';

  const score   = state.bonnoTotal;
  const combo   = state.combo;
  const rank    = getRank(combo);
  const hs      = loadHighScore();
  const isNew   = score > hs;
  if (isNew) saveHighScore(score);

  els.resultTitle.textContent = combo === 0 ? '残念！' : `${combo}連続成功！`;
  els.resultRank.textContent  = rank;
  els.resultRank.className    = `result-rank rank-${rank.toLowerCase()}`;
  els.resultScore.textContent = score.toLocaleString();
  els.resultMaxCombo.textContent = combo;
  els.resultLastBonno.textContent = state.lastBonno || '—';

  els.newRecord.classList.toggle('hidden', !isNew);
  els.resultHighscore.textContent = isNew ? '' : `ハイスコア: ${hs.toLocaleString()}個`;

  const shareText = buildShareText(score, combo, rank);
  els.btnShare.dataset.shareText = shareText;

  spawnConfetti(rank);
  showScreen('result');
}

function buildShareText(score, combo, rank) {
  let text = `【除夜の鐘チャレンジ】\n${combo}回連続で煩悩を退散！\n退散した煩悩: ${score.toLocaleString()}個 / ${rank}ランク\n#除夜の鐘 #煩悩退散\n${SHARE_URL}`;
  return text;
}

// ===== 紙吹雪 =====
function spawnConfetti(rank) {
  els.confettiContainer.innerHTML = '';
  const count = { D: 0, C: 10, B: 25, A: 50, S: 80, SS: 130 }[rank] || 0;
  if (count === 0) return;

  const colorSets = {
    C:  ['#c8a000','#ffe066','#a07000'],
    B:  ['#4cff88','#c8a000','#ffe066','#fff'],
    A:  ['#4cf4ff','#c8a000','#ffe066','#aaffff','#fff'],
    S:  ['#ff4cf4','#4cf4ff','#4cff88','#ffe066','#fff'],
    SS: ['#ff4cf4','#4cf4ff','#4cff88','#ffe066','#fff','#ff8800','#ff3333'],
  };
  const colors = colorSets[rank] || colorSets.C;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 4 + Math.random() * 8;
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${size}px;
      height: ${size}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-delay: ${Math.random() * 2.5}s;
      animation-duration: ${2 + Math.random() * 3}s;
    `;
    els.confettiContainer.appendChild(p);
  }
}

// ===== シェア =====
async function share() {
  const text = els.btnShare.dataset.shareText || '';
  if (navigator.share) {
    try { await navigator.share({ text }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

// ===== イベント登録 =====
function initEvents() {
  els.btnStart.addEventListener('click', startGame);
  els.btnReplay.addEventListener('click', startGame);
  els.btnShare.addEventListener('click', share);

  function handleHit(e) { e.preventDefault(); onHit(); }

  els.btnHit.addEventListener('click', handleHit);
  els.btnHit.addEventListener('touchstart', (e) => {
    e.preventDefault();
    els.btnHit.classList.add('pressed');
    onHit();
  }, { passive: false });
  els.btnHit.addEventListener('touchend', () => {
    els.btnHit.classList.remove('pressed');
  }, { passive: true });

  els.bellImg.addEventListener('click', handleHit);
  els.bellImg.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onHit();
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (state.phase === 'game') onHit();
      else if (state.phase === 'start') startGame();
    }
  });
}

// ===== 初期化 =====
function init() {
  const hs = loadHighScore();
  if (hs > 0) els.startHighscore.textContent = `ハイスコア: ${hs.toLocaleString()}個`;
  showScreen('start');
  initEvents();
}

init();
