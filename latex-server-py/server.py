import os
import uuid
import shutil
import subprocess
import tempfile
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="LaTeX Compilation Server (tectonic)")

PORT = int(os.environ.get("PORT", 3001))
API_KEY = os.environ.get("API_KEY", "development-key")
NODE_ENV = os.environ.get("NODE_ENV", "development")

# CORS
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
origins = allowed_origins_env.split(",") if allowed_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = datetime.now(timezone.utc)
    response = await call_next(request)
    duration_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
    logger.info(
        "%s %s %s - %.2fms %s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        datetime.now(timezone.utc).isoformat(),
    )
    return response


def check_tectonic() -> bool:
    try:
        subprocess.run(
            ["tectonic", "--version"],
            capture_output=True,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def validate_api_key(request: Request):
    """Dependency: skip key check in development, enforce in production."""
    if NODE_ENV == "development":
        return
    api_key = request.headers.get("x-api-key")
    if not api_key or api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tectonic": check_tectonic(),
    }


class CompileRequest(BaseModel):
    latex: str


@app.post("/compile")
async def compile_latex(
    body: CompileRequest,
    _: None = Depends(validate_api_key),
):
    if not body.latex:
        raise HTTPException(status_code=400, detail="LaTeX content is required")

    job_id = str(uuid.uuid4())
    work_dir = Path(tempfile.gettempdir()) / f"latex-{job_id}"
    tex_file = work_dir / "document.tex"
    pdf_file = work_dir / "document.pdf"

    try:
        work_dir.mkdir(parents=True, exist_ok=True)
        tex_file.write_text(body.latex, encoding="utf-8")

        # tectonic handles multiple compilation passes internally
        result = subprocess.run(
            [
                "tectonic",
                "--outdir", str(work_dir),
                str(tex_file),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if not pdf_file.exists():
            error_details = (
                result.stderr.strip()
                or result.stdout.strip()
                or "PDF generation failed"
            )
            logger.error("Compilation failed: %s", error_details)
            raise HTTPException(
                status_code=500,
                detail={"error": "Compilation failed", "details": error_details},
            )

        pdf_bytes = pdf_file.read_bytes()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="resume.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except subprocess.TimeoutExpired:
        logger.error("Tectonic timed out for job %s", job_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "Compilation failed", "details": "Tectonic timed out"},
        )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    logger.info("LaTeX compilation server (tectonic) starting on port %d", PORT)
    logger.info("tectonic available: %s", check_tectonic())
    uvicorn.run(app, host="0.0.0.0", port=PORT)
