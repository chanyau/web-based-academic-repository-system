"""
NLP Utilities for Keyword Extraction
Uses a combination of TF-IDF and RAKE for extracting keywords from project abstracts and documents.
Falls back to simple frequency-based extraction if libraries are not available.
"""

import os
import logging
import re
from typing import List, Tuple, Optional
from collections import Counter

# Set up logging
logger = logging.getLogger(__name__)

# Common English stop words
STOP_WORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll",
    "you'd", 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's",
    'her', 'hers', 'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs',
    'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
    'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should', "should've",
    'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't", 'didn',
    "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn',
    "shouldn't", 'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't",
    'also', 'however', 'thus', 'therefore', 'hence', 'moreover', 'furthermore', 'although', 'though',
    'even', 'still', 'yet', 'already', 'always', 'never', 'ever', 'often', 'sometimes', 'usually',
    'may', 'might', 'must', 'shall', 'would', 'could', 'need', 'used', 'using', 'use', 'uses',
    'based', 'include', 'includes', 'including', 'included', 'within', 'without', 'well', 'many',
    'much', 'several', 'various', 'different', 'similar', 'like', 'such', 'one', 'two', 'three',
    'first', 'second', 'third', 'new', 'old', 'high', 'low', 'good', 'best', 'better', 'great',
    'important', 'significant', 'main', 'major', 'key', 'primary', 'among', 'across', 'along',
    'around', 'away', 'back', 'behind', 'beside', 'beyond', 'throughout', 'toward', 'towards',
    'upon', 'whether', 'whose', 'show', 'shows', 'shown', 'showing', 'result', 'results',
    'study', 'studies', 'research', 'paper', 'work', 'approach', 'method', 'methods', 'provide',
    'provides', 'proposed', 'propose', 'present', 'presents', 'presented', 'aim', 'aims',
    'objective', 'objectives', 'goal', 'goals', 'focus', 'focuses', 'focused', 'analyze',
    'analysis', 'evaluate', 'evaluation', 'develop', 'development', 'developed', 'implement',
    'implementation', 'implemented', 'achieve', 'achieved', 'demonstrate', 'demonstrated'
}

# Lazy loading of KeyBERT model to avoid slow startup
_kw_model = None
_use_keybert = None

def get_keyword_model():
    """Lazy load KeyBERT model if available"""
    global _kw_model, _use_keybert
    
    if _use_keybert is None:
        try:
            from keybert import KeyBERT
            _kw_model = KeyBERT(model='all-MiniLM-L6-v2')
            _use_keybert = True
            logger.info("KeyBERT model loaded successfully")
        except Exception as e:
            logger.warning(f"KeyBERT not available, using fallback extraction: {e}")
            _use_keybert = False
            _kw_model = None
    
    return _kw_model if _use_keybert else None


def tokenize(text: str) -> List[str]:
    """Simple tokenization"""
    # Convert to lowercase and split on non-alphanumeric
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    return words


def extract_ngrams(tokens: List[str], n: int = 2) -> List[str]:
    """Extract n-grams from token list"""
    ngrams = []
    for i in range(len(tokens) - n + 1):
        ngram = ' '.join(tokens[i:i+n])
        # Skip if any token is a stop word
        if not any(t in STOP_WORDS for t in tokens[i:i+n]):
            ngrams.append(ngram)
    return ngrams


