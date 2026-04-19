import json
import os
import re
import uuid
import shutil
import subprocess
import tarfile
import tempfile
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

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


def _extract_latex_errors(stderr: str, stdout: str) -> str:
    """
    Parse tectonic/XeTeX output and extract the most meaningful error lines.
    Returns a human-readable summary of what went wrong.
    """
    combined = (stderr + "\n" + stdout).strip()
    if not combined:
        return "No output captured from the compiler."

    # Collect lines that carry actionable information
    error_lines: list[str] = []
    for line in combined.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # Hard LaTeX errors
        if stripped.startswith("!"):
            error_lines.append(stripped)
        # File-not-found / package errors reported by tectonic
        elif re.search(r"error|fatal|undefined|missing|not found|cannot|failed", stripped, re.IGNORECASE):
            error_lines.append(stripped)

    if error_lines:
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique_errors: list[str] = []
        for line in error_lines:
            if line not in seen:
                seen.add(line)
                unique_errors.append(line)
        return "\n".join(unique_errors)

    # Fall back to the raw output (truncated to avoid enormous payloads)
    return combined[:2000]


def _get_tectonic_download_url() -> str:
    """Fetch the latest tectonic release from the GitHub API and return the asset URL."""
    req = urllib.request.Request(
        TECTONIC_RELEASES_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "cv-builder"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            http_status = resp.status
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"GitHub API request failed with HTTP {exc.code}: {exc.reason}. "
            "Cannot resolve tectonic download URL."
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Network error while contacting GitHub API: {exc.reason}. "
            "Check your internet connection and try again."
        ) from exc
    except TimeoutError:
        raise RuntimeError(
            "GitHub API request timed out after 10 seconds. "
            "The server may be temporarily unavailable."
        )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Failed to parse GitHub API response as JSON (HTTP {http_status}): {exc}. "
            "The API may have returned an unexpected payload."
        ) from exc

    for asset in data.get("assets", []):
        if asset.get("name", "").endswith(TECTONIC_ASSET_NAME):
            return asset["browser_download_url"]

    available = [a.get("name", "") for a in data.get("assets", [])]
    raise RuntimeError(
        f"No tectonic asset matching '{TECTONIC_ASSET_NAME}' found in the latest release. "
        f"Available assets: {available or 'none'}."
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

    try:
        urllib.request.urlretrieve(download_url, str(tar_path))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"Failed to download tectonic binary: HTTP {exc.code} {exc.reason} — URL: {download_url}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Network error while downloading tectonic binary: {exc.reason} — URL: {download_url}"
        ) from exc

    if not tar_path.is_file() or tar_path.stat().st_size == 0:
        raise RuntimeError(
            f"Downloaded tectonic archive is empty or missing at {tar_path}. "
            "The download may have been interrupted."
        )

    try:
        with tarfile.open(str(tar_path)) as tf:
            tf.extractall(path=str(tar_path.parent))
    except tarfile.TarError as exc:
        raise RuntimeError(
            f"Failed to extract tectonic archive at {tar_path}: {exc}. "
            "The archive may be corrupt."
        ) from exc

    if not dest.is_file():
        raise RuntimeError(
            f"Tectonic binary not found at {dest} after extraction. "
            "The archive may not contain the expected binary name 'tectonic'."
        )

    try:
        dest.chmod(0o755)
    except OSError as exc:
        raise RuntimeError(
            f"Failed to set execute permissions on {dest}: {exc}."
        ) from exc

    tar_path.unlink(missing_ok=True)
    logger.info("tectonic ready at %s", dest)
    return str(dest)


def get_tectonic_path() -> str:
    """
    Resolve tectonic binary path.
    Checks: bundled bin/ (local dev) -> system PATH -> /tmp download (Vercel Lambda).
    Raises RuntimeError with an explicit message if tectonic cannot be found or downloaded.
    """
    project_root = Path(__file__).resolve().parent.parent
    bundled = project_root / "bin" / "tectonic"
    if bundled.is_file() and os.access(str(bundled), os.X_OK):
        return str(bundled)

    system = shutil.which("tectonic")
    if system:
        return system

    return _download_tectonic()


def check_tectonic() -> dict:
    """Return availability status and version string (or error reason) for tectonic."""
    try:
        tectonic = get_tectonic_path()
        result = subprocess.run(
            [tectonic, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            version = result.stdout.strip() or result.stderr.strip() or "unknown"
            return {"available": True, "version": version}
        return {
            "available": False,
            "reason": f"tectonic --version exited with code {result.returncode}: {result.stderr.strip()}",
        }
    except RuntimeError as exc:
        return {"available": False, "reason": str(exc)}
    except subprocess.TimeoutExpired:
        return {"available": False, "reason": "tectonic --version timed out after 10 seconds"}
    except Exception as exc:
        return {"available": False, "reason": f"Unexpected error checking tectonic: {exc}"}


def validate_api_key(request: Request):
    """Skip key check in development, enforce in production."""
    if NODE_ENV == "development":
        return
    api_key = request.headers.get("x-api-key")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Provide a valid key in the 'X-API-Key' header.",
        )
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key. The provided 'X-API-Key' value does not match the server key.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    tectonic_status = check_tectonic()
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tectonic": tectonic_status,
    }


