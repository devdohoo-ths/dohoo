import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserIcon, Camera } from 'lucide-react';
import { getImageUrl } from '../../utils/userHelpers';

interface AvatarUploadProps {
  avatarPreview: string;
  editUser: any | null;
  avatarFile: File | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarPreview,
  editUser,
  avatarFile,
  onAvatarChange
}) => {
  const clearAvatar = () => {
    // Reset preview and file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">Avatar</Label>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="relative mx-auto sm:mx-0">
          {avatarPreview ? (
            <img 
              src={avatarPreview} 
              alt="Preview" 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-200"
            />
          ) : editUser?.avatar_url ? (
            <img 
              src={getImageUrl(editUser.avatar_url) || ''} 
              alt={editUser.name} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
              <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
          )}
          <label className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1.5 sm:p-2 cursor-pointer hover:bg-blue-600 transition">
            <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
            <input 
              type="file" 
              accept="image/*" 
              onChange={onAvatarChange}
              className="hidden"
            />
          </label>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Clique na câmera para selecionar uma imagem
          </p>
          {avatarFile && (
            <Button 
              type="button" 
              size="sm" 
              variant="outline" 
              onClick={clearAvatar}
              className="mt-2 text-xs"
            >
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarUpload;