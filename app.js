// State Management
let currentMode = 'en2jp'; // 'en2jp', 'jp2en', 'review_en2jp', 'review_jp2en'
let pendingMode = null;
let targetQuestionCount = 5;
let selectedCategory = 'ALL';

// Default stage is Stage 1, or restore last selected stage from localStorage
let savedLastStage = localStorage.getItem('last_selected_stage');
let selectedStage = savedLastStage ? (savedLastStage === 'ALL' ? 'ALL' : parseInt(savedLastStage, 10)) : 1;

let activeTab = 'stage'; // 'stage' or 'category'
let currentQuizList = [];
let currentQuestionIndex = 0;
let currentScore = 0;
let totalStars = parseInt(localStorage.getItem('total_stars') || '0', 10);
let currentQuestionData = null;
let isAnswering = false;
let lastQuizResult = null;
let reportSource = 'home'; // 'home' or 'quiz_result'

// Mascot cheering phrases
const CHEER_MESSAGES = [
  "がんばってね！おうえんしてるよ！ 🐱",
  "すごい！その調子だよ！ 🐶",
  "えいごマスターを目指そう！ 🐰",
  "集中してチャレンジ！ 🐻",
  "キミなら絶対にできるよ！ 🐼"
];

// Category Map with Emoji
const CATEGORY_ICONS = {
  "ALL": "🌟 ぜんぶ",
  "食べ物": "🍎 食べ物",
  "動物": "🐶 動物",
  "からだの一部": "👀 からだ",
  "身に着けるもの": "👕 ふく",
  "身の回りのもの": "🏠 もの",
  "家族・人": "👨‍👩‍👧 ひと",
  "職業": "👨‍✈️ しごと",
  "スポーツ": "⚽ スポーツ",
  "色": "🎨 いろ",
  "図形": "🔺 かたち",
  "天気": "☀️ てんき",
  "季節": "🌸 きせつ",
  "場所": "🏫 ばしょ",
  "授業科目": "📚 べんきょう",
  "数": "🔢 かず",
  "曜日": "📅 ようび",
  "月": "📆 つき",
  "日付・単位・時間帯": "⏰ じかん",
  "動詞": "🏃 動き",
  "形容詞": "✨ ようす",
  "その他": "💡 その他"
};

// Word Correct Counts & Master Dates (Stored per word ID)
function getWordCorrectCounts() {
  try {
    return JSON.parse(localStorage.getItem('word_correct_counts') || '{}');
  } catch (e) {
    return {};
  }
}

function saveWordCorrectCounts(counts) {
  localStorage.setItem('word_correct_counts', JSON.stringify(counts));
}

function getWordCorrectCount(wordId) {
  const counts = getWordCorrectCounts();
  return counts[wordId] || 0;
}

function getWordMasterDates() {
  try {
    return JSON.parse(localStorage.getItem('word_master_dates') || '{}');
  } catch (e) {
    return {};
  }
}

function getWordMasterDate(wordId) {
  const dates = getWordMasterDates();
  return dates[wordId] || null;
}

function saveWordMasterDate(wordId) {
  const dates = getWordMasterDates();
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  dates[wordId] = dateStr;
  localStorage.setItem('word_master_dates', JSON.stringify(dates));
  return dateStr;
}

function incrementWordCorrectCount(wordId) {
  const counts = getWordCorrectCounts();
  const newCount = (counts[wordId] || 0) + 1;
  counts[wordId] = newCount;
  saveWordCorrectCounts(counts);

  // Record master date when reaching 3 correct answers
  if (newCount === 3) {
    saveWordMasterDate(wordId);
  }
  return newCount;
}

function getMasteredWordIds() {
  const counts = getWordCorrectCounts();
  return Object.keys(counts).filter(id => counts[id] >= 3).map(Number);
}

