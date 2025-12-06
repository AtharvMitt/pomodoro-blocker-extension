"""
Train a classification model to distinguish educational vs entertainment videos.
Supports multiple model types: Naive Bayes, Logistic Regression, Random Forest, Neural Network
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import joblib

# Download NLTK data (first time only)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

os.makedirs('models', exist_ok=True)
os.makedirs('data/processed', exist_ok=True)

def preprocess_text(text):
    """Clean and preprocess text"""
    if pd.isna(text):
        return ""
    
    text = str(text).lower()
    # Remove special characters but keep spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_features(df):
    """Extract features from title and description"""
    # Combine title and description
    df['combined_text'] = df['title'].fillna('') + ' ' + df['description'].fillna('')
    df['combined_text'] = df['combined_text'].apply(preprocess_text)
    
    # Additional features
    df['title_length'] = df['title'].fillna('').apply(len)
    df['desc_length'] = df['description'].fillna('').apply(len)
    df['word_count'] = df['combined_text'].apply(lambda x: len(x.split()))
    
    # Educational keywords count
    edu_keywords = ['tutorial', 'lesson', 'course', 'learn', 'explain', 'guide', 
                   'how to', 'introduction', 'basics', 'advanced', 'concept']
    df['edu_keyword_count'] = df['combined_text'].apply(
        lambda x: sum(1 for kw in edu_keywords if kw in x)
    )
    
    # Entertainment keywords count
    ent_keywords = ['funny', 'comedy', 'prank', 'fail', 'compilation', 'reaction',
                   'vlog', 'challenge', 'gameplay', 'music video', 'song']
    df['ent_keyword_count'] = df['combined_text'].apply(
        lambda x: sum(1 for kw in ent_keywords if kw in x)
    )
    
    return df

def train_naive_bayes(X_train, y_train, X_test, y_test):
    """Train Naive Bayes classifier"""
    print("\n=== Training Naive Bayes ===")
    
    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    # Train model
    model = MultinomialNB()
    model.fit(X_train_vec, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Entertainment', 'Educational']))
    
    # Save model
    model_path = 'models/naive_bayes_model.pkl'
    joblib.dump({
        'model': model,
        'vectorizer': vectorizer
    }, model_path)
    print(f"\nModel saved to {model_path}")
    
    return model, vectorizer, accuracy

def train_logistic_regression(X_train, y_train, X_test, y_test):
    """Train Logistic Regression classifier"""
    print("\n=== Training Logistic Regression ===")
    
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train_vec, y_train)
    
    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Entertainment', 'Educational']))
    
    model_path = 'models/logistic_regression_model.pkl'
    joblib.dump({
        'model': model,
        'vectorizer': vectorizer
    }, model_path)
    print(f"\nModel saved to {model_path}")
    
    return model, vectorizer, accuracy

def train_random_forest(X_train, y_train, X_test, y_test):
    """Train Random Forest classifier"""
    print("\n=== Training Random Forest ===")
    
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train_vec, y_train)
    
    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Entertainment', 'Educational']))
    
    model_path = 'models/random_forest_model.pkl'
    joblib.dump({
        'model': model,
        'vectorizer': vectorizer
    }, model_path)
    print(f"\nModel saved to {model_path}")
    
    return model, vectorizer, accuracy

def train_neural_network(X_train, y_train, X_test, y_test):
    """Train Neural Network classifier"""
    print("\n=== Training Neural Network ===")
    
    try:
        from tensorflow import keras
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import Dense, Dropout
        from tensorflow.keras.optimizers import Adam
    except ImportError:
        print("TensorFlow not installed. Install with: pip install tensorflow")
        return None, None, 0
    
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train).toarray()
    X_test_vec = vectorizer.transform(X_test).toarray()
    
    # Build model
    model = Sequential([
        Dense(512, activation='relu', input_shape=(X_train_vec.shape[1],)),
        Dropout(0.5),
        Dense(256, activation='relu'),
        Dropout(0.5),
        Dense(128, activation='relu'),
        Dropout(0.3),
        Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    # Train
    history = model.fit(
        X_train_vec, y_train,
        epochs=20,
        batch_size=32,
        validation_split=0.2,
        verbose=1
    )
    
    # Evaluate
    loss, accuracy = model.evaluate(X_test_vec, y_test, verbose=0)
    print(f"Accuracy: {accuracy:.4f}")
    
    model_path = 'models/neural_network_model.h5'
    model.save(model_path)
    
    # Save vectorizer separately
    vectorizer_path = 'models/neural_network_vectorizer.pkl'
    joblib.dump(vectorizer, vectorizer_path)
    
    print(f"\nModel saved to {model_path}")
    print(f"Vectorizer saved to {vectorizer_path}")
    
    return model, vectorizer, accuracy

def main():
    # Load data
    csv_path = 'data/labeled/videos.csv'
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found!")
        print("Run collect_data.py first to create the data file.")
        return
    
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # Check required columns
    required_cols = ['title', 'label']
    if not all(col in df.columns for col in required_cols):
        print(f"Error: CSV must have columns: {required_cols}")
        return
    
    print(f"Loaded {len(df)} videos")
    print(f"Educational: {df['label'].sum()}, Entertainment: {(df['label'] == 0).sum()}")
    
    # Preprocess
    print("\nPreprocessing data...")
    df = extract_features(df)
    
    # Prepare features
    X = df['combined_text'].fillna('')
    y = df['label'].astype(int)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Train multiple models
    results = {}
    
    # Naive Bayes (fastest, good baseline)
    nb_model, nb_vec, nb_acc = train_naive_bayes(X_train, y_train, X_test, y_test)
    results['Naive Bayes'] = nb_acc
    
    # Logistic Regression
    lr_model, lr_vec, lr_acc = train_logistic_regression(X_train, y_train, X_test, y_test)
    results['Logistic Regression'] = lr_acc
    
    # Random Forest
    rf_model, rf_vec, rf_acc = train_random_forest(X_train, y_train, X_test, y_test)
    results['Random Forest'] = rf_acc
    
    # Neural Network (best accuracy, but slower)
    nn_model, nn_vec, nn_acc = train_neural_network(X_train, y_train, X_test, y_test)
    if nn_acc > 0:
        results['Neural Network'] = nn_acc
    
    # Summary
    print("\n" + "="*50)
    print("MODEL COMPARISON")
    print("="*50)
    for model_name, accuracy in sorted(results.items(), key=lambda x: x[1], reverse=True):
        print(f"{model_name:20s}: {accuracy:.4f}")
    
    print("\n" + "="*50)
    print("RECOMMENDATION:")
    best_model = max(results, key=results.get)
    print(f"Best model: {best_model} ({results[best_model]:.4f})")
    print("\nFor Chrome extension, use the model with best balance of:")
    print("  - Accuracy")
    print("  - Model size (for fast loading)")
    print("  - Inference speed")

if __name__ == "__main__":
    main()

