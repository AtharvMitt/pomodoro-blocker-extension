// Block websites during focus mode
// Simplified: Use webNavigation only to avoid rule ID conflicts

// Method: Use webNavigation for blocking (most reliable, no rule ID issues)
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only process main frame
  if (details.frameId !== 0) return;
  
  try {
    const { focus, blocklist } = await chrome.storage.sync.get(["focus", "blocklist"]);
    
    if (!focus) return;
    if (!blocklist || blocklist.length === 0) return;
    
    const url = details.url;
    if (!url || 
        url.startsWith("chrome://") || 
        url.startsWith("chrome-extension://") || 
        url.startsWith("data:") ||
        url.includes("blocked.html")) {
      return;
    }
    
    let hostname;
    try {
      const urlObj = new URL(url);
      hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");
    } catch (e) {
      return;
    }
    
    const isBlocked = blocklist.some(site => {
      const cleanSite = site.toLowerCase().replace(/^www\./, "").trim();
      if (!cleanSite) return false;
      return hostname === cleanSite || hostname.endsWith(`.${cleanSite}`);
    });
    
    if (isBlocked) {
      const blockedUrl = chrome.runtime.getURL("blocked.html");
      try {
        await chrome.tabs.update(details.tabId, { url: blockedUrl });
      } catch (error) {
        // Tab might be closed
      }
    }
  } catch (error) {
    console.error("Error in webNavigation listener:", error);
  }
});

// Also check tabs.onUpdated for direct navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.url) return;
  
  try {
    const { focus, blocklist } = await chrome.storage.sync.get(["focus", "blocklist"]);
    
    if (!focus) return;
    if (!blocklist || blocklist.length === 0) return;
    
    const url = tab.url;
    if (!url || 
        url.startsWith("chrome://") || 
        url.startsWith("chrome-extension://") || 
        url.startsWith("data:") ||
        url.includes("blocked.html")) {
      return;
    }
    
    let hostname;
    try {
      const urlObj = new URL(url);
      hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");
    } catch (e) {
      return;
    }
    
    const isBlocked = blocklist.some(site => {
      const cleanSite = site.toLowerCase().replace(/^www\./, "").trim();
      if (!cleanSite) return false;
      return hostname === cleanSite || hostname.endsWith(`.${cleanSite}`);
    });
    
    if (isBlocked) {
      const blockedUrl = chrome.runtime.getURL("blocked.html");
      try {
        await chrome.tabs.update(tabId, { url: blockedUrl });
      } catch (error) {
        // Tab might be closed
      }
    }
  } catch (error) {
    console.error("Error in tabs.onUpdated:", error);
  }
});

console.log("Background script loaded - using webNavigation for blocking");
