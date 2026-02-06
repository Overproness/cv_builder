const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'development-key';

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pdflatex: checkPdflatex()
  });
});

// Check if pdflatex is available
function checkPdflatex() {
  try {
    execSync('pdflatex --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// API Key validation middleware
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  // Skip API key check in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  next();
}

// Main compilation endpoint
app.post('/compile', validateApiKey, async (req, res) => {
  const { latex } = req.body;
  
  if (!latex) {
    return res.status(400).json({ error: 'LaTeX content is required' });
  }
  
  const jobId = uuidv4();
  const workDir = path.join('/tmp', `latex-${jobId}`);
  const texFile = path.join(workDir, 'document.tex');
  const pdfFile = path.join(workDir, 'document.pdf');
  
  try {
    // Create working directory
    fs.mkdirSync(workDir, { recursive: true });
    
    // Write LaTeX file
    fs.writeFileSync(texFile, latex, 'utf8');
    
    // Run pdflatex (twice for references)
    const pdflatexArgs = [
      '-interaction=nonstopmode',
      '-halt-on-error',
      '-output-directory=' + workDir,
      texFile
    ];
    
    // First pass
    await runPdflatex(pdflatexArgs, workDir);
    
    // Second pass (for references, if needed)
    await runPdflatex(pdflatexArgs, workDir);
    
    // Check if PDF was created
    if (!fs.existsSync(pdfFile)) {
      // Read log file for error details
      const logFile = path.join(workDir, 'document.log');
      let errorDetails = 'PDF generation failed';
      if (fs.existsSync(logFile)) {
        const log = fs.readFileSync(logFile, 'utf8');
        // Extract error messages
        const errorMatch = log.match(/^!.*$/gm);
        if (errorMatch) {
          errorDetails = errorMatch.join('\n');
        }
      }
      throw new Error(errorDetails);
    }
    
    // Read and send PDF
    const pdfBuffer = fs.readFileSync(pdfFile);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume.pdf"',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Compilation error:', error.message);
    res.status(500).json({ 
      error: 'Compilation failed',
      details: error.message
    });
  } finally {
    // Cleanup
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
});

// Run pdflatex as a promise
function runPdflatex(args, cwd) {
  return new Promise((resolve, reject) => {
    const process = spawn('pdflatex', args, { 
      cwd,
      timeout: 60000 // 60 second timeout
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        // pdflatex may return non-zero but still produce PDF
        // Only reject if we need to
        resolve({ stdout, stderr, code });
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`LaTeX compilation server running on port ${PORT}`);
  console.log(`pdflatex available: ${checkPdflatex()}`);
});
