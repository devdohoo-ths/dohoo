import { 
  MonitoringRule, 
  RuleReportResponse, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  ProcessHistoricalRequest,
  ProcessHistoricalResponse
} from '../types/rules';
import { apiBase, getAuthHeaders } from '../utils/apiBase';

export class RulesService {
  // Listar regras
  static async getRules(userId?: string): Promise<MonitoringRule[]> {
    try {
      // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono em vez de getAuthHeadersSync
      const headers = await getAuthHeaders();
      console.log('🔍 [RulesService] Headers de autenticação obtidos');
      
      const response = await fetch(`${apiBase}/api/rules`, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 [RulesService] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [RulesService] Erro na resposta:', errorText);
        
        // ✅ CORREÇÃO: Verificar se a resposta é HTML (erro do Cloudflare/Supabase)
        if (errorText.includes('<!DOCTYPE html>') || errorText.includes('Internal server error')) {
          throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns instantes.');
        }
        
        // Tentar parsear como JSON se possível
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorText;
        } catch {
          // Se não for JSON, usar o texto como está
        }
        
        throw new Error(`Erro ao carregar regras: ${response.status} - ${errorMessage.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('✅ [RulesService] Dados recebidos:', data);
      return data.rules || [];
    } catch (error) {
      console.error('❌ [RulesService] Erro ao buscar regras:', error);
      throw error;
    }
  }

  // Criar regra
  static async createRule(rule: CreateRuleRequest, userId?: string): Promise<MonitoringRule> {
    // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono
    const headers = await getAuthHeaders();
    console.log('🔍 [RulesService] Criando regra');
    
    const response = await fetch(`${apiBase}/api/rules`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rule)
    });

    console.log('🔍 [RulesService] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [RulesService] Erro na resposta:', errorText);
      throw new Error(`Erro ao criar regra: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ [RulesService] Regra criada:', data);
    return data.rule;
  }

  // Atualizar regra
  static async updateRule(id: string, rule: UpdateRuleRequest, userId?: string): Promise<MonitoringRule> {
    // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${apiBase}/api/rules/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rule)
    });

    if (!response.ok) {
      throw new Error('Erro ao atualizar regra');
    }

    const data = await response.json();
    return data.rule;
  }

  // Deletar regra
  static async deleteRule(id: string, userId?: string): Promise<void> {
    // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${apiBase}/api/rules/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao deletar regra');
    }
  }

  // Gerar relatório
  static async generateReport(
    dateStart: string, 
    dateEnd: string, 
    ruleId?: string,
    userId?: string
  ): Promise<RuleReportResponse> {
    // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${apiBase}/api/rules/report`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dateStart, dateEnd, ruleId })
    });

    if (!response.ok) {
      throw new Error('Erro ao gerar relatório');
    }

    return response.json();
  }

  // Processar dados históricos
  static async processHistorical(
    request: ProcessHistoricalRequest,
    userId?: string
  ): Promise<ProcessHistoricalResponse> {
    // ✅ CORREÇÃO: Usar getAuthHeaders assíncrono
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${apiBase}/api/rules/process-historical`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('Erro ao processar dados históricos');
    }

    return response.json();
  }
} 