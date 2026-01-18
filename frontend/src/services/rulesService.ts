import { 
  MonitoringRule, 
  RuleReportResponse, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  ProcessHistoricalRequest,
  ProcessHistoricalResponse
} from '../types/rules';
import { apiBase, getAuthHeadersSync } from '../utils/apiBase';

export class RulesService {
  // Listar regras
  static async getRules(userId?: string): Promise<MonitoringRule[]> {
    try {
      const headers = getAuthHeadersSync(userId);
      console.log('🔍 [RulesService] Headers de autenticação:', headers);
      
      const response = await fetch(`${apiBase}/api/rules`, {
        method: 'GET',
        headers: {
          ...headers
          // ✅ CORREÇÃO: Remover x-user-id hardcoded
        }
      });

      console.log('🔍 [RulesService] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [RulesService] Erro na resposta:', errorText);
        throw new Error(`Erro ao carregar regras: ${response.status} - ${errorText}`);
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
    const headers = getAuthHeadersSync(userId);
    console.log('🔍 [RulesService] Criando regra com headers:', headers);
    
    const response = await fetch(`${apiBase}/api/rules`, {
      method: 'POST',
      headers: {
        ...headers
        // ✅ CORREÇÃO: Remover x-user-id hardcoded
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
    const headers = getAuthHeadersSync(userId);
    
    const response = await fetch(`${apiBase}/api/rules/${id}`, {
      method: 'PUT',
      headers: {
        ...headers
        // ✅ CORREÇÃO: Remover x-user-id hardcoded
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
    const headers = getAuthHeadersSync(userId);
    
    const response = await fetch(`${apiBase}/api/rules/${id}`, {
      method: 'DELETE',
      headers: {
        ...headers
        // ✅ CORREÇÃO: Remover x-user-id hardcoded
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
    const headers = getAuthHeadersSync(userId);
    
    const response = await fetch(`${apiBase}/api/rules/report`, {
      method: 'POST',
      headers: {
        ...headers
        // ✅ CORREÇÃO: Remover x-user-id hardcoded
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
    const headers = getAuthHeadersSync(userId);
    
    const response = await fetch(`${apiBase}/api/rules/process-historical`, {
      method: 'POST',
      headers: {
        ...headers
        // ✅ CORREÇÃO: Remover x-user-id hardcoded
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('Erro ao processar dados históricos');
    }

    return response.json();
  }
} 