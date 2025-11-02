import React, { useState, useRef, useEffect } from 'react';
import Shell from '../Shell';
import CodeEditor from '../CodeEditor';
import { Terminal, X, FileCode } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

function InlineImageViewer({ projectName, file }) {
  if (!file) return null;
  const imagePath = `/api/projects/${projectName}/files/content?path=${encodeURIComponent(file.path)}`;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-background">
        <img
          src={imagePath}
          alt={file.name}
          className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
        />
      </div>
    </div>
  );
}

function VSCodeEditorArea({
  selectedProject,
  selectedSession,
  selectedFile,
  selectedImage,
  showShell,
  onToggleShell,
  onCloseEditor,
  isMobile
}) {
  const [editorHeight, setEditorHeight] = useState(60); // %
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const percentage = (offsetY / rect.height) * 100;
      if (percentage >= 20 && percentage <= 80) {
        setEditorHeight(percentage);
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 h-full" ref={containerRef}>
      <div className="h-10 px-2 flex items-center justify-end gap-2 border-b border-border bg-card flex-shrink-0">
        <Button
          variant={showShell ? "default" : "secondary"}
          size="sm"
          onClick={onToggleShell}
          className="h-7 text-xs"
        >
          <Terminal className="w-3 h-3 mr-1" />
          Shell
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCloseEditor}
          className="h-7 w-7 p-0"
          title="Close Editor"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div
        className="transition-all flex flex-col overflow-hidden min-h-0 h-full"
        style={showShell ? { flex: `0 0 ${editorHeight}%` } : { flex: 1 }}
      >
        {selectedFile && (
          <div className="flex-1 min-h-0 flex flex-col">
            <CodeEditor
              file={selectedFile}
              projectPath={selectedProject?.fullPath || selectedProject?.path}
              isSidebar={true}
            />
          </div>
        )}
        {selectedImage && (
          <InlineImageViewer
            projectName={selectedProject?.name}
            file={selectedImage}
          />
        )}
        {!selectedFile && !selectedImage && (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-background">
            <div className="text-center">
              <FileCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-2">
                Select a file from the file tree to view or edit
              </p>
              <p className="text-sm text-muted-foreground/70">
                Files will open in the editor area
              </p>
            </div>
          </div>
        )}
      </div>

      {showShell && (
        <div
          className={cn(
            "h-1.5 bg-border hover:bg-primary/50 cursor-row-resize transition-colors flex-shrink-0",
            isDragging && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
          style={{ minHeight: '6px' }}
        />
      )}

      {showShell && (
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          <Shell selectedProject={selectedProject} selectedSession={selectedSession} />
        </div>
      )}
    </div>
  );
}

export default VSCodeEditorArea;
