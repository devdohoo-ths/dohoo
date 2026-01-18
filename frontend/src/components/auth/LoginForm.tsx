
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, ArrowRight, HelpCircle } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, refreshProfile } = useAuth();

  // ✅ CORREÇÃO: Carregar email E senha salvos ao iniciar
  useEffect(() => {
    const savedEmail = localStorage.getItem('dohoo_saved_email');
    const savedPassword = localStorage.getItem('dohoo_saved_password');
    const savedRememberMe = localStorage.getItem('dohoo_remember_me') === 'true';
    
    if (savedEmail) {
      setEmail(savedEmail);
    }
    if (savedPassword) {
      setPassword(savedPassword);
    }
    if (savedRememberMe) {
      setRememberMe(true);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 [Login] Tentando fazer login com:', email);
      
      // Usar o hook useAuth que agora faz login via backend
      const result = await signIn(email, password);

      if (result.success && result.user) {
        console.log('✅ [Login] Login realizado com sucesso:', result.user.email);
        
        // ✅ Salvar email E senha se "remember me" estiver marcado
        if (rememberMe) {
          localStorage.setItem('dohoo_saved_email', email);
          localStorage.setItem('dohoo_saved_password', password);
          localStorage.setItem('dohoo_remember_me', 'true');
          console.log('💾 [Login] Dados salvos para próximo login');
        } else {
          // ✅ Limpar todos os dados se não estiver marcado
          localStorage.removeItem('dohoo_saved_email');
          localStorage.removeItem('dohoo_saved_password');
          localStorage.removeItem('dohoo_remember_me');
          console.log('🗑️ [Login] Dados removidos do armazenamento');
        }
        
        // Refresh do perfil já é feito no signIn do hook, mas podemos garantir
        await refreshProfile();
        
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo, ${result.user.email || email}`,
        });

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        // Erro já foi mostrado pelo toast no hook useAuth
        console.error('❌ [Login] Login falhou:', result.error);
      }
    } catch (error: any) {
      console.error('❌ [Login] Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('📧 [Reset] Enviando email de recuperação para:', email);
      
      // TODO: Implementar endpoint de reset de senha no backend
      // Por enquanto, mostrar mensagem informativa
      toast({
        title: "Reset de senha",
        description: "Funcionalidade de reset de senha será implementada em breve. Entre em contato com o administrador.",
        variant: "default",
      });
      setLoading(false);
      return;
    } catch (error: any) {
      console.error('❌ [Reset] Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao enviar o email. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForgotPasswordMode(false);
    setResetEmailSent(false);
  };

  // ✅ CORREÇÃO: Função para limpar todos os dados salvos
  const clearSavedData = () => {
    localStorage.removeItem('dohoo_saved_email');
    localStorage.removeItem('dohoo_saved_password');
    localStorage.removeItem('dohoo_remember_me');
    setEmail('');
    setPassword('');
    setRememberMe(false);
    toast({
      title: "Dados limpos",
      description: "Dados salvos foram removidos com sucesso.",
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md mx-4 shadow-xl border-0">
        <CardHeader className="text-center pb-6">
          {/* Logo completo */}
          <div className="mb-6 flex justify-center">
            <img 
              src="/logo_completo.png" 
              alt="Dohoo Logo" 
              className="h-11 w-auto object-contain"
            />
          </div>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          {!forgotPasswordMode ? (
            // ✅ MODE 1: Login Normal
            <form onSubmit={handleSignIn} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-gray-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10 h-12 text-base"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-gray-700">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
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
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={loading}
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600">
                    remember me
                  </Label>
                </div>
                
                <button
                  type="button"
                  onClick={() => setForgotPasswordMode(true)}
                  className="text-sm text-[#9333EA] hover:text-[#8C55E0] flex items-center gap-1"
                  disabled={loading}
                >
                  <HelpCircle className="h-4 w-4" />
                  Esqueceu a senha?
                </button>
              </div>

              {/* ✅ CORREÇÃO: Botão para limpar todos os dados salvos */}
              {(localStorage.getItem('dohoo_saved_email') || localStorage.getItem('dohoo_saved_password')) && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={clearSavedData}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                    disabled={loading}
                  >
                    Limpar dados salvos
                  </button>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base"
                style={{ backgroundColor: '#9333EA' }}
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Entrando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Sistema restrito - Apenas usuários autorizados
                </p>
              </div>
            </form>
          ) : (
            // ✅ MODE 2: Recuperar Senha
            <div className="space-y-6">
              {!resetEmailSent ? (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="text-center">
                    <HelpCircle className="mx-auto h-12 w-12 text-[#9333EA] mb-4" />
                    <h3 className="text-lg text-gray-900 mb-2">
                      Recuperar Senha
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Digite seu email e enviaremos um link para redefinir sua senha.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm text-gray-700">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      className="flex-1 h-12"
                      disabled={loading}
                    >
                      Voltar
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
                          Enviando...
                        </div>
                      ) : (
                        'Enviar Email'
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                // ✅ MODE 3: Email Enviado
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg text-gray-900 mb-2">
                      Email Enviado!
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                    </p>
                  </div>

                  <Button
                    onClick={resetForm}
                    className="w-full h-12"
                    style={{ backgroundColor: '#9333EA' }}
                  >
                    Voltar ao Login
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
