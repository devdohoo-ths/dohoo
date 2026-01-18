import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Users, LogIn, X } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface TeamLoginModalProps {
  onLoginSuccess: (team: Team, sessionToken: string) => void;
  children?: React.ReactNode;
}

export const TeamLoginModal: React.FC<TeamLoginModalProps> = ({ 
  onLoginSuccess, 
  children 
}) => {
  const { profile, session } = useAuth();
  const organizationId = profile?.organization_id;
  const userToken = session?.access_token;
  
  console.log('🔍 [TeamLoginModal] Auth data:', { 
    profile: !!profile, 
    session: !!session, 
    organizationId, 
    userToken: !!userToken 
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [open, setOpen] = useState(false);
  const [loginAllTeams, setLoginAllTeams] = useState(false); // 🎯 NOVO: Flag para login em todos os times

  // Buscar times disponíveis
  const fetchTeams = async () => {
    console.log('🔍 [TeamLoginModal] Fetching teams with:', { organizationId, userToken: !!userToken });
    
    if (!organizationId || !userToken) {
      console.error('❌ [TeamLoginModal] Missing auth data:', { organizationId, userToken: !!userToken });
      setError('Dados de autenticação não disponíveis. Faça login novamente.');
      return;
    }

    try {
      setLoadingTeams(true);
      console.log('🔍 [TeamLoginModal] Making request to:', `/api/teams?organization_id=${organizationId}`);
      console.log('🔍 [TeamLoginModal] Headers:', {
        'Authorization': `Bearer ${userToken?.substring(0, 20)}...`,
        'x-user-id': 'supervisor',
        'x-organization-id': organizationId
      });
      
      const response = await fetch(`/api/teams?organization_id=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        }
      });
      
      console.log('🔍 [TeamLoginModal] Response status:', response.status);
      const data = await response.json();
      console.log('🔍 [TeamLoginModal] Response data:', data);
      
      if (!response.ok) {
        console.error('❌ [TeamLoginModal] Request failed:', response.status, data);
        setError(`Erro ao carregar times: ${data.error || response.statusText}`);
        return;
      }
      
      if (data.success && data.teams) {
        console.log('✅ [TeamLoginModal] Teams loaded:', data.teams.length);
        setTeams(data.teams);
        
        if (data.teams.length === 0) {
          setError('Você não está vinculado a nenhum time. Entre em contato com o administrador para ser adicionado a um time.');
        } else if (data.teams.length === 1) {
          // 🎯 NOVO: Pré-selecionar o time se houver apenas 1
          console.log('✅ [TeamLoginModal] Usuário tem apenas 1 time, pré-selecionando...');
          setSelectedTeamId(data.teams[0].id);
          // Não fazer login automático - deixar usuário confirmar
        } else {
          console.log('✅ [TeamLoginModal] Usuário tem múltiplos times, aguardando seleção...');
        }
      } else {
        console.error('❌ [TeamLoginModal] Invalid response:', data);
        setError(data.error || 'Erro ao carregar times');
      }
    } catch (err) {
      console.error('Erro ao buscar times:', err);
      setError('Erro ao carregar times');
    } finally {
      setLoadingTeams(false);
    }
  };

  // Fazer login do time
  const handleLogin = async (autoTeam?: Team) => {
    try {
      setLoading(true);
      setError('');

      // 🎯 NOVO: Verificar se é login em todos os times
      if (loginAllTeams && teams.length > 1) {
        console.log('🔐 [TeamLoginModal] Fazendo login em todos os times:', teams.length);
        
        // Fazer login em todos os times sequencialmente
        for (const team of teams) {
          const response = await fetch('/api/teams/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userToken}`,
              'x-user-id': 'supervisor',
              'x-organization-id': organizationId
            },
            body: JSON.stringify({
              teamId: team.id,
              teamName: team.name,
              organizationId: organizationId
            })
          });

          const data = await response.json();

          if (data.success) {
            console.log(`✅ Login no time ${team.name} realizado com sucesso`);
            if (team === teams[0]) {
              onLoginSuccess(data.team, data.sessionToken);
            }
          }
        }
        
        setOpen(false);
        setSelectedTeamId('');
        setLoginAllTeams(false);
        return;
      }

      // Login em time único
      const teamToLogin = autoTeam || teams.find(team => team.id === selectedTeamId);
      
      if (!teamToLogin) {
        setError('Selecione um time');
        return;
      }

      const selectedTeam = teamToLogin;

      const response = await fetch('/api/teams/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          teamName: selectedTeam.name,
          organizationId: organizationId
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login do time realizado com sucesso:', data);
        onLoginSuccess(data.team, data.sessionToken);
        setOpen(false);
        setSelectedTeamId('');
      } else {
        setError(data.error || 'Erro ao fazer login do time');
      }
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao fazer login do time');
    } finally {
      setLoading(false);
    }
  };

  // Carregar times quando modal abrir
  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" />
            Login como Time
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Login do Time
          </DialogTitle>
          <DialogDescription>
            Faça login como um time para acessar funcionalidades específicas
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {teams.length > 1 && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <input
                type="checkbox"
                id="login-all-teams"
                checked={loginAllTeams}
                onChange={(e) => {
                  setLoginAllTeams(e.target.checked);
                  if (e.target.checked) {
                    setSelectedTeamId(''); // Limpar seleção individual
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <Label htmlFor="login-all-teams" className="text-sm text-blue-900 cursor-pointer">
                Fazer login em todos os times ({teams.length})
              </Label>
            </div>
          )}

          {!loginAllTeams && (
            <div className="space-y-2">
              <Label htmlFor="team-select">Selecione o Time</Label>
              <Select 
                value={selectedTeamId} 
                onValueChange={setSelectedTeamId}
                disabled={loadingTeams || loginAllTeams}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTeams ? "Carregando times..." : "Selecione um time"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex flex-col">
                        <span className="">{team.name}</span>
                        {team.description && (
                          <span className="text-sm text-gray-500">{team.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex space-x-2">
            <Button 
              onClick={() => handleLogin()} 
              disabled={loading || loadingTeams || (!selectedTeamId && !loginAllTeams)}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fazendo login...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {loginAllTeams ? 'Entrar em Todos' : 'Entrar como Time'}
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {teams.length === 0 && !loadingTeams && (
            <Alert>
              <AlertDescription>
                Nenhum time encontrado. Verifique se existem times cadastrados na organização.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
