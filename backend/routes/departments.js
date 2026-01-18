import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// GET /departments - Lista todos os departamentos únicos da organização
router.get('/', async (req, res) => {
  try {
    console.log('🏢 [API] Requisição para listar departamentos recebida');
    const { user } = req;
    
    console.log('🏢 [API] Dados do usuário autenticado:', {
      id: user?.id,
      organization_id: user?.organization_id,
      user_role: user?.user_role
    });
    
    if (!user || !user.organization_id) {
      console.log('❌ [API] Usuário não autenticado ou sem organização');
      return res.status(401).json({ error: 'Usuário não autenticado ou sem organização' });
    }

    console.log(`🏢 [API] Buscando departamentos da organização: ${user.organization_id}`);

    // Buscar departamentos únicos dos usuários da organização
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('department')
      .eq('organization_id', user.organization_id)
      .not('department', 'is', null);

    if (error) {
      console.error('❌ [API] Erro do Supabase ao buscar departamentos:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    console.log(`🏢 [API] Profiles encontrados: ${profiles?.length || 0}`);
    console.log('🏢 [API] Dados brutos dos profiles:', profiles);

    // Extrair departamentos únicos
    const uniqueDepartments = [...new Set(profiles.map(p => p.department).filter(Boolean))];
    console.log('🏢 [API] Departamentos únicos:', uniqueDepartments);
    
    // Formatar dados para os filtros
    const formattedDepartments = uniqueDepartments.map((dept, index) => ({
      id: `dept-${index + 1}`,
      name: dept,
      value: dept,
      label: dept
    }));

    console.log('🏢 [API] Departamentos formatados:', formattedDepartments);

    res.json({ 
      departments: formattedDepartments,
      total: formattedDepartments.length 
    });

  } catch (error) {
    console.error('❌ [API] Erro geral ao buscar departamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router; 