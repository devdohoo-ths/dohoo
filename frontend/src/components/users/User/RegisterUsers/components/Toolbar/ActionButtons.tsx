import React from 'react';
import { Button } from '@/components/ui/button';
import { UserIcon, Download, Upload } from 'lucide-react';

interface ActionButtonsProps {
  onOpenUserForm: () => void;
  onCsvDownload: () => void;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  csvUploading: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onOpenUserForm,
  onCsvDownload,
  onCsvUpload,
  csvUploading
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:justify-end">
      {/* Download CSV Template */}
      <Button 
        onClick={onCsvDownload} 
        variant="outline" 
        size="sm"
        className="flex items-center justify-center gap-2 w-full sm:w-auto"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Baixar modelo CSV</span>
        <span className="sm:hidden">Modelo CSV</span>
      </Button>
      
      {/* Upload CSV */}
      <label className="flex items-center justify-center gap-2 cursor-pointer border rounded px-3 py-2 bg-gray-50 hover:bg-gray-100 transition text-sm w-full sm:w-auto">
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">
          {csvUploading ? 'Processando...' : 'Importar CSV'}
        </span>
        <span className="sm:hidden">
          {csvUploading ? 'Processando...' : 'Importar'}
        </span>
        <input 
          type="file" 
          accept=".csv" 
          onChange={onCsvUpload} 
          className="hidden" 
          disabled={csvUploading}
        />
      </label>
      
      {/* Add User */}
      <Button 
        onClick={onOpenUserForm} 
        size="sm"
        className="flex items-center justify-center gap-2 w-full sm:w-auto"
      >
        <UserIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Cadastrar Usuário</span>
        <span className="sm:hidden">Cadastrar</span>
      </Button>
    </div>
  );
};

export default ActionButtons;