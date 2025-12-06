"""
Export the trained model in a format suitable for Chrome extension
Converts the model to a lightweight format that can be loaded in JavaScript
"""

import joblib
import json
import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

def export_to_json(model_type='logistic_regression', output_file='models/model_for_extension.json'):
    """
    Export model to JSON format for JavaScript loading
    Note: This is a simplified export. For production, consider:
    - Using TensorFlow.js for neural networks
    - Using ONNX.js for cross-platform models
    - Or keeping model on server and using API calls
    """
    
    model_path = f'models/{model_type}_model.pkl'
    
    if not os.path.exists(model_path):
        print(f"Model not found: {model_path}")
        return
    
    print(f"Loading model from {model_path}...")
    data = joblib.load(model_path)
    model = data['model']
    vectorizer = data['vectorizer']
    
    # Extract model parameters
    if hasattr(model, 'coef_'):
        # Logistic Regression
        coef = model.coef_[0].tolist()
        intercept = model.intercept_[0] if hasattr(model, 'intercept_') else 0
        
        export_data = {
            'type': 'logistic_regression',
            'coefficients': coef,
            'intercept': float(intercept),
            'vocabulary': vectorizer.vocabulary_,
            'idf': vectorizer.idf_.tolist(),
            'max_features': vectorizer.max_features,
            'ngram_range': list(vectorizer.ngram_range)
        }
    elif hasattr(model, 'feature_log_prob_'):
        # Naive Bayes
        feature_log_prob = model.feature_log_prob_[1].tolist()  # Educational class
        class_log_prior = model.class_log_prior_[1]
        
        export_data = {
            'type': 'naive_bayes',
            'feature_log_prob': feature_log_prob,
            'class_log_prior': float(class_log_prior),
            'vocabulary': vectorizer.vocabulary_,
            'idf': vectorizer.idf_.tolist(),
            'max_features': vectorizer.max_features,
            'ngram_range': list(vectorizer.ngram_range)
        }
    else:
        print("Model type not supported for JSON export")
        print("Consider using TensorFlow.js or ONNX.js for complex models")
        return
    
    # Save to JSON
    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    file_size = os.path.getsize(output_file) / 1024  # KB
    print(f"\n✅ Model exported to {output_file}")
    print(f"   File size: {file_size:.2f} KB")
    print(f"\n⚠️  Note: For production, consider:")
    print(f"   1. Using TensorFlow.js for neural networks")
    print(f"   2. Hosting model on server and using API calls")
    print(f"   3. Using ONNX.js for cross-platform models")

def create_js_model_loader(output_file='models/model_loader.js'):
    """Create a JavaScript file to load and use the model"""
    
    js_code = """
// YouTube Video Classifier - Model Loader
// This file loads the trained model and provides prediction functions

class VideoClassifier {
    constructor(modelData) {
        this.modelType = modelData.type;
        this.vocabulary = modelData.vocabulary;
        this.idf = modelData.idf;
        this.maxFeatures = modelData.max_features;
        this.ngramRange = modelData.ngram_range;
        
        if (this.modelType === 'logistic_regression') {
            this.coefficients = modelData.coefficients;
            this.intercept = modelData.intercept;
        } else if (this.modelType === 'naive_bayes') {
            this.featureLogProb = modelData.feature_log_prob;
            this.classLogPrior = modelData.class_log_prior;
        }
    }
    
    preprocessText(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9\\s]/g, '')
            .replace(/\\s+/g, ' ')
            .trim();
    }
    
    extractNgrams(text, n) {
        const words = text.split(' ');
        const ngrams = [];
        for (let i = 0; i <= words.length - n; i++) {
            ngrams.push(words.slice(i, i + n).join(' '));
        }
        return ngrams;
    }
    
    vectorize(text) {
        const processed = this.preprocessText(text);
        const features = new Array(this.maxFeatures).fill(0);
        
        // Extract unigrams and bigrams
        const ngrams = [];
        if (this.ngramRange[0] <= 1) {
            ngrams.push(...this.extractNgrams(processed, 1));
        }
        if (this.ngramRange[1] >= 2) {
            ngrams.push(...this.extractNgrams(processed, 2));
        }
        
        // Map to vocabulary and apply IDF
        ngrams.forEach(ngram => {
            const index = this.vocabulary[ngram];
            if (index !== undefined && index < this.maxFeatures) {
                features[index] = this.idf[index] || 1;
            }
        });
        
        // Normalize (TF-IDF)
        const norm = Math.sqrt(features.reduce((sum, x) => sum + x * x, 0));
        if (norm > 0) {
            return features.map(x => x / norm);
        }
        return features;
    }
    
    predict(title, description = '') {
        const combinedText = `${title} ${description}`;
        const features = this.vectorize(combinedText);
        
        if (this.modelType === 'logistic_regression') {
            // Logistic regression: sigmoid(w·x + b)
            let score = this.intercept;
            for (let i = 0; i < features.length; i++) {
                score += this.coefficients[i] * features[i];
            }
            const probability = 1 / (1 + Math.exp(-score));
            return {
                prediction: probability > 0.5 ? 1 : 0,
                probability: probability,
                confidence: Math.abs(probability - 0.5) * 2
            };
        } else if (this.modelType === 'naive_bayes') {
            // Naive Bayes (simplified)
            let logProb = this.classLogPrior;
            for (let i = 0; i < features.length; i++) {
                if (features[i] > 0) {
                    logProb += this.featureLogProb[i];
                }
            }
            const probability = 1 / (1 + Math.exp(-logProb));
            return {
                prediction: probability > 0.5 ? 1 : 0,
                probability: probability,
                confidence: Math.abs(probability - 0.5) * 2
            };
        }
    }
}

// Load model and create classifier
async function loadVideoClassifier() {
    try {
        const response = await fetch(chrome.runtime.getURL('models/model_for_extension.json'));
        const modelData = await response.json();
        return new VideoClassifier(modelData);
    } catch (error) {
        console.error('Error loading model:', error);
        return null;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VideoClassifier, loadVideoClassifier };
}
"""
    
    with open(output_file, 'w') as f:
        f.write(js_code)
    
    print(f"✅ JavaScript model loader created: {output_file}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Export model for Chrome extension')
    parser.add_argument('--model', type=str, default='logistic_regression',
                       choices=['naive_bayes', 'logistic_regression', 'random_forest'],
                       help='Model type to export')
    
    args = parser.parse_args()
    
    export_to_json(args.model)
    create_js_model_loader()

