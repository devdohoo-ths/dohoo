export function generatePassword(): string {
    return 'Dohoo@' + Math.floor(1000 + Math.random() * 9000);
  }
  
  export function getRoleStyle(role: string): string {
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('super') || lowerRole.includes('super_admin')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    } else if (lowerRole.includes('admin')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (lowerRole.includes('agent') || lowerRole.includes('agente')) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }
  
  export function getImageUrl(imagePath: string | null): string | null {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/')) {
      return `${import.meta.env.VITE_API_BASE || 'http://localhost:3001'}${imagePath}`;
    }
    
    return `${import.meta.env.VITE_API_BASE || 'http://localhost:3001'}/${imagePath}`;
  }