import React from 'react';
import VSCodeFileTree from './VSCodeFileTree';
import GitPanel from '../GitPanel';
import { cn } from '../../lib/utils';

function VSCodeSidePanel({
  activeView,
  selectedProject,
  isMobile,
  isCollapsed = false,
  onToggleCollapse,
  onFileSelect,
  onGitFileOpen
}) {
  if (!selectedProject) {
    return (
      <div className={cn(
        "hidden md:flex flex-col bg-card border-r border-border transition-all duration-300",
        isCollapsed ? "w-0" : "w-64"
      )}>
        {!isCollapsed && (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-muted-foreground">No project selected</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "hidden md:flex flex-col bg-card border-r border-border transition-all duration-300",
      isCollapsed ? "w-0" : "w-64"
    )}>
      {!isCollapsed && (
        <>
          <div className="h-12 px-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {activeView === 'files' ? 'Files' : 'Source Control'}
            </h2>
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-accent rounded transition-colors"
              title="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeView === 'files' && (
              <VSCodeFileTree
                selectedProject={selectedProject}
                onFileSelect={onFileSelect}
              />
            )}
            {activeView === 'git' && (
              <GitPanel
                selectedProject={selectedProject}
                isMobile={isMobile}
                onFileOpen={onGitFileOpen}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default VSCodeSidePanel;
