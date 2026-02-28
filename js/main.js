'use strict';

// ===== 定数 =====
const TOTAL_BONNO = 108;
const MAX_ANGLE = 25;      // 度
const PERFECT_THRESH = 3;
const GREAT_THRESH = 8;
const GOOD_THRESH = 15;

const SCORE_PERFECT = 100;
const SCORE_GREAT   = 50;
const SCORE_GOOD    = 20;
const SCORE_MISS    = 0;

const COMBO_MULT = [
  { min: 0,  max: 4,  mult: 1.0 },
  { min: 5,  max: 9,  mult: 1.5 },
  { min: 10, max: 19, mult: 2.0 },
  { min: 20, max: Infinity, mult: 3.0 },
];

const SHARE_URL = 'https://gzer0-dev.github.io/joya/';

const BONNO_LIST = [
  '嫉妬','怒り','貪欲','無知','傲慢','猜疑','執着','怠慢',
  '嘘','恨み','後悔','焦り','羨望','暴食','恐怖','絶望',
  '妄想','欲望','憎悪','不安','怨念','自惚れ','懶惰','色欲',
  '強欲','愚痴','偏見','迷い','驕り','苦悩',
  // 現代的な煩悩
  'SNS依存','いいね欲しい','スマホ中毒','ネット炎上','バズりたい',
  'フォロワー数自慢','課金衝動','エナドリ飲み過ぎ','徹夜ゲーム',
  '推し課金','匿名煽り','リプ乞食','ストーリー監視','タイムライン中毒',
  '承認欲求','炎上見物','出前依存','Netflixイッキ見','サブスク乱立',
  '積みゲー','積ん読','朝活詐欺','ダイエット先延ばし','二度寝',
  '残業自慢','マウント取り','古参アピール','VTuber推し','ガチャ依存',
  'ランキング執着','ブランド依存','見栄','愚痴ツイート','他責思考',
  '自己嫌悪','完璧主義','比較癖','情報収集過多','睡眠不足自慢',
  '痩せたいのに食べる','やる気ない','現実逃避','過去に縛られる',
  '将来が怖い','孤独感','上司への不満','満員電車の怒り','財布の寂しさ',
  '無計画な衝動買い','周りの目が気になる','既読無視する','返信が遅い',
  '約束を忘れる','時間を守らない','言い訳','責任転嫁','主張できない',
  '断れない','優柔不断','潔癖症','偏食','好き嫌い激しい',
  '競争心','プライドが高い','頑固','気が短い','涙もろい過ぎ',
  'おせっかい','干渉しすぎ','心配しすぎ','過保護','依存体質',
  'ネガティブ思考','悲観的','楽観的すぎ','無責任','自己中',
];

const RANK_TABLE = [
  { min: 9000, rank: 'S' },
  { min: 7000, rank: 'A' },
  { min: 5000, rank: 'B' },
  { min: 3000, rank: 'C' },
  { min: 0,    rank: 'D' },
];

// ===== ゲーム状態 =====
let state = {
  phase: 'start',       // 'start' | 'game' | 'result'
  angle: 0,
  direction: 1,
  elapsed: 0,
  lastTime: null,
  rafId: null,
  bonnoLeft: TOTAL_BONNO,
  score: 0,
  combo: 0,
  maxCombo: 0,
  highScore: 0,
  counts: { perfect: 0, great: 0, good: 0, miss: 0 },
  bonnoHits: {},        // 煩悩名 -> 回数
  currentBonno: '',
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
  bonnoRemaining:   document.getElementById('bonno-remaining'),
  bellWrapper:      document.getElementById('bell-wrapper'),
  bellImg:          document.getElementById('bell-img'),
  judgmentText:     document.getElementById('judgment-text'),
  timingPointer:    document.getElementById('timing-pointer'),
  btnStart:         document.getElementById('btn-start'),
  btnHit:           document.getElementById('btn-hit'),
  btnReplay:        document.getElementById('btn-replay'),
  btnShare:         document.getElementById('btn-share'),
  startHighscore:   document.getElementById('start-highscore'),
  resultRank:       document.getElementById('result-rank'),
  resultScore:      document.getElementById('result-score'),
  resultMaxCombo:   document.getElementById('result-max-combo'),
  resultPerfect:    document.getElementById('result-perfect'),
  resultGreat:      document.getElementById('result-great'),
  resultGood:       document.getElementById('result-good'),
  resultMiss:       document.getElementById('result-miss'),
  resultStrongestBonno: document.getElementById('result-strongest-bonno'),
  newRecord:        document.getElementById('new-record'),
  resultHighscore:  document.getElementById('result-highscore'),
};

