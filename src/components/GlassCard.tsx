'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'cyan' | 'blue' | 'purple' | null;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = '',
  hover = false,
  glow = null,
  onClick,
}: GlassCardProps) {
  const glowClass = glow ? `glow-${glow}` : '';
  const hoverClass = hover ? 'glass-hover cursor-pointer' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={hover ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={`glass ${hoverClass} ${glowClass} p-4 ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
