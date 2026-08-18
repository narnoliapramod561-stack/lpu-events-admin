import React, { useRef, useEffect } from 'react';

interface AutoExpandingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  placeholder?: string;
}

export const AutoExpandingTextarea: React.FC<AutoExpandingTextareaProps> = ({
  value,
  onChange,
  minHeight = 160,
  maxHeight,
  className = '',
  placeholder = '',
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.max(el.scrollHeight, minHeight);
    if (maxHeight && newHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${newHeight}px`;
      el.style.overflowY = 'hidden';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value, minHeight, maxHeight]);

  // Adjust on initial render & window resize
  useEffect(() => {
    adjustHeight();
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e);
        adjustHeight();
      }}
      placeholder={placeholder}
      className={`w-full p-4 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm leading-relaxed outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all font-sans overflow-hidden resize-y ${className}`}
      style={{ minHeight: `${minHeight}px` }}
      {...props}
    />
  );
};