// ===== Web Audio =====
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playBellSound(judgment) {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const baseFreq = judgment === 'perfect' ? 220 :
                     judgment === 'great'   ? 200 :
                     judgment === 'good'    ? 180 : 140;

    const partials = [1, 2.756, 5.404, 8.933, 13.34];
    const amplitudes = [1, 0.5, 0.25, 0.12, 0.06];
    const decayTime = judgment === 'perfect' ? 3.0 :
                      judgment === 'great'   ? 2.0 :
                      judgment === 'good'    ? 1.2 : 0.5;

    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);
      oscGain.gain.setValueAtTime(amplitudes[i] * 0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);
      osc.connect(oscGain);
      oscGain.connect(gainNode);
      osc.start(now);
      osc.stop(now + decayTime);
    });

    gainNode.gain.setValueAtTime(1, now);
  } catch (e) {
    // AudioContext 未対応環境では無視
  }
}

// ===== ハイスコア =====
function loadHighScore() {
  return parseInt(localStorage.getItem('joya_highscore') || '0', 10);
}

function saveHighScore(score) {
  localStorage.setItem('joya_highscore', String(score));
}

// ===== アニメーションループ =====
function animationLoop(timestamp) {
  if (state.phase !== 'game') return;

  if (state.lastTime === null) {
    state.lastTime = timestamp;
  }
  const dt = (timestamp - state.lastTime) / 1000; // 秒
  state.lastTime = timestamp;
  state.elapsed += dt;

  // 周期: 打数が増えるほど短くなる (2.0秒 -> 0.8秒)
  const progress = 1 - state.bonnoLeft / TOTAL_BONNO;
  const period = 2.0 - progress * 1.2; // 2.0 〜 0.8
  const angle = Math.sin(state.elapsed / period * Math.PI * 2) * MAX_ANGLE;
  state.angle = angle;

  // 鐘の回転
  els.bellWrapper.style.transform = `rotate(${angle}deg)`;

  // タイミングポインター位置
  // angle は -25〜+25 -> barの 0〜100% にマッピング
  const pct = (angle / MAX_ANGLE) * 50 + 50; // 0%=左端, 50%=中央, 100%=右端
  els.timingPointer.style.left = `${pct}%`;

  state.rafId = requestAnimationFrame(animationLoop);
}

// ===== 判定 =====
function getJudgment(angle) {
  const absAngle = Math.abs(angle);
  if (absAngle <= PERFECT_THRESH) return 'perfect';
  if (absAngle <= GREAT_THRESH)   return 'great';
  if (absAngle <= GOOD_THRESH)    return 'good';
  return 'miss';
}

function getComboMult(combo) {
  for (const tier of COMBO_MULT) {
    if (combo >= tier.min && combo <= tier.max) return tier.mult;
  }
  return 1;
}

// ===== ヒット処理 =====
function onHit() {
  if (state.phase !== 'game') return;
  if (state.bonnoLeft <= 0) return;

  const judgment = getJudgment(state.angle);
  const baseScore = { perfect: SCORE_PERFECT, great: SCORE_GREAT, good: SCORE_GOOD, miss: SCORE_MISS }[judgment];

  if (judgment !== 'miss') {
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  } else {
    state.combo = 0;
  }

  const mult = getComboMult(state.combo);
  const gained = Math.floor(baseScore * mult);
  state.score += gained;
  state.counts[judgment]++;

  // 煩悩名
  const bonno = BONNO_LIST[Math.floor(Math.random() * BONNO_LIST.length)];
  state.currentBonno = bonno;
  state.bonnoHits[bonno] = (state.bonnoHits[bonno] || 0) + 1;
  els.bonnoName.textContent = bonno + 'を退散！';

  state.bonnoLeft--;

  // UI更新
  updateGameUI(judgment);
  playBellSound(judgment);

  // 終了判定
  if (state.bonnoLeft <= 0) {
    setTimeout(endGame, 600);
  }
}

function updateGameUI(judgment) {
  // スコア・コンボ
  els.scoreDisplay.textContent = state.score.toLocaleString();
  els.bonnoRemaining.textContent = state.bonnoLeft;

  // コンボ表示（バウンス）
  els.comboDisplay.textContent = state.combo;
  if (state.combo > 0) {
    els.comboDisplay.classList.remove('combo-up');
    void els.comboDisplay.offsetWidth; // reflow
    els.comboDisplay.classList.add('combo-up');
  }

  // 判定テキスト
  const labels = {
    perfect: 'PERFECT!!',
    great:   'GREAT!',
    good:    'GOOD',
    miss:    'MISS...',
  };
  els.judgmentText.textContent = labels[judgment];
  els.judgmentText.className = 'judgment-text';
  void els.judgmentText.offsetWidth;
  els.judgmentText.classList.add(`show-${judgment}`);

  // 鐘の光エフェクト
  els.bellImg.classList.remove('hit');
  void els.bellImg.offsetWidth;
  els.bellImg.classList.add('hit');
  setTimeout(() => els.bellImg.classList.remove('hit'), 200);
}

