import { supabase } from '../../lib/supabaseClient.js';
import { createEvent } from '../google/calendarService.js';
import { getOAuthClient } from '../google/googleAuthService.js';
import { google } from 'googleapis';

/**
 * Executa uma ferramenta chamada pela IA
 */
export const executeTool = async (toolCall, userId, organizationId, phoneNumber) => {
  try {
    console.log('🔧 Executando ferramenta:', toolCall.function.name);
    console.log('📋 Argumentos:', toolCall.function.arguments);

    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    switch (functionName) {
      case 'agendar_google_calendar':
        return await executeGoogleCalendarScheduling(args, userId, organizationId, phoneNumber);
      
      case 'verificar_disponibilidade':
        return await executeAvailabilityCheck(args, userId, organizationId);
      
      case 'sugerir_disponibilidade':
        return await executeSuggestAvailability(args, userId, organizationId);
      
      case 'cancelar_agendamento':
        return await executeCancelScheduling(args, userId, organizationId, phoneNumber);
      
      case 'solicitar_reagendamento':
        return await executeRescheduleRequest(args, userId, organizationId, phoneNumber);
      
      case 'atendimento_humano':
        return await executeHumanSupport(args, userId, organizationId, phoneNumber);
      
      default:
        throw new Error(`Ferramenta não implementada: ${functionName}`);
    }
  } catch (error) {
    console.error('❌ Erro ao executar ferramenta:', error);
    return {
      success: false,
      error: error.message,
      message: `Erro ao executar ${toolCall.function.name}: ${error.message}`
    };
  }
};

/**
 * Executa agendamento no Google Calendar
 */
const executeGoogleCalendarScheduling = async (args, userId, organizationId, phoneNumber) => {
  try {
    console.log('📅 Agendando no Google Calendar:', args);

    // Verificar se a organização tem agendamento habilitado
    const { data: aiSettings, error: aiSettingsError } = await supabase
      .from('ai_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .single();

    if (aiSettingsError || !aiSettings) {
      throw new Error('Configurações de IA da organização não encontradas');
    }

    const schedulingConfig = aiSettings.settings?.scheduling;
    
    if (!schedulingConfig?.enabled) {
      return {
        success: false,
        message: 'Agendamento automático não está habilitado para esta organização. Configure nas configurações de IA.'
      };
    }

    if (!schedulingConfig.google_calendar_enabled) {
      return {
        success: false,
        message: 'Integração com Google Calendar não está habilitada. Configure nas configurações de IA.'
      };
    }

    if (!schedulingConfig.auto_scheduling_enabled) {
      return {
        success: false,
        message: 'Agendamento automático não está habilitado. Habilite nas configurações de IA.'
      };
    }

    // Verificar se há integração Google Calendar ativa
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', 'calendar')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return {
        success: false,
        message: 'Integração com Google Calendar não encontrada ou inativa. Configure a integração primeiro.'
      };
    }

    // Buscar perfil do usuário para obter email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil do usuário não encontrado');
    }

    // --- CORREÇÃO: Converter duração para número de minutos ---
    let duracao = args.duracao;
    if (typeof duracao === 'string') {
      // Extrai apenas números, ex: '45m' -> 45
      const match = duracao.match(/\d+/);
      duracao = match ? parseInt(match[0], 10) : (schedulingConfig.default_duration || 60);
    }
    if (!duracao || isNaN(duracao)) {
      duracao = schedulingConfig.default_duration || 60;
    }
    // ---------------------------------------------------------

    // Criar evento no Google Calendar
    const eventData = {
      summary: args.titulo || 'Agendamento via WhatsApp',
      description: `Agendamento realizado via WhatsApp\nCliente: ${args.nome}\nTelefone: ${phoneNumber}`,
      start: {
        dateTime: args.data_hora,
        timeZone: schedulingConfig.timezone || 'America/Sao_Paulo',
      },
      end: {
        dateTime: calculateEndTime(args.data_hora, duracao),
        timeZone: schedulingConfig.timezone || 'America/Sao_Paulo',
      },
      location: args.local || schedulingConfig.location,
      attendees: [
        { email: profile.email } // Adicionar o usuário como participante
      ]
    };

    console.log('📅 Dados do evento:', eventData);

    const event = await createEvent(userId, organizationId, phoneNumber, eventData);

    return {
      success: true,
      message: `✅ Agendamento realizado com sucesso!\n\n📅 **${args.titulo}**\n📅 Data: ${formatDateTime(args.data_hora)}\n⏰ Duração: ${duracao} minutos\n📍 Local: ${args.local || schedulingConfig.location}\n\nO evento foi adicionado ao seu Google Calendar.`,
      event: event
    };

  } catch (error) {
    console.error('❌ Erro ao agendar no Google Calendar:', error);
    return {
      success: false,
      message: `Erro ao agendar: ${error.message}`
    };
  }
};

