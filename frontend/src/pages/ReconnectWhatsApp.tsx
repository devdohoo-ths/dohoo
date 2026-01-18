import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/utils/apiBase';
import { normalizeQrCode, pickQrValue } from '@/utils/qrCode';
import io, { Socket } from 'socket.io-client';
import { QrCode, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface TokenResponse {
  success: boolean;
  token: string;
  account: {
    id: string;
    name: string;
    organization_id: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  expires_at: string;
}

const ReconnectWhatsApp: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrTimer, setQrTimer] = useState<number>(0);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchToken = async () => {
      try {
        const response = await fetch(`${apiBase}/api/whatsapp-reconnect/${token}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Token inválido ou expirado');
        }

        setValidToken(result);
      } catch (err: any) {
        console.error('Erro ao validar token de reconexão:', err);
        setError(err.message || 'Token inválido ou expirado');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [token]);

  useEffect(() => {
    if (!validToken) return;

    let isMounted = true;
    const newSocket = io(apiBase);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ [Reconnect] Socket conectado');
      newSocket.emit('join-organization', validToken.account.organization_id);
    });

    newSocket.on('whatsapp-qr-code', async (data: { accountId: string; qr?: string; qrCode?: string; code?: string }) => {
      if (!isMounted || data.accountId !== validToken.account.id) {
        return;
      }

      const rawQrValue = pickQrValue(data);
      const normalized = await normalizeQrCode(rawQrValue);

      if (!normalized) {
        console.warn('⚠️ [Reconnect] QR Code recebido sem payload válido:', {
          accountId: data.accountId,
          rawLength: rawQrValue.length,
        });
        return;
      }

      setQrCode(normalized);
      setQrTimer(120);
      setConnecting(true);
    });

    newSocket.on('whatsapp-connected', (data: { accountId: string }) => {
      if (data.accountId === validToken.account.id) {
        setConnected(true);
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        toast({
          title: 'WhatsApp reconectado',
          description: 'Sua conta foi reconectada com sucesso. Você pode fechar esta página.'
        });
      }
    });

    newSocket.on('whatsapp-qr-expired', (data: { accountId: string }) => {
      if (data.accountId === validToken.account.id) {
        setConnecting(false);
        setQrCode('');
        setQrTimer(0);
        toast({
          title: 'QR Code expirado',
          description: 'O QR Code expirou. Clique em gerar novamente.',
          variant: 'destructive'
        });
      }
    });

    return () => {
      isMounted = false;
      newSocket.disconnect();
    };
  }, [validToken, toast]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrTimer]);

  const startReconnect = async () => {
    if (!token || !validToken) return;

    setConnecting(true);
    setQrCode('');
    setQrTimer(0);

    try {
      const response = await fetch(`${apiBase}/api/whatsapp-reconnect/${token}/regenerate`, {
        method: 'POST'
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao iniciar reconexão');
      }

      toast({
        title: 'QR Code solicitado',
        description: 'Abra o WhatsApp no celular e aguarde a chegada do novo QR Code nesta tela.'
      });
    } catch (err: any) {
      console.error('Erro ao iniciar reconexão:', err);
      setConnecting(false);
      setQrCode('');
      setQrTimer(0);
      toast({
        title: 'Erro ao gerar QR Code',
        description: err.message || 'Não foi possível gerar o QR Code. Solicite novamente.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-lg">Validando link...</p>
            <p className="text-sm text-muted-foreground mt-2">Aguarde um instante</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Link inválido ou expirado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <Alert variant="destructive">
              <AlertDescription>{error || 'Solicite um novo link de reconexão.'}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => navigate('/')}>
              Voltar para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <CardTitle>Conexão realizada com sucesso</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              O WhatsApp <strong>{validToken.account.name}</strong> já está conectado novamente.
            </p>
            <Button onClick={() => navigate('/')}>Voltar ao Dohoo</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Reconectar WhatsApp</CardTitle>
          <p className="text-muted-foreground">
            Olá <strong>{validToken.user.name}</strong>, vamos gerar um novo QR Code para a conta{' '}
            <strong>{validToken.account.name}</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {qrCode ? (
            <div className="space-y-4 text-center">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 mx-auto rounded-xl shadow-lg" />
              <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                <Clock size={20} />
                <span className="font-mono text-lg">
                  {Math.floor(qrTimer / 60)}:{(qrTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Abra o WhatsApp no seu celular e escaneie este QR Code imediatamente.
              </p>
              <Button variant="outline" onClick={startReconnect} disabled={connecting}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar QR novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Clique no botão abaixo para gerar um novo QR Code. Ele será exibido aqui nesta página.
              </p>
              <Button className="w-full" onClick={startReconnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Aguardando novo QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Gerar novo QR Code
                  </>
                )}
              </Button>
              <Alert>
                <AlertDescription className="text-sm text-muted-foreground">
                  Este link expira em {new Date(validToken.expires_at).toLocaleString('pt-BR')}. Caso expire, solicite uma nova
                  reconexão através da plataforma.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconnectWhatsApp;

