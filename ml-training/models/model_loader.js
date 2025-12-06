
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
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
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
