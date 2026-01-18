import { google } from 'googleapis';
import { getOAuthClient } from './googleAuthService.js';
import { supabase } from '../../lib/supabaseClient.js';

// Função para criar evento
export const createEvent = async (userId, organizationId, clientPhoneNumber, eventData) => {
  try {
    console.log('📅 Criando evento no Google Calendar...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Garantir que as datas tenham o mesmo formato (com timezone)
    const checkStartDateTime = new Date(eventData.start.dateTime).toISOString();
    const checkEndDateTime = new Date(eventData.end.dateTime).toISOString();

    console.log('🔍 Verificando disponibilidade para:', checkStartDateTime, 'até', checkEndDateTime);

    // Verifica se horário está disponível
    const busyCheck = await calendar.freebusy.query({
      requestBody: {
        timeMin: checkStartDateTime,
        timeMax: checkEndDateTime,
        timeZone: 'America/Sao_Paulo',
        items: [{ id: 'primary' }]
      }
    });

    console.log('📊 Resposta do freebusy.query:', busyCheck.data);

    const busySlots = busyCheck.data.calendars?.primary?.busy;
    if (busySlots && busySlots.length > 0) {
      throw new Error('Horário já está ocupado na agenda do Google Calendar.');
    }

    // Se o horário estiver disponível, cria o evento
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventData,
    });

    if (!event.data || !event.data.id) {
      throw new Error('Falha ao criar evento no Google Calendar.');
    }

    const { 
      id: googleEventId, 
      start: { dateTime: eventStartDateTime }, 
      end: { dateTime: eventEndDateTime }, 
      summary = '', 
      description = '', 
      location = '', 
      creator: { email: userEmail = '' } = {} 
    } = event.data;

    if (!userEmail) {
      throw new Error('Email do criador do evento é obrigatório.');
    }

    // Salvar no banco de dados
    const { data: savedEvent, error } = await supabase
      .from('google_calendar_events')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        google_event_id: googleEventId,
        client_phone_number: clientPhoneNumber,
        user_email: userEmail,
        start_date_time: eventStartDateTime,
        end_date_time: eventEndDateTime,
        summary,
        description,
        location,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar evento no banco:', error);
      // Tentar deletar o evento do Google se falhar ao salvar no banco
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: googleEventId,
        });
      } catch (deleteError) {
        console.error('❌ Erro ao deletar evento do Google após falha no banco:', deleteError);
      }
      throw new Error('Erro ao salvar evento no banco de dados');
    }

    console.log('✅ Evento criado com sucesso:', savedEvent.id);
    return { ...event.data, db_id: savedEvent.id };
  } catch (error) {
    console.error('❌ Erro ao criar evento:', error);
    throw new Error(error.message || 'Erro ao criar evento no Google Calendar');
  }
};

// Função para verificar a disponibilidade
export const checkAvailability = async (userId, organizationId, startDate, endDate) => {
  try {
    console.log('🔍 Verificando disponibilidade...');
    
    // Corrige as datas, se vierem como objetos { dateTime: '...' }
    startDate = new Date(startDate?.dateTime || startDate).toISOString();
    endDate = new Date(endDate?.dateTime || endDate).toISOString();

    // Obtém o cliente OAuth2 configurado com os tokens do usuário
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    const response = await calendarApi.events.list({
      calendarId: 'primary',
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    const isAvailable = events.length === 0; // Se não tem evento, está disponível

    console.log(`✅ Disponibilidade verificada: ${isAvailable ? 'Disponível' : 'Ocupado'}`);
    return isAvailable;
  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error.message || error);
    throw new Error('Erro ao verificar disponibilidade');
  }
};

// Sugerir horários disponíveis para o cliente
export const suggestAvailableSlots = async (userId, organizationId, startDate) => {
  try {
    console.log('💡 Sugerindo horários disponíveis...');
    const now = new Date();

    // Se o cliente só passar a data (ex: "2025-05-17")
    if (!startDate) {
      throw new Error("Por favor, informe uma data.");
    }

    // Se vier como string, ajusta para 09:00 e 18:00
    const day = new Date(startDate);
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);

    const end = new Date(day);
    end.setHours(18, 0, 0, 0);

    if (end < now) {
      throw new Error("Data inválida. Por favor, selecione uma data a partir de hoje.");
    }

    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    const response = await calendarApi.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;

    const busySlots = events.map(event => ({
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date),
    }));

    const suggestions = [];
    let current = new Date(start);

    while (current < end && suggestions.length < 3) {
      const nextHour = new Date(current.getTime() + 60 * 60 * 1000);

      const isBusy = busySlots.some(slot =>
        current < slot.end && nextHour > slot.start
      );

      if (!isBusy) {
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        suggestions.push({
          start: current.toISOString(),
          end: nextHour.toISOString(),
          display: `${formatter.format(current)} - ${formatter.format(nextHour)}`
        });
      }

      current = nextHour;
    }

    console.log(`✅ ${suggestions.length} horários sugeridos`);
    return suggestions;

  } catch (error) {
    console.error('❌ Erro ao sugerir horários:', error.message || error);
    throw new Error('Erro ao sugerir horários disponíveis');
  }
};

