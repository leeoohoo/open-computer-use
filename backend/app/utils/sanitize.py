"""
Content sanitization utilities
"""

import bleach
import re
from typing import Any, Union
import unicodedata


def sanitize_content(content: Union[str, Any]) -> str:
    """Sanitize user-generated content - removes HTML threats and Unicode issues"""
    
    if not isinstance(content, str):
        content = str(content)
    
    # CRITICAL: Remove null bytes and invalid Unicode that breaks PostgreSQL
    # This must happen FIRST before any other processing
    content = content.replace('\x00', '')  # Remove null bytes
    content = content.replace('\u0000', '')  # Remove Unicode null
    content = content.replace('\\u0000', '')  # Remove escaped Unicode null
    content = content.replace('\\x00', '')  # Remove escaped hex null
    
    # Remove other problematic control characters (keep tab, newline, carriage return)
    control_chars = dict.fromkeys(range(0, 32), None)
    control_chars[ord('\t')] = '\t'  # Keep tab
    control_chars[ord('\n')] = '\n'  # Keep newline  
    control_chars[ord('\r')] = '\r'  # Keep carriage return
    content = content.translate(control_chars)
    content = content.replace('\x7F', '')  # Remove DEL character
    
    # Normalize Unicode to prevent encoding issues
    try:
        content = unicodedata.normalize('NFC', content)
    except:
        pass  # If normalization fails, continue with original
    
    # Ensure valid UTF-8
    try:
        content = content.encode('utf-8', errors='replace').decode('utf-8')
    except:
        pass  # If encoding check fails, continue
    
    # Allow basic formatting tags, file-attachment tags, and CUA section tags
    allowed_tags = [
        'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2',
        'h3', 'h4', 'h5', 'h6', 'file-attachment', 'cua-section'
    ]

    allowed_attributes = {
        'a': ['href', 'title'],
        'code': ['class'],
        'file-attachment': ['name', 'path', 'size'],
        'cua-section': ['type', 'status', 'step', 'budget']
    }
    
    # Clean the content
    cleaned = bleach.clean(
        content,
        tags=allowed_tags,
        attributes=allowed_attributes,
        strip=True
    )
    
    # Remove any script tags or javascript
    cleaned = re.sub(r'<script[^>]*>.*?</script>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'on\w+\s*=', '', cleaned, flags=re.IGNORECASE)
    
    return cleaned


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename"""
    
    # Remove any path components
    filename = filename.replace('/', '').replace('\\', '')
    
    # Remove special characters
    filename = re.sub(r'[^\w\s\-\.]', '', filename)
    
    # Limit length
    name_parts = filename.rsplit('.', 1)
    if len(name_parts) == 2:
        name, ext = name_parts
        name = name[:200]  # Limit name to 200 chars
        ext = ext[:10]  # Limit extension to 10 chars
        filename = f"{name}.{ext}"
    else:
        filename = filename[:200]
    
    return filename