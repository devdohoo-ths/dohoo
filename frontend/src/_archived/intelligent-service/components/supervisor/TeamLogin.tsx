import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Users, LogIn } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface TeamLoginProps {
  onLoginSuccess: (team: Team, sessionToken: string) => void;
}

export const TeamLogin: React.FC<TeamLoginProps> = ({ onLoginSuccess }) => {
  const { organizationId, userToken } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Buscar times disponíveis
  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      const response = await fetch(`/api/teams?organization_id=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.teams) {
        setTeams(data.teams);
      } else {
        setError('Erro ao carregar times');
      }
    } catch (err) {
      console.error('Erro ao buscar times:', err);
      setError('Erro ao carregar times');
    } finally {
      setLoadingTeams(false);
    }
  };

  // Fazer login do time
  const handleLogin = async () => {
    if (!selectedTeamId) {
      setError('Selecione um time');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const selectedTeam = teams.find(team => team.id === selectedTeamId);
      if (!selectedTeam) {
        setError('Time não encontrado');
        return;
      }

      const response = await fetch('/api/teams/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
          'x-user-id': 'supervisor',
          'x-organization-id': organizationId
        },
        body: JSON.stringify({
          teamId: selectedTeamId,
          teamName: selectedTeam.name,
          organizationId: organizationId
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login do time realizado com sucesso:', data);
        onLoginSuccess(data.team, data.sessionToken);
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

  // Carregar times ao montar o componente
  React.useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle className="text-2xl">Login do Time</CardTitle>
        <CardDescription>
          Faça login como um time para acessar o dashboard
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="team-select">Selecione o Time</Label>
          <Select 
            value={selectedTeamId} 
            onValueChange={setSelectedTeamId}
            disabled={loadingTeams}
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

        <Button 
          onClick={handleLogin} 
          disabled={loading || loadingTeams || !selectedTeamId}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fazendo login...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Entrar como Time
            </>
          )}
        </Button>

        {teams.length === 0 && !loadingTeams && (
          <Alert>
            <AlertDescription>
              Nenhum time encontrado. Verifique se existem times cadastrados na organização.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