/**
 * Verifica disponibilidade
 */
const executeAvailabilityCheck = async (args, userId, organizationId) => {
  try {
    console.log('🔍 Verificando disponibilidade:', args);

    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .single();

    const schedulingConfig = aiSettings?.settings?.scheduling;
    
    if (!schedulingConfig?.enabled || !schedulingConfig?.auto_scheduling_enabled) {
      return {
        success: false,
        message: 'Agendamento automático não está habilitado para esta organização.'
      };
    }

    const requestedDateTime = new Date(args.data_hora);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDateTime.getDay()];
    const dayConfig = schedulingConfig.business_hours[dayOfWeek];

    if (!dayConfig?.enabled) {
      return {
        success: false,
        message: `❌ Não atendemos aos ${getDayName(dayOfWeek)}s.`
      };
    }

    const [startHour, startMinute] = dayConfig.start.split(':').map(Number);
    const [endHour, endMinute] = dayConfig.end.split(':').map(Number);

    const startTime = new Date(requestedDateTime);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(requestedDateTime);
    endTime.setHours(endHour, endMinute, 0, 0);

    if (requestedDateTime < startTime || requestedDateTime > endTime) {
      return {
        success: false,
        message: `❌ Horário fora do expediente. Atendemos das ${dayConfig.start} às ${dayConfig.end} aos ${getDayName(dayOfWeek)}s.`
      };
    }

    return {
      success: true,
      message: `✅ Horário disponível! ${formatDateTime(args.data_hora)} está dentro do nosso horário de funcionamento.`
    };

  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error);
    return {
      success: false,
      message: `Erro ao verificar disponibilidade: ${error.message}`
    };
  }
};

/**
 * Sugere horários disponíveis
 */
const executeSuggestAvailability = async (args, userId, organizationId) => {
  try {
    console.log('💡 Sugerindo horários disponíveis:', args);

    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .single();

    const schedulingConfig = aiSettings?.settings?.scheduling;
    
    if (!schedulingConfig?.enabled || !schedulingConfig?.auto_scheduling_enabled) {
      return {
        success: false,
        message: 'Agendamento automático não está habilitado para esta organização.'
      };
    }

    const requestedDate = new Date(args.data);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestedDate.getDay()];
    const dayConfig = schedulingConfig.business_hours[dayOfWeek];

    if (!dayConfig?.enabled) {
      return {
        success: false,
        message: `❌ Não atendemos aos ${getDayName(dayOfWeek)}s.`
      };
    }

    // Gerar horários disponíveis
    const availableSlots = generateAvailableSlots(dayConfig, requestedDate, schedulingConfig.default_duration);

    if (availableSlots.length === 0) {
      return {
        success: false,
        message: `❌ Não há horários disponíveis para ${formatDate(args.data)}.`
      };
    }

    const slotsText = availableSlots.slice(0, 5).map(slot => `• ${slot}`).join('\n');

    return {
      success: true,
      message: `📅 Horários disponíveis para ${formatDate(args.data)}:\n\n${slotsText}\n\nEscolha um horário e eu farei o agendamento para você!`
    };

  } catch (error) {
    console.error('❌ Erro ao sugerir horários:', error);
    return {
      success: false,
      message: `Erro ao sugerir horários: ${error.message}`
    };
  }
};

/**
 * Cancela agendamento
 */
