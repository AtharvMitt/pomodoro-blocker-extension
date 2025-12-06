// YouTube Video Classifier - Model Loader
// This file loads the trained model and provides prediction functions

class VideoClassifier {
    constructor(modelData) {
        console.log('Initializing VideoClassifier with model type:', modelData?.type);
        
        if (!modelData) {
            throw new Error('Model data is required');
        }
        
        this.modelType = modelData.type;
        this.vocabulary = modelData.vocabulary;
        this.idf = modelData.idf;
        this.maxFeatures = modelData.max_features;
        this.ngramRange = modelData.ngram_range;
        
        console.log('Model initialized:', {
            type: this.modelType,
            maxFeatures: this.maxFeatures,
            vocabularySize: this.vocabulary ? Object.keys(this.vocabulary).length : 0,
            idfLength: this.idf ? this.idf.length : 0
        });
        
        if (this.modelType === 'logistic_regression') {
            this.coefficients = modelData.coefficients;
            this.intercept = modelData.intercept;
            console.log('Logistic Regression model:', {
                coefficientsLength: this.coefficients ? this.coefficients.length : 0,
                intercept: this.intercept,
                interceptType: typeof this.intercept
            });
        } else if (this.modelType === 'naive_bayes') {
            this.featureLogProb = modelData.feature_log_prob;
            this.classLogPrior = modelData.class_log_prior;
            console.log('Naive Bayes model:', {
                featureLogProbLength: this.featureLogProb ? this.featureLogProb.length : 0,
                classLogPrior: this.classLogPrior
            });
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
        try {
            const combinedText = `${title} ${description}`;
            const features = this.vectorize(combinedText);
            
            if (this.modelType === 'logistic_regression') {
                // Check if required properties exist
                if (!this.coefficients || !Array.isArray(this.coefficients) || 
                    this.intercept === undefined || this.intercept === null) {
                    console.error('Invalid model data: missing coefficients or intercept');
                    return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational
                }
                
                // Logistic regression: sigmoid(w*x + b)
                let score = this.intercept || 0;
                for (let i = 0; i < Math.min(features.length, this.coefficients.length); i++) {
                    const coef = this.coefficients[i] || 0;
                    const feat = features[i] || 0;
                    score += coef * feat;
                }
                
                // Prevent overflow in Math.exp
                // Clamp score to prevent Infinity
                score = Math.max(-700, Math.min(700, score));
                
                const expScore = Math.exp(-score);
                const probability = 1 / (1 + expScore);
                
                // Validate probability
                if (!isFinite(probability) || isNaN(probability)) {
                    console.error('Invalid probability calculated:', { score, expScore, probability });
                    return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational
                }
                
                return {
                    prediction: probability > 0.5 ? 1 : 0,
                    probability: probability,
                    confidence: Math.abs(probability - 0.5) * 2
                };
            } else if (this.modelType === 'naive_bayes') {
                // Check if required properties exist
                if (!this.featureLogProb || !Array.isArray(this.featureLogProb) ||
                    this.classLogPrior === undefined || this.classLogPrior === null) {
                    console.error('Invalid model data: missing featureLogProb or classLogPrior');
                    return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational
                }
                
                // Naive Bayes (simplified)
                let logProb = this.classLogPrior || 0;
                for (let i = 0; i < Math.min(features.length, this.featureLogProb.length); i++) {
                    if (features[i] > 0) {
                        logProb += (this.featureLogProb[i] || 0);
                    }
                }
                
                // Prevent overflow
                logProb = Math.max(-700, Math.min(700, logProb));
                
                const expLogProb = Math.exp(-logProb);
                const probability = 1 / (1 + expLogProb);
                
                // Validate probability
                if (!isFinite(probability) || isNaN(probability)) {
                    console.error('Invalid probability calculated:', { logProb, expLogProb, probability });
                    return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational
                }
                
                return {
                    prediction: probability > 0.5 ? 1 : 0,
                    probability: probability,
                    confidence: Math.abs(probability - 0.5) * 2
                };
            } else {
                console.error('Unknown model type:', this.modelType);
                return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational
            }
        } catch (error) {
            console.error('Error in predict:', error);
            return { prediction: 1, probability: 0.5, confidence: 0 }; // Default to educational on error
        }
    }
}

// Load model and create classifier
async function loadVideoClassifier() {
    try {
        const response = await fetch(chrome.runtime.getURL('models/model_for_extension.json'));
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }
        
        const modelData = await response.json();
        
        // Validate model data structure
        if (!modelData.type) {
            throw new Error('Model data missing type');
        }
        if (!modelData.vocabulary) {
            throw new Error('Model data missing vocabulary');
        }
        if (!modelData.idf || !Array.isArray(modelData.idf)) {
            throw new Error('Model data missing or invalid idf array');
        }
        
        if (modelData.type === 'logistic_regression') {
            if (!modelData.coefficients || !Array.isArray(modelData.coefficients)) {
                throw new Error('Logistic regression model missing coefficients array');
            }
            if (modelData.intercept === undefined || modelData.intercept === null) {
                throw new Error('Logistic regression model missing intercept');
            }
            // Ensure intercept is a number
            if (typeof modelData.intercept !== 'number' || isNaN(modelData.intercept)) {
                console.warn('Intercept is not a valid number, converting:', modelData.intercept);
                modelData.intercept = parseFloat(modelData.intercept) || 0;
            }
        }
        
        console.log('Model data validated successfully');
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
