import React from 'react';
import { FileText, GitBranch } from 'lucide-react';
import { cn } from '../../lib/utils';

function IDEStyleActivityBar({ activeView, onViewChange }) {
  const menuItems = [
    { id: 'files', icon: FileText, label: 'Files' },
    { id: 'git', icon: GitBranch, label: 'Source Control' }
  ];

  return (
    <div className="hidden md:flex flex-col w-12 bg-card border-r border-border">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "h-12 w-12 flex items-center justify-center transition-colors relative",
              isActive
                ? "text-primary bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            title={item.label}
          >
            <Icon className="w-5 h-5" />
            {isActive && (
              <div className="absolute left-0 w-0.5 h-8 bg-primary rounded-r" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default IDEStyleActivityBar;

