# YouTube Video Classification - Educational vs Entertainment

This directory contains scripts to train an AI model that classifies YouTube videos as educational or entertainment based on title and metadata.

## Project Structure

```
ml-training/
├── README.md                      # This file
├── collect_data.py                # Script to collect YouTube video data
├── train_model.py                 # Script to train the classification model
├── predict.py                     # Script to test predictions
├── export_model_for_extension.py  # Export model for Chrome extension
├── requirements.txt               # Python dependencies
├── data/
│   ├── raw/                       # Raw collected data
│   ├── labeled/                   # Manually labeled data (videos.csv)
│   └── processed/                 # Processed training data
└── models/                        # Saved trained models
```

## Complete Workflow

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Collect Data

**Option A: Manual Collection (Recommended for small datasets)**
```bash
python collect_data.py
```
This creates a template CSV at `data/labeled/videos.csv`. Manually add video data:
- `video_id`: YouTube video ID
- `title`: Video title
- `description`: Video description (optional)
- `label`: 1 for educational, 0 for entertainment
- `url`: YouTube URL

**Option B: YouTube API (For large datasets)**
1. Get API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Run:
```bash
python collect_data.py --api-key YOUR_API_KEY --count 1000
```

### Step 3: Label Your Data

Open `data/labeled/videos.csv` and ensure all videos have correct labels:
- **1** = Educational (tutorials, courses, lectures, etc.)
- **0** = Entertainment (funny videos, music, gaming, vlogs, etc.)

**Tips for labeling:**
- Aim for balanced dataset (50% educational, 50% entertainment)
- Include diverse examples
- Minimum 100-200 videos for decent results, 1000+ for better accuracy

### Step 4: Train the Model

```bash
python train_model.py
```

This will:
- Train 4 different models (Naive Bayes, Logistic Regression, Random Forest, Neural Network)
- Compare their accuracy
- Save the best models to `models/` directory

**Expected Output:**
```
=== Training Naive Bayes ===
Accuracy: 0.8500

=== Training Logistic Regression ===
Accuracy: 0.8700

=== Training Random Forest ===
Accuracy: 0.8800

=== Training Neural Network ===
Accuracy: 0.8900

MODEL COMPARISON
Best model: Neural Network (0.8900)
```

### Step 5: Test Predictions

```bash
python predict.py "Python Tutorial for Beginners"
python predict.py "Funny Cat Compilation" "" "logistic_regression"
```

### Step 6: Export for Extension

```bash
python export_model_for_extension.py --model logistic_regression
```

This creates:
- `models/model_for_extension.json` - Model data in JSON format
- `models/model_loader.js` - JavaScript class to load and use the model

## Model Options

| Model | Accuracy | Speed | Size | Best For |
|-------|----------|-------|------|----------|
| **Naive Bayes** | Good | Very Fast | Small | Quick prototyping |
| **Logistic Regression** | Very Good | Fast | Small | **Chrome Extension (Recommended)** |
| **Random Forest** | Excellent | Medium | Medium | High accuracy needs |
| **Neural Network** | Best | Slow | Large | Maximum accuracy |

**Recommendation for Extension:** Use Logistic Regression - best balance of accuracy, speed, and model size.

## Integration with Chrome Extension

### 1. Copy Model Files

Copy these files to your extension directory:
- `models/model_for_extension.json` → `extension/models/model.json`
- `models/model_loader.js` → `extension/models/model_loader.js`

### 2. Update manifest.json

Add model files to web_accessible_resources:
```json
"web_accessible_resources": [
  {
    "resources": ["blocked.html", "models/*"],
    "matches": ["<all_urls>"]
  }
]
```

### 3. Use in content.js

```javascript
// Load model
const classifier = await loadVideoClassifier();

// Get video title and description
const title = document.querySelector('h1.ytd-watch-metadata')?.textContent || '';
const description = document.querySelector('#description')?.textContent || '';

// Predict
const result = classifier.predict(title, description);

if (result.prediction === 0 && result.confidence > 0.7) {
  // Block entertainment video
  document.body.innerHTML = '<h1>Entertainment content blocked</h1>';
}
```

## Tips for Better Accuracy

1. **More Data**: Collect 1000+ labeled videos
2. **Balanced Dataset**: Equal educational and entertainment examples
3. **Feature Engineering**: Add more features (channel name, tags, etc.)
4. **Hyperparameter Tuning**: Adjust model parameters
5. **Ensemble Methods**: Combine multiple models

## Troubleshooting

**"Model not found" error:**
- Run `train_model.py` first to create models

**Low accuracy (< 70%):**
- Collect more training data
- Check for labeling errors
- Try different model types

**Large model size:**
- Use Logistic Regression instead of Neural Network
- Reduce `max_features` in vectorizer
- Consider server-side API instead

## Next Steps

1. Collect and label 500-1000 videos
2. Train the model
3. Test on real YouTube videos
4. Integrate into extension
5. Iterate and improve!

Good luck with your AI model! 🚀
