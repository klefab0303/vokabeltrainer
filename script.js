// LocalStorage Keys
const VOCABULARIES_KEY = "latin-vocab-vocabularies";
const PRACTICE_RESULTS_KEY = "latin-vocab-practice-results";

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
  // Get DOM elements after page load
  homeView = document.getElementById("home-view");
  selectView = document.getElementById("select-view");
  practiceView = document.getElementById("practice-view");
  resultsView = document.getElementById("results-view");
  
  loadData();
  updateStats();
  setupEventListeners();
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
  
  // Enable/disable start button
  document.getElementById("start-btn").disabled = total === 0;
  
  // Update lesson stats
  updateLessonStats();
}

function updateLessonStats() {
  const lessonStatsContainer = document.getElementById("lesson-stats");
  if (!lessonStatsContainer) return;
  
  // Get unique lessons
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) {
      lessonMap.set(v.lesson_number, { total: 0, known: 0, unknown: 0 });
    }
    const stats = lessonMap.get(v.lesson_number);
    stats.total++;
  });
  
  // Count practice results per lesson (only last result per vocabulary)
  const lastResultPerVocab = new Map();
  practiceResults.forEach(r => {
    lastResultPerVocab.set(r.vocabulary_id, r.known);
  });
  
  vocabularies.forEach(v => {
    if (lastResultPerVocab.has(v.id)) {
      const stats = lessonMap.get(v.lesson_number);
      if (lastResultPerVocab.get(v.id)) {
        stats.known++;
      } else {
        stats.unknown++;
      }
    }
  });
  
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  
  if (lessons.length === 0) {
    lessonStatsContainer.innerHTML = '<p class="no-stats">Noch keine Vokabeln geladen.</p>';
    return;
  }
  
  lessonStatsContainer.innerHTML = lessons.map(([num, stats]) => {
    const practiced = stats.known + stats.unknown;
    const percentage = practiced > 0 ? Math.round((stats.known / practiced) * 100) : 0;
    const progressWidth = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
    
    return `
      <div class="lesson-stat-row">
        <div class="lesson-stat-header">
          <span class="lesson-stat-name">Lektion ${num}</span>
          <span class="lesson-stat-numbers">${stats.known}/${stats.total} (${progressWidth}%)</span>
        </div>
        <div class="lesson-stat-bar">
          <div class="lesson-stat-fill" style="width: ${progressWidth}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  document.getElementById("start-btn").addEventListener("click", showSelectView);
  document.getElementById("back-to-home").addEventListener("click", showHomeView);
  document.getElementById("back-to-select").addEventListener("click", showSelectView);
  
  // CSV Upload
  document.getElementById("csv-input").addEventListener("change", handleCSVUpload);
  
  // Lesson Selection
  document.getElementById("select-all-btn").addEventListener("click", selectAllLessons);
  document.getElementById("deselect-all-btn").addEventListener("click", deselectAllLessons);
  document.getElementById("start-practice-btn").addEventListener("click", startPractice);
  
  // Flashcard
  document.getElementById("flashcard").addEventListener("click", flipCard);
  document.getElementById("known-btn").addEventListener("click", () => answerCard(true));
  document.getElementById("unknown-btn").addEventListener("click", () => answerCard(false));
  
  // Results
  document.getElementById("practice-again-btn").addEventListener("click", () => {
    if (selectedLessons.length === 0) {
      showSelectView(); // Go back to selection if no lessons selected
    } else {
      startPractice();
    }
  });
  document.getElementById("practice-wrong-btn").addEventListener("click", practiceWrongCards);
  document.getElementById("back-home-btn").addEventListener("click", showHomeView);
}

// CSV Upload
function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.split("\n").filter(line => line.trim());
      
      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes("latein") ? 1 : 0;
      
      const newVocabs = [];
      console.log(`CSV: ${lines.length} Zeilen gefunden, starte bei Zeile ${startIndex}`);
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines
        
        const parts = parseCSVLine(line);
        console.log(`Zeile ${i + 1}:`, parts);
        
        if (parts.length >= 4) {
          // IMPORTANT: Always take the LAST element as lesson number
          // because translations may contain unquoted semicolons that create extra parts
          const lessonStr = parts[parts.length - 1].trim();
          const lessonNum = parseInt(lessonStr, 10);
          
          // Skip if lesson number is invalid
          if (isNaN(lessonNum)) {
            console.warn(`Zeile ${i + 1} übersprungen: Ungültige Lektionsnummer "${lessonStr}"`);
            continue;
          }
          
          // Combine all middle parts as the German translation (in case of extra splits)
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
          console.log(`✓ Vokabel hinzugefügt: ${parts[0]} (Lektion ${lessonNum})`);
        } else {
          console.warn(`Zeile ${i + 1} übersprungen: Nur ${parts.length} Teile gefunden (brauche mindestens 4)`);
        }
      }
      
      if (newVocabs.length > 0) {
        vocabularies = newVocabs;
        practiceResults = [];
        selectedLessons = []; // Reset selected lessons when new CSV is uploaded
        saveVocabularies();
        savePracticeResults();
        updateStats();
        showUploadStatus(`✓ ${newVocabs.length} Vokabeln erfolgreich hochgeladen!`, "success");
      } else {
        showUploadStatus("Keine gültigen Vokabeln gefunden.", "error");
      }
    } catch (error) {
      showUploadStatus("Fehler beim Lesen der Datei.", "error");
    }
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
      // Handle escaped quotes ("") inside quoted fields
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip the next quote
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
  // Don't forget the last field
  if (current.length > 0 || result.length > 0) {
    result.push(current.trim());
  }
  
  // Clean up quotes and whitespace
  return result.map(s => s.replace(/^"|"$/g, "").trim());
}

// Debug function to log parsing results (can be removed in production)
function debugParseLine(line) {
  const parts = parseCSVLine(line);
  console.log("Parsing line:", line);
  console.log("Result:", parts);
  console.log("Parts count:", parts.length);
  return parts;
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
  
  // Add click handlers
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
  
  // Check if there are cards to practice
  if (currentPracticeCards.length === 0) {
    alert("Keine Vokabeln in den ausgewählten Lektionen gefunden.");
    return;
  }
  
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  
  showPracticeView();
  
  // Reset visibility after view is shown
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
  
  // Reset card
  flashcard.classList.remove("flipped");
  document.getElementById("answer-buttons").classList.add("hidden");
  
  // Update content
  document.getElementById("latin-word").textContent = card.latin_word;
  document.getElementById("latin-forms").textContent = card.forms || "";
  document.getElementById("german-word").textContent = card.german_translation;
  
  // Update progress
  const progress = ((currentCardIndex + 1) / currentPracticeCards.length) * 100;
  document.getElementById("progress-text").textContent = 
    `Karte ${currentCardIndex + 1} von ${currentPracticeCards.length}`;
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
  
  // Record result
  practiceResults.push({
    id: generateId(),
    vocabulary_id: card.id,
    known: known,
    practiced_at: new Date().toISOString()
  });
  savePracticeResults();
  
  // Update session stats
  if (known) {
    sessionResults.known++;
  } else {
    sessionResults.unknown++;
    sessionResults.wrongCards.push(card);
  }
  
  // Next card
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
  
  // Show/hide "practice wrong" button based on whether there are wrong cards
  const practiceWrongBtn = document.getElementById("practice-wrong-btn");
  if (practiceWrongBtn) {
    if (sessionResults.wrongCards.length > 0) {
      practiceWrongBtn.classList.remove("hidden");
      practiceWrongBtn.textContent = `🔄 Falsche wiederholen (${sessionResults.wrongCards.length})`;
    } else {
      practiceWrongBtn.classList.add("hidden");
    }
  }
  
  // Update global stats
  updateStats();
}

// Practice only wrong cards from last session
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
