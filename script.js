
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
// LocalStorage Keys
const VOCABULARIES_KEY = "latin-vocab-vocabularies";
const PRACTICE_RESULTS_KEY = "latin-vocab-practice-results";

// State
let vocabularies = [];
let practiceResults = [];
let selectedLessons = [];
let currentPracticeCards = [];
let currentCardIndex = 0;
let sessionResults = { known: 0, unknown: 0 };

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
  const percentage = practiced > 0 ? Math.round((known / practiced) * 100) : 0;
  
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-practiced").textContent = practiced;
  document.getElementById("stat-known").textContent = known;
  document.getElementById("stat-percentage").textContent = percentage + "%";
  
  // Enable/disable start button
  document.getElementById("start-btn").disabled = total === 0;
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
