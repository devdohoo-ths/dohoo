import { supabaseAdmin } from '../lib/supabaseClient.js';

/**
 * Serviço para gerenciar contatos
 * Inclui criação automática, transferência e histórico
 */
class ContactService {
  
  /**
   * Criar contato automaticamente a partir de dados de mensagem
   * @param {Object} messageData - Dados da mensagem
   * @param {string} messageData.phone - Número do telefone
   * @param {string} messageData.name - Nome do contato
   * @param {string} messageData.organization_id - ID da organização
   * @param {string} messageData.user_id - ID do usuário responsável
   * @param {Date} messageData.last_interaction_at - Data da última interação
   * @param {Object} messageData.metadata - Metadados adicionais
   */
  async createContactFromMessage(messageData) {
    try {
      const {
        phone,
        name,
        organization_id,
        user_id,
        last_interaction_at,
        metadata = {}
      } = messageData;

      console.log('📞 [ContactService] Criando contato a partir de mensagem:', {
        phone,
        name,
        organization_id,
        user_id
      });

      // Verificar se já existe contato com este número na organização
      const { data: existingContact, error: findError } = await supabaseAdmin
        .from('contacts')
        .select('id, name, last_interaction_at')
        .eq('phone_number', phone)
        .eq('organization_id', organization_id)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ [ContactService] Erro ao buscar contato existente:', findError);
        throw findError;
      }

      if (existingContact) {
        // Atualizar contato existente
        const { data: updatedContact, error: updateError } = await supabaseAdmin
          .from('contacts')
          .update({
            name: name || existingContact.name,
            last_interaction_at: last_interaction_at || new Date(),
            metadata: {
              ...existingContact.metadata,
              ...metadata,
              last_message_at: last_interaction_at || new Date()
            }
          })
          .eq('id', existingContact.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ [ContactService] Erro ao atualizar contato:', updateError);
          throw updateError;
        }

        console.log('✅ [ContactService] Contato atualizado:', updatedContact.id);
        return updatedContact;
      } else {
        // Criar novo contato
        const { data: newContact, error: createError } = await supabaseAdmin
          .from('contacts')
          .insert({
            phone_number: phone,
            name: name || 'Cliente',
            organization_id,
            user_id,
            last_interaction_at: last_interaction_at || new Date(),
            metadata: {
              ...metadata,
              created_from_message: true,
              created_at: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ [ContactService] Erro ao criar contato:', createError);
          throw createError;
        }

        // Registrar no histórico
        await this.logContactHistory('created', newContact.id, {
          created_by: user_id,
          notes: 'Contato criado automaticamente a partir de mensagem'
        });

        console.log('✅ [ContactService] Contato criado:', newContact.id);
        return newContact;
      }
    } catch (error) {
      console.error('❌ [ContactService] Erro em createContactFromMessage:', error);
      throw error;
    }
  }

  /**
   * Buscar ou criar contato
   * @param {string} phone - Número do telefone
   * @param {string} organizationId - ID da organização
   * @param {string} userId - ID do usuário responsável
   * @param {Object} options - Opções adicionais
   */
  async getOrCreateContact(phone, organizationId, userId, options = {}) {
    try {
      const { name, metadata = {} } = options;

      // Buscar contato existente
      const { data: existingContact, error: findError } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('phone_number', phone)
        .eq('organization_id', organizationId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      if (existingContact) {
        // Atualizar último contato se necessário
        if (options.updateLastInteraction) {
          const { data: updatedContact, error: updateError } = await supabaseAdmin
            .from('contacts')
            .update({
              last_interaction_at: new Date(),
              name: name || existingContact.name,
              metadata: {
                ...existingContact.metadata,
                ...metadata
              }
            })
            .eq('id', existingContact.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return updatedContact;
        }

        return existingContact;
      }

      // Criar novo contato
      const { data: newContact, error: createError } = await supabaseAdmin
        .from('contacts')
        .insert({
          phone_number: phone,
          name: name || 'Cliente',
          organization_id: organizationId,
          user_id: userId,
          last_interaction_at: new Date(),
          metadata: {
            ...metadata,
            created_manually: true,
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (createError) throw createError;

      // Registrar no histórico
      await this.logContactHistory('created', newContact.id, {
        created_by: userId,
        notes: 'Contato criado manualmente'
      });

      return newContact;
    } catch (error) {
      console.error('❌ [ContactService] Erro em getOrCreateContact:', error);
      throw error;
    }
  }

  /**
   * Transferir contatos entre usuários
   * @param {Array<string>} contactIds - IDs dos contatos a transferir
   * @param {string} fromUserId - ID do usuário de origem
   * @param {string} toUserId - ID do usuário de destino
   * @param {string} transferredBy - ID do usuário que fez a transferência
   * @param {string} notes - Observações sobre a transferência
   */
  async transferContacts(contactIds, fromUserId, toUserId, transferredBy, notes = '') {
    try {
      console.log('🔄 [ContactService] Transferindo contatos:', {
        contactIds,
        fromUserId,
        toUserId,
        transferredBy
      });

      // Verificar se todos os contatos existem e pertencem ao usuário de origem
      const { data: contacts, error: findError } = await supabaseAdmin
        .from('contacts')
        .select('id, phone_number, name')
        .in('id', contactIds)
        .eq('user_id', fromUserId);

      if (findError) throw findError;

      if (contacts.length !== contactIds.length) {
        throw new Error('Alguns contatos não foram encontrados ou não pertencem ao usuário de origem');
      }

      // Atualizar contatos
      const { error: updateError } = await supabaseAdmin
        .from('contacts')
        .update({ user_id: toUserId })
        .in('id', contactIds);

      if (updateError) throw updateError;

      // Registrar no histórico para cada contato
      const historyPromises = contactIds.map(contactId =>
        this.logContactHistory('transferred', contactId, {
          from_user_id: fromUserId,
          to_user_id: toUserId,
          created_by: transferredBy,
          notes: notes || `Transferido de ${fromUserId} para ${toUserId}`
        })
      );

      await Promise.all(historyPromises);

      console.log('✅ [ContactService] Contatos transferidos com sucesso');
      return {
        success: true,
        transferredCount: contactIds.length,
        contacts: contacts.map(c => ({ id: c.id, phone: c.phone_number, name: c.name }))
      };
    } catch (error) {
      console.error('❌ [ContactService] Erro em transferContacts:', error);
      throw error;
    }
  }

  /**
   * Registrar ação no histórico do contato
   * @param {string} actionType - Tipo da ação
   * @param {string} contactId - ID do contato
   * @param {Object} data - Dados da ação
   */
  async logContactHistory(actionType, contactId, data) {
    try {
      const {
        from_user_id,
        to_user_id,
        created_by,
        notes,
        metadata = {}
      } = data;

      const { error } = await supabaseAdmin
        .from('contact_history')
        .insert({
          contact_id: contactId,
          action_type: actionType,
          from_user_id,
          to_user_id,
          created_by,
          notes,
          metadata
        });

      if (error) {
        console.error('❌ [ContactService] Erro ao registrar histórico:', error);
        // Não falhar a operação principal por erro no histórico
      }
    } catch (error) {
      console.error('❌ [ContactService] Erro em logContactHistory:', error);
      // Não falhar a operação principal por erro no histórico
    }
  }

  /**
   * Buscar contatos com filtros
   * @param {Object} filters - Filtros de busca
   * @param {string} filters.organization_id - ID da organização
   * @param {string} filters.user_id - ID do usuário (opcional)
   * @param {string} filters.search - Termo de busca (nome ou telefone)
   * @param {number} filters.limit - Limite de resultados
   * @param {number} filters.offset - Offset para paginação
   */
  async getContacts(filters = {}) {
    try {
      const {
        organization_id,
        user_id,
        search,
        limit,
        offset = 0
      } = filters;

      let query = supabase
        .from('contacts')
        .select(`
          *,
          user:profiles!contacts_user_id_fkey(
            id,
            name,
            email
          )
        `, { count: 'exact' })
        .eq('organization_id', organization_id)
        .order('last_interaction_at', { ascending: false });

      // Aplicar limite e offset apenas se limit for especificado
      if (limit) {
        query = query.range(offset, offset + limit - 1);
        console.log('🔍 [ContactService] Aplicando limite:', limit, 'offset:', offset);
      } else {
        // Se não há limite, usar range com um valor muito alto
        query = query.range(0, 9999); // Range de 0 a 9999 (10000 registros)
        console.log('🔍 [ContactService] Carregando todos os contatos com range(0, 9999)');
      }

      // Filtrar por usuário se especificado
      if (user_id) {
        query = query.eq('user_id', user_id);
      }

      // Busca por nome ou telefone
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
      }

      const { data: contacts, error, count } = await query;

      if (error) throw error;

      console.log('🔍 [ContactService] Resultado da query:', {
        contactsCount: contacts?.length,
        totalCount: count,
        limit,
        offset,
        hasMore: limit ? (offset + limit) < (count || 0) : false
      });

      return {
        contacts: contacts || [],
        total: count || 0,
        hasMore: limit ? (offset + limit) < (count || 0) : false
      };
    } catch (error) {
      console.error('❌ [ContactService] Erro em getContacts:', error);
      throw error;
    }
  }

  /**
   * Buscar contato por ID
   * @param {string} contactId - ID do contato
   * @param {string} organizationId - ID da organização (para segurança)
   */
  async getContactById(contactId, organizationId) {
    try {
      const { data: contact, error } = await supabaseAdmin
        .from('contacts')
        .select(`
          *,
          user:profiles!contacts_user_id_fkey(
            id,
            name,
            email
          )
        `)
        .eq('id', contactId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      return contact;
    } catch (error) {
      console.error('❌ [ContactService] Erro em getContactById:', error);
      throw error;
    }
  }

  /**
   * Atualizar contato
   * @param {string} contactId - ID do contato
   * @param {Object} updateData - Dados para atualizar
   * @param {string} updatedBy - ID do usuário que fez a atualização
   */
  async updateContact(contactId, updateData, updatedBy) {
    try {
      const { data: contact, error } = await supabaseAdmin
        .from('contacts')
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .eq('id', contactId)
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico
      await this.logContactHistory('updated', contactId, {
        created_by: updatedBy,
        notes: 'Contato atualizado',
        metadata: { updated_fields: Object.keys(updateData) }
      });

      return contact;
    } catch (error) {
      console.error('❌ [ContactService] Erro em updateContact:', error);
      throw error;
    }
  }

  /**
   * Excluir contato
   * @param {string} contactId - ID do contato
   * @param {string} deletedBy - ID do usuário que fez a exclusão
   */
  async deleteContact(contactId, deletedBy) {
    try {
      // Buscar dados do contato antes de excluir
      const { data: contact, error: findError } = await supabaseAdmin
        .from('contacts')
        .select('id, phone_number, name')
        .eq('id', contactId)
        .single();

      if (findError) throw findError;

      // Excluir contato
      const { error: deleteError } = await supabaseAdmin
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (deleteError) throw deleteError;

      // Registrar no histórico
      await this.logContactHistory('deleted', contactId, {
        created_by: deletedBy,
        notes: `Contato excluído: ${contact.phone_number} (${contact.name})`
      });

      return { success: true, deletedContact: contact };
    } catch (error) {
      console.error('❌ [ContactService] Erro em deleteContact:', error);
      throw error;
    }
  }

  /**
   * Buscar histórico de um contato
   * @param {string} contactId - ID do contato
   */
  async getContactHistory(contactId) {
    try {
      const { data: history, error } = await supabaseAdmin
        .from('contact_history')
        .select(`
          *,
          from_user:profiles!contact_history_from_user_id_fkey(
            id,
            name,
            email
          ),
          to_user:profiles!contact_history_to_user_id_fkey(
            id,
            name,
            email
          ),
          created_by_user:profiles!contact_history_created_by_fkey(
            id,
            name,
            email
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return history || [];
    } catch (error) {
      console.error('❌ [ContactService] Erro em getContactHistory:', error);
      throw error;
    }
  }
}

export default new ContactService();
