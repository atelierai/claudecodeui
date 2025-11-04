import React from 'react';

const CursorLogo = ({ className = 'w-5 h-5' }) => {
  return (
    <img src={window.location.protocol === 'file:' ? './icons/cursor.svg' : '/icons/cursor.svg'} alt="Cursor" className={className} />
  );
};

export default CursorLogo;
