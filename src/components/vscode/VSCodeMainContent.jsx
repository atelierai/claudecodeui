import React, { useState, useEffect } from 'react';
import ChatInterface from '../ChatInterface';
import VSCodeActivityBar from './VSCodeActivityBar';
import VSCodeSidePanel from './VSCodeSidePanel';
import VSCodeEditorArea from './VSCodeEditorArea';
import ErrorBoundary from '../ErrorBoundary';
import { useTaskMaster } from '../../contexts/TaskMasterContext';
import { useTasksSettings } from '../../contexts/TasksSettingsContext';

function VSCodeMainContent({
  selectedProject,
  selectedSession,
  activeTab,
  setActiveTab,
  ws,
  sendMessage,
  messages,
  isMobile,
  isPWA,
  onMenuClick,
  isLoading,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onReplaceTemporarySession,
  onNavigateToSession,
  onShowSettings,
  autoExpandTools,
  showRawParameters,
  showThinking,
  autoScrollToBottom,
  sendByCtrlEnter,
  externalMessageUpdate
}) {
  const [activeView, setActiveView] = useState('files'); // 'files' | 'git'
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [showShell, setShowShell] = useState(false);
  const [editorVisible, setEditorVisible] = useState(true);
  const [editorWidth, setEditorWidth] = useState(50); // %
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const { setCurrentProject } = useTaskMaster();
  const { tasksEnabled } = useTasksSettings();

  useEffect(() => {
    if (selectedProject) {
      setCurrentProject(selectedProject);
    }
  }, [selectedProject, setCurrentProject]);

  const handleViewChange = (view) => {
    if (activeView === view && !sidePanelCollapsed) {
      setSidePanelCollapsed(true);
    } else {
      setActiveView(view);
      setSidePanelCollapsed(false);
    }
  };

  const handleToggleSidePanel = () => setSidePanelCollapsed(!sidePanelCollapsed);
  const handleToggleShell = () => setShowShell(!showShell);
  const handleCloseEditor = () => {
    setEditorVisible(false);
    setSelectedFile(null);
    setSelectedImage(null);
  };

  const handleFileSelect = (file) => {
    const imageExtensions = ['.png','.jpg','.jpeg','.gif','.svg','.webp','.bmp','.ico'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (isImage) {
      setSelectedImage(file);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
      setSelectedImage(null);
    }
    if (!editorVisible) setEditorVisible(true);
  };

  const handleGitFileOpen = (filePath, diffInfo = null) => {
    if (!selectedProject) return;
    const file = {
      name: filePath.split('/').pop(),
      path: filePath,
      projectName: selectedProject.name,
      diffInfo
    };
    setSelectedFile(file);
    setSelectedImage(null);
    if (!editorVisible) setEditorVisible(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDivider) return;
      const container = document.getElementById('vscode-main-area');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percentage = (offsetX / rect.width) * 100;
      if (percentage >= 30 && percentage <= 70) setEditorWidth(percentage);
    };
    const handleMouseUp = () => setIsDraggingDivider(false);
    if (isDraggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 pwa-header-safe flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 pwa-menu-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="w-12 h-12 mx-auto mb-4">
              <div className="w-full h-full rounded-full border-4 border-gray-200 border-t-blue-500" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Loading Claude Code UI</h2>
            <p>Setting up your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {isMobile && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 pwa-header-safe flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 pwa-menu-button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400 max-w-md mx-auto px-6">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">Choose Your Project</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Select a project from the sidebar to start coding with Claude. Each project contains your chat sessions and file history.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> {isMobile ? 'Tap the menu button above to access projects' : 'Create a new project by clicking the folder icon in the sidebar'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 pwa-header-safe flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onMenuClick}
              className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {selectedProject.displayName}
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary showDetails={true}>
            <ChatInterface
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              ws={ws}
              sendMessage={sendMessage}
              messages={messages}
              onFileOpen={handleGitFileOpen}
              onInputFocusChange={onInputFocusChange}
              onSessionActive={onSessionActive}
              onSessionInactive={onSessionInactive}
              onReplaceTemporarySession={onReplaceTemporarySession}
              onNavigateToSession={onNavigateToSession}
              onShowSettings={onShowSettings}
              autoExpandTools={autoExpandTools}
              showRawParameters={showRawParameters}
              showThinking={showThinking}
              autoScrollToBottom={autoScrollToBottom}
              sendByCtrlEnter={sendByCtrlEnter}
              externalMessageUpdate={externalMessageUpdate}
            />
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex bg-background">
      <VSCodeActivityBar
        activeView={sidePanelCollapsed ? null : activeView}
        onViewChange={handleViewChange}
      />

      <VSCodeSidePanel
        activeView={activeView}
        selectedProject={selectedProject}
        isMobile={isMobile}
        isCollapsed={sidePanelCollapsed}
        onToggleCollapse={handleToggleSidePanel}
        onFileSelect={handleFileSelect}
        onGitFileOpen={handleGitFileOpen}
      />

      <div id="vscode-main-area" className="flex-1 flex overflow-hidden min-h-0 h-full">
        {editorVisible && (
          <>
            <div style={{ width: `${editorWidth}%` }} className="flex-shrink-0 overflow-hidden min-h-0 flex flex-col">
              <VSCodeEditorArea
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                selectedFile={selectedFile}
                selectedImage={selectedImage}
                showShell={showShell}
                onToggleShell={handleToggleShell}
                onCloseEditor={handleCloseEditor}
                isMobile={isMobile}
              />
            </div>
            <div
              className={`w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors ${isDraggingDivider ? 'bg-primary' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingDivider(true);
              }}
            />
          </>
        )}

        <div className="flex-1 border-l border-border overflow-hidden min-h-0">
          <ErrorBoundary showDetails={true}>
            <ChatInterface
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              ws={ws}
              sendMessage={sendMessage}
              messages={messages}
              onFileOpen={handleGitFileOpen}
              onInputFocusChange={onInputFocusChange}
              onSessionActive={onSessionActive}
              onSessionInactive={onSessionInactive}
              onReplaceTemporarySession={onReplaceTemporarySession}
              onNavigateToSession={onNavigateToSession}
              onShowSettings={onShowSettings}
              autoExpandTools={autoExpandTools}
              showRawParameters={showRawParameters}
              showThinking={showThinking}
              autoScrollToBottom={autoScrollToBottom}
              sendByCtrlEnter={sendByCtrlEnter}
              externalMessageUpdate={externalMessageUpdate}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default React.memo(VSCodeMainContent);
