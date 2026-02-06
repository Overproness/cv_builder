# LaTeX Compilation Server

Express.js server that compiles LaTeX to PDF using TeX Live's pdflatex.

## Deployment on Render.com

### Option 1: Blueprint Deployment (Recommended)

1. Push this folder to a GitHub repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml` and configure the service

### Option 2: Manual Deployment

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `latex-compilation-server`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `latex-server`
   - **Runtime**: Docker
   - **Plan**: Starter ($7/month) or higher

5. Add Environment Variables:
   - `API_KEY`: Generate a secure random string
   - `ALLOWED_ORIGINS`: Your Vercel app URL (e.g., `https://your-app.vercel.app`)
   - `NODE_ENV`: `production`

6. Click "Create Web Service"

## API Usage

### Health Check
```bash
GET /health
```

### Compile LaTeX to PDF
```bash
POST /compile
Headers:
  Content-Type: application/json
  X-API-Key: your-api-key

Body:
{
  "latex": "\\documentclass{article}\\begin{document}Hello World\\end{document}"
}

Response: PDF binary (application/pdf)
```

## Local Development

```bash
# Install dependencies
npm install

# Run server (requires pdflatex installed locally)
npm start
```

For local testing without TeX Live, use Docker:
```bash
docker build -t latex-server .
docker run -p 3001:3001 latex-server
```
