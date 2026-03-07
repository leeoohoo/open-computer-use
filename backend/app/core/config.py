"""
Configuration management using Pydantic Settings
"""

import os
from typing import List, Optional, Union
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Server Configuration
    SERVER_HOST: str = Field(default="0.0.0.0")
    SERVER_PORT: int = Field(default=8001)
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)
    
    # CORS Settings  
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default="http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173"
    )
    
    # Supabase Configuration
    SUPABASE_URL: str = Field(default="")
    SUPABASE_ANON_KEY: str = Field(default="")
    SUPABASE_SERVICE_ROLE: str = Field(default="")
    
    # Security
    ENCRYPTION_KEY: str = Field(default="")
    JWT_SECRET_KEY: str = Field(default="your-secret-key-change-in-production")
    CSRF_SECRET: str = Field(default="")
    INTERNAL_API_KEY: str = Field(default="")  # Shared secret between Next.js proxy and backend
    
    # AWS Bedrock Configuration
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    AWS_REGION: str = Field(default="us-east-1")

    # Bedrock Model Configuration (env-configurable with fallbacks)
    BEDROCK_DEFAULT_MODEL: str = Field(default="anthropic.claude-sonnet-4-20250514-v1:0")
    BEDROCK_GROUNDING_MODEL: str = Field(default="anthropic.claude-3-5-sonnet-20241022-v2:0")
    BEDROCK_AVAILABLE_MODELS: str = Field(
        default="anthropic.claude-sonnet-4-20250514-v1:0,anthropic.claude-3-5-sonnet-20241022-v2:0,anthropic.claude-3-haiku-20240307-v1:0,meta.llama3-2-90b-instruct-v1:0,mistral.mistral-large-2407-v1:0,amazon.nova-pro-v1:0,amazon.nova-lite-v1:0"
    )
    
    # Google Search Configuration
    GOOGLE_SEARCH_KEY: Optional[str] = Field(default=None)
    GOOGLE_SEARCH_CX: Optional[str] = Field(default=None)
    
    # Azure Container Instances
    AZURE_SUBSCRIPTION_ID: Optional[str] = Field(default=None)
    AZURE_RESOURCE_GROUP: Optional[str] = Field(default=None)
    AZURE_TENANT_ID: Optional[str] = Field(default=None)
    AZURE_CLIENT_ID: Optional[str] = Field(default=None)
    AZURE_CLIENT_SECRET: Optional[str] = Field(default=None)
    AZURE_CONTAINER_REGISTRY: Optional[str] = Field(default=None)
    AZURE_STORAGE_ACCOUNT: Optional[str] = Field(default=None)
    AZURE_STORAGE_KEY: Optional[str] = Field(default=None)
    
    # Redis Cache
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    CACHE_ENABLED: bool = Field(default=False)
    CACHE_TTL: int = Field(default=300)  # 5 minutes
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    RATE_LIMIT_PER_MINUTE: int = Field(default=60)
    RATE_LIMIT_PER_HOUR: int = Field(default=1000)
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FORMAT: str = Field(default="json")
    
    # Model Configuration
    FREE_MODELS: Union[str, List[str]] = Field(
        default="amazon.nova-lite-v1:0,anthropic.claude-3-haiku-20240307-v1:0"
    )

    NON_AUTH_ALLOWED_MODELS: Union[str, List[str]] = Field(
        default="amazon.nova-lite-v1:0"
    )
    
    # Request Configuration
    MAX_REQUEST_SIZE: int = Field(default=10 * 1024 * 1024)  # 10MB
    REQUEST_TIMEOUT: int = Field(default=60)  # seconds
    STREAM_TIMEOUT: int = Field(default=300)  # seconds — raised for long-running tasks

    # Task Scheduler
    SCHEDULER_ENABLED: bool = Field(default=True)
    SCHEDULER_POLL_INTERVAL: int = Field(default=60)  # seconds
    MAX_CONSECUTIVE_FAILURES: int = Field(default=5)
    SCHEDULE_LIMITS: str = Field(default="free:3,basic:3,pro:10,enterprise:50")
    SCHEDULED_TASK_IDLE_TIMEOUT: int = Field(default=300)  # 5 min — no chunk = stuck
    SCHEDULED_TASK_MAX_TIMEOUT: int = Field(default=21600)  # 6 hours — absolute wall-clock cap
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        elif v is None:
            return ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]
        return v
    
    @field_validator("FREE_MODELS", mode="before")
    @classmethod
    def parse_free_models(cls, v):
        if isinstance(v, str):
            return [model.strip() for model in v.split(",")]
        return v
    
    @field_validator("NON_AUTH_ALLOWED_MODELS", mode="before")
    @classmethod
    def parse_non_auth_models(cls, v):
        if isinstance(v, str):
            return [model.strip() for model in v.split(",")]
        return v
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"
    
    def get_bedrock_models_list(self) -> List[str]:
        """Get list of available Bedrock model IDs from config."""
        if isinstance(self.BEDROCK_AVAILABLE_MODELS, str):
            return [m.strip() for m in self.BEDROCK_AVAILABLE_MODELS.split(",") if m.strip()]
        return list(self.BEDROCK_AVAILABLE_MODELS)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Create a global settings instance
settings = get_settings()