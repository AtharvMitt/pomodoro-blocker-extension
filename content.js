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
  
  // Try multiple selectors for title
  const titleSelectors = [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.ytd-video-primary-info-renderer yt-formatted-string',
    'yt-formatted-string.style-scope.ytd-watch-metadata',
    'meta[property="og:title"]',
    'h1[class*="watch"]'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      title = element.textContent || element.getAttribute('content') || element.innerText || '';
      if (title) break;
    }
  }
  
  // Try multiple selectors for description
  const descSelectors = [
    '#description yt-formatted-string',
    '#description-text',
    'meta[property="og:description"]',
    'ytd-expander[class*="description"]'
  ];
  
  for (const selector of descSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      description = element.textContent || element.getAttribute('content') || element.innerText || '';
      if (description) break;
    }
  }
  
  // Limit description length
  description = description.substring(0, 500);
  
  return { title: title.trim(), description: description.trim() };
}

// Check if video is educational using ML model
async function checkVideoWithModel() {
  try {
    // Load model if not already loaded
    const classifier = await loadVideoClassifier();
    if (!classifier) {
      console.log("Model not available, allowing video");
      return true; // Allow if model fails to load
    }
    
    // Get video metadata
    const { title, description } = getVideoMetadata();
    
    if (!title) {
      console.log("Could not extract title, allowing video");
      return true; // Allow if we can't get title
    }
    
    console.log("Video title:", title);
    console.log("Video description:", description.substring(0, 100) + "...");
    
    // Predict using ML model
    const result = classifier.predict(title, description);
    
    // Validate result
    if (!result || result.prediction === undefined) {
      console.error("Invalid prediction result:", result);
      return true; // Allow on invalid result
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
      return true; // Allow on NaN (safer to allow than block)
    }
    
    console.log("ML Prediction:", result.prediction === 1 ? "Educational" : "Entertainment");
    console.log("Confidence:", (result.confidence * 100).toFixed(2) + "%");
    console.log("Probability:", (result.probability * 100).toFixed(2) + "%");
    
    // Return true if educational (prediction === 1), false if entertainment
    return result.prediction === 1;
  } catch (error) {
    console.error("Error checking video with model:", error);
    return true; // Allow on error
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
      
      // Wait for page to load a bit, then check
      setTimeout(async () => {
        const isEducational = await checkVideoWithModel();
        
        if (!isEducational) {
          // Block entertainment video
          console.log("Entertainment video detected - blocking");
          
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
                  <h2 style="font-size: 28px; margin-bottom: 10px; font-weight: 600;">Entertainment Content Blocked</h2>
                  <p style="font-size: 16px; opacity: 0.9;">Focus Mode is Active</p>
                  <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">Only educational videos are allowed during focus time</p>
                </div>
              `;
            }
          }, 10);
        } else {
          // Allow educational video - CSS already hides distractions
          console.log("Educational video detected - allowing with distractions removed");
        }
      }, 1000); // Wait 1 second for page to load
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
