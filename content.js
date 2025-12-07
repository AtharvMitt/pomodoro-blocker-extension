// YouTube content filtering for focus mode with AI model
// Uses trained ML model to classify videos as educational or entertainment

console.log("YouTube content script loaded at document_start");

let videoClassifier = null;

// Load the ML model
async function loadVideoClassifier() {
  if (videoClassifier) return videoClassifier;
  
  try {
    const response = await fetch(chrome.runtime.getURL('models/model_for_extension.json'));
    const modelData = await response.json();
    videoClassifier = new VideoClassifier(modelData);
    console.log("ML model loaded successfully");
    return videoClassifier;
  } catch (error) {
    console.error("Error loading ML model:", error);
    return null;
  }
}

// Inject CSS immediately - this will work even as content loads dynamically
function injectFocusModeCSS() {
  // Check if styles already injected
  if (document.getElementById('focus-mode-styles')) {
    return;
  }
  
  const style = document.createElement("style");
  style.id = 'focus-mode-styles';
  style.innerHTML = `
    /* Hide search bar */
    ytd-searchbox,
    #search-container,
    form#search-form,
    input#search {
      display: none !important;
    }
    
    /* Hide header/navigation */
    ytd-masthead,
    #masthead-container,
    #header {
      display: none !important;
    }
    
    /* Hide sidebar and recommended videos - CRITICAL - Works with dynamic loading */
    #secondary,
    #secondary-inner,
    ytd-watch-next-secondary-results-renderer,
    ytd-item-section-renderer[target-id="watch-next"],
    ytd-watch-next-secondary-results-renderer[class*="watch-next"] {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
    }
    
    /* Hide comments */
    #comments,
    ytd-comments,
    ytd-comments-header-renderer,
    #comment-section,
    ytd-comment-thread-renderer {
      display: none !important;
    }
    
    /* Hide video owner/subscribe */
    ytd-video-owner-renderer,
    #owner,
    #subscribe-button {
      display: none !important;
    }
    
    /* Expand primary content to full width */
    #primary {
      width: 100% !important;
      max-width: 100% !important;
    }
    
    /* Force sidebar width to 0 */
    ytd-watch-flexy {
      --watch-sidebar-width: 0px !important;
    }
    
    ytd-watch-flexy[flexy] #secondary {
      display: none !important;
      width: 0 !important;
    }
    
    /* Hide video actions */
    #top-level-buttons,
    #menu-container {
      display: none !important;
    }
    
    /* Hide navigation */
    #guide,
    #guide-button {
      display: none !important;
    }
    
    /* Hide merch and other distractions */
    ytd-merch-shelf-renderer,
    ytd-engagement-panel-section-list-renderer {
      display: none !important;
    }
  `;
  
  // Inject into head immediately, or document if head doesn't exist yet
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.documentElement.appendChild(style);
  }
  
  console.log("Focus mode CSS injected");
}

// Inject CSS immediately when script runs
injectFocusModeCSS();

// Also inject when DOM is ready (in case head wasn't available)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFocusModeCSS);
}

