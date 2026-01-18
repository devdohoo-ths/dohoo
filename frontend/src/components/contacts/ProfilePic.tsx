import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useWhatsAppProfilePic } from '@/hooks/useWhatsAppProfilePic';

interface ProfilePicProps {
  phoneNumber: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProfilePic({ phoneNumber, name, size = 'md', className = '' }: ProfilePicProps) {
  const { profilePic, loading } = useWhatsAppProfilePic(phoneNumber);
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  if (loading) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded-full flex items-center justify-center animate-pulse ${className}`}>
        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
      </div>
    );
  }

  // Se a imagem falhou ao carregar ou não há foto, mostrar ícone padrão
  if (!profilePic || imageError) {
    return (
      <div className={`${sizeClasses[size]} bg-blue-100 rounded-full flex items-center justify-center ${className}`}>
        <User className={`${iconSizes[size]} text-blue-600`} />
      </div>
    );
  }

  // Mostrar foto do perfil
  return (
    <img
      src={profilePic}
      alt={name || 'Foto do perfil'}
      className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 ${className}`}
      onError={() => {
        // Se a imagem falhar ao carregar, mostrar ícone padrão
        setImageError(true);
      }}
    />
  );
}
