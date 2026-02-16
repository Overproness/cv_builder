'use client';

import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { LuCheck, LuCopy, LuDownload, LuExternalLink, LuFileCode, LuMaximize2, LuX } from 'react-icons/lu';

/**
 * PDF Preview component - displays compiled PDF and provides download/copy options
 */
export default function PdfPreview({ 
  pdfBlob, 
  latexSource = '',
  fileName = 'resume.pdf',
  onClose,
  className = '' 
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  // Create object URL when pdfBlob changes
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfBlob]);

  const handleDownloadPdf = () => {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadLatex = () => {
    if (!latexSource) return;
    
    const blob = new Blob([latexSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.pdf', '.tex');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLatex = async () => {
    if (!latexSource) return;
    
    try {
      await navigator.clipboard.writeText(latexSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenInOverleaf = () => {
    if (!latexSource) return;
    
    // Create a form to submit to Overleaf
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';
    
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'snip';
    input.value = latexSource;
    
    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'snip_name';
    nameInput.value = fileName.replace('.pdf', '.tex');
    
    form.appendChild(input);
    form.appendChild(nameInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!pdfBlob) {
    return null;
  }

  const previewContent = (
    <div className={`relative bg-muted rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <span className="text-sm font-medium">PDF Preview</span>
        <div className="flex items-center gap-2">
          {/* LaTeX actions - shown only if latexSource is provided */}
          {latexSource && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInOverleaf}
                title="Open in Overleaf"
              >
                <LuExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLatex}
                title="Copy LaTeX Source"
              >
                {copied ? (
                  <LuCheck className="h-4 w-4 text-green-500" />
                ) : (
                  <LuCopy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadLatex}
                title="Download LaTeX (.tex)"
              >
                <LuFileCode className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {/* PDF actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            title="Download PDF"
          >
            <LuDownload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <LuMaximize2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close Preview"
            >
              <LuX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* PDF Embed */}
      <div className={isFullscreen ? "h-[calc(100vh-60px)]" : "h-[500px]"}>
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Loading PDF...
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {previewContent}
      </div>
    );
  }

  return previewContent;
}