// Extract video title and description from page
function getVideoMetadata() {
  let title = '';
  let description = '';
  
  // Try multiple selectors for title (expanded list with more variations)
  const titleSelectors = [
    // Modern YouTube selectors
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.ytd-video-primary-info-renderer yt-formatted-string',
    'yt-formatted-string.style-scope.ytd-watch-metadata',
    'h1.ytd-watch-metadata yt-formatted-string[class*="style-scope"]',
    'h1 yt-formatted-string',
    'h1[class*="watch"] yt-formatted-string',
    'ytd-watch-metadata h1 yt-formatted-string',
    'ytd-video-primary-info-renderer h1 yt-formatted-string',
    // Meta tags (always available early)
    'meta[property="og:title"]',
    'meta[name="title"]',
    // Fallback selectors
    'h1[class*="watch"]',
    'h1.title',
    '#watch-headline-title',
    // Try to get from any h1 in the main content area
    '#primary h1',
    'ytd-watch-flexy h1'
  ];
  
  for (const selector of titleSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        title = element.textContent || element.getAttribute('content') || element.innerText || element.title || '';
        // Also try getting from aria-label
        if (!title) {
          title = element.getAttribute('aria-label') || '';
        }
        if (title && title.trim()) {
          title = title.trim();
          break;
        }
      }
    } catch (e) {
      // Continue to next selector
      continue;
    }
  }
  
  // Fallback: Try to extract from page title (removes " - YouTube" suffix)
  if (!title) {
    const pageTitle = document.title;
    if (pageTitle && pageTitle !== 'YouTube' && !pageTitle.startsWith('YouTube')) {
      title = pageTitle.replace(/\s*-\s*YouTube\s*$/, '').trim();
    }
  }
  
  // Try multiple selectors for description
  const descSelectors = [
    '#description yt-formatted-string',
    '#description-text',
    'ytd-expander[class*="description"] yt-formatted-string',
    'ytd-video-secondary-info-renderer #description yt-formatted-string',
    'meta[property="og:description"]',
    'meta[name="description"]',
    '#watch-description-text',
    'ytd-watch-metadata #description'
  ];
  
  for (const selector of descSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        description = element.textContent || element.getAttribute('content') || element.innerText || '';
        if (description && description.trim()) {
          description = description.trim();
          break;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // Limit description length
  description = description.substring(0, 500);
  
  return { title: title.trim(), description: description.trim() };
}

// Wait for video title to appear with retries
async function waitForVideoTitle(maxRetries = 10, delay = 200) {
  for (let i = 0; i < maxRetries; i++) {
    const { title } = getVideoMetadata();
    if (title && title.trim()) {
      return title;
    }
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return null;
}

// Check if video is educational using ML model
async function checkVideoWithModel() {
  try {
    // Load model if not already loaded
    const classifier = await loadVideoClassifier();
    if (!classifier) {
      console.log("Model not available, blocking video for safety");
      return false; // Block if model fails to load (safer for focus mode)
    }
    
    // Wait for title with retries (up to 2 seconds total)
    const title = await waitForVideoTitle(10, 200);
    
    if (!title) {
      console.log("Could not extract title after retries, blocking video for safety");
      return false; // Block if we can't get title (safer for focus mode)
    }
    
    // Get description (may still be empty, that's okay)
    const { description } = getVideoMetadata();
    
    console.log("Video title:", title);
    console.log("Video description:", description ? description.substring(0, 100) + "..." : "(none)");
    
    // Predict using ML model
    const result = classifier.predict(title, description);
    
    // Validate result
    if (!result || result.prediction === undefined) {
      console.error("Invalid prediction result:", result);
      return false; // Block on invalid result (safer for focus mode)
    }
    
    // Check for NaN values
    if (isNaN(result.probability) || isNaN(result.confidence)) {
      console.error("NaN detected in prediction result:", result);
      console.log("Model data check:", {
        type: classifier.modelType,
        hasCoefficients: !!classifier.coefficients,
        hasIntercept: classifier.intercept !== undefined,
        coefficientsLength: classifier.coefficients?.length,
        featuresLength: classifier.maxFeatures
      });
      return false; // Block on NaN (safer for focus mode)
    }
    
    console.log("ML Prediction:", result.prediction === 1 ? "Educational" : "Entertainment");
    console.log("Confidence:", (result.confidence * 100).toFixed(2) + "%");
    console.log("Probability:", (result.probability * 100).toFixed(2) + "%");
    
    // Return true if educational (prediction === 1), false if entertainment
    return result.prediction === 1;
  } catch (error) {
    console.error("Error checking video with model:", error);
    return false; // Block on error (safer for focus mode)
  }
}

// Check focus mode and handle page blocking
async function checkFocusMode() {
  try {
    const { focus } = await chrome.storage.sync.get("focus");
    
    console.log("Focus mode status:", focus);
    
    if (!focus) {
      // Remove styles if focus mode is off
      const styleEl = document.getElementById('focus-mode-styles');
      if (styleEl) {
        styleEl.remove();
      }
      return;
    }
    
    // Ensure CSS is injected
    injectFocusModeCSS();
    
    const path = window.location.pathname;
    console.log("Current path:", path);
    
    // BLOCK YOUTUBE HOMEPAGE & FEEDS
    if (path === "/" || path.includes("/feed") || path.includes("/shorts")) {
      console.log("Blocking YouTube homepage");
      
      // Wait for body to exist
      const waitForBody = setInterval(() => {
        if (document.body) {
          clearInterval(waitForBody);
          document.body.innerHTML = `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 20px;
            ">
              <h1 style="font-size: 48px; margin-bottom: 20px;">🚫</h1>
              <h2 style="font-size: 28px; margin-bottom: 10px; font-weight: 600;">YouTube Homepage Blocked</h2>
              <p style="font-size: 16px; opacity: 0.9;">Focus Mode is Active</p>
              <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">You can still search for educational content</p>
            </div>
          `;
        }
      }, 10);
      
      return;
    }
    
    // CHECK VIDEO PAGE - Use ML model to classify
    if (path.includes("/watch")) {
      console.log("On video page - checking with ML model");
      
      // Function to block the video page
      function blockVideoPage(reason = "Entertainment Content Blocked") {
        // Wait for body to exist
        const waitForBody = setInterval(() => {
          if (document.body) {
            clearInterval(waitForBody);
            document.body.innerHTML = `
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 20px;
              ">
                <h1 style="font-size: 48px; margin-bottom: 20px;">❌</h1>
                <h2 style="font-size: 28px; margin-bottom: 10px; font-weight: 600;">${reason}</h2>
                <p style="font-size: 16px; opacity: 0.9;">Focus Mode is Active</p>
                <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">Only educational videos are allowed during focus time</p>
              </div>
            `;
          }
        }, 10);
      }
      
      // Check immediately and also set up observer for dynamic content
      let checkPerformed = false;
      
      const performCheck = async () => {
        if (checkPerformed) return;
        checkPerformed = true;
        
        const isEducational = await checkVideoWithModel();
        
        if (!isEducational) {
          // Block entertainment video or video that couldn't be classified
          console.log("Video blocked - not educational or classification failed");
          blockVideoPage("Entertainment Content Blocked");
        } else {
          // Allow educational video - CSS already hides distractions
          console.log("Educational video detected - allowing with distractions removed");
        }
      };
      
      // Try checking after a short delay (for initial page load)
      setTimeout(performCheck, 500);
      
      // Also set up a MutationObserver to catch when title appears
      const titleObserver = new MutationObserver(() => {
        if (!checkPerformed) {
          const { title } = getVideoMetadata();
          if (title && title.trim()) {
            // Title appeared, perform check
            setTimeout(performCheck, 100);
          }
        }
      });
      
      // Observe the document for changes
      if (document.body) {
        titleObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Stop observing after 5 seconds to avoid infinite observation
        setTimeout(() => {
          titleObserver.disconnect();
          // If still not checked, perform final check
          if (!checkPerformed) {
            performCheck();
          }
        }, 5000);
      }
    }
  } catch (error) {
    console.error("Error in YouTube blocking:", error);
  }
}

// Run focus mode check when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkFocusMode);
} else {
  checkFocusMode();
}

// Listen for storage changes (in case focus mode is toggled)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.focus) {
    console.log("Focus mode changed, re-checking");
    checkFocusMode();
  }
});

// Watch for YouTube SPA navigation (URL changes without page reload)
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log("URL changed (SPA navigation), re-checking");
    setTimeout(checkFocusMode, 100);
  }
}).observe(document, { subtree: true, childList: true });
