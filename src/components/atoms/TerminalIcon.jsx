import React from 'react';
import * as LucideIcons from 'lucide-react';

const TerminalIcon = ({ name, size = 16, color = 'text-[color:var(--text-primary)]', className = '' }) => {
  const Icon = LucideIcons[name];
  if (!Icon) return null;
  return <Icon size={size} className={`${color} ${className}`} />;
};

export default TerminalIcon;