const executeCancelScheduling = async (args, userId, organizationId, phoneNumber) => {
  try {
    console.log('❌ Cancelando agendamento:', args);

    // Verificar se há integração Google Calendar
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('service_type', 'calendar')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return {
        success: false,
        message: 'Integração com Google Calendar não encontrada.'
      };
    }

    // Buscar evento no Google Calendar
    const oauth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(args.data_hora).toISOString(),
      timeMax: new Date(new Date(args.data_hora).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      q: args.nome // Buscar por nome
    });

    if (!events.data.items || events.data.items.length === 0) {
      return {
        success: false,
        message: 'Nenhum agendamento encontrado para cancelar.'
      };
    }

    // Cancelar primeiro evento encontrado
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: events.data.items[0].id
    });

    return {
      success: true,
      message: `✅ Agendamento cancelado com sucesso!\n\n📅 Evento: ${events.data.items[0].summary}\n📅 Data: ${formatDateTime(args.data_hora)}`
    };

  } catch (error) {
    console.error('❌ Erro ao cancelar agendamento:', error);
    return {
      success: false,
      message: `Erro ao cancelar agendamento: ${error.message}`
    };
  }
};

/**
 * Solicita reagendamento
 */
const executeRescheduleRequest = async (args, userId, organizationId, phoneNumber) => {
  try {
    console.log('🔄 Solicitando reagendamento:', args);

    // Primeiro cancelar o agendamento atual
    const cancelResult = await executeCancelScheduling({
      nome: 'Cliente',
      data_hora: args.data_hora
    }, userId, organizationId, phoneNumber);

    if (!cancelResult.success) {
      return cancelResult;
    }

    // Agendar novo horário
    const newSchedulingResult = await executeGoogleCalendarScheduling({
      nome: 'Cliente',
      data_hora: args.nova_data_hora,
      titulo: 'Agendamento Reagendado',
      local: 'Local do serviço',
      duracao: '60'
    }, userId, organizationId, phoneNumber);

    if (newSchedulingResult.success) {
      return {
        success: true,
        message: `✅ Reagendamento realizado com sucesso!\n\n📅 Novo horário: ${formatDateTime(args.nova_data_hora)}\n\nO agendamento anterior foi cancelado e um novo foi criado.`
      };
    } else {
      return newSchedulingResult;
    }

  } catch (error) {
    console.error('❌ Erro ao reagendar:', error);
    return {
      success: false,
      message: `Erro ao reagendar: ${error.message}`
    };
  }
};

/**
 * Solicita atendimento humano
 */
const executeHumanSupport = async (args, userId, organizationId, phoneNumber) => {
  try {
    console.log('👤 Solicitando atendimento humano:', args);

    // Salvar solicitação no banco para notificar atendentes
    const { error } = await supabase
      .from('human_support_requests')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        customer_name: args.nome,
        customer_phone: args.numero_origem,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Erro ao salvar solicitação:', error);
    }

    return {
      success: true,
      message: `👤 Solicitação de atendimento humano enviada!\n\nOlá ${args.nome}, sua solicitação foi registrada e um atendente entrará em contato em breve.\n\n⏰ Tempo estimado de resposta: 5-10 minutos\n📞 Telefone: ${args.numero_origem}`
    };

  } catch (error) {
    console.error('❌ Erro ao solicitar atendimento humano:', error);
    return {
      success: false,
      message: `Erro ao solicitar atendimento: ${error.message}`
    };
  }
};

// Funções auxiliares
const calculateEndTime = (startTime, durationMinutes) => {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
};

const formatDateTime = (dateTime) => {
  return new Date(dateTime).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getDayName = (day) => {
  const days = {
    sunday: 'domingo',
    monday: 'segunda-feira',
    tuesday: 'terça-feira',
    wednesday: 'quarta-feira',
    thursday: 'quinta-feira',
    friday: 'sexta-feira',
    saturday: 'sábado'
  };
  return days[day] || day;
};

const generateAvailableSlots = (dayConfig, date, durationMinutes) => {
  const slots = [];
  const [startHour, startMinute] = dayConfig.start.split(':').map(Number);
  const [endHour, endMinute] = dayConfig.end.split(':').map(Number);

  const startTime = new Date(date);
  startTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(endHour, endMinute, 0, 0);

  const currentTime = new Date();
  const slotTime = new Date(startTime);

  while (slotTime < endTime) {
    // Não sugerir horários passados
    if (slotTime > currentTime) {
      slots.push(slotTime.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }));
    }
    
    slotTime.setMinutes(slotTime.getMinutes() + durationMinutes);
  }

  return slots;
}; 