"""
Screenshot storage service for efficient handling of large images
"""

import json
import logging
import hashlib
import os
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)


class ScreenshotStorageService:
    """
    Service for storing screenshots separately from chat messages
    Uses a hybrid approach:
    1. Temporary file storage for active sessions
    2. Reference-based storage in messages
    3. Automatic cleanup of old screenshots
    """
    
    def __init__(self, storage_path: str = "/tmp/coasty_screenshots"):
        """Initialize screenshot storage service"""
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache for quick access
        self.cache: Dict[str, Dict] = {}
        self.max_cache_size = 100
        
        # Flag to track if cleanup task has been started
        self._cleanup_task = None
    
    async def initialize(self):
        """Initialize async components"""
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_old_screenshots())
    
    def generate_screenshot_id(self, data: str) -> str:
        """Generate unique ID for screenshot based on content hash"""
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    async def store_screenshot(
        self,
        screenshot_data: str,
        chat_id: str,
        message_id: str,
        compressed_data: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Store screenshot and return reference
        
        Args:
            screenshot_data: Original base64 screenshot data
            chat_id: Chat session ID
            message_id: Message ID
            compressed_data: Optional pre-compressed version
            
        Returns:
            Reference object with screenshot metadata
        """
        try:
            # Generate unique ID
            screenshot_id = self.generate_screenshot_id(screenshot_data)
            
            # Check if already stored
            if screenshot_id in self.cache:
                logger.debug(f"Screenshot {screenshot_id} already in cache")
                return self.cache[screenshot_id]["reference"]
            
            # Create storage structure
            timestamp = datetime.utcnow().isoformat()
            file_path = self.storage_path / f"{screenshot_id}.json"
            
            # Prepare metadata
            metadata = {
                "id": screenshot_id,
                "chat_id": chat_id,
                "message_id": message_id,
                "timestamp": timestamp,
                "original_size": len(screenshot_data),
                "compressed_size": len(compressed_data) if compressed_data else len(screenshot_data),
                "file_path": str(file_path)
            }
            
            # Store to file (async write)
            storage_data = {
                "metadata": metadata,
                "data": compressed_data or screenshot_data
            }
            
            await self._write_file_async(file_path, json.dumps(storage_data))
            
            # Create reference object for message
            reference = {
                "type": "screenshot_reference",
                "screenshot_id": screenshot_id,
                "size": metadata["compressed_size"],
                "timestamp": timestamp,
                "preview": self._generate_preview_url(screenshot_id)
            }
            
            # Cache with size management
            if len(self.cache) >= self.max_cache_size:
                # Remove oldest entries
                oldest_keys = sorted(
                    self.cache.keys(),
                    key=lambda k: self.cache[k]["metadata"]["timestamp"]
                )[:10]
                for key in oldest_keys:
                    del self.cache[key]
            
            self.cache[screenshot_id] = {
                "metadata": metadata,
                "reference": reference,
                "last_accessed": datetime.utcnow()
            }
            
            logger.info(f"Stored screenshot {screenshot_id}: {metadata['original_size']:,} -> {metadata['compressed_size']:,} bytes")
            
            return reference
            
        except Exception as e:
            logger.error(f"Failed to store screenshot: {str(e)}")
            # Return inline data as fallback
            return {
                "type": "screenshot_inline",
                "data": compressed_data or screenshot_data
            }
    
    async def retrieve_screenshot(self, screenshot_id: str) -> Optional[str]:
        """
        Retrieve screenshot data by ID
        
        Args:
            screenshot_id: Screenshot unique ID
            
        Returns:
            Base64 encoded screenshot data or None
        """
        try:
            # Check cache first
            if screenshot_id in self.cache:
                self.cache[screenshot_id]["last_accessed"] = datetime.utcnow()
                file_path = self.cache[screenshot_id]["metadata"]["file_path"]
            else:
                file_path = self.storage_path / f"{screenshot_id}.json"
            
            # Read from file
            if os.path.exists(file_path):
                data = await self._read_file_async(file_path)
                storage_data = json.loads(data)
                return storage_data.get("data")
            
            logger.warning(f"Screenshot {screenshot_id} not found")
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve screenshot {screenshot_id}: {str(e)}")
            return None
    
    async def _write_file_async(self, path: Path, data: str):
        """Async file write"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._write_file_sync, path, data)
    
    def _write_file_sync(self, path: Path, data: str):
        """Sync file write for executor"""
        with open(path, 'w') as f:
            f.write(data)
    
    async def _read_file_async(self, path: Path) -> str:
        """Async file read"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._read_file_sync, path)
    
    def _read_file_sync(self, path: Path) -> str:
        """Sync file read for executor"""
        with open(path, 'r') as f:
            return f.read()
    
    def _generate_preview_url(self, screenshot_id: str) -> str:
        """Generate preview URL for screenshot"""
        # This would be the endpoint to retrieve screenshots
        return f"/api/screenshots/{screenshot_id}/preview"
    
    async def _cleanup_old_screenshots(self):
        """Background task to clean up old screenshots"""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                
                # Clean files older than 24 hours
                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                
                for file_path in self.storage_path.glob("*.json"):
                    try:
                        # Check file age
                        file_stat = file_path.stat()
                        file_time = datetime.fromtimestamp(file_stat.st_mtime)
                        
                        if file_time < cutoff_time:
                            file_path.unlink()
                            logger.info(f"Cleaned up old screenshot: {file_path.name}")
                            
                            # Remove from cache
                            screenshot_id = file_path.stem
                            if screenshot_id in self.cache:
                                del self.cache[screenshot_id]
                    
                    except Exception as e:
                        logger.error(f"Error cleaning up {file_path}: {str(e)}")
                
                # Clean cache entries not accessed recently
                cache_cutoff = datetime.utcnow() - timedelta(hours=2)
                expired_keys = [
                    k for k, v in self.cache.items()
                    if v.get("last_accessed", datetime.utcnow()) < cache_cutoff
                ]
                
                for key in expired_keys:
                    del self.cache[key]
                
                if expired_keys:
                    logger.info(f"Removed {len(expired_keys)} expired entries from cache")
                    
            except Exception as e:
                logger.error(f"Error in cleanup task: {str(e)}")
    
    def get_storage_stats(self) -> Dict:
        """Get storage statistics"""
        try:
            total_files = len(list(self.storage_path.glob("*.json")))
            total_size = sum(f.stat().st_size for f in self.storage_path.glob("*.json"))
            
            return {
                "total_files": total_files,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "cache_entries": len(self.cache),
                "storage_path": str(self.storage_path)
            }
        except Exception as e:
            logger.error(f"Failed to get storage stats: {str(e)}")
            return {}


# Global instance
screenshot_storage = ScreenshotStorageService()