import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiBase } from '@/utils/apiBase';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    console.log('🔍 [Reset] Iniciando processo de recuperação de senha...');
    
    const verifyToken = async () => {
      try {
        setLoading(true);
        
        // Extrair token da URL (pode estar no hash ou query string)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const resetToken = urlParams.get('token') || hashParams.get('access_token') || hashParams.get('type');
        
        if (!resetToken) {
          // Se não há token na URL, verificar se há sessão (token pode estar no hash do Supabase)
          // Tentar verificar com a sessão atual ou hash do URL
          const hash = window.location.hash;
          
          if (hash && hash.includes('access_token')) {
            // Token está no hash, extrair e usar
            const hashParts = hash.substring(1).split('&');
            const accessTokenPart = hashParts.find(p => p.startsWith('access_token='));
            const tokenValue = accessTokenPart?.split('=')[1];
            
            if (tokenValue) {
              // Verificar token via API do backend
              const response = await fetch(`${apiBase}/api/users/verify-reset-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenValue })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                  setTokenValid(true);
                  setTokenVerified(true);
                  setUserEmail(result.user.email || '');
                  setToken(tokenValue); // Guardar token para uso posterior
                  if (mounted) setLoading(false);
                  return;
                }
              }
            }
          }
          
          // Se não encontrou token, mostrar erro após timeout
          if (mounted) {
            setTimeout(() => {
              if (!mounted || tokenVerified) return;
              console.log('❌ [Reset] Token não encontrado na URL');
              setTokenValid(false);
              setTokenVerified(true);
              setLoading(false);
              toast({
                title: "Link inválido",
                description: "Este link de recuperação é inválido ou expirou. Solicite um novo link.",
                variant: "destructive",
              });
            }, 2000);
          }
          return;
        }

        // Verificar token via API do backend
        const response = await fetch(`${apiBase}/api/users/verify-reset-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.user) {
            console.log('✅ [Reset] Token válido para:', result.user.email);
            setTokenValid(true);
            setTokenVerified(true);
            setUserEmail(result.user.email || '');
            setToken(resetToken);
          } else {
            throw new Error('Token inválido');
          }
        } else {
          throw new Error('Token inválido ou expirado');
        }
      } catch (error: any) {
        console.error('❌ [Reset] Erro ao verificar token:', error);
        if (mounted) {
          setTokenValid(false);
          setTokenVerified(true);
          toast({
            title: "Link inválido",
            description: error.message || "Este link de recuperação é inválido ou expirou. Solicite um novo link.",
            variant: "destructive",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyToken();

    return () => {
      mounted = false;
    };
  }, [tokenVerified]);

  // ✅ REDEFINIR: Senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenValid) {
      toast({
        title: "Sessão inválida",
        description: "Link de recuperação inválido ou expirado.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas digitadas não são iguais.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Senha muito fraca",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('🔐 [Reset] Redefinindo senha via API do backend...');
      
      const response = await fetch(`${apiBase}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Reset] Erro ao redefinir senha:', errorData);
        toast({
          title: "Erro ao redefinir senha",
          description: errorData.error || "Não foi possível redefinir a senha.",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      console.log('✅ [Reset] Senha redefinida com sucesso');
      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso. Você será redirecionado para o login.",
      });
      
      // Redirecionar para o login após 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('❌ [Reset] Erro inesperado:', error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ VOLTAR: Para o login
  const handleBackToLogin = () => {
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md mx-4 shadow-xl border-0">
        <CardHeader className="text-center pb-6">
          {/* Logo DoHoo */}
          <div className="mb-6">
            <h1 className="text-4xl">
              <span className="text-gray-800">doh</span>
              <span className="text-[#9333EA]">o</span>
              <span className="text-gray-800">o</span>
            </h1>
          </div>
          
          <CardTitle className="text-2xl text-gray-900">
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-gray-600">
            Digite sua nova senha para continuar
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          {loading && !tokenVerified ? (
            // ✅ LOADING: Verificando token
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 border-4 border-[#9333EA] border-t-transparent rounded-full animate-spin"></div>
              <div>
                <h3 className="text-lg text-gray-900 mb-2">
                  Verificando link...
                </h3>
                <p className="text-gray-600 text-sm">
                  Aguarde enquanto verificamos seu link de recuperação.
                </p>
              </div>
            </div>
          ) : !tokenValid ? (
            // ✅ ERRO: Token inválido
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-lg text-gray-900 mb-2">
                  Link Inválido
                </h3>
                <p className="text-gray-600 text-sm">
                  Este link de recuperação é inválido ou expirou. Solicite um novo link.
                </p>
              </div>

              <Button
                onClick={handleBackToLogin}
                className="w-full h-12"
                style={{ backgroundColor: '#9333EA' }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>
          ) : (
            // ✅ FORMULÁRIO: Redefinir senha
            <form onSubmit={handleResetPassword} className="space-y-6">
              {userEmail && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Redefinindo senha para: <strong>{userEmail}</strong>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-gray-700">
                  Nova Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua nova senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 pr-10 h-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Mínimo 6 caracteres
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-gray-700">
                  Confirmar Nova Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirme sua nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 pr-10 h-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToLogin}
                  className="flex-1 h-12"
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-12"
                  style={{ backgroundColor: '#9333EA' }}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Redefinindo...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Redefinir Senha
                    </div>
                  )}
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
