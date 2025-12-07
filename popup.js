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
let isBreak = false;
let breakSeconds = 0;
let sessionDuration = 25 * 60; // Track the session duration for break calculation
let totalRuntime = 0; // Total runtime across all cycles in seconds
let sessionStartTime = null; // Track when current session started

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
const totalRuntimeEl = document.getElementById("totalRuntime");

// Initialize on popup open
chrome.storage.sync.get(["blocklist", "focus", "timerSeconds", "timerStartTime", "isPaused", "isBreak", "breakSeconds", "sessionDuration", "totalRuntime", "sessionStartTime"], data => {
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

  // Restore break state
  if (data.isBreak !== undefined) {
    isBreak = data.isBreak;
  }
  if (data.breakSeconds !== undefined) {
    breakSeconds = data.breakSeconds;
  }
  if (data.sessionDuration !== undefined) {
    sessionDuration = data.sessionDuration;
  } else {
    // Initialize session duration if not set
    sessionDuration = 25 * 60;
    chrome.storage.sync.set({ sessionDuration: sessionDuration });
  }
  if (data.totalRuntime !== undefined) {
    totalRuntime = data.totalRuntime;
  }
  if (data.sessionStartTime !== undefined && data.sessionStartTime !== null) {
    sessionStartTime = data.sessionStartTime;
  }

  // Update total runtime display
  updateTotalRuntimeDisplay();

  if (data.timerStartTime && !data.isPaused) {
    // Calculate remaining time
    const elapsed = Math.floor((Date.now() - data.timerStartTime) / 1000);
    if (isBreak) {
      breakSeconds = Math.max(0, breakSeconds - elapsed);
      updateTimeDisplay();
      if (breakSeconds > 0) {
        startBreak(false);
      } else {
        // Break finished while popup was closed
        endBreak();
      }
    } else {
      seconds = Math.max(0, seconds - elapsed);
      updateTimeDisplay();
      
      if (seconds > 0) {
        startTimer(false);
      } else {
        // Timer finished while popup was closed
        onTimerComplete();
      }
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
  const displaySeconds = isBreak ? breakSeconds : seconds;
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  timeDisplay.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
}

// Calculate break duration based on session duration
function getBreakDuration(sessionDurationSeconds) {
  if (sessionDurationSeconds === 25 * 60) {
    return 5 * 60; // 5 minutes for 25 min session
  } else if (sessionDurationSeconds === 45 * 60) {
    return 15 * 60; // 15 minutes for 45 min session
  } else if (sessionDurationSeconds === 60 * 60) {
    return 25 * 60; // 25 minutes for 60 min session
  }
  return 5 * 60; // Default 5 minutes
}

// Update total runtime display
function updateTotalRuntimeDisplay() {
  if (totalRuntimeEl) {
    let displayRuntime = totalRuntime;
    
    // If there's an active session, add its elapsed time
    if (sessionStartTime && !isBreak && !isPaused) {
      const sessionElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      displayRuntime += sessionElapsed;
    }
    
    const hours = Math.floor(displayRuntime / 3600);
    const minutes = Math.floor((displayRuntime % 3600) / 60);
    const seconds = displayRuntime % 60;
    
    // Format: show hours, minutes, and seconds
    let displayText = '';
    if (hours > 0) {
      displayText = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      displayText = `${minutes}m ${seconds}s`;
    } else {
      displayText = `${seconds}s`;
    }
    
    totalRuntimeEl.textContent = displayText;
  }
}

function updateStatus(isActive) {
  if (isBreak) {
    statusEl.textContent = "Break";
    statusEl.classList.add("break");
    statusEl.classList.remove("active");
  } else if (isActive) {
    statusEl.textContent = "Active";
    statusEl.classList.add("active");
    statusEl.classList.remove("break");
  } else {
    statusEl.textContent = "Inactive";
    statusEl.classList.remove("active");
    statusEl.classList.remove("break");
  }
}

function startTimer(saveState = true) {
  if (interval) clearInterval(interval);
  
  isPaused = false;
  isBreak = false;
  timerStartTime = Date.now();
  
  // Track session start time for total runtime (only if starting a new session, not resuming)
  if (!sessionStartTime && saveState) {
    sessionStartTime = Date.now();
  }
  
  if (saveState) {
    chrome.storage.sync.set({ 
      focus: true, 
      timerStartTime: timerStartTime,
      timerSeconds: seconds,
      isPaused: false,
      isBreak: false,
      sessionStartTime: sessionStartTime
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
      onTimerComplete();
    }
  }, 1000);
}

// Handle timer completion - start break
function onTimerComplete() {
  // Add completed session time to total runtime
  // Use session duration since timer completed (accounting for any pauses/resumes)
  totalRuntime += sessionDuration;
  
  // Calculate break duration
  breakSeconds = getBreakDuration(sessionDuration);
  
  // Reset session start time
  sessionStartTime = null;
  
  chrome.storage.sync.set({ 
    focus: false, // Disable blocking during break
    timerStartTime: null,
    isPaused: false,
    isBreak: true,
    breakSeconds: breakSeconds,
    totalRuntime: totalRuntime,
    sessionStartTime: null // Reset session start time
  });
  
  updateStatus(false);
  updateTotalRuntimeDisplay();
  alert(`🍅 Pomodoro Complete! Time for a ${Math.floor(breakSeconds / 60)} minute break!`);
  
  // Start break
  startBreak();
}

// Start break timer
function startBreak(saveState = true) {
  if (interval) clearInterval(interval);
  
  isPaused = false;
  isBreak = true;
  timerStartTime = Date.now();
  
  if (saveState) {
    chrome.storage.sync.set({ 
      focus: false, // No blocking during break
      timerStartTime: timerStartTime,
      breakSeconds: breakSeconds,
      isPaused: false,
      isBreak: true
    }, () => {
      console.log("Break started - blocking disabled");
      updateStatus(false);
    });
  }

  showRunningState();

  interval = setInterval(() => {
    breakSeconds--;
    updateTimeDisplay();

    if (saveState) {
      chrome.storage.sync.set({ breakSeconds: breakSeconds });
    }

    if (breakSeconds <= 0) {
      clearInterval(interval);
      interval = null;
      endBreak();
    }
  }, 1000);
}

// End break and start new cycle
function endBreak() {
  chrome.storage.sync.set({ 
    focus: false, 
    timerStartTime: null,
    isPaused: false,
    isBreak: false,
    breakSeconds: 0,
    sessionStartTime: null // Reset for new cycle
  });
  
  sessionStartTime = null; // Reset for new cycle
  
  updateStatus(false);
  alert("Break complete! Starting new Pomodoro cycle.");
  
  // Reset timer to session duration and start new cycle
  seconds = sessionDuration;
  updateTimeDisplay();
  startTimer();
}

function pauseTimer() {
  if (!interval) return;
  
  clearInterval(interval);
  interval = null;
  isPaused = true;
  
  if (isBreak) {
    chrome.storage.sync.set({ 
      isPaused: true,
      breakSeconds: breakSeconds,
      timerStartTime: null
    });
  } else {
    chrome.storage.sync.set({ 
      isPaused: true,
      timerSeconds: seconds,
      timerStartTime: null
    });
  }
  
  showPauseState();
}

function resumeTimer() {
  if (isBreak) {
    if (breakSeconds <= 0) return;
    isPaused = false;
    timerStartTime = Date.now();
    
    chrome.storage.sync.set({ 
      isPaused: false,
      timerStartTime: timerStartTime,
      breakSeconds: breakSeconds
    });
    
    startBreak(false);
  } else {
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
}

function stopTimer() {
  clearInterval(interval);
  interval = null;
  isPaused = false;
  isBreak = false;
  seconds = sessionDuration;
  breakSeconds = 0;
  timerStartTime = null;
  sessionStartTime = null;
  
  chrome.storage.sync.set({ 
    focus: false, 
    timerStartTime: null,
    timerSeconds: sessionDuration,
    isPaused: false,
    isBreak: false,
    breakSeconds: 0,
    sessionStartTime: null
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
  if (isBreak) {
    if (breakSeconds <= 0) {
      breakSeconds = getBreakDuration(sessionDuration);
      updateTimeDisplay();
    }
    startBreak();
  } else {
    if (seconds <= 0) {
      seconds = sessionDuration;
      updateTimeDisplay();
    }
    startTimer();
  }
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
    sessionDuration = minutes * 60; // Update session duration
    updateTimeDisplay();
    
    // Save session duration
    chrome.storage.sync.set({ sessionDuration: sessionDuration });
    
    // Update active preset
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

// Update timer display and sync state when popup is open
// This only syncs the display - the main interval handles the actual countdown
setInterval(() => {
  // Only sync if timer is running but we don't have an active interval
  // (this handles the case where timer was started when popup was closed)
  if (!interval && !isPaused) {
    chrome.storage.sync.get(["timerStartTime", "timerSeconds", "breakSeconds", "isBreak"], data => {
      if (data.timerStartTime && !isPaused) {
        const elapsed = Math.floor((Date.now() - data.timerStartTime) / 1000);
        if (data.isBreak) {
          const remaining = Math.max(0, (data.breakSeconds || breakSeconds) - elapsed);
          if (remaining !== breakSeconds) {
            breakSeconds = remaining;
            updateTimeDisplay();
            // If break finished, end it
            if (breakSeconds <= 0) {
              endBreak();
            }
          }
        } else {
          const remaining = Math.max(0, (data.timerSeconds || seconds) - elapsed);
          if (remaining !== seconds) {
            seconds = remaining;
            updateTimeDisplay();
            // If timer finished, complete it
            if (seconds <= 0) {
              onTimerComplete();
            }
          }
        }
      }
    });
  }
  
  // Update total runtime display
  updateTotalRuntimeDisplay();
}, 1000);
