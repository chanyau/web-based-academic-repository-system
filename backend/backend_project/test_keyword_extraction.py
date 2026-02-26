"""
Test script for keyword extraction functionality
Run this from the backend_project directory with the venv activated:
  python test_keyword_extraction.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
django.setup()

from api.nlp_utils import extract_keywords_from_project, extract_keywords_simple

def test_keyword_extraction():
    print("=" * 60)
    print("KEYWORD EXTRACTION TEST")
    print("=" * 60)
    
    # Test abstract
    abstract = """
    This research explores the application of machine learning algorithms 
    for predicting student academic performance in higher education institutions. 
    We developed a predictive model using random forest and neural network 
    techniques, analyzing various student attributes including demographic 
    information, previous academic records, and engagement metrics. The study 
    utilized data from over 5000 students across multiple faculties. Results 
    demonstrate that our hybrid approach achieves 89% accuracy in predicting 
    at-risk students, enabling early intervention strategies.
    """
    
    print("\n📝 Abstract:")
    print(abstract.strip())
    
    print("\n🔍 Extracting keywords...")
    keywords = extract_keywords_from_project(abstract)
    
    print(f"\n✅ Extracted {len(keywords)} keywords:")
    for i, kw in enumerate(keywords, 1):
        print(f"   {i}. {kw}")
    
    # Test with another abstract
    abstract2 = """
    This thesis investigates the use of blockchain technology for secure 
    electronic voting systems. We propose a decentralized voting platform 
    that ensures voter anonymity while maintaining ballot integrity and 
    auditability. The system uses smart contracts to automate vote counting 
    and prevent fraud. Our implementation was tested with simulated elections 
    involving 10,000 voters.
    """
    
    print("\n" + "=" * 60)
    print("📝 Second Abstract:")
    print(abstract2.strip())
    
    print("\n🔍 Extracting keywords...")
    keywords2 = extract_keywords_from_project(abstract2)
    
    print(f"\n✅ Extracted {len(keywords2)} keywords:")
    for i, kw in enumerate(keywords2, 1):
        print(f"   {i}. {kw}")
    
    print("\n" + "=" * 60)
    print("✅ Keyword extraction is working!")
    print("=" * 60)

if __name__ == "__main__":
    test_keyword_extraction()