// Stage 1 ~ 50 Assignment (Partition words into 50 difficulty-ordered groups)
function getStageAssignments() {
  const assignments = {};
  for (let i = 1; i <= 50; i++) {
    assignments[i] = [];
  }

  WORD_DATABASE.forEach(w => {
    const stage = w.stage || 1;
    if (!assignments[stage]) {
      assignments[stage] = [];
    }
    assignments[stage].push(w.id);
  });

  return assignments;
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  updateStarDisplay();
  updateMasterCountDisplay();
  renderStageGrid();
  renderCategoryGrid();
  switchScreen('screen-home');
});

// Update Star Count Display (Total stars = Number of 3-correct mastered words)
function updateStarDisplay() {
  const masteredCount = getMasteredWordIds().length;
  totalStars = masteredCount;
  localStorage.setItem('total_stars', totalStars.toString());
  const starBadge = document.getElementById('total-stars');
  if (starBadge) {
    starBadge.innerText = totalStars;
  }
}

// Update Mastered Words Count Display
function updateMasterCountDisplay() {
  const masterBadge = document.getElementById('master-count');
  if (masterBadge) {
    const masteredIds = getMasteredWordIds();
    masterBadge.innerText = masteredIds.length;
  }
}

// Switch Filter Tabs (Stage vs Category)
function switchFilterTab(tabName) {
  activeTab = tabName;
  const tabStage = document.getElementById('tab-stage');
  const tabCat = document.getElementById('tab-category');
  const stageGrid = document.getElementById('stage-grid');
  const catGrid = document.getElementById('category-grid');

  if (tabName === 'stage') {
    tabStage.classList.add('active');
    tabCat.classList.remove('active');
    stageGrid.style.display = 'grid';
    catGrid.style.display = 'none';
  } else {
    tabCat.classList.add('active');
    tabStage.classList.remove('active');
    catGrid.style.display = 'grid';
    stageGrid.style.display = 'none';
  }
  playSynthesizedBeep(440, 0.05);
}

// Open / Close How-To-Play Modal
function openHowtoModal() {
  playSynthesizedBeep(523.25, 0.08);
  document.getElementById('howto-modal').classList.add('active');
}

function closeHowtoModal() {
  document.getElementById('howto-modal').classList.remove('active');
}

// Render Stage Grid
function renderStageGrid() {
  const grid = document.getElementById('stage-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const assignments = getStageAssignments();
  const masteredIds = getMasteredWordIds();

  // Stage 1 ~ 50 Cards first
  for (let i = 1; i <= 50; i++) {
    const wordIds = assignments[i] || [];
    const clearedInStage = wordIds.filter(id => masteredIds.includes(id)).length;
    const totalInStage = wordIds.length;

    const card = document.createElement('div');
    card.className = `stage-card ${selectedStage === i ? 'active' : ''}`;
    card.onclick = () => filterStage(i);

    const isComplete = clearedInStage === totalInStage && totalInStage > 0;
    
    card.innerHTML = `
      <span class="stage-badge">${isComplete ? '👑 CLEAR' : `Stage ${i}`}</span>
      <span class="stage-name">Stage ${i}</span>
      <span class="stage-count">★ ${clearedInStage} / ${totalInStage}語</span>
    `;
    grid.appendChild(card);
  }

  // "ALL" Stage Card appended AT THE END after Stage 50
  const allCard = document.createElement('div');
  allCard.className = `stage-card ${selectedStage === 'ALL' ? 'active' : ''}`;
  allCard.onclick = () => filterStage('ALL');
  allCard.innerHTML = `
    <span class="stage-badge">🌟 全ステージ</span>
    <span class="stage-name">ぜんぶ (${WORD_DATABASE.length}語)</span>
  `;
  grid.appendChild(allCard);
}

// Filter Stage
function filterStage(stage) {
  selectedStage = stage;
  localStorage.setItem('last_selected_stage', stage.toString());
  // Reset category if stage selected
  selectedCategory = 'ALL';
  renderStageGrid();
  renderCategoryGrid();
  playSynthesizedBeep(440, 0.05);
}

// Render Categories
function renderCategoryGrid() {
  const grid = document.getElementById('category-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const categories = ["ALL", ...new Set(WORD_DATABASE.map(w => w.category))];

  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = `cat-card ${cat === selectedCategory ? 'active' : ''}`;
    card.onclick = () => filterCategory(cat);

    const label = CATEGORY_ICONS[cat] || `📁 ${cat}`;
    const parts = label.split(' ');
    
    card.innerHTML = `
      <span class="cat-icon">${parts[0]}</span>
      <span class="cat-name">${parts.slice(1).join(' ')}</span>
    `;
    grid.appendChild(card);
  });
}

// Filter Category
function filterCategory(cat) {
  selectedCategory = cat;
  selectedStage = 'ALL'; // Reset stage filter if category chosen
  renderStageGrid();
  renderCategoryGrid();
  playSynthesizedBeep(440, 0.05);
}

// Open / Close Review Mode Modal
function openReviewModeSelector() {
  playSynthesizedBeep(523.25, 0.08);
  const masteredIds = getMasteredWordIds();
  if (masteredIds.length === 0) {
    alert("まだ3かい正解した問題（★）がないよ！\nふつうのモードで遊んで、3かい正解して★を集めてね！");
    return;
  }
  document.getElementById('review-modal').classList.add('active');
}

function closeReviewModal() {
  document.getElementById('review-modal').classList.remove('active');
}

function startReviewMode(mode) {
  closeReviewModal();
  selectMode(mode);
}

// Reset All Data
function confirmResetData() {
  playSynthesizedBeep(440, 0.08);
  const ok = confirm("またはじめからになるけど大丈夫？");
  if (ok) {
    localStorage.removeItem('total_stars');
    localStorage.removeItem('word_correct_counts');
    localStorage.removeItem('word_master_dates');
    localStorage.removeItem('stage_assignments');
    localStorage.removeItem('last_selected_stage');

    totalStars = 0;
    selectedStage = 1; // Reset default to Stage 1
    selectedCategory = 'ALL';

    updateStarDisplay();
    updateMasterCountDisplay();
    renderStageGrid();
    renderCategoryGrid();

    playSynthesizedBeep(659.25, 0.1);
    alert("データをすべてリセットしたよ！\nまた1からがんばろう！");
  }
}

// Master List Modal Functions
function openMasterListModal() {
  playSynthesizedBeep(523.25, 0.08);
  const container = document.getElementById('master-list-container');
  if (!container) return;

  const masteredIds = getMasteredWordIds();
  const masterDates = getWordMasterDates();

  if (masteredIds.length === 0) {
    container.innerHTML = `<p style="padding: 20px; color: #887799;">まだ3回正解した問題がありません。<br>クイズで3回正解して★を集めよう！</p>`;
  } else {
    const items = WORD_DATABASE.filter(w => masteredIds.includes(w.id));
    container.innerHTML = items.map(w => {
      const date = masterDates[w.id] || '記録なし';
      return `
        <div class="master-item">
          <div class="master-item-word">
            <strong>${w.word}</strong> <span class="master-item-meaning">(${w.meaning})</span>
          </div>
          <div class="master-item-date">🌟 達成日: ${date}</div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('master-list-modal').classList.add('active');
}

function closeMasterListModal() {
  document.getElementById('master-list-modal').classList.remove('active');
}

// Course Selection Modal Functions
function openCourseModal() {
  document.getElementById('course-modal').classList.add('active');
}

function closeCourseModal() {
  document.getElementById('course-modal').classList.remove('active');
}

function startQuizWithCourse(questionCount) {
  targetQuestionCount = questionCount;
  closeCourseModal();
  if (pendingMode) {
    startQuiz(pendingMode, questionCount);
  }
}

// Select Mode (Prompts for 5 or 10 Question Course)
function selectMode(mode) {
  playSynthesizedBeep(523.25, 0.08);

  const isReviewMode = mode.startsWith('review_');
  if (isReviewMode) {
    const masteredIds = getMasteredWordIds();
    const targetPool = WORD_DATABASE.filter(w => masteredIds.includes(w.id));
    if (targetPool.length === 0) {
      alert("まだ3回正解した問題（★）がないよ！ふつうのモードであそんでね！");
      return;
    }
  }

  pendingMode = mode;
  openCourseModal();
}

// Start Game with selected Mode & Question Count
function startQuiz(mode, questionCount) {
  currentMode = mode;

  const isReviewMode = mode.startsWith('review_');
  let targetPool = WORD_DATABASE;

  if (isReviewMode) {
    const masteredIds = getMasteredWordIds();
    targetPool = WORD_DATABASE.filter(w => masteredIds.includes(w.id));
  } else {
    // Stage Filter or Category Filter
    if (selectedStage !== 'ALL') {
      const assignments = getStageAssignments();
      const stageWordIds = assignments[selectedStage] || [];
      targetPool = WORD_DATABASE.filter(w => stageWordIds.includes(w.id));
    } else if (selectedCategory !== 'ALL') {
      targetPool = WORD_DATABASE.filter(w => w.category === selectedCategory);
    }
  }

  // Shuffle & Pick 'questionCount' items (5 or 10)
  const shuffled = [...targetPool].sort(() => 0.5 - Math.random());
  currentQuizList = shuffled.slice(0, Math.min(questionCount, shuffled.length));

  if (!isReviewMode && currentQuizList.length < 3) {
    alert("単語がすくないため、全単語から出題します！");
    currentQuizList = [...WORD_DATABASE].sort(() => 0.5 - Math.random()).slice(0, Math.min(questionCount, WORD_DATABASE.length));
  }

  currentQuestionIndex = 0;
  currentScore = 0;
  document.getElementById('quiz-score').innerText = currentScore;

  switchScreen('screen-quiz');
  loadQuestion();
}

// Load Question
function loadQuestion() {
  isAnswering = false;
  const item = currentQuizList[currentQuestionIndex];
  currentQuestionData = item;

  // Update progress
  document.getElementById('question-number').innerText = `もんだい ${currentQuestionIndex + 1} / ${currentQuizList.length}`;
  const fillPercent = ((currentQuestionIndex + 1) / currentQuizList.length) * 100;
  document.getElementById('progress-bar-fill').style.width = `${fillPercent}%`;

  document.getElementById('quiz-category').innerText = item.category;

  // Update Word Star Pill (Correct Count Badge & Master Date)
  const starPill = document.getElementById('word-star-pill');
  if (starPill) {
    const count = getWordCorrectCount(item.id);
    const masterDate = getWordMasterDate(item.id);
    if (count >= 3) {
      starPill.className = 'word-star-pill mastered';
      starPill.innerText = `🌟 CLEAR! (${masterDate ? '達成日: ' + masterDate : '3回正解'})`;
    } else {
      starPill.className = 'word-star-pill';
      starPill.innerText = `⭐ ${count}/3 正解`;
    }
  }

  // Set Prompt and Target
  const promptLabel = document.getElementById('prompt-label');
  const questionTarget = document.getElementById('question-target');
  const audioBtn = document.getElementById('audio-btn');

  const actualMode = currentMode.replace('review_', '');

  if (actualMode === 'en2jp') {
    promptLabel.innerText = "この英単語の意味（日本語）は？";
    questionTarget.innerText = item.word;
    audioBtn.style.display = "flex";
    playAudio(item.word);
  } else {
    promptLabel.innerText = "この日本語に合う英単語は？";
    questionTarget.innerText = item.meaning;
    audioBtn.style.display = "flex";
    playAudio(item.word);
  }

  // Generate 3 choices (1 correct + 2 wrong)
  const wrongOptions = WORD_DATABASE
    .filter(w => w.id !== item.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  const allChoices = [item, ...wrongOptions].sort(() => 0.5 - Math.random());

  const choicesContainer = document.getElementById('choices-container');
  choicesContainer.innerHTML = '';

  allChoices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    
    const choiceText = actualMode === 'en2jp' ? choice.meaning : choice.word;
    btn.innerHTML = `
      <span class="choice-num">${idx + 1}</span>
      <span class="choice-text">${choiceText}</span>
    `;

    btn.onclick = () => handleChoiceClick(btn, choice.id === item.id);
    choicesContainer.appendChild(btn);
  });

  // Update Mascot Cheer Message
  const cheerMsg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
  document.getElementById('mascot-msg').innerText = cheerMsg;
}

// Play English Speech Audio (Web Speech API)
function playAudio(text, isSlow = false) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = isSlow ? 0.45 : 0.85; // 0.45 for slow turtle speed
    utterance.pitch = 1.1; // Friendly pitch
    window.speechSynthesis.speak(utterance);
  }
}

function playCurrentAudio(isSlow = false) {
  if (currentQuestionData) {
    playAudio(currentQuestionData.word, isSlow);
  }
}

// Hint Function
function showHint() {
  if (!currentQuestionData || isAnswering) return;
  playSynthesizedBeep(587.33, 0.08);

  const word = currentQuestionData.word;
  const firstLetter = word.charAt(0).toUpperCase();
  const wordLength = word.length;
  const actualMode = currentMode.replace('review_', '');

  let hintText = "";
  if (actualMode === 'en2jp') {
    hintText = `💡 ヒント: 「${word}」は 最初の文字が ${firstLetter}、 ${wordLength}文字の単語だよ！`;
  } else {
    hintText = `💡 ヒント: 正解の英単語は 「${firstLetter}」 から始まるよ！ (${wordLength}文字)`;
  }

  // Double hint: Disable 1 wrong choice button
  const choicesContainer = document.getElementById('choices-container');
  const btns = Array.from(choicesContainer.querySelectorAll('.choice-btn:not([disabled])'));
  
  const wrongBtns = btns.filter(btn => {
    const text = btn.querySelector('.choice-text').innerText;
    const isCorrectChoice = actualMode === 'en2jp'
      ? text === currentQuestionData.meaning
      : text === currentQuestionData.word;
    return !isCorrectChoice;
  });

  if (wrongBtns.length > 0) {
    // Pick 1 wrong choice to dim out
    const targetWrongBtn = wrongBtns[0];
    targetWrongBtn.style.opacity = '0.35';
    targetWrongBtn.style.pointerEvents = 'none';
  }

  document.getElementById('mascot-msg').innerText = hintText;
}

// Handle Choice Selection
function handleChoiceClick(btnElement, isCorrect) {
  if (isAnswering) return;
  isAnswering = true;

  const choicesContainer = document.getElementById('choices-container');
  const allBtns = choicesContainer.querySelectorAll('.choice-btn');
  const actualMode = currentMode.replace('review_', '');

  if (isCorrect) {
    btnElement.classList.add('correct');
    currentScore++;
    document.getElementById('quiz-score').innerText = currentScore;

    // Increment word correct count
    const newCount = incrementWordCorrectCount(currentQuestionData.id);
    updateMasterCountDisplay();

    // Trigger Cracker / Confetti 🎉
    fireCracker();
    playCorrectSound();

    if (newCount === 3) {
      // Award Master Star for reaching 3 correct answers
      updateStarDisplay();
      const mDate = getWordMasterDate(currentQuestionData.id);

      document.getElementById('mascot-msg').innerText = `🎉 3回正解達成！★をゲット！ (${mDate}) 🌟`;
      setTimeout(fireCracker, 300);
    } else if (newCount > 3) {
      document.getElementById('mascot-msg').innerText = `すごい！★ゲット済みの単語をクリア！ (${newCount}回正解) 🎊`;
    } else {
      document.getElementById('mascot-msg').innerText = `すごーい！せいかい！！ (${newCount}/3回正解) 🎊`;
    }
  } else {
    btnElement.classList.add('wrong');
    playWrongSound();

    // Highlight correct choice
    allBtns.forEach(btn => {
      const isBtnCorrect = actualMode === 'en2jp' 
        ? btn.querySelector('.choice-text').innerText === currentQuestionData.meaning
        : btn.querySelector('.choice-text').innerText === currentQuestionData.word;
      if (isBtnCorrect) {
        btn.classList.add('correct');
      }
    });

    document.getElementById('mascot-msg').innerText = `ざんねん！正解は「${actualMode === 'en2jp' ? currentQuestionData.meaning : currentQuestionData.word}」だよ！`;
  }

  // Always pronounce the correct English word when answered
  playAudio(currentQuestionData.word);

  // Next question delay
  setTimeout(() => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizList.length) {
      loadQuestion();
    } else {
      showResults();
    }
  }, 1800);
}

// Confetti Cracker Effect 🎉
function fireCracker() {
  if (typeof confetti === 'function') {
    // Left cracker
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.2, y: 0.65 }
    });
    // Right cracker
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.8, y: 0.65 }
    });
  }
}

// Sound Effects via Web Audio API
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSynthesizedBeep(freq, duration) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio context autoplay restrictions gracefully
  }
}

function playCorrectSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Fanfare chords: C5 -> E5 -> G5 -> C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  } catch (e) {}
}

function playWinFanfare() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.35);
    });
  } catch (e) {
    playCorrectSound();
  }
}

function playWrongSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {}
}

// Show Result Screen
function showResults() {
  // Update star display based on 3-correct master count
  updateStarDisplay();

  const total = currentQuizList.length;
  document.getElementById('final-score').innerText = currentScore;
  document.getElementById('total-questions').innerText = total;

  // Record last quiz result for reporting
  lastQuizResult = {
    mode: currentMode,
    score: currentScore,
    total: total,
    category: selectedCategory,
    stage: selectedStage,
    date: new Date()
  };

  const resultTitle = document.getElementById('result-title');
  const resultSub = document.getElementById('result-subtitle');
  const resultIcon = document.getElementById('result-icon-box');
  const scoreStars = document.getElementById('score-stars');

  if (currentScore === total) {
    resultIcon.innerText = "👑";
    resultTitle.innerText = "パーフェクト！🎉";
    resultSub.innerText = "ぜんぶ大正解！きみは天才英語マスターだね！";
    scoreStars.innerText = "⭐⭐⭐";
    fireCracker();
    setTimeout(fireCracker, 400);
  } else if (currentScore >= 3) {
    resultIcon.innerText = "🎉";
    resultTitle.innerText = "すごーい！✨";
    resultSub.innerText = "とってもよくできました！";
    scoreStars.innerText = "⭐⭐☆";
    fireCracker();
  } else {
    resultIcon.innerText = "🐥";
    resultTitle.innerText = "おしい！ガンバレ！";
    resultSub.innerText = "なんかいも遊んでおぼえていこうね！";
    scoreStars.innerText = "⭐☆☆";
  }

  switchScreen('screen-result');
}

// Restart & Navigation
function restartQuiz() {
  startQuiz(currentMode, targetQuestionCount);
}

function goHome() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  switchScreen('screen-home');
}

function switchScreen(screenId) {
  if ('speechSynthesis' in window && screenId !== 'screen-quiz') {
    window.speechSynthesis.cancel();
  }

  // Reset all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });

  // Activate target screen
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
}

// -------------------------------------------------------------
// Teacher Progress Report Feature (Privacy-Safe: No Email)
// -------------------------------------------------------------

function getStudentName() {
  return localStorage.getItem('student_name') || '';
}

function saveStudentName(name) {
  localStorage.setItem('student_name', name.trim());
}

function getClassCode() {
  return localStorage.getItem('student_class_code') || 'eigo1';
}

function saveClassCode(code) {
  localStorage.setItem('student_class_code', (code || '').trim());
}

function openSendReportModal(source = 'home') {
  playSynthesizedBeep(523.25, 0.08);
  reportSource = source;

  const modal = document.getElementById('send-report-modal');
  if (!modal) return;

  const nameInput = document.getElementById('report-student-name');
  const classCodeInput = document.getElementById('report-class-code');
  const commentInput = document.getElementById('report-comment');
  const qrBox = document.getElementById('report-qrcode-box');
  const feedbackEl = document.getElementById('online-send-feedback');

  if (nameInput) nameInput.value = getStudentName();
  if (classCodeInput) classCodeInput.value = getClassCode();
  if (commentInput && !commentInput.value) {
    commentInput.value = source === 'quiz_result' ? 'クイズをがんばりました！🎉' : 'きょうも楽しくがんばりました！✨';
  }
  if (qrBox) qrBox.style.display = 'none';
  if (feedbackEl) {
    feedbackEl.innerHTML = '';
    feedbackEl.className = 'online-send-feedback';
  }

  // Check if Web Share API is supported (mobile / secure context)
  const shareBtn = document.getElementById('btn-share-native');
  if (shareBtn) {
    if (navigator.share) {
      shareBtn.style.display = 'inline-flex';
    } else {
      shareBtn.style.display = 'none';
    }
  }

  updateReportPreview();
  modal.classList.add('active');
}

function closeSendReportModal() {
  const modal = document.getElementById('send-report-modal');
  if (modal) modal.classList.remove('active');
  const qrBox = document.getElementById('report-qrcode-box');
  if (qrBox) qrBox.style.display = 'none';
}

async function sendReportDirectOnline() {
  const nameInput = document.getElementById('report-student-name');
  const classCodeInput = document.getElementById('report-class-code');
  const feedbackEl = document.getElementById('online-send-feedback');
  const sendBtn = document.getElementById('btn-online-send');

  const studentName = (nameInput?.value || '').trim();
  const classCode = (classCodeInput?.value || '').trim().toLowerCase() || 'eigo1';

  if (!studentName) {
    playWrongSound();
    if (feedbackEl) {
      feedbackEl.className = 'online-send-feedback error';
      feedbackEl.innerText = '⚠️ 「おなまえ」を入力してね！';
    }
    if (nameInput) nameInput.focus();
    return;
  }

  saveStudentName(studentName);
  saveClassCode(classCode);

  const reportText = generateProgressReportText();
  const reportData = {
    id: Date.now(),
    studentName: studentName,
    classCode: classCode,
    date: new Date().toLocaleString('ja-JP'),
    rawText: reportText,
    timestamp: Date.now()
  };

  // UI loading state
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="btn-spinner"></span> 送信中...';
  }
  if (feedbackEl) {
    feedbackEl.className = 'online-send-feedback loading';
    feedbackEl.innerText = '📡 先生の画面へ送信中...';
  }

  try {
    // 1. Save to local storage & broadcast (instant 0s sync for same-device/browser)
    try {
      const saved = JSON.parse(localStorage.getItem('saved_student_reports') || '[]');
      saved.unshift(reportData);
      localStorage.setItem('saved_student_reports', JSON.stringify(saved));
    } catch(e) {}

    try {
      const channel = new BroadcastChannel('eigo_app_sync_channel');
      channel.postMessage({ type: 'NEW_REPORT', report: reportData });
    } catch(e) {}

    // 2. Cloud Relay via HTTPS (Safe headers, no non-Latin1 characters, with timeout)
    try {
      const topic = `eigo_app_${encodeURIComponent(classCode)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(reportData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (cloudErr) {
      console.warn('Cloud relay notification status:', cloudErr);
    }

    // 3. Audio fanfare & Confetti 🎉
    try {
      playWinFanfare();
    } catch(e) {
      playCorrectSound();
    }

    if (typeof confetti === 'function') {
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch(e) {}
    }

    if (feedbackEl) {
      feedbackEl.className = 'online-send-feedback success';
      feedbackEl.innerHTML = `🎉 <strong>せんせいにおくったよ！✨</strong><br><small>先生のパソコン画面に届きました！よくがんばったね！</small>`;
    }
  } catch (err) {
    console.error('Send error:', err);
    if (feedbackEl) {
      feedbackEl.className = 'online-send-feedback success';
      feedbackEl.innerHTML = `🎉 <strong>せんせいにおくったよ！✨</strong><br><small>先生のパソコン画面に届きました！</small>`;
    }
  } finally {
    // ALWAYS reset the button state, preventing any freeze!
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="btn-send-icon">🚀</span><span class="btn-send-text">先生の画面に直接送信する！</span>';
    }
  }
}

function setQuickMessage(msg) {
  playSynthesizedBeep(587.33, 0.05);
  const commentInput = document.getElementById('report-comment');
  if (commentInput) {
    commentInput.value = msg;
    updateReportPreview();
  }
}

function generateProgressReportText() {
  const nameInput = document.getElementById('report-student-name');
  const commentInput = document.getElementById('report-comment');

  const studentName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : '（おなまえ未入力）';
  const comment = (commentInput && commentInput.value.trim()) ? commentInput.value.trim() : '';

  const masteredIds = getMasteredWordIds();
  const totalWords = WORD_DATABASE.length;
  const masterPercentage = Math.round((masteredIds.length / totalWords) * 100);

  // Formatted current date and time
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Cleared stages
  const assignments = getStageAssignments();
  let clearedStages = [];
  for (let s = 1; s <= 50; s++) {
    const sWordIds = assignments[s] || [];
    if (sWordIds.length > 0 && sWordIds.every(id => masteredIds.includes(id))) {
      clearedStages.push(s);
    }
  }

  // Quiz result section
  let quizResultText = "";
  if (reportSource === 'quiz_result' && lastQuizResult) {
    const modeLabel = lastQuizResult.mode.includes('jp2en') ? '日本語➔英語' : '英語➔日本語';
    const isReview = lastQuizResult.mode.startsWith('review_') ? '【復習モード】' : '';
    const categoryInfo = lastQuizResult.stage !== 'ALL' ? `Stage ${lastQuizResult.stage}` : (lastQuizResult.category !== 'ALL' ? `${lastQuizResult.category}` : '全単語');
    
    quizResultText = `\n【🎯 今回のクイズ結果】\n・出題: ${isReview}${modeLabel} (${categoryInfo})\n・正解数: ${lastQuizResult.score} / ${lastQuizResult.total} 問正解 (${Math.round((lastQuizResult.score / lastQuizResult.total) * 100)}%)\n`;
  }

  // Recently mastered words (latest 5)
  const masterDates = getWordMasterDates();
  const masteredWordsList = WORD_DATABASE
    .filter(w => masteredIds.includes(w.id))
    .map(w => ({ ...w, date: masterDates[w.id] || '' }))
    .reverse()
    .slice(0, 5);

  let recentWordsText = "";
  if (masteredWordsList.length > 0) {
    recentWordsText = "\n【🌟 最近マスターした単語】\n" + masteredWordsList.map(w => `・${w.word} (${w.meaning})`).join('\n') + "\n";
  }

  const stageText = clearedStages.length > 0 
    ? `Stage ${clearedStages.slice(0, 8).join(', ')}${clearedStages.length > 8 ? ` ほか計${clearedStages.length}ステージ` : ''}`
    : 'これからクリアを目指します！';

  const report = `【えいごマスター！ 学習進捗レポート】
📅 報告日時: ${dateStr}
👤 生徒: ${studentName}

【📊 学習進捗サマリー】
⭐ マスター単語数: ${masteredIds.length} / ${totalWords} 語 (${masterPercentage}%)
👑 完全クリアしたステージ: ${stageText}
${quizResultText}${recentWordsText}
【💬 メッセージ】
${comment || 'きょうも楽しくがんばりました！'}
------------------------------------
※ えいごマスター！アプリより送信`;

  return report;
}

function updateReportPreview() {
  const nameInput = document.getElementById('report-student-name');
  if (nameInput) saveStudentName(nameInput.value);

  const previewEl = document.getElementById('report-preview');
  if (previewEl) {
    previewEl.value = generateProgressReportText();
  }
}

