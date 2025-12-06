// Default blocked sites
const DEFAULT_BLOCKLIST = [
  "instagram.com",
  "tiktok.com",
  "reddit.com",
  "netflix.com",
  "hotstar.com",
  "steampowered.com",
  "roblox.com"
];

// Timer state
let seconds = 25 * 60;
let interval = null;
let isPaused = false;
let timerStartTime = null;
let savedSeconds = null;

// DOM elements
const timeDisplay = document.getElementById("time");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const blockCountEl = document.getElementById("blockCount");
const blockListEl = document.getElementById("blockList");
const emptyStateEl = document.getElementById("emptyState");
const newSiteInput = document.getElementById("newSite");
const addSiteBtn = document.getElementById("addSite");
const presetBtns = document.querySelectorAll(".preset-btn");

// Initialize on popup open
chrome.storage.sync.get(["blocklist", "focus", "timerSeconds", "timerStartTime", "isPaused"], data => {
  // Initialize blocklist
  if (!data.blocklist) {
    chrome.storage.sync.set({ blocklist: DEFAULT_BLOCKLIST });
    renderBlockList(DEFAULT_BLOCKLIST);
  } else {
    renderBlockList(data.blocklist);
  }

  // Restore timer state
  if (data.timerSeconds !== undefined) {
    seconds = data.timerSeconds;
    updateTimeDisplay();
  }

  if (data.timerStartTime && !data.isPaused) {
    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - data.timerStartTime) / 1000);
    seconds = Math.max(0, seconds - elapsed);
    updateTimeDisplay();
    
    if (seconds > 0) {
      startTimer(false);
    } else {
      // Timer finished while popup was closed
      chrome.storage.sync.set({ focus: false, timerStartTime: null, isPaused: false });
      updateStatus(false);
    }
  } else if (data.isPaused) {
    isPaused = true;
    showPauseState();
  }

  // Update status
  updateStatus(data.focus || false);
});

// Render blocklist
function renderBlockList(list) {
  blockListEl.innerHTML = "";
  
  if (list.length === 0) {
    emptyStateEl.classList.remove("hidden");
    blockCountEl.textContent = "0";
    return;
  }

  emptyStateEl.classList.add("hidden");
  blockCountEl.textContent = list.length;

  list.forEach(site => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="site-name">${site}</span>
      <button class="remove-btn" data-site="${site}">×</button>
    `;
    blockListEl.appendChild(li);
  });
}

// Add site to blocklist
addSiteBtn.onclick = () => {
  const newSite = newSiteInput.value.trim().toLowerCase();
  if (!newSite) return;

  // Remove protocol if present
  const cleanSite = newSite.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  chrome.storage.sync.get("blocklist", data => {
    const blocklist = data.blocklist || DEFAULT_BLOCKLIST;
    if (blocklist.includes(cleanSite)) {
      alert("Site is already in the blocklist!");
      return;
    }
    const updated = [...blocklist, cleanSite];
    chrome.storage.sync.set({ blocklist: updated });
    renderBlockList(updated);
    newSiteInput.value = "";
  });
};

// Allow Enter key to add site
newSiteInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addSiteBtn.click();
  }
});

// Remove site
blockListEl.addEventListener("click", e => {
  if (e.target.classList.contains("remove-btn")) {
    const site = e.target.dataset.site;
    chrome.storage.sync.get("blocklist", data => {
      const updated = data.blocklist.filter(s => s !== site);
      chrome.storage.sync.set({ blocklist: updated });
      renderBlockList(updated);
    });
  }
});

// Timer functions
function updateTimeDisplay() {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timeDisplay.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateStatus(isActive) {
  if (isActive) {
    statusEl.textContent = "Active";
    statusEl.classList.add("active");
  } else {
    statusEl.textContent = "Inactive";
    statusEl.classList.remove("active");
  }
}

function startTimer(saveState = true) {
  if (interval) clearInterval(interval);
  
  isPaused = false;
  timerStartTime = Date.now();
  
  if (saveState) {
    chrome.storage.sync.set({ 
      focus: true, 
      timerStartTime: timerStartTime,
      timerSeconds: seconds,
      isPaused: false
    }, () => {
      // Ensure blocking rules are updated
      console.log("Focus mode activated - blocking should be active");
      updateStatus(true);
    });
  }

  showRunningState();

  interval = setInterval(() => {
    seconds--;
    updateTimeDisplay();

    if (saveState) {
      chrome.storage.sync.set({ timerSeconds: seconds });
    }

    if (seconds <= 0) {
      clearInterval(interval);
      interval = null;
      chrome.storage.sync.set({ 
        focus: false, 
        timerStartTime: null,
        timerSeconds: 25 * 60,
        isPaused: false
      });
      updateStatus(false);
      showStoppedState();
      alert("🍅 Pomodoro Complete! Time for a break!");
      seconds = 25 * 60;
      updateTimeDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  if (!interval) return;
  
  clearInterval(interval);
  interval = null;
  isPaused = true;
  
  chrome.storage.sync.set({ 
    isPaused: true,
    timerSeconds: seconds,
    timerStartTime: null
  });
  
  showPauseState();
}

function resumeTimer() {
  if (seconds <= 0) return;
  
  isPaused = false;
  timerStartTime = Date.now();
  
  chrome.storage.sync.set({ 
    isPaused: false,
    timerStartTime: timerStartTime,
    timerSeconds: seconds
  });
  
  startTimer(false);
}

function stopTimer() {
  clearInterval(interval);
  interval = null;
  isPaused = false;
  seconds = 25 * 60;
  timerStartTime = null;
  
  chrome.storage.sync.set({ 
    focus: false, 
    timerStartTime: null,
    timerSeconds: 25 * 60,
    isPaused: false
  });
  
  updateStatus(false);
  updateTimeDisplay();
  showStoppedState();
}

function showRunningState() {
  startBtn.style.display = "none";
  pauseBtn.style.display = "block";
  resumeBtn.style.display = "none";
  stopBtn.style.display = "block";
}

function showPauseState() {
  startBtn.style.display = "none";
  pauseBtn.style.display = "none";
  resumeBtn.style.display = "block";
  stopBtn.style.display = "block";
}

function showStoppedState() {
  startBtn.style.display = "block";
  pauseBtn.style.display = "none";
  resumeBtn.style.display = "none";
  stopBtn.style.display = "block";
}

// Timer controls
startBtn.onclick = () => {
  if (seconds <= 0) {
    seconds = 25 * 60;
    updateTimeDisplay();
  }
  startTimer();
};

pauseBtn.onclick = pauseTimer;
resumeBtn.onclick = resumeTimer;
stopBtn.onclick = stopTimer;

// Preset buttons
presetBtns.forEach(btn => {
  btn.onclick = () => {
    if (interval) {
      if (!confirm("Timer is running. Stop and reset to new time?")) return;
      stopTimer();
    }
    
    const minutes = parseInt(btn.dataset.minutes);
    seconds = minutes * 60;
    updateTimeDisplay();
    
    // Update active preset
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

// Update timer every second when popup is open and timer is running
setInterval(() => {
  if (interval && !isPaused) {
    chrome.storage.sync.get(["timerStartTime", "timerSeconds"], data => {
      if (data.timerStartTime && !isPaused) {
        const elapsed = Math.floor((Date.now() - data.timerStartTime) / 1000);
        const remaining = Math.max(0, (data.timerSeconds || seconds) - elapsed);
        if (remaining !== seconds) {
          seconds = remaining;
          updateTimeDisplay();
        }
      }
    });
  }
}, 1000);