// Função para reagendar um evento
export const rescheduleEvent = async (userId, organizationId, eventId, newStartDate, newEndDate) => {
  try {
    console.log('🔄 Reagendando evento...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Verifica se o horário novo está disponível
    const busyCheck = await calendarApi.freebusy.query({
      requestBody: {
        timeMin: newStartDate,
        timeMax: newEndDate,
        timeZone: 'America/Sao_Paulo',
        items: [{ id: 'primary' }]
      }
    });

    const busySlots = busyCheck.data.calendars?.primary?.busy;

    if (busySlots && busySlots.length > 0) {
      throw new Error('Novo horário está ocupado na agenda do Google Calendar.');
    }

    // Busca o evento existente
    const event = await calendarApi.events.get({
      calendarId: 'primary',
      eventId,
    });

    // Atualiza as datas
    event.data.start.dateTime = newStartDate;
    event.data.end.dateTime = newEndDate;

    const updatedEvent = await calendarApi.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event.data,
    });

    // Atualiza no banco
    const { error } = await supabase
      .from('google_calendar_events')
      .update({
        start_date_time: newStartDate,
        end_date_time: newEndDate,
        status: 'rescheduled'
      })
      .eq('google_event_id', eventId);

    if (error) {
      console.error('❌ Erro ao atualizar evento no banco:', error);
    }

    console.log('✅ Evento reagendado com sucesso');
    return updatedEvent.data;
  } catch (error) {
    console.error('❌ Erro ao reagendar evento:', error.message || error);
    throw new Error('Erro ao reagendar evento');
  }
};

// Função para listar eventos
export const listEvents = async (userId, organizationId, startDate, endDate) => {
  try {
    console.log('📋 Listando eventos...');
    startDate = new Date(startDate?.dateTime || startDate).toISOString();
    endDate = new Date(endDate?.dateTime || endDate).toISOString();

    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    const response = await calendarApi.events.list({
      calendarId: 'primary',
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    console.log(`✅ ${events.length} eventos encontrados`);

    return events.length ? events : { message: 'Nenhum evento encontrado' };
  } catch (error) {
    console.error('❌ Erro ao listar eventos:', error.message || error);
    throw new Error('Erro ao listar eventos');
  }
};

// Função para cancelar um evento
export const cancelEvent = async (userId, organizationId, eventId) => {
  try {
    console.log('❌ Cancelando evento...');
    const oAuth2Client = await getOAuthClient(userId, organizationId, 'calendar');
    const calendarApi = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Verifica se o evento existe no banco de dados
    const { data: event, error: dbError } = await supabase
      .from('google_calendar_events')
      .select('*')
      .eq('google_event_id', eventId)
      .single();

    if (dbError || !event) {
      console.log("Evento não foi encontrado no banco!");
      throw new Error('Evento não encontrado no banco de dados.');
    }

    // Tenta excluir o evento na agenda do Google
    await calendarApi.events.delete({
      calendarId: 'primary',
      eventId,
    });

    // Exclui o evento do banco de dados
    const { error: deleteError } = await supabase
      .from('google_calendar_events')
      .delete()
      .eq('google_event_id', eventId);

    if (deleteError) {
      console.warn(`Erro ao deletar evento do banco: ${deleteError}`);
      throw new Error('Falha ao excluir o evento do banco de dados.');
    }

    console.log('✅ Evento cancelado com sucesso');
    return { message: 'Evento cancelado com sucesso' };
  } catch (error) {
    console.error('❌ Erro ao cancelar evento:', error.message || error);
    throw new Error(`Erro ao cancelar evento: ${error.message || error}`);
  }
};

// Função para enviar alerta de confirmação
export const sendConfirmationAlert = async (userEmail, eventId) => {
  console.log(`📧 Enviando alerta de confirmação para ${userEmail} sobre o evento ${eventId}`);
  // Aqui você pode integrar com um serviço de envio de e-mail
  // Como o nodemailer para enviar um e-mail de confirmação
  return { success: true, message: 'Alerta enviado' };
};

// Função para listar eventos do banco de dados
export const listStoredEvents = async (userId, organizationId, status = null) => {
  try {
    console.log('📋 Listando eventos armazenados...');
    
    let query = supabase
      .from('google_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .order('start_date_time', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    console.log(`✅ ${data.length} eventos encontrados no banco`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao listar eventos armazenados:', error);
    throw error;
  }
};

// Função para buscar evento por ID do Google
export const getEventByGoogleId = async (userId, organizationId, googleEventId) => {
  try {
    console.log('🔍 Buscando evento por ID do Google...');
    
    const { data, error } = await supabase
      .from('google_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('google_event_id', googleEventId)
      .single();

    if (error) throw error;
    
    console.log('✅ Evento encontrado:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Erro ao buscar evento:', error);
    throw error;
  }
};
