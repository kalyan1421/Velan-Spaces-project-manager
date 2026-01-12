import React from 'react';
import { LogOut } from 'lucide-react';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl shadow-card border border-neutral-100 p-6 ${className}`}>
    {children}
  </div>
);

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent' | 'outline';
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', className = "", type = "button", disabled = false
}) => {
  const baseStyle = "px-6 py-3 rounded-xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide";
  const variants = {
    primary: "bg-primary text-white hover:bg-neutral-800 shadow-lg hover:shadow-xl",
    secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
    accent: "bg-accent text-primary hover:bg-accent-hover shadow-velan",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost: "bg-transparent text-neutral-500 hover:text-primary hover:bg-neutral-50",
    outline: "border-2 border-primary text-primary hover:bg-primary hover:text-white"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Input = ({ label, ...props }: any) => (
  <div className="mb-5">
    {label && <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">{label}</label>}
    <input 
      className="w-full px-5 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-all text-neutral-900 placeholder-neutral-400"
      {...props}
    />
  </div>
);

export const VelanLogo = ({ className = "h-12", showText = true, size = "normal" }: { className?: string, showText?: boolean, size?: "small" | "normal" | "large" }) => {
    const dimensions = size === "small" ? "w-10 h-10" : size === "large" ? "w-20 h-20" : "w-14 h-14";
    
    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* Velan Spaces Logo - House with interior */}
            <div className={`relative ${dimensions} flex-shrink-0`}>
                <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                    {/* Sun */}
                    <circle cx="82" cy="12" r="10" fill="#F9E768"/>
                    
                    {/* House Roof */}
                    <path d="M10 50 L50 15 L90 50" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    
                    {/* Ceiling Lamp */}
                    <line x1="50" y1="15" x2="50" y2="32" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <path d="M42 32 L50 32 L58 32 L55 42 L45 42 Z" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
                    
                    {/* Lamp Light Glow */}
                    <path d="M45 42 L35 65 L65 65 L55 42" fill="url(#lampGlow)" opacity="0.4"/>
                    
                    {/* Floor Lamp */}
                    <line x1="18" y1="55" x2="18" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <path d="M12 48 L18 55 L24 48 L12 48" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
                    <line x1="14" y1="85" x2="22" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    
                    {/* Couch */}
                    <rect x="30" y="60" width="40" height="20" rx="3" stroke="#1a1a1a" strokeWidth="2" fill="none"/>
                    <rect x="32" y="55" width="8" height="8" rx="1" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
                    <rect x="60" y="55" width="8" height="8" rx="1" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
                    {/* Couch cushions */}
                    <rect x="38" y="66" width="6" height="6" rx="1" stroke="#1a1a1a" strokeWidth="1" fill="none"/>
                    <rect x="47" y="66" width="6" height="6" rx="1" stroke="#1a1a1a" strokeWidth="1" fill="none"/>
                    <rect x="56" y="66" width="6" height="6" rx="1" stroke="#1a1a1a" strokeWidth="1" fill="none"/>
                    {/* Couch legs */}
                    <line x1="33" y1="80" x2="33" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <line x1="67" y1="80" x2="67" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    
                    {/* Side Table */}
                    <ellipse cx="80" cy="72" rx="8" ry="3" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
                    <line x1="76" y1="72" x2="76" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <line x1="84" y1="72" x2="84" y2="85" stroke="#1a1a1a" strokeWidth="1.5"/>
                    <line x1="74" y1="82" x2="86" y2="82" stroke="#1a1a1a" strokeWidth="1"/>
                    
                    {/* Gradient for lamp glow */}
                    <defs>
                        <linearGradient id="lampGlow" x1="50" y1="42" x2="50" y2="65" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#F9E768" stopOpacity="0.8"/>
                            <stop offset="100%" stopColor="#F9E768" stopOpacity="0"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            {showText && (
                <div className="flex flex-col">
                    <span className="font-serif font-bold text-2xl tracking-tight text-primary">VELAN SPACES</span>
                    <span className="text-[0.55rem] text-neutral-400 tracking-[0.25em] uppercase font-medium">Elevating Spaces Into Masterpieces</span>
                </div>
            )}
        </div>
    );
};

interface HeaderProps {
  title: string;
  subtitle?: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onLogout }) => (
  <header className="bg-white/80 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <VelanLogo />
        <div className="hidden md:block w-px h-10 bg-neutral-100"></div>
        <div className="hidden md:block">
            <h1 className="text-xl font-serif font-bold text-primary">{title}</h1>
            {subtitle && <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide">{subtitle}</p>}
        </div>
      </div>
      <Button variant="ghost" onClick={onLogout} className="flex items-center gap-2 !px-3">
        <LogOut size={18} />
        <span className="hidden sm:inline">Sign Out</span>
      </Button>
    </div>
  </header>
);

interface BadgeProps {
  children?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'neutral' | 'black';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'neutral', className = "" }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-100',
    neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    black: 'bg-primary text-white border-primary'
  };
  return <span className={`px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider border ${colors[color]} ${className}`}>{children}</span>;
};