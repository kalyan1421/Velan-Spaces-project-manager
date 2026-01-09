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

export const VelanLogo = ({ className = "h-12" }: { className?: string }) => (
    <div className={`flex items-center gap-4 ${className}`}>
        {/* Geometric Line Art Logo: House roof + Sun */}
        <div className="relative w-12 h-12 flex-shrink-0">
             <div className="absolute inset-0 border-2 border-primary rounded-lg transform rotate-3"></div>
             <div className="absolute inset-0 bg-white border-2 border-primary rounded-lg flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary w-8 h-8 relative z-10">
                      <path d="M3 12L12 4L21 12" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 12V20H19V12" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 15H15" strokeLinecap="round"/>
                  </svg>
                  {/* Sun Accent */}
                  <div className="absolute top-2 right-2 w-3 h-3 bg-accent rounded-full shadow-[0_0_8px_rgba(249,231,104,0.8)]"></div>
             </div>
        </div>
        <div className="flex flex-col">
            <span className="font-serif font-bold text-2xl tracking-tight text-primary">VELAN SPACES</span>
            <span className="text-[0.6rem] text-neutral-400 tracking-[0.2em] uppercase font-medium">Elevating Spaces Into Masterpieces</span>
        </div>
    </div>
);

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