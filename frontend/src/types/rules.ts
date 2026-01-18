export interface MonitoringRule {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  keywords: string[];
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RuleOccurrence {
  id: string;
  rule_id: string;
  chat_id: string;
  message_id: string;
  matched_keyword: string;
  message_content: string;
  message_timestamp: string;
  customer_name?: string;
  customer_phone?: string;
  agent_name?: string;
  created_at: string;
  rule?: {
    name: string;
  };
  chat?: {
    name: string;
    whatsapp_jid: string;
  };
  message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
}

export interface RuleReportData {
  id: string;
  rule_name: string;
  matched_keyword: string;
  customer_name: string;
  customer_phone: string;
  agent_name: string;
  message_content: string;
  message_timestamp: string;
  chat_id: string;
  message_id: string;
}

export interface RuleReportResponse {
  success: boolean;
  occurrences: RuleReportData[];
  total: number;
}

export interface CreateRuleRequest {
  name: string;
  keywords: string[];
  description?: string;
}

export interface UpdateRuleRequest {
  name: string;
  keywords: string[];
  description?: string;
  is_active: boolean;
}

export interface ProcessHistoricalRequest {
  dateStart: string;
  dateEnd: string;
}

export interface ProcessHistoricalResponse {
  success: boolean;
  message: string;
  processed: number;
} 