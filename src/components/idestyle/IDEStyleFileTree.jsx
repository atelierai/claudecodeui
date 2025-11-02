import React, { useState, useEffect } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Folder, FolderOpen, File, FileText, FileCode, List, TableProperties, Eye, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../utils/api';

function IDEStyleFileTree({ selectedProject, onFileSelect }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [viewMode, setViewMode] = useState('simple'); // 'simple', 'detailed', 'compact'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);

  useEffect(() => {
    if (selectedProject) fetchFiles();
  }, [selectedProject]);

  useEffect(() => {
    const saved = localStorage.getItem('file-tree-view-mode');
    if (saved && ['simple', 'detailed', 'compact'].includes(saved)) setViewMode(saved);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFiles(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);
      const expandMatches = (items) => {
        items.forEach(item => {
          if (item.type === 'directory' && item.children?.length) {
            setExpandedDirs(prev => new Set(prev.add(item.path)));
            expandMatches(item.children);
          }
        });
      };
      expandMatches(filtered);
    }
  }, [files, searchQuery]);

  const filterFiles = (items, query) =>
    items.reduce((acc, item) => {
      const matches = item.name.toLowerCase().includes(query);
      const children = item.type === 'directory' && item.children ? filterFiles(item.children, query) : [];
      if (matches || children.length) acc.push({ ...item, children });
      return acc;
    }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await api.getFiles(selectedProject.name);
      if (!res.ok) return setFiles([]);
      const data = await res.json();
      setFiles(data);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path) => {
    const next = new Set(expandedDirs);
    next.has(path) ? next.delete(path) : next.add(path);
    setExpandedDirs(next);
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (date) => {
    if (!date) return '-';
    const now = new Date(), past = new Date(date);
    const sec = Math.floor((now - past) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec/60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec/3600)} hours ago`;
    if (sec < 2592000) return `${Math.floor(sec/86400)} days ago`;
    return past.toLocaleDateString();
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const code = ['js','jsx','ts','tsx','py','java','cpp','c','php','rb','go','rs'];
    const doc = ['md','txt','doc','pdf'];
    const img = ['png','jpg','jpeg','gif','svg','webp','ico','bmp'];
    if (code.includes(ext)) return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    if (doc.includes(ext)) return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    if (img.includes(ext)) return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
  };

  const rowSimple = (item, level) => (
    <div
      className={cn("w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent")}
      style={{ paddingLeft: `${level * 16 + 12}px` }}
    >
      <div className="flex items-center gap-2 min-w-0 w-full">
        {item.type === 'directory'
          ? expandedDirs.has(item.path)
            ? <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
            : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : getFileIcon(item.name)}
        <span className="text-sm truncate text-foreground">{item.name}</span>
      </div>
    </div>
  );

  const renderFileTree = (items, level = 0) =>
    items.map((item) => (
      <div key={item.path} className="select-none">
        <button
          className="w-full text-left"
          onClick={() => {
            if (item.type === 'directory') toggleDirectory(item.path);
            else onFileSelect?.({
              name: item.name,
              path: item.path,
              projectPath: selectedProject.path,
              projectName: selectedProject.name
            });
          }}
        >
          {rowSimple(item, level)}
        </button>
        {item.type === 'directory' && expandedDirs.has(item.path) && item.children?.length > 0 && (
          <div>{renderFileTree(item.children, level + 1)}</div>
        )}
      </div>
    ));

  const renderDetailedView = (items, level = 0) =>
    items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn("grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center")}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (item.type === 'directory') toggleDirectory(item.path);
            else onFileSelect?.({
              name: item.name,
              path: item.path,
              projectPath: selectedProject.path,
              projectName: selectedProject.name
            });
          }}
        >
          <div className="col-span-5 flex items-center gap-2 min-w-0">
            {item.type === 'directory'
              ? expandedDirs.has(item.path)
                ? <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              : getFileIcon(item.name)}
            <span className="text-sm truncate text-foreground">{item.name}</span>
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            {item.type === 'file' ? formatFileSize(item.size) : '-'}
          </div>
          <div className="col-span-3 text-sm text-muted-foreground">{formatRelativeTime(item.modified)}</div>
          <div className="col-span-2 text-sm text-muted-foreground font-mono">{item.permissionsRwx || '-'}</div>
        </div>
        {item.type === 'directory' && expandedDirs.has(item.path) && item.children && renderDetailedView(item.children, level + 1)}
      </div>
    ));

  const renderCompactView = (items, level = 0) =>
    items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn("flex items-center justify-between p-2 hover:bg-accent cursor-pointer")}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (item.type === 'directory') toggleDirectory(item.path);
            else onFileSelect?.({
              name: item.name,
              path: item.path,
              projectPath: selectedProject.path,
              projectName: selectedProject.name
            });
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.type === 'directory'
              ? expandedDirs.has(item.path)
                ? <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              : getFileIcon(item.name)}
            <span className="text-sm truncate text-foreground">{item.name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <>
                <span>{formatFileSize(item.size)}</span>
                <span className="font-mono">{item.permissionsRwx}</span>
              </>
            )}
          </div>
        </div>
        {item.type === 'directory' && expandedDirs.has(item.path) && item.children && renderCompactView(item.children, level + 1)}
      </div>
    ));

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Files</h3>
          <div className="flex gap-1">
            <Button variant={viewMode === 'simple' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => changeViewMode('simple')} title="Simple view">
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'compact' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => changeViewMode('compact')} title="Compact view">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'detailed' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => changeViewMode('detailed')} title="Detailed view">
              <TableProperties className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="text" placeholder="Search files and folders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-8 h-8 text-sm" />
          {searchQuery && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent" onClick={() => setSearchQuery('')} title="Clear search">
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      {viewMode === 'detailed' && filteredFiles.length > 0 && (
        <div className="px-4 pt-2 pb-1 border-b border-border">
          <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-3">Modified</div>
            <div className="col-span-2">Permissions</div>
          </div>
        </div>
      )}
      <ScrollArea className="flex-1 p-4">
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No files found</h4>
            <p className="text-sm text-muted-foreground">Check if the project path is accessible</p>
          </div>
        ) : filteredFiles.length === 0 && searchQuery ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No matches found</h4>
            <p className="text-sm text-muted-foreground">Try a different search term or clear the search</p>
          </div>
        ) : (
          <div className={viewMode === 'detailed' ? '' : 'space-y-1'}>
            {viewMode === 'simple' && renderFileTree(filteredFiles)}
            {viewMode === 'compact' && renderCompactView(filteredFiles)}
            {viewMode === 'detailed' && renderDetailedView(filteredFiles)}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default IDEStyleFileTree;

