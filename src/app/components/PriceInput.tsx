import React from 'react';

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
}

const PriceInput: React.FC<PriceInputProps> = ({
  value,
  onChange,
  id,
  placeholder = "0.00",
  className = "w-28",
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Allow only numbers and one decimal point
    // Clean input using regex before updating state
    val = val.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const dots = val.match(/\./g);
    if (dots && dots.length > 1) {
      return;
    }

    onChange(val);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 select-none pointer-events-none text-sm font-medium">
        $
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-6 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 bg-white"
      />
    </div>
  );
};

export default PriceInput;
