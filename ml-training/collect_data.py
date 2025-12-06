"""
Collect YouTube video metadata for training the classification model.
This script extracts video titles, descriptions, and metadata from YouTube.
"""

import json
import csv
import os
import re
import requests
from urllib.parse import parse_qs, urlparse
import time

# Create directories
os.makedirs('data/raw', exist_ok=True)
os.makedirs('data/labeled', exist_ok=True)

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_video_metadata_from_page(video_id):
    """Extract metadata from YouTube page (simplified - you may need YouTube API)"""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        response = requests.get(url, timeout=10)
        
        # Extract title from page
        title_match = re.search(r'<title>(.*?)</title>', response.text)
        title = title_match.group(1).replace(' - YouTube', '').strip() if title_match else ""
        
        # Extract description (simplified - YouTube API would be better)
        desc_match = re.search(r'"shortDescription":"([^"]*)"', response.text)
        description = desc_match.group(1) if desc_match else ""
        
        return {
            'video_id': video_id,
            'title': title,
            'description': description[:500] if description else "",  # Limit description length
            'url': url
        }
    except Exception as e:
        print(f"Error fetching {video_id}: {e}")
        return None

def collect_from_search_queries(queries, count_per_query=50):
    """
    Collect videos from search queries.
    Note: For production, use YouTube Data API v3 (requires API key)
    """
    all_videos = []
    
    # Example educational search queries
    educational_queries = [
        "python tutorial",
        "javascript course",
        "machine learning explained",
        "calculus lesson",
        "physics lecture",
        "history documentary",
        "programming tutorial",
        "math tutorial",
        "chemistry explained"
    ]
    
    # Example entertainment search queries
    entertainment_queries = [
        "funny videos",
        "comedy compilation",
        "music video",
        "gaming highlights",
        "prank videos",
        "vlog",
        "challenge video",
        "reaction video"
    ]
    
    print("Note: This is a simplified collector.")
    print("For production use, integrate YouTube Data API v3")
    print("Get API key from: https://console.cloud.google.com/")
    
    # For now, create a template CSV
    return create_template_csv()

def create_template_csv():
    """Create a template CSV file for manual data entry"""
    csv_path = 'data/labeled/videos.csv'
    
    # Check if file exists
    if os.path.exists(csv_path):
        print(f"{csv_path} already exists. Add more rows manually.")
        return
    
    # Create template with example rows
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['video_id', 'title', 'description', 'label', 'url'])
        
        # Add some example rows
        examples = [
            ['dQw4w9WgXcQ', 'Python Tutorial for Beginners', 'Learn Python programming from scratch', '1', 'https://youtube.com/watch?v=dQw4w9WgXcQ'],
            ['example2', 'Funny Cat Compilation', 'Best funny cat videos of 2024', '0', 'https://youtube.com/watch?v=example2'],
        ]
        
        for row in examples:
            writer.writerow(row)
    
    print(f"Created template CSV at {csv_path}")
    print("Please manually add video data with labels:")
    print("  - Label 1 = Educational")
    print("  - Label 0 = Entertainment")
    return csv_path

def collect_from_youtube_api(search_queries, api_key, max_results=50):
    """
    Collect data using YouTube Data API v3 (recommended method)
    Requires: pip install google-api-python-client
    """
    try:
        from googleapiclient.discovery import build
        
        youtube = build('youtube', 'v3', developerKey=api_key)
        videos = []
        
        for query in search_queries:
            request = youtube.search().list(
                part='snippet',
                q=query,
                type='video',
                maxResults=max_results,
                order='relevance'
            )
            
            response = request.execute()
            
            for item in response.get('items', []):
                video_data = {
                    'video_id': item['id']['videoId'],
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description'][:500],
                    'channel': item['snippet']['channelTitle'],
                    'published_at': item['snippet']['publishedAt'],
                    'url': f"https://youtube.com/watch?v={item['id']['videoId']}"
                }
                videos.append(video_data)
            
            time.sleep(0.1)  # Rate limiting
        
        return videos
    
    except ImportError:
        print("Install google-api-python-client: pip install google-api-python-client")
        return []
    except Exception as e:
        print(f"API Error: {e}")
        return []

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Collect YouTube video data')
    parser.add_argument('--count', type=int, default=100, help='Number of videos to collect')
    parser.add_argument('--api-key', type=str, help='YouTube Data API key (optional)')
    
    args = parser.parse_args()
    
    if args.api_key:
        # Use YouTube API
        educational_queries = ["python tutorial", "javascript course", "math lesson"]
        entertainment_queries = ["funny videos", "music video", "gaming"]
        
        edu_videos = collect_from_youtube_api(educational_queries, args.api_key, args.count // 2)
        ent_videos = collect_from_youtube_api(entertainment_queries, args.api_key, args.count // 2)
        
        # Save to CSV
        csv_path = 'data/labeled/videos.csv'
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['video_id', 'title', 'description', 'label', 'url'])
            
            for video in edu_videos:
                writer.writerow([video['video_id'], video['title'], video['description'], '1', video['url']])
            
            for video in ent_videos:
                writer.writerow([video['video_id'], video['title'], video['description'], '0', video['url']])
        
        print(f"Collected {len(edu_videos)} educational and {len(ent_videos)} entertainment videos")
        print(f"Saved to {csv_path}")
    else:
        # Create template for manual entry
        create_template_csv()
        print("\nTo use YouTube API:")
        print("1. Get API key from https://console.cloud.google.com/")
        print("2. Run: python collect_data.py --api-key YOUR_KEY --count 1000")