// ===== 画面遷移 =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  state.phase = name;
}

function startGame() {
  // 状態初期化
  state = {
    phase: 'game',
    angle: 0,
    direction: 1,
    elapsed: 0,
    lastTime: null,
    rafId: null,
    bonnoLeft: TOTAL_BONNO,
    score: 0,
    combo: 0,
    maxCombo: 0,
    highScore: loadHighScore(),
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    bonnoHits: {},
    currentBonno: '',
  };

  els.scoreDisplay.textContent = '0';
  els.comboDisplay.textContent = '0';
  els.highscoreDisplay.textContent = state.highScore.toLocaleString();
  els.bonnoRemaining.textContent = TOTAL_BONNO;
  els.bonnoName.textContent = '煩悩を退散させよ';
  els.judgmentText.textContent = '';
  els.judgmentText.className = 'judgment-text';
  els.bellWrapper.style.transform = 'rotate(0deg)';

  showScreen('game');
  state.rafId = requestAnimationFrame(animationLoop);
}

function endGame() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.phase = 'result';

  const score = state.score;
  const hs = loadHighScore();
  const isNew = score > hs;
  if (isNew) saveHighScore(score);
  const finalHs = isNew ? score : hs;

  const rank = RANK_TABLE.find(r => score >= r.min)?.rank ?? 'D';

  // 一番多く退散させた煩悩
  let strongestBonno = '';
  let maxHits = 0;
  for (const [name, count] of Object.entries(state.bonnoHits)) {
    if (count > maxHits) { maxHits = count; strongestBonno = name; }
  }

  // 結果画面更新
  els.resultScore.textContent = score.toLocaleString();
  els.resultMaxCombo.textContent = state.maxCombo;
  els.resultPerfect.textContent = state.counts.perfect;
  els.resultGreat.textContent   = state.counts.great;
  els.resultGood.textContent    = state.counts.good;
  els.resultMiss.textContent    = state.counts.miss;

  els.resultRank.textContent = rank;
  els.resultRank.className = `result-rank rank-${rank.toLowerCase()}`;

  if (strongestBonno) {
    els.resultStrongestBonno.textContent = `最強の煩悩: ${strongestBonno}（${maxHits}回）`;
  }

  els.newRecord.classList.toggle('hidden', !isNew);
  els.resultHighscore.textContent = isNew ? '' : `ハイスコア: ${finalHs.toLocaleString()}pt`;

  // シェアテキストを結果ボタンに紐付け
  const shareText = buildShareText(score, rank, state.maxCombo, strongestBonno);
  els.btnShare.dataset.shareText = shareText;

  showScreen('result');
}

function buildShareText(score, rank, maxCombo, strongestBonno) {
  let text = `【除夜の鐘チャレンジ】\n108の煩悩を退散させた！\nスコア: ${score.toLocaleString()}pt / ${rank}ランク\nコンボ最大: ${maxCombo}連続`;
  if (strongestBonno) text += `\n一番強かった煩悩: ${strongestBonno}`;
  text += `\n#除夜の鐘 #煩悩退散\n${SHARE_URL}`;
  return text;
}

// ===== シェア =====
async function share() {
  const text = els.btnShare.dataset.shareText || '';
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  // フォールバック: Xシェア
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

// ===== イベント登録 =====
function initEvents() {
  els.btnStart.addEventListener('click', startGame);
  els.btnReplay.addEventListener('click', startGame);
  els.btnShare.addEventListener('click', share);

  // PC: クリック / モバイル: タップ
  function handleHit(e) {
    e.preventDefault();
    onHit();
  }

  els.btnHit.addEventListener('click', handleHit);
  els.btnHit.addEventListener('touchstart', (e) => {
    e.preventDefault();
    els.btnHit.classList.add('pressed');
    onHit();
  }, { passive: false });
  els.btnHit.addEventListener('touchend', () => {
    els.btnHit.classList.remove('pressed');
  }, { passive: true });

  // 鐘画像もタップ可能
  els.bellImg.addEventListener('click', handleHit);
  els.bellImg.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onHit();
  }, { passive: false });

  // キーボード: スペース/Enter
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
  state.highScore = loadHighScore();
  const hs = state.highScore;
  if (hs > 0) {
    els.startHighscore.textContent = `ハイスコア: ${hs.toLocaleString()}pt`;
  }
  showScreen('start');
  initEvents();
}

init();
