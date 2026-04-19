FROM python:3.11-slim

# Install system dependencies required by tectonic
RUN apt-get update && apt-get install -y \
    curl \
    libssl3 \
    libfontconfig1 \
    libfreetype6 \
    libharfbuzz0b \
    libgraphite2-3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install tectonic from official GitHub releases (musl binary, no extra deps needed)
RUN curl -fsSL \
    "https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic-x86_64-unknown-linux-musl.tar.gz" \
    | tar xz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/tectonic

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY . .

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["python", "server.py"]
