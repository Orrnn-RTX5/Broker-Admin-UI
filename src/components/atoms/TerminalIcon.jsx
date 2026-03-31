import React from 'react';
import * as LucideIcons from 'lucide-react';

const TerminalIcon = ({ name, size = 16, color = 'text-[#d1d1d1]', className = '' }) => {
  const Icon = LucideIcons[name];
  if (!Icon) return null;
  return <Icon size={size} className={`${color} ${className}`} />;
};

export default TerminalIcon;