def extract_keywords_simple(text: str, top_n: int = 10) -> List[str]:
    """
    Simple frequency-based keyword extraction with n-grams.
    Used as fallback when KeyBERT is not available.
    """
    if not text or len(text.strip()) < 50:
        return []
    
    tokens = tokenize(text)
    
    # Filter stop words for unigrams
    unigrams = [t for t in tokens if t not in STOP_WORDS and len(t) > 3]
    
    # Get bigrams
    bigrams = extract_ngrams(tokens, 2)
    
    # Count frequencies
    unigram_counts = Counter(unigrams)
    bigram_counts = Counter(bigrams)
    
    # Normalize similar words (simple stemming - remove common suffixes)
    def normalize(word):
        for suffix in ['ing', 'tion', 'sion', 'ment', 'ness', 'ity', 'ies', 'es', 's', 'ed', 'ly']:
            if word.endswith(suffix) and len(word) > len(suffix) + 3:
                return word[:-len(suffix)]
        return word
    
    # Merge similar unigrams
    normalized_counts = {}
    word_map = {}  # normalized -> best original word
    for word, count in unigram_counts.items():
        norm = normalize(word)
        if norm in normalized_counts:
            normalized_counts[norm] += count
            # Keep the shorter/more common form
            if count > unigram_counts.get(word_map.get(norm, ''), 0):
                word_map[norm] = word
        else:
            normalized_counts[norm] = count
            word_map[norm] = word
    
    # Score bigrams higher (they're more specific)
    all_candidates = []
    
    for norm, count in normalized_counts.items():
        word = word_map[norm]
        all_candidates.append((word, count * 1.0))
    
    for bigram, count in bigram_counts.most_common(top_n * 2):
        all_candidates.append((bigram, count * 2.0))  # Boost bigrams more
    
    # Sort by score and deduplicate
    all_candidates.sort(key=lambda x: x[1], reverse=True)
    
    seen = set()
    keywords = []
    for candidate, score in all_candidates:
        # Skip if any word in candidate was already used
        words_in_candidate = set(candidate.split())
        if not words_in_candidate & seen:
            keywords.append(candidate)
            seen.update(words_in_candidate)
            if len(keywords) >= top_n:
                break
    
    return keywords


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file"""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""


def extract_text_from_docx(file_path: str) -> str:
    """Extract text content from a DOCX file"""
    try:
        from docx import Document
        doc = Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        return ""


def extract_text_from_file(file_path: str) -> str:
    """Extract text from a file based on its extension"""
    if not file_path or not os.path.exists(file_path):
        return ""
    
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    elif ext == '.txt':
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading text file: {e}")
            return ""
    else:
        logger.warning(f"Unsupported file format: {ext}")
        return ""


def extract_keywords(
    text: str,
    top_n: int = 10,
    keyphrase_ngram_range: Tuple[int, int] = (1, 2),
    stop_words: str = 'english',
    use_mmr: bool = True,
    diversity: float = 0.5
) -> List[str]:
    """
    Extract keywords from text using KeyBERT if available, otherwise fallback to simple extraction.
    
    Args:
        text: The input text to extract keywords from
        top_n: Number of keywords to extract
        keyphrase_ngram_range: Range of n-grams for keywords (min, max)
        stop_words: Language for stop words removal
        use_mmr: Use Maximal Marginal Relevance for diversity
        diversity: Diversity score for MMR (0-1, higher = more diverse)
    
    Returns:
        List of extracted keywords
    """
    if not text or len(text.strip()) < 50:
        return []
    
    model = get_keyword_model()
    
    # Use KeyBERT if available
    if model is not None:
        try:
            keywords_with_scores = model.extract_keywords(
                text,
                keyphrase_ngram_range=keyphrase_ngram_range,
                stop_words=stop_words,
                top_n=top_n,
                use_mmr=use_mmr,
                diversity=diversity
            )
            keywords = [kw[0] for kw in keywords_with_scores]
            logger.info(f"Extracted {len(keywords)} keywords using KeyBERT")
            return keywords
        except Exception as e:
            logger.error(f"KeyBERT extraction failed: {e}")
    
    # Fallback to simple extraction
    logger.info("Using simple keyword extraction (KeyBERT not available)")
    return extract_keywords_simple(text, top_n=top_n)


def extract_keywords_from_project(abstract: str, file_path: Optional[str] = None, top_n: int = 10) -> List[str]:
    """
    Extract keywords from a project's abstract and optionally its uploaded document.
    
    Args:
        abstract: The project abstract
        file_path: Optional path to the uploaded document
        top_n: Number of keywords to extract
    
    Returns:
        List of extracted keywords
    """
    # Combine abstract with document text if available
    combined_text = abstract or ""
    
    if file_path:
        document_text = extract_text_from_file(file_path)
        if document_text:
            # Combine but give more weight to abstract by putting it first
            combined_text = f"{abstract}\n\n{document_text}"
    
    if not combined_text.strip():
        return []
    
    # Extract keywords
    keywords = extract_keywords(combined_text, top_n=top_n)
    
    # Clean and deduplicate keywords
    cleaned_keywords = []
    seen = set()
    for kw in keywords:
        kw_lower = kw.lower().strip()
        if kw_lower and kw_lower not in seen and len(kw_lower) > 2:
            seen.add(kw_lower)
            # Capitalize first letter of each word
            cleaned_keywords.append(kw.title())
    
    return cleaned_keywords[:top_n]


def suggest_keywords(abstract: str, existing_keywords: List[str] = None, top_n: int = 5) -> List[str]:
    """
    Suggest additional keywords based on the abstract that aren't already in existing keywords.
    
    Args:
        abstract: The project abstract
        existing_keywords: List of keywords already assigned
        top_n: Number of suggestions to return
    
    Returns:
        List of suggested keywords
    """
    if not abstract:
        return []
    
    existing_lower = set(kw.lower() for kw in (existing_keywords or []))
    
    # Extract more keywords than needed to filter
    all_keywords = extract_keywords(abstract, top_n=top_n * 2)
    
    # Filter out existing keywords
    suggestions = []
    for kw in all_keywords:
        if kw.lower() not in existing_lower:
            suggestions.append(kw.title())
            if len(suggestions) >= top_n:
                break
    
    return suggestions