class CompileRequest(BaseModel):
    latex: str


@app.post("/compile")
async def compile_latex(
    body: CompileRequest,
    _: None = Depends(validate_api_key),
):
    if not body.latex or not body.latex.strip():
        raise HTTPException(status_code=400, detail="LaTeX content is required and cannot be empty.")

    # Strip pdfTeX-only primitives that are undefined in tectonic (XeTeX).
    # Resume templates often include \input{glyphtounicode} and
    # \pdfgentounicode=1 for pdflatex — they are a no-op for our purposes.
    latex_source = body.latex
    latex_source = re.sub(r"\\input\{glyphtounicode\}", "", latex_source)
    latex_source = re.sub(r"\\pdfgentounicode\s*=\s*\d+", "", latex_source)
    latex_source = re.sub(r"\\pdfglyphtounicode\b[^\n]*", "", latex_source)

    try:
        tectonic = get_tectonic_path()
    except RuntimeError as exc:
        logger.error("tectonic binary unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={
                "error": "LaTeX compiler unavailable",
                "reason": str(exc),
            },
        ) from exc

    job_id = str(uuid.uuid4())
    work_dir = Path(tempfile.gettempdir()) / f"latex-{job_id}"
    tex_file = work_dir / "document.tex"
    pdf_file = work_dir / "document.pdf"

    # tectonic downloads TeX packages on first run; cache them in /tmp
    tectonic_cache = Path(tempfile.gettempdir()) / "tectonic-cache"

    try:
        try:
            work_dir.mkdir(parents=True, exist_ok=True)
            tex_file.write_text(latex_source, encoding="utf-8")
        except OSError as exc:
            logger.error("Failed to prepare working directory for job %s: %s", job_id, exc)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Server filesystem error",
                    "reason": f"Could not create temporary working directory or write LaTeX source: {exc}",
                },
            ) from exc

        # Create a minimal fontconfig file so XeTeX doesn't fail with
        # "Cannot load default config file: No such file: (null)" in
        # environments (like Vercel) that have no system fontconfig.
        fontconfig_dir = Path(tempfile.gettempdir()) / "fontconfig"
        try:
            fontconfig_dir.mkdir(exist_ok=True)
            fonts_conf = fontconfig_dir / "fonts.conf"
            if not fonts_conf.exists():
                fonts_conf.write_text(
                    '<?xml version="1.0"?>\n'
                    '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
                    "<fontconfig>\n"
                    "</fontconfig>\n"
                )
        except OSError as exc:
            logger.warning("Could not create fontconfig stub (non-fatal): %s", exc)
            fonts_conf = None

        env = {**os.environ, "TECTONIC_CACHE_DIR": str(tectonic_cache)}
        if fonts_conf and fonts_conf.exists():
            env["FONTCONFIG_FILE"] = str(fonts_conf)

        try:
            # tectonic handles multiple passes internally
            result = subprocess.run(
                [tectonic, "--outdir", str(work_dir), str(tex_file)],
                capture_output=True,
                text=True,
                timeout=60,
                env=env,
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "LaTeX compiler unavailable",
                    "reason": f"tectonic binary not found at resolved path '{tectonic}'. It may have been removed after startup.",
                },
            )
        except PermissionError as exc:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "LaTeX compiler unavailable",
                    "reason": f"Permission denied when executing tectonic at '{tectonic}': {exc}",
                },
            ) from exc
        except subprocess.TimeoutExpired:
            logger.error("Tectonic timed out for job %s", job_id)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Compilation timed out",
                    "reason": (
                        "tectonic did not finish within 60 seconds. "
                        "This can happen when the document is very complex, "
                        "references missing packages, or contains an infinite loop."
                    ),
                },
            )

        if not pdf_file.exists():
            error_summary = _extract_latex_errors(result.stderr, result.stdout)
            logger.error("Compilation failed for job %s (exit code %d): %s", job_id, result.returncode, error_summary)
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "LaTeX compilation failed",
                    "exit_code": result.returncode,
                    "reason": error_summary,
                },
            )

        try:
            pdf_bytes = pdf_file.read_bytes()
        except OSError as exc:
            logger.error("Failed to read compiled PDF for job %s: %s", job_id, exc)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to read compiled PDF",
                    "reason": f"PDF was generated but could not be read from disk: {exc}",
                },
            ) from exc

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="resume.pdf"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# Local development entry point
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server on port %d", PORT)
    status = check_tectonic()
    if status["available"]:
        logger.info("tectonic available: %s", status.get("version"))
    else:
        logger.warning("tectonic NOT available: %s", status.get("reason"))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
