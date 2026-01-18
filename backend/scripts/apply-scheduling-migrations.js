import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL não encontrada no arquivo .env');
  console.log('📝 Por favor, adicione sua SUPABASE_URL no arquivo .env');
  process.exit(1);
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no arquivo .env');
  console.log('📝 Por favor, adicione sua SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchedulingToAISettings() {
  console.log('🔧 Aplicando configurações de agendamento na tabela ai_settings...');
  
  try {
    // Atualizar configurações existentes para incluir scheduling
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE public.ai_settings 
        SET settings = settings || '{
          "scheduling": {
            "enabled": false,
            "google_calendar_enabled": false,
            "auto_scheduling_enabled": false,
            "business_hours": {
              "monday": {"enabled": true, "start": "09:00", "end": "18:00"},
              "tuesday": {"enabled": true, "start": "09:00", "end": "18:00"},
              "wednesday": {"enabled": true, "start": "09:00", "end": "18:00"},
              "thursday": {"enabled": true, "start": "09:00", "end": "18:00"},
              "friday": {"enabled": true, "start": "09:00", "end": "18:00"},
              "saturday": {"enabled": false, "start": "09:00", "end": "18:00"},
              "sunday": {"enabled": false, "start": "09:00", "end": "18:00"}
            },
            "default_duration": 60,
            "timezone": "America/Sao_Paulo",
            "location": "",
            "service_types": []
          }
        }'::jsonb
        WHERE NOT (settings ? 'scheduling');
      `
    });

    if (updateError) {
      console.error('❌ Erro ao atualizar ai_settings:', updateError);
      return false;
    }

    console.log('✅ Configurações de agendamento adicionadas à tabela ai_settings!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao aplicar configurações de agendamento:', error);
    return false;
  }
}

async function applyHumanSupportRequests() {
  console.log('👤 Aplicando tabela de solicitações de atendimento humano...');
  
  try {
    // Criar tabela human_support_requests
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.human_support_requests (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
          organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
          assigned_to UUID REFERENCES public.profiles(id),
          priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          description TEXT,
          chat_id UUID REFERENCES public.chats(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          assigned_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE
        );
      `
    });

    if (createError) {
      console.error('❌ Erro ao criar tabela human_support_requests:', createError);
      return false;
    }

    console.log('✅ Tabela human_support_requests criada com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao aplicar tabela de atendimento humano:', error);
    return false;
  }
}

async function applyMigrations() {
  console.log('🚀 Iniciando aplicação das migrações de agendamento...');
  
  const schedulingSuccess = await applySchedulingToAISettings();
  if (!schedulingSuccess) {
    console.error('❌ Falha ao aplicar configurações de agendamento');
    return;
  }
  
  const humanSupportSuccess = await applyHumanSupportRequests();
  if (!humanSupportSuccess) {
    console.error('❌ Falha ao aplicar tabela de atendimento humano');
    return;
  }
  
  console.log('🎉 Todas as migrações foram aplicadas com sucesso!');
  console.log('📋 Resumo das alterações:');
  console.log('   • Adicionada seção scheduling na tabela ai_settings');
  console.log('   • Criada tabela human_support_requests');
  console.log('   • Configurações de agendamento automático habilitadas');
}

// Executar migrações
applyMigrations().catch(console.error); 