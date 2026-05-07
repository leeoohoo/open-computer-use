from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from server.app.api.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Open Computer Use",
        version="0.1.0",
        description="Local-first computer-use prototype.",
    )
    app.include_router(router)

    static_dir = Path(__file__).resolve().parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        @app.get("/", response_class=HTMLResponse)
        def index() -> str:
            return (static_dir / "index.html").read_text(encoding="utf-8")

    return app


app = create_app()
