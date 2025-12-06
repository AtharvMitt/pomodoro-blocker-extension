"""
Test the trained model with new video titles/descriptions
"""

import joblib
import sys
import os
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

def predict_video(title, description="", model_type='logistic_regression'):
    """
    Predict if a video is educational (1) or entertainment (0)
    
    Args:
        title: Video title
        description: Video description (optional)
        model_type: 'naive_bayes', 'logistic_regression', 'random_forest', or 'neural_network'
    
    Returns:
        prediction: 1 for educational, 0 for entertainment
        probability: Confidence score
    """
    
    # Load model
    if model_type == 'neural_network':
        model_path = 'models/neural_network_model.h5'
        vectorizer_path = 'models/neural_network_vectorizer.pkl'
        
        if not os.path.exists(model_path):
            print(f"Model not found: {model_path}")
            print("Train the model first with: python train_model.py")
            return None, None
        
        try:
            from tensorflow import keras
            model = keras.models.load_model(model_path)
            vectorizer = joblib.load(vectorizer_path)
        except ImportError:
            print("TensorFlow required for neural network model")
            return None, None
    else:
        model_path = f'models/{model_type}_model.pkl'
        
        if not os.path.exists(model_path):
            print(f"Model not found: {model_path}")
            print("Available models:")
            for f in os.listdir('models'):
                if f.endswith('.pkl'):
                    print(f"  - {f}")
            return None, None
        
        data = joblib.load(model_path)
        model = data['model']
        vectorizer = data['vectorizer']
    
    # Preprocess text
    combined_text = f"{title} {description}".lower().strip()
    
    # Vectorize
    text_vec = vectorizer.transform([combined_text])
    
    # Predict
    if model_type == 'neural_network':
        probability = model.predict(text_vec.toarray())[0][0]
        prediction = 1 if probability > 0.5 else 0
    else:
        probability = model.predict_proba(text_vec)[0]
        prediction = model.predict(text_vec)[0]
        probability = probability[1] if len(probability) > 1 else probability[0]
    
    return prediction, probability

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py '<video_title>' [description] [model_type]")
        print("\nExample:")
        print("  python predict.py 'Python Tutorial for Beginners'")
        print("  python predict.py 'Funny Cat Compilation' '' 'logistic_regression'")
        return
    
    title = sys.argv[1]
    description = sys.argv[2] if len(sys.argv) > 2 else ""
    model_type = sys.argv[3] if len(sys.argv) > 3 else 'logistic_regression'
    
    print(f"Title: {title}")
    if description:
        print(f"Description: {description[:100]}...")
    print(f"Model: {model_type}")
    print("-" * 50)
    
    prediction, probability = predict_video(title, description, model_type)
    
    if prediction is not None:
        label = "Educational" if prediction == 1 else "Entertainment"
        confidence = probability * 100
        
        print(f"\nPrediction: {label}")
        print(f"Confidence: {confidence:.2f}%")
        
        if prediction == 1:
            print("\n✅ This video appears to be educational")
        else:
            print("\n❌ This video appears to be entertainment")

if __name__ == "__main__":
    main()

