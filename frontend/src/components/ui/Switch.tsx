import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({ 
  checked, 
  onCheckedChange, 
  id,
  className = ''
}) => {
  return (
    <label 
      htmlFor={id} 
      className={`relative inline-flex items-center cursor-pointer ${className}`}
    >
      <input
        type="checkbox"
        id={id}
        className="sr-only"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}>
        <div className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}></div>
      </div>
    </label>
  );
};
