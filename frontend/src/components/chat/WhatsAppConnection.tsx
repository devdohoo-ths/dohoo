
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Wifi, WifiOff, QrCode } from 'lucide-react';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';

export const WhatsAppConnection: React.FC = () => {
  const { whatsappStatus, loading, checkWhatsAppStatus, connectSocket } = useWhatsAppConnection();

  const getStatusColor = () => {
    switch (whatsappStatus.status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (whatsappStatus.status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      default: return 'Desconectado';
    }
  };

  const getStatusIcon = () => {
    switch (whatsappStatus.status) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <QrCode className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5" />
          <CardTitle className="text-lg">WhatsApp</CardTitle>
        </div>
        <Badge variant="secondary" className={`ml-auto ${getStatusColor()} text-white`}>
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <CardDescription>
          Status da conexão com WhatsApp para receber e enviar mensagens
        </CardDescription>

        {whatsappStatus.qrCode && (
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Escaneie o QR Code com seu WhatsApp
            </p>
            <div className="bg-white p-4 rounded-lg">
              <img 
                src={whatsappStatus.qrCode} 
                alt="QR Code WhatsApp" 
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {whatsappStatus.phoneNumber && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Número conectado:</p>
            <p className="">{whatsappStatus.phoneNumber}</p>
          </div>
        )}

        <div className="flex space-x-2">
          <Button 
            onClick={checkWhatsAppStatus}
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            Verificar Status
          </Button>
          
          {whatsappStatus.status === 'disconnected' && (
            <Button 
              onClick={connectSocket}
              disabled={loading}
              className="flex-1"
            >
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
