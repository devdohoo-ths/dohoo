import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { supabase } from '../lib/supabaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authenticateToken);

// 🎯 MIDDLEWARE DE DEBUG: Logar todas as requisições que chegam neste router
router.use((req, res, next) => {
  console.log('\n🔵 [CampanhasContatos] ===== MIDDLEWARE DE DEBUG =====');
  console.log('🔵 [CampanhasContatos] Método:', req.method);
  console.log('🔵 [CampanhasContatos] URL:', req.url);
  console.log('🔵 [CampanhasContatos] Path:', req.path);
  console.log('🔵 [CampanhasContatos] req.user existe?', !!req.user);
  if (req.user) {
    console.log('🔵 [CampanhasContatos] req.user.id:', req.user.id);
    console.log('🔵 [CampanhasContatos] req.user.role_name:', req.user?.role_name);
  }
  console.log('🔵 [CampanhasContatos] ===== FIM DEBUG =====\n');
  next();
});

// Middleware de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// GET /api/campanhas/contatos/numeros-conectados - Buscar números conectados da organização
router.get('/contatos/numeros-conectados', async (req, res) => {
  // 🎯 LOG IMEDIATO NO INÍCIO PARA GARANTIR QUE A ROTA ESTÁ SENDO CHAMADA
  console.log('\n🚀🚀🚀 [Campanhas] ===== ROTA CHAMADA =====');
  console.log('🚀 [Campanhas] GET /api/campanhas/contatos/numeros-conectados');
  console.log('🚀 [Campanhas] req.user existe?', !!req.user);
  if (req.user) {
    console.log('🚀 [Campanhas] req.user.id:', req.user.id);
    console.log('🚀 [Campanhas] req.user.email:', req.user.email);
    console.log('🚀 [Campanhas] req.user.role_name:', req.user.role_name);
  }
  
  try {
    console.log('🔍 [DEBUG] Rota /contatos/numeros-conectados chamada');
    console.log('🔍 [DEBUG] req.user:', req.user);
    console.log('🔍 [DEBUG] req.user.organization_id:', req.user?.organization_id);
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }
    
    if (!req.user.organization_id) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID não encontrado'
      });
    }
    
    console.log('🔍 Buscando números conectados para organização:', req.user.organization_id);
    
    // Primeiro, vamos verificar se existem números na tabela
    const { data: todosNumeros, error: todosError } = await supabase
      .from('whatsapp_accounts')
      .select(`
        id,
        phone_number,
        name,
        status,
        last_connected_at,
        created_at,
        organization_id
      `)
      .eq('organization_id', req.user.organization_id);

    console.log('🔍 Todos os números da organização:', todosNumeros?.length || 0);
    if (todosNumeros && todosNumeros.length > 0) {
      console.log('🔍 Status dos números:', todosNumeros.map(n => ({ name: n.name, status: n.status, phone: n.phone_number })));
    }

    // 🎯 VERIFICAR ROLE DO USUÁRIO PARA FILTRAR DADOS SE FOR AGENTE
    // ✅ OTIMIZAÇÃO: Tentar usar role_name do middleware primeiro, buscar se não estiver disponível
    console.log('🔍 [Campanhas] DEBUG req.user completo:', {
      id: req.user?.id,
      email: req.user?.email,
      role_name: req.user?.role_name,
      role_id: req.user?.role_id,
      organization_id: req.user?.organization_id,
      todas_propriedades: Object.keys(req.user || {})
    });
    
    let roleName = req.user?.role_name || '';
    let isAgent = false;
    
    // Se role_name não estiver disponível no req.user, buscar da tabela
    if (!roleName && req.user?.role_id) {
      console.log('⚠️ [Campanhas] role_name não encontrado em req.user, buscando da tabela roles...');
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', req.user.role_id)
        .single();
      
      if (!roleError && role?.name) {
        roleName = role.name;
        console.log('✅ [Campanhas] Role encontrado na tabela:', roleName);
      }
    } else if (!roleName && !req.user?.role_id) {
      console.log('⚠️ [Campanhas] Nem role_name nem role_id encontrados em req.user, buscando do profile...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', req.user.id)
        .single();
      
      if (!profileError && profile?.role_id) {
        const { data: role, error: roleError2 } = await supabase
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .single();
        
        if (!roleError2 && role?.name) {
          roleName = role.name;
          console.log('✅ [Campanhas] Role encontrado via profile:', roleName);
        }
      }
    }
    
    // Verificar se é agente (case insensitive)
    // ✅ USAR MESMA LÓGICA DE /api/whatsapp-accounts
    const roleMapping = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Manager': 'manager',
      'Agente': 'agent'
    };
    const normalizedRoleName = roleMapping[roleName] || roleName?.toLowerCase();
    isAgent = normalizedRoleName === 'agent' || 
              roleName?.toLowerCase().includes('agente') || 
              roleName?.toLowerCase().includes('agent');

    console.log('🎯 [Campanhas] Role do usuário:', {
      user_id: req.user.id,
      role_name: roleName,
      role_name_from_user: req.user?.role_name,
      role_id_from_user: req.user?.role_id,
      isAgent,
      willFilterByAgent: isAgent,
      roleName_empty: roleName === '',
      roleName_length: roleName.length
    });

    // Agora buscar apenas os conectados
    let numerosQuery = supabase
      .from('whatsapp_accounts')
      .select(`
        id,
        phone_number,
        name,
        status,
        last_connected_at,
        created_at,
        user_id
      `)
      .eq('organization_id', req.user.organization_id)
      .eq('status', 'connected');
    
    // 🎯 FILTRO POR AGENTE: Se for agente, mostrar apenas números vinculados a ele
    if (isAgent) {
      console.log('🔒 [Campanhas] Aplicando filtro de agente:', {
        user_id: req.user.id,
        isAgent: true,
        role_name: roleName
      });
      // ✅ IMPORTANTE: Filtrar por user_id do agente
      numerosQuery = numerosQuery.eq('user_id', req.user.id);
      console.log('🔒 [Campanhas] Query configurada com filtro user_id =', req.user.id);
    } else {
      console.log('🔓 [Campanhas] Usuário não é agente, mostrando todos os números da organização');
    }
    
    numerosQuery = numerosQuery.order('created_at', { ascending: false });
    
    let { data: numeros, error } = await numerosQuery;

    if (error) {
      console.error('❌ Erro na query:', error);
      throw error;
    }
    
    // 🎯 LOG DE DEBUG: Verificar quais números foram retornados ANTES do filtro
    console.log('📊 [Campanhas] Números encontrados ANTES do filtro de segurança:', {
      total: numeros?.length || 0,
      isAgent,
      user_id: req.user.id,
      numeros: numeros?.map(n => ({
        phone: n.phone_number,
        name: n.name,
        user_id: n.user_id,
        matches_user: n.user_id === req.user.id
      })) || []
    });
    
    // 🎯 VALIDAÇÃO ADICIONAL: Se for agente, garantir que apenas números do agente sejam retornados
    if (isAgent) {
      if (!numeros || numeros.length === 0) {
        console.log('⚠️ [Campanhas] Agente sem números conectados');
        numeros = [];
      } else {
        const numerosInvalidos = numeros.filter(n => {
          // Verificar se user_id não existe, é null, ou é diferente do agente
          return !n.user_id || n.user_id !== req.user.id;
        });
        
        if (numerosInvalidos.length > 0) {
          console.error('❌ [Campanhas] ERRO CRÍTICO: Encontrados números de outros usuários ou sem user_id para agente:', {
            total_invalidos: numerosInvalidos.length,
            numeros_invalidos: numerosInvalidos.map(n => ({
              phone: n.phone_number,
              name: n.name,
              user_id: n.user_id,
              esperado: req.user.id
            }))
          });
          // Filtrar manualmente para garantir segurança - APENAS números com user_id do agente
          numeros = numeros.filter(n => n.user_id === req.user.id);
          console.log('✅ [Campanhas] Números filtrados manualmente após detecção de erro. Total válido:', numeros.length);
        } else {
          console.log('✅ [Campanhas] Todos os números pertencem ao agente');
        }
      }
    }
    
    // 🎯 LOG DE DEBUG: Verificar quais números foram retornados APÓS o filtro
    console.log('📊 [Campanhas] Números encontrados APÓS o filtro de segurança:', {
      total: numeros?.length || 0,
      isAgent,
      user_id: req.user.id,
      numeros: numeros?.map(n => ({
        phone: n.phone_number,
        name: n.name,
        user_id: n.user_id
      })) || []
    });

    console.log('✅ Números conectados encontrados:', numeros?.length || 0);

    // Mapear os campos para o formato esperado pelo frontend
    const numerosFormatados = (numeros || []).map(numero => ({
      id: numero.id,
      phone_number: numero.phone_number,
      session_name: numero.name, // Mapear name para session_name
      status: numero.status,
      last_seen: numero.last_connected_at, // Mapear last_connected_at para last_seen
      created_at: numero.created_at
    }));

    // 🎯 GARANTIR QUE O DEBUG MOSTRE O ESTADO CORRETO
    res.json({
      success: true,
      data: numerosFormatados,
      debug: {
        total_accounts: todosNumeros?.length || 0,
        connected_accounts: numerosFormatados?.length || 0, // ✅ Usar numerosFormatados após filtro
        filtered_accounts: numeros?.length || 0, // Total após filtro de agente
        isAgent: isAgent,
        role_name: roleName,
        user_id: req.user.id,
        organization_id: req.user.organization_id,
        filter_applied: isAgent ? `user_id = ${req.user.id}` : 'none'
      }
    });

  } catch (error) {
    console.error('Erro ao buscar números conectados:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/contatos/debug-numeros - Debug: verificar todos os números da organização
router.get('/contatos/debug-numeros', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Verificando todos os números para organização:', req.user.organization_id);
    
    // Buscar todos os números da organização
    const { data: todosNumeros, error } = await supabase
      .from('whatsapp_accounts')
      .select(`
        id,
        phone_number,
        name,
        status,
        last_connected_at,
        created_at,
        organization_id,
        user_id
      `)
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [DEBUG] Erro na query:', error);
      throw error;
    }

    console.log('🔍 [DEBUG] Total de números encontrados:', todosNumeros?.length || 0);
    
    if (todosNumeros && todosNumeros.length > 0) {
      console.log('🔍 [DEBUG] Detalhes dos números:');
      todosNumeros.forEach((numero, index) => {
        console.log(`  ${index + 1}. ${numero.name} - ${numero.status} - ${numero.phone_number || 'Sem número'}`);
      });
    }

    res.json({
      success: true,
      data: {
        total_accounts: todosNumeros?.length || 0,
        accounts: todosNumeros || [],
        organization_id: req.user.organization_id,
        connected_count: todosNumeros?.filter(n => n.status === 'connected').length || 0,
        disconnected_count: todosNumeros?.filter(n => n.status === 'disconnected').length || 0,
        connecting_count: todosNumeros?.filter(n => n.status === 'connecting').length || 0,
        error_count: todosNumeros?.filter(n => n.status === 'error').length || 0
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Erro ao buscar números:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/contatos/contatos-com-historico - Buscar contatos que já conversaram com números específicos
router.get('/contatos/contatos-com-historico', [
  query('numeros').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { numeros, limit = 100, offset = 0, search = '' } = req.query;
    const numerosArray = numeros.split(',').map(n => n.trim());
    const searchTerm = search.trim();

    console.log('🔍 Buscando contatos com histórico para números:', numerosArray);
    console.log('🔍 Termo de busca:', searchTerm);

    // Buscar TODAS as mensagens da organização primeiro
    const { data: allMessages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at,
        sender_name,
        organization_id,
        account_id,
        sender_jid,
        is_from_me,
        chats(name, whatsapp_jid, assigned_agent_id, platform, status, department, priority, created_at, last_message_at)
      `)
      .eq('organization_id', req.user.organization_id)
      .not('content', 'is', null)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      throw messagesError;
    }

    console.log('✅ Total de mensagens na organização:', allMessages?.length || 0);

    // Buscar informações das contas WhatsApp para mapear account_id para phone_number
    const { data: accounts, error: accountsError } = await supabase
      .from('whatsapp_accounts')
      .select('id, phone_number, name')
      .eq('organization_id', req.user.organization_id)
      .in('phone_number', numerosArray);

    if (accountsError) {
      console.error('❌ Erro ao buscar contas:', accountsError);
      throw accountsError;
    }

    console.log('✅ Contas encontradas:', accounts?.length || 0);
    
    // Criar mapa de account_id para phone_number
    const accountMap = {};
    accounts.forEach(account => {
      accountMap[account.id] = account.phone_number;
    });

    console.log('🔍 [DEBUG] Mapa de contas:', accountMap);

    // Filtrar mensagens enviadas pela empresa
    const messages = allMessages.filter(msg => msg.is_from_me === true);
    console.log('✅ Mensagens enviadas pela empresa:', messages?.length || 0);

    // Usar a mesma lógica do relatório: agrupar por chat_id (conversas únicas)
    console.log('🔍 [DEBUG] Iniciando processamento usando lógica do relatório...');
    console.log('🔍 [DEBUG] Números selecionados:', numerosArray);
    
    // Primeiro, agrupar por chat_id como no relatório
    const uniqueChats = new Map();
    
    messages.forEach(msg => {
      if (msg.chat_id && msg.chats) {
        const chatId = msg.chat_id;
        if (!uniqueChats.has(chatId)) {
          uniqueChats.set(chatId, {
            id: msg.chats.id || chatId,
            name: msg.chats.name || msg.sender_name || 'Sem nome',
            platform: msg.chats.platform || 'whatsapp',
            whatsapp_jid: msg.chats.whatsapp_jid,
            created_at: msg.chats.created_at || msg.created_at,
            last_message_at: msg.chats.last_message_at || msg.created_at,
            totalMessages: 0
          });
        }
        // Incrementar contador de mensagens para este chat
        uniqueChats.get(chatId).totalMessages++;
      }
    });

    const chats = Array.from(uniqueChats.values());
    console.log('🔍 [DEBUG] Conversas únicas encontradas:', chats.length);

    // Usar a mesma lógica do relatório para extrair contatos
    const contatosComHistorico = [];
    const contatosUnicos = new Map(); // Para evitar duplicatas
    
    console.log('🔍 [DEBUG] Processando chats usando lógica do relatório...');
    
    chats.forEach(chat => {
      // Verificar se é WhatsApp
      if (chat.platform !== 'whatsapp' || !chat.whatsapp_jid) {
        return;
      }
      
      // Usar a mesma lógica do relatório para extrair telefone
      let phoneNumber = 'N/A';
      let customerName = chat.name || 'Cliente';
      
      const jid = chat.whatsapp_jid;
      
      // Verificar se é grupo do WhatsApp
      if (jid && jid.endsWith('@g.us')) {
        // É um grupo - pular
        console.log(`⚠️ [DEBUG] Ignorando grupo: ${chat.name}`);
        return;
      } else if (jid && jid.endsWith('@s.whatsapp.net')) {
        // É conversa individual
        phoneNumber = jid.replace('@s.whatsapp.net', '');
        customerName = chat.name || phoneNumber;
      } else if (jid) {
        // Outros tipos de JID
        phoneNumber = jid.split('@')[0];
        customerName = chat.name || 'Contato';
      }
      
      console.log(`🔍 [DEBUG] Processando contato: ${customerName} (${phoneNumber})`);
      
      // Verificar se não é número da empresa
      const isNumeroEmpresa = numerosArray.some(n => {
        const numeroLimpo = n.replace(/\D/g, '');
        const contatoLimpo = phoneNumber.replace(/\D/g, '');
        return contatoLimpo === numeroLimpo;
      });
      
      if (isNumeroEmpresa) {
        console.log(`⚠️ [DEBUG] Ignorando ${phoneNumber} - é um número da empresa`);
        return;
      }
      
      // Aplicar filtro de busca se fornecido
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const phoneMatches = phoneNumber.includes(searchTerm);
        const nameMatches = customerName.toLowerCase().includes(searchLower);
        
        if (!phoneMatches && !nameMatches) {
          console.log(`🔍 [BUSCA] Contato ${phoneNumber} não corresponde ao termo de busca: ${searchTerm}`);
          return; // Pular este contato
        }
        
        console.log(`✅ [BUSCA] Contato ${phoneNumber} corresponde ao termo de busca: ${searchTerm}`);
      }

      // Associar contato ao primeiro número selecionado
      const numeroAssociado = numerosArray[0];
      console.log(`🔍 Associando contato ${phoneNumber} ao número: ${numeroAssociado}`);
      
      if (numeroAssociado) {
        const chaveUnica = `${phoneNumber}_${numeroAssociado}`;
        if (!contatosUnicos.has(chaveUnica)) {
          contatosUnicos.set(chaveUnica, {
            contato_phone: phoneNumber,
            contato_name: customerName,
            numero_whatsapp: numeroAssociado,
            ultima_conversa: chat.last_message_at,
            total_mensagens: chat.totalMessages
          });
          
          console.log(`✅ Contato adicionado: ${customerName} (${phoneNumber}) -> número ${numeroAssociado}`);
        }
      }
    });
    
    // Converter Map para array
    contatosComHistorico.push(...Array.from(contatosUnicos.values()));

    console.log('✅ [DEBUG] Contatos filtrados:', contatosComHistorico.length);

    const contatos = contatosComHistorico;
    
    // Aplicar paginação
    const contatosPaginados = contatos.slice(offset, offset + limit);

    console.log('✅ Contatos agrupados:', contatos.length);
    console.log('✅ Contatos paginados:', contatosPaginados.length);

    res.json({
      success: true,
      data: contatosPaginados,
      total: contatos.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Erro ao buscar contatos com histórico:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/campanhas/contatos/validar-contatos - Validar se contatos têm histórico com números selecionados
router.post('/contatos/validar-contatos', [
  body('numeros').isArray().notEmpty(),
  body('contatos').isArray().notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { numeros, contatos } = req.body;

    // Buscar histórico de mensagens para os contatos e números especificados
    const { data: historico, error } = await supabase
      .from('messages')
      .select('contact_phone, from_number')
      .in('from_number', numeros)
      .in('contact_phone', contatos)
      .eq('organization_id', req.user.organization_id);

    if (error) throw error;

    // Criar mapa de validação
    const validacaoMap = {};
    historico.forEach(msg => {
      const key = `${msg.contact_phone}_${msg.from_number}`;
      validacaoMap[key] = true;
    });

    // Validar cada combinação contato-número
    const contatosValidados = [];
    const contatosInvalidos = [];

    contatos.forEach(contato => {
      numeros.forEach(numero => {
        const key = `${contato}_${numero}`;
        if (validacaoMap[key]) {
          contatosValidados.push({
            contato_phone: contato,
            numero_whatsapp: numero,
            tem_historico: true
          });
        } else {
          contatosInvalidos.push({
            contato_phone: contato,
            numero_whatsapp: numero,
            tem_historico: false
          });
        }
      });
    });

    res.json({
      success: true,
      data: {
        contatos_validados: contatosValidados,
        contatos_invalidos: contatosInvalidos,
        total_validados: contatosValidados.length,
        total_invalidos: contatosInvalidos.length
      }
    });

  } catch (error) {
    console.error('Erro ao validar contatos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/campanhas/contatos/sugerir-distribuicao - Sugerir distribuição automática de contatos
router.get('/contatos/sugerir-distribuicao', [
  query('numeros').isString().notEmpty(),
  query('contatos').isString().notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { numeros, contatos } = req.query;
    const numerosArray = numeros.split(',').map(n => n.trim());
    const contatosArray = contatos.split(',').map(c => c.trim());

    // Buscar histórico detalhado
    const { data: historico, error } = await supabase
      .from('messages')
      .select(`
        contact_phone,
        contact_name,
        from_number,
        created_at,
        message_type
      `)
      .in('from_number', numerosArray)
      .in('contact_phone', contatosArray)
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Analisar histórico e sugerir distribuição
    const distribuicao = {};
    numerosArray.forEach(numero => {
      distribuicao[numero] = {
        numero_whatsapp: numero,
        contatos_sugeridos: [],
        total_mensagens: 0,
        ultima_atividade: null
      };
    });

    // Processar histórico
    historico.forEach(msg => {
      const numero = msg.from_number;
      if (distribuicao[numero]) {
        distribuicao[numero].total_mensagens += 1;
        
        if (!distribuicao[numero].ultima_atividade || 
            new Date(msg.created_at) > new Date(distribuicao[numero].ultima_atividade)) {
          distribuicao[numero].ultima_atividade = msg.created_at;
        }

        // Adicionar contato se não estiver na lista
        const contatoJaExiste = distribuicao[numero].contatos_sugeridos.some(
          c => c.contact_phone === msg.contact_phone
        );

        if (!contatoJaExiste) {
          distribuicao[numero].contatos_sugeridos.push({
            contact_phone: msg.contact_phone,
            contact_name: msg.contact_name,
            ultima_conversa: msg.created_at
          });
        }
      }
    });

    // Ordenar contatos por última conversa (mais recente primeiro)
    Object.values(distribuicao).forEach(numero => {
      numero.contatos_sugeridos.sort((a, b) => 
        new Date(b.ultima_conversa) - new Date(a.ultima_conversa)
      );
    });

    res.json({
      success: true,
      data: {
        distribuicao: Object.values(distribuicao),
        total_contatos_distribuidos: Object.values(distribuicao)
          .reduce((total, n) => total + n.contatos_sugeridos.length, 0),
        numeros_ativos: numerosArray.length
      }
    });

  } catch (error) {
    console.error('Erro ao sugerir distribuição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
