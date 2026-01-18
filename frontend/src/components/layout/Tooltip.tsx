import React, { ReactNode, useState } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg z-50 whitespace-nowrap">
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip; 