from __future__ import annotations

import json
import os
from pathlib import Path

from shared.schemas.chat import RunConfig


class RunConfigStore:
    def __init__(self, path: Path | None = None) -> None:
        root_dir = Path(__file__).resolve().parents[3]
        default_path = root_dir / "server_config.json"
        configured_path = os.getenv("OPEN_COMPUTER_USE_SERVER_CONFIG")
        self.path = Path(configured_path) if configured_path else (path or default_path)

    def load(self) -> RunConfig:
        if not self.path.exists():
            config = self.default_config()
            self.save(config)
            return config

        data = json.loads(self.path.read_text(encoding="utf-8"))
        return RunConfig.model_validate(data)

    def save(self, config: RunConfig) -> RunConfig:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(config.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return config

    @staticmethod
    def default_config() -> RunConfig:
        return RunConfig(
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1/",
            api_key="",
            api_mode="auto",
            thinking_mode="auto",
            reasoning_effort="medium",
            model_compat_mode="auto",
            max_steps=100,
            enable_ocr=False,
            max_images_per_tool_result=1,
            model_image_max_edge=1600,
            model_image_max_bytes=350000,
        )
