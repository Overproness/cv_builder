import os
import uuid
import shutil
import subprocess
import tarfile
import tempfile
import logging
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

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
        "%s %s %s - %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


TECTONIC_ASSET_NAME = "x86_64-unknown-linux-musl.tar.gz"
TECTONIC_RELEASES_API = (
    "https://api.github.com/repos/tectonic-typesetting/tectonic/releases/latest"
)


def _get_tectonic_download_url() -> str:
    """Fetch the latest release from GitHub API and return the correct asset URL."""
    req = urllib.request.Request(
        TECTONIC_RELEASES_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "cv-builder"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        import json
        data = json.loads(resp.read())
    for asset in data.get("assets", []):
        if asset["name"].endswith(TECTONIC_ASSET_NAME):
            return asset["browser_download_url"]
    raise RuntimeError(
        f"No tectonic asset matching '{TECTONIC_ASSET_NAME}' found in latest release"
    )


def _download_tectonic() -> str:
    """Download the tectonic static binary to /tmp on cold start."""
    dest = Path(tempfile.gettempdir()) / "tectonic"
    if dest.is_file() and os.access(str(dest), os.X_OK):
        return str(dest)
    logger.info("Downloading tectonic binary from GitHub...")
    download_url = _get_tectonic_download_url()
    logger.info("Resolved tectonic URL: %s", download_url)
    tar_path = Path(tempfile.gettempdir()) / "tectonic.tar.gz"
    urllib.request.urlretrieve(download_url, str(tar_path))
    with tarfile.open(str(tar_path)) as tf:
        tf.extractall(path=str(tar_path.parent))
    dest.chmod(0o755)
    tar_path.unlink(missing_ok=True)
    logger.info("tectonic ready at %s", dest)
    return str(dest)


def get_tectonic_path() -> str:
    """
    Resolve tectonic binary path.
    Checks: bundled bin/ (local dev) -> system PATH -> /tmp download (Vercel Lambda).
    """
    project_root = Path(__file__).resolve().parent.parent
    bundled = project_root / "bin" / "tectonic"
    if bundled.is_file() and os.access(str(bundled), os.X_OK):
        return str(bundled)
    system = shutil.which("tectonic")
    if system:
        return system
    return _download_tectonic()


def check_tectonic() -> bool:
    try:
        tectonic = get_tectonic_path()
        subprocess.run([tectonic, "--version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


def validate_api_key(request: Request):
    """Skip key check in development, enforce in production."""
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

    tectonic = get_tectonic_path()
    job_id = str(uuid.uuid4())
    work_dir = Path(tempfile.gettempdir()) / f"latex-{job_id}"
    tex_file = work_dir / "document.tex"
    pdf_file = work_dir / "document.pdf"

    # tectonic downloads TeX packages on first run; cache them in /tmp
    tectonic_cache = Path(tempfile.gettempdir()) / "tectonic-cache"

    try:
        work_dir.mkdir(parents=True, exist_ok=True)
        tex_file.write_text(body.latex, encoding="utf-8")

        env = {**os.environ, "TECTONIC_CACHE_DIR": str(tectonic_cache)}

        # tectonic handles multiple passes internally
        result = subprocess.run(
            [tectonic, "--outdir", str(work_dir), str(tex_file)],
            capture_output=True,
            text=True,
            timeout=60,
            env=env,
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


# Local development entry point
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server on port %d", PORT)
    logger.info("tectonic available: %s", check_tectonic())
    uvicorn.run(app, host="0.0.0.0", port=PORT)
