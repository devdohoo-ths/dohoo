import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Loader2, User, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export default function UserSettings() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Atualizar o nome quando o perfil mudar
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ 
        name: name.trim()
      });
      toast({
        title: "Sucesso",
        description: "Configurações atualizadas com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshProfile = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      console.log('🔄 Recarregando perfil do usuário:', user.id);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiBase}/api/users/${user.id}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        // Se perfil não existe (404), criar um novo
        if (response.status === 404) {
          console.log('🔄 Criando novo perfil...');
          const emailName = user.email?.split('@')[0];
          const newName = emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : 'Usuário';
          
          const createResponse = await fetch(`${apiBase}/api/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              id: user.id,
              name: newName,
              email: user.email,
              user_role: 'agent'
            })
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Failed to create profile: ${createResponse.statusText} - ${errorText}`);
          }

          const { data: newProfile } = await createResponse.json();
          setName(newProfile?.name || newName);
          toast({
            title: "Perfil Criado",
            description: `Perfil criado com nome: ${newProfile?.name || newName}`,
          });
          window.location.reload();
          return;
        }
        
        const errorText = await response.text();
        throw new Error(`Failed to fetch profile: ${response.statusText} - ${errorText}`);
      }

      const { data: currentProfile } = await response.json();
      console.log('🔄 Perfil atual:', currentProfile);

      // Verificar se o nome precisa ser corrigido
      let correctedName = currentProfile?.name;
      if (currentProfile?.name === user.email) {
        const emailName = user.email?.split('@')[0];
        correctedName = emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : 'Usuário';
        console.log('🔄 Corrigindo nome de', currentProfile.name, 'para', correctedName);
      }

      if (correctedName && correctedName !== currentProfile.name) {
        // Atualizar nome se precisar corrigir
        console.log('🔄 Atualizando nome do perfil...');
        const updateResponse = await fetch(`${apiBase}/api/users/${user.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name: correctedName })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update profile: ${updateResponse.statusText} - ${errorText}`);
        }

        const { data: updatedProfile } = await updateResponse.json();
        setName(updatedProfile?.name || correctedName);
        toast({
          title: "Nome Corrigido",
          description: `Nome atualizado para: ${updatedProfile?.name || correctedName}`,
        });
      } else {
        toast({
          title: "Perfil OK",
          description: "Perfil já está correto!",
        });
      }

      // Recarregar a página para atualizar o estado
      window.location.reload();

    } catch (error) {
      console.error('Erro ao recarregar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao recarregar perfil.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <span className="ml-2">Usuário não autenticado</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Configurações do Usuário</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Atualize seu nome e configure como ele aparece nas mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Email não pode ser alterado
              </p>
            </div>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Este nome aparecerá nas mensagens que você enviar
              </p>
            </div>
          </div>


          <div className="flex gap-2">
            <Button 
              onClick={handleSave}
              disabled={saving || !name.trim() || name === profile?.name}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Salvar Configurações
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={handleRefreshProfile}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recarregando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar Perfil
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
          <CardDescription>
            Detalhes da sua conta no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>ID do Usuário</Label>
              <Input value={user.id} disabled className="bg-gray-50" />
            </div>
            <div>
              <Label>Função</Label>
              <Input 
                value={profile?.user_role || 'agent'} 
                disabled 
                className="bg-gray-50" 
              />
            </div>
          </div>
          
          <div>
            <Label>Data de Criação</Label>
            <Input 
              value={new Date(user.created_at).toLocaleDateString('pt-BR')} 
              disabled 
              className="bg-gray-50" 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 