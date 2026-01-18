import { useState, useEffect } from 'react';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';

interface User {
  id: string;
  name: string;
  department?: string;
  role?: string;
  isOnline?: boolean;
}

interface Department {
  id: string;
  name: string;
  value: string;
  label: string;
}

export function useReportFilterData() {
  const [operators, setOperators] = useState<Array<{ value: string; label: string }>>([]);
  const [tags, setTags] = useState([]);
  const [departments, setDepartments] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔍 Iniciando busca de dados dos filtros...');
      console.log('🔍 Profile completo:', profile);
      console.log('🔍 Profile disponível:', {
        id: profile?.id,
        organization_id: profile?.organization_id,
        user_role: profile?.user_role
      });

      // Verificar se o profile está disponível
      if (!profile?.organization_id) {
        console.warn('⚠️ Profile ou organization_id não disponível, pulando busca de dados');
        console.warn('⚠️ Profile atual:', profile);
        setOperators([]);
        setDepartments([]);
        setLoading(false);
        return;
      }
      
      // Buscar usuários via API do backend
      console.log('👥 Buscando usuários via API do backend...');
      console.log('👥 Organization ID:', profile.organization_id);
      
      const headers = await getAuthHeaders();
      const usersResponse = await fetch(`${apiBase}/api/users?organization_id=${profile.organization_id}`, {
        headers
      });

      if (!usersResponse.ok) {
        console.error('❌ Erro ao buscar usuários via API:', usersResponse.status);
        setOperators([]);
      } else {
        const usersData = await usersResponse.json();
        const users = usersData.users || [];
        
        console.log(`✅ Usuários encontrados via API: ${users?.length || 0}`);
        if (users && users.length > 0) {
          console.log('📊 Exemplos de usuários:', users.slice(0, 3).map((u: any) => ({ 
            id: u.id, 
            name: u.name, 
            organization_id: profile.organization_id 
          })));
        }
        
        let formattedUsers = (users || []).map((user: any) => ({
          value: user.id,
          label: `${user.name}${user.department ? ` (${user.department})` : ''}${user.is_online ? ' 🟢' : ''}`
        }));
        
        // Se o usuário for agente, mostrar apenas ele mesmo na lista
        if (profile?.role_name === 'agent' || profile?.user_role === 'agent') {
          formattedUsers = formattedUsers.filter(user => user.value === profile.id);
          console.log('👥 Filtro aplicado: agente vê apenas seus próprios dados');
        }
        
        console.log('👥 Usuários formatados:', formattedUsers);
        setOperators(formattedUsers);
      }

      // Buscar times via API do backend
      console.log('🏢 Buscando times via API do backend...');
      console.log('🏢 Organization ID:', profile.organization_id);
      
      const teamsResponse = await fetch(`${apiBase}/api/teams?organization_id=${profile.organization_id}`, {
        headers: await getAuthHeaders()
      });

      if (!teamsResponse.ok) {
        console.error('❌ Erro ao buscar times via API:', teamsResponse.status);
        setDepartments([]);
      } else {
        const teamsData = await teamsResponse.json();
        const teams = teamsData.teams || teamsData.data || [];
        
        console.log(`✅ Times encontrados via API: ${teams?.length || 0}`);
        if (teams && teams.length > 0) {
          console.log('📊 Exemplos de times:', teams.slice(0, 3).map((t: any) => ({ 
            id: t.id, 
            name: t.name, 
            organization_id: profile.organization_id 
          })));
        } else {
          console.log('⚠️ Nenhum time encontrado para a organização:', profile.organization_id);
        }
        
        const formattedTeams = (teams || []).map((team: any) => ({
          value: team.id,
          label: team.name
        }));
        console.log('🏢 Times formatados:', formattedTeams);
        setDepartments(formattedTeams);
      }

    } catch (error) {
      console.error('Erro ao buscar dados dos filtros:', error);
      
      // Fallback para dados mock em caso de erro
      setOperators([
        { value: 'op1', label: 'Operador 1' },
        { value: 'op2', label: 'Operador 2' },
        { value: 'op3', label: 'Operador 3' },
      ]);
      
      setDepartments([
        { value: 'vendas', label: 'Vendas' },
        { value: 'suporte', label: 'Suporte' },
        { value: 'financeiro', label: 'Financeiro' },
      ]);
    }
    
    setLoading(false);
  };

  const refreshData = () => {
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [profile?.user_role]);

  return {
    operators,
    tags,
    departments,
    loading,
    refreshData
  };
} 