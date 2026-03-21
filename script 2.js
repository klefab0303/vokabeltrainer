// LocalStorage Keys
const VOCABULARIES_KEY = "latin-vocab-vocabularies";
const PRACTICE_RESULTS_KEY = "latin-vocab-practice-results";
const VOCABS_FOLDER = "vocabs/";

// State
let vocabularies = [];
let practiceResults = [];
let selectedLessons = [];
let currentPracticeCards = [];
let currentCardIndex = 0;
let sessionResults = { known: 0, unknown: 0, wrongCards: [] };

// DOM Elements
let homeView, selectView, practiceView, resultsView;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  homeView = document.getElementById("home-view");
  selectView = document.getElementById("select-view");
  practiceView = document.getElementById("practice-view");
  resultsView = document.getElementById("results-view");
  
  loadData();
  updateStats();
  setupEventListeners();
  loadPresetVocabularies();
});

// Data Functions
function loadData() {
  const vocabData = localStorage.getItem(VOCABULARIES_KEY);
  const resultsData = localStorage.getItem(PRACTICE_RESULTS_KEY);
  
  vocabularies = vocabData ? JSON.parse(vocabData) : [];
  practiceResults = resultsData ? JSON.parse(resultsData) : [];
}

function saveVocabularies() {
  localStorage.setItem(VOCABULARIES_KEY, JSON.stringify(vocabularies));
}

function savePracticeResults() {
  localStorage.setItem(PRACTICE_RESULTS_KEY, JSON.stringify(practiceResults));
}

// ============ PRESET VOCABULARIES ============

function loadPresetVocabularies() {
  const presetList = document.getElementById("preset-list");
  
  fetch(VOCABS_FOLDER + "manifest.json")
    .then(response => {
      if (!response.ok) throw new Error("Manifest nicht gefunden");
      return response.json();
    })
    .then(presets => {
      if (presets.length === 0) {
        presetList.innerHTML = '<p class="text-muted">Keine voreingestellten Vokabeln verfügbar.</p>';
        return;
      }
      
      presetList.innerHTML = presets.map(preset => `
        <button class="preset-btn" data-file="${preset.file}">
          📄 ${preset.name}
        </button>
      `).join("");
      
      // Add click handlers
      presetList.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          loadPresetFile(btn.dataset.file, btn);
        });
      });
    })
    .catch(err => {
      presetList.innerHTML = '<p class="text-muted">Keine voreingestellten Vokabeln verfügbar.</p>';
      console.log("Preset-Manifest nicht geladen:", err.message);
    });
}

function loadPresetFile(filename, buttonEl) {
  buttonEl.disabled = true;
  buttonEl.textContent = "⏳ Lade...";
  
  fetch(VOCABS_FOLDER + filename)
    .then(response => {
      if (!response.ok) throw new Error("Datei nicht gefunden: " + filename);
      return response.text();
    })
    .then(text => {
      processCSVText(text);
      buttonEl.textContent = "✅ Geladen!";
      setTimeout(() => {
        loadPresetVocabularies(); // Reset button states
      }, 1500);
    })
    .catch(err => {
      buttonEl.textContent = "❌ Fehler";
      buttonEl.disabled = false;
      showUploadStatus("Fehler beim Laden: " + err.message, "error");
      setTimeout(() => {
        loadPresetVocabularies();
      }, 1500);
    });
}

// ============ SHARED CSV PROCESSING ============

function processCSVText(text) {
  try {
    const lines = text.split("\n").filter(line => line.trim());
    const startIndex = lines[0].toLowerCase().includes("latein") ? 1 : 0;
    
    const newVocabs = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = parseCSVLine(line);
      
      if (parts.length >= 4) {
        const lessonStr = parts[parts.length - 1].trim();
        const lessonNum = parseInt(lessonStr, 10);
        
        if (isNaN(lessonNum)) continue;
        
        const germanParts = parts.slice(2, parts.length - 1);
        const germanTranslation = germanParts.join("; ").trim();
        
        newVocabs.push({
          id: generateId(),
          latin_word: parts[0].trim(),
          forms: parts[1].trim() || null,
          german_translation: germanTranslation,
          lesson_number: lessonNum,
          created_at: new Date().toISOString()
        });
      }
    }
    
    if (newVocabs.length > 0) {
      vocabularies = newVocabs;
      practiceResults = [];
      selectedLessons = [];
      saveVocabularies();
      savePracticeResults();
      updateStats();
      showUploadStatus("✓ " + newVocabs.length + " Vokabeln erfolgreich geladen!", "success");
    } else {
      showUploadStatus("Keine gültigen Vokabeln gefunden.", "error");
    }
  } catch (error) {
    showUploadStatus("Fehler beim Verarbeiten der Datei.", "error");
  }
}

// Stats
function updateStats() {
  const total = vocabularies.length;
  const practiced = practiceResults.length;
  const known = practiceResults.filter(r => r.known).length;
  const unknown = practiced - known;
  const percentage = practiced > 0 ? Math.round((known / practiced) * 100) : 0;
  
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-practiced").textContent = practiced;
  document.getElementById("stat-known").textContent = known;
  document.getElementById("stat-percentage").textContent = percentage + "%";
  
  document.getElementById("start-btn").disabled = total === 0;
  updateLessonStats();
}

function updateLessonStats() {}

// Stats Modal Functions
function showStatsModal() {
  document.getElementById("stats-modal").classList.remove("hidden");
  renderBarChart();
}

function hideStatsModal() {
  document.getElementById("stats-modal").classList.add("hidden");
}

function renderBarChart() {
  const chartContainer = document.getElementById("bar-chart");
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) {
      lessonMap.set(v.lesson_number, { total: 0, known: 0, unknown: 0 });
    }
    lessonMap.get(v.lesson_number).total++;
  });
  
  practiceResults.forEach(r => {
    const vocab = vocabularies.find(v => v.id === r.vocabulary_id);
    if (vocab && lessonMap.has(vocab.lesson_number)) {
      const stats = lessonMap.get(vocab.lesson_number);
      if (r.known) { stats.known++; } else { stats.unknown++; }
    }
  });
  
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  
  if (lessons.length === 0) {
    chartContainer.innerHTML = '<p class="no-stats">Noch keine Vokabeln geladen.</p>';
    return;
  }
  
  const maxValue = Math.max(...lessons.map(([_, stats]) => stats.known + stats.unknown), 1);
  
  chartContainer.innerHTML = `
    <div class="chart-container">
      <div class="chart-y-axis">
        <span class="y-label">${maxValue}</span>
        <span class="y-label">${Math.round(maxValue / 2)}</span>
        <span class="y-label">0</span>
      </div>
      <div class="chart-bars">
        ${lessons.map(([num, stats]) => {
          const knownHeight = (stats.known / maxValue) * 100;
          const unknownHeight = (stats.unknown / maxValue) * 100;
          return `
            <div class="bar-group">
              <div class="bar-stack" title="Lektion ${num}: ${stats.known} gewusst, ${stats.unknown} nicht gewusst">
                <div class="bar known" style="height: ${knownHeight}%"></div>
                <div class="bar unknown" style="height: ${unknownHeight}%"></div>
              </div>
              <span class="bar-label">L${num}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

// Event Listeners
function setupEventListeners() {
  document.getElementById("start-btn").addEventListener("click", showSelectView);
  document.getElementById("back-to-home").addEventListener("click", showHomeView);
  document.getElementById("back-to-select").addEventListener("click", showSelectView);
  
  document.getElementById("csv-input").addEventListener("change", handleCSVUpload);
  
  document.getElementById("select-all-btn").addEventListener("click", selectAllLessons);
  document.getElementById("deselect-all-btn").addEventListener("click", deselectAllLessons);
  document.getElementById("start-practice-btn").addEventListener("click", startPractice);
  
  document.getElementById("flashcard").addEventListener("click", flipCard);
  document.getElementById("known-btn").addEventListener("click", () => answerCard(true));
  document.getElementById("unknown-btn").addEventListener("click", () => answerCard(false));
  
  document.getElementById("practice-again-btn").addEventListener("click", () => {
    if (selectedLessons.length === 0) {
      showSelectView();
    } else {
      startPractice();
    }
  });
  document.getElementById("practice-wrong-btn").addEventListener("click", practiceWrongCards);
  document.getElementById("back-home-btn").addEventListener("click", showHomeView);
  
  document.getElementById("show-stats-btn").addEventListener("click", showStatsModal);
  document.getElementById("close-stats-btn").addEventListener("click", hideStatsModal);
  document.getElementById("stats-modal-overlay").addEventListener("click", hideStatsModal);
}

// CSV Upload (file input)
function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    processCSVText(e.target.result);
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length > 0 || result.length > 0) {
    result.push(current.trim());
  }
  
  return result.map(s => s.replace(/^"|"$/g, "").trim());
}

function showUploadStatus(message, type) {
  const status = document.getElementById("upload-status");
  status.textContent = message;
  status.className = type;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Navigation
function showHomeView() {
  homeView.classList.remove("hidden");
  selectView.classList.add("hidden");
  practiceView.classList.add("hidden");
  updateStats();
}

function showSelectView() {
  homeView.classList.add("hidden");
  selectView.classList.remove("hidden");
  practiceView.classList.add("hidden");
  resultsView.classList.add("hidden");
  renderLessons();
}

function showPracticeView() {
  homeView.classList.add("hidden");
  selectView.classList.add("hidden");
  practiceView.classList.remove("hidden");
  resultsView.classList.add("hidden");
}

// Lesson Selection
function renderLessons() {
  const lessonsGrid = document.getElementById("lessons-grid");
  const lessonMap = new Map();
  
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) {
      lessonMap.set(v.lesson_number, 0);
    }
    lessonMap.set(v.lesson_number, lessonMap.get(v.lesson_number) + 1);
  });
  
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  
  lessonsGrid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${selectedLessons.includes(num) ? 'selected' : ''}" data-lesson="${num}">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>
  `).join("");
  
  document.querySelectorAll(".lesson-item").forEach(item => {
    item.addEventListener("click", () => {
      const lesson = parseInt(item.dataset.lesson);
      toggleLesson(lesson);
    });
  });
  
  updateStartButton();
}

function toggleLesson(lesson) {
  const index = selectedLessons.indexOf(lesson);
  if (index > -1) {
    selectedLessons.splice(index, 1);
  } else {
    selectedLessons.push(lesson);
  }
  renderLessons();
}

function selectAllLessons() {
  const allLessons = [...new Set(vocabularies.map(v => v.lesson_number))];
  selectedLessons = allLessons;
  renderLessons();
}

function deselectAllLessons() {
  selectedLessons = [];
  renderLessons();
}

function updateStartButton() {
  const btn = document.getElementById("start-practice-btn");
  btn.disabled = selectedLessons.length === 0;
}

// Practice Mode
function startPractice() {
  currentPracticeCards = vocabularies
    .filter(v => selectedLessons.includes(v.lesson_number))
    .sort(() => Math.random() - 0.5);
  
  if (currentPracticeCards.length === 0) {
    alert("Keine Vokabeln in den ausgewählten Lektionen gefunden.");
    return;
  }
  
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  
  showPracticeView();
  
  const practiceContainer = document.querySelector(".practice-container");
  const resultsViewEl = document.getElementById("results-view");
  if (practiceContainer) practiceContainer.classList.remove("hidden");
  if (resultsViewEl) resultsViewEl.classList.add("hidden");
  
  showCard();
}

function showCard() {
  if (currentCardIndex >= currentPracticeCards.length) {
    showResults();
    return;
  }
  
  const card = currentPracticeCards[currentCardIndex];
  const flashcard = document.getElementById("flashcard");
  
  flashcard.classList.remove("flipped");
  document.getElementById("answer-buttons").classList.add("hidden");
  
  document.getElementById("latin-word").textContent = card.latin_word;
  document.getElementById("german-word").textContent = card.german_translation;
  document.getElementById("german-forms").textContent = card.forms || "";
  
  const progress = ((currentCardIndex + 1) / currentPracticeCards.length) * 100;
  document.getElementById("progress-text").textContent = 
    "Karte " + (currentCardIndex + 1) + " von " + currentPracticeCards.length;
  document.getElementById("progress-fill").style.width = progress + "%";
}

function flipCard() {
  const flashcard = document.getElementById("flashcard");
  if (!flashcard.classList.contains("flipped")) {
    flashcard.classList.add("flipped");
    document.getElementById("answer-buttons").classList.remove("hidden");
  }
}

function answerCard(known) {
  const card = currentPracticeCards[currentCardIndex];
  
  practiceResults.push({
    id: generateId(),
    vocabulary_id: card.id,
    known: known,
    practiced_at: new Date().toISOString()
  });
  savePracticeResults();
  
  if (known) {
    sessionResults.known++;
  } else {
    sessionResults.unknown++;
    sessionResults.wrongCards.push(card);
  }
  
  currentCardIndex++;
  showCard();
}

// Results
function showResults() {
  const practiceContainer = document.querySelector(".practice-container");
  const resultsViewEl = document.getElementById("results-view");
  
  if (practiceContainer) practiceContainer.classList.add("hidden");
  if (resultsViewEl) resultsViewEl.classList.remove("hidden");
  
  const total = sessionResults.known + sessionResults.unknown;
  const percentage = total > 0 ? Math.round((sessionResults.known / total) * 100) : 0;
  
  document.getElementById("result-total").textContent = total;
  document.getElementById("result-known").textContent = sessionResults.known;
  document.getElementById("result-unknown").textContent = sessionResults.unknown;
  document.getElementById("result-percentage").textContent = percentage + "%";
  
  const practiceWrongBtn = document.getElementById("practice-wrong-btn");
  if (practiceWrongBtn) {
    if (sessionResults.wrongCards.length > 0) {
      practiceWrongBtn.classList.remove("hidden");
      practiceWrongBtn.textContent = "🔄 Falsche wiederholen (" + sessionResults.wrongCards.length + ")";
    } else {
      practiceWrongBtn.classList.add("hidden");
    }
  }
  
  updateStats();
}

function practiceWrongCards() {
  if (sessionResults.wrongCards.length === 0) {
    alert("Keine falschen Vokabeln zum Wiederholen.");
    return;
  }
  
  currentPracticeCards = [...sessionResults.wrongCards].sort(() => Math.random() - 0.5);
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  
  showPracticeView();
  
  const practiceContainer = document.querySelector(".practice-container");
  const resultsViewEl = document.getElementById("results-view");
  if (practiceContainer) practiceContainer.classList.remove("hidden");
  if (resultsViewEl) resultsViewEl.classList.add("hidden");
  
  showCard();
}
