export const tools = [
    {
        "type": "function",
        "function": {
            "name": "verificar_disponibilidade",
            "description": "Verifica disponibilidade na barbearia",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": {
                        "type": "string",
                        "description": "Nome completo do cliente"
                    },
                    "data_hora": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Data e hora desejada para o agendamento (formato ISO 8601)"
                    }
                },
                "required": ["nome", "data_hora"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "sugerir_disponibilidade",
            "description": "Sugere horários disponíveis para agendamento com base na agenda do Google Calendar do cliente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "format": "date",
                        "description": "Data desejada para o agendamento (apenas a data no formato YYYY-MM-DD)"

                    }
                },
                "required": ["data"]
            }
        }
    },


    {
        "type": "function",
        "function": {
            "name": "agendar_google_calendar",
            "description": "Agenda um compromisso no Google Calendar",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": {
                        "type": "string",
                        "description": "Nome da pessoa que está agendando"
                    },
                    "data_hora": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Data e hora desejada para o agendamento (formato ISO 8601)"
                    },
                    "titulo": {
                        "type": "string",
                        "description": "Título do compromisso, geralmente o tipo de serviço"
                    },
                    "local": {
                        "type": "string",
                        "description": "Local onde será realizado o compromisso, ex: Nome da barbearia"
                    },
                    "duracao": {
                        "type": "string",
                        "description": "Duração do serviço (ex: '30m', '1h')"
                    }
                },
                "required": ["nome", "data_hora", "titulo", "local", "duracao"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancelar_agendamento",
            "description": "Cancela um compromisso agendado",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": { "type": "string" },
                    "data_hora": { 
                        "type": "string",
                        "format": "date-time",
                        "description": "Data e hora desejada para o agendamento (formato ISO 8601)"
                    },
                },
                "required": ["nome", "data_hora"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "solicitar_reagendamento",
            "description": "Recebe a nova data desejada pelo cliente para reagendar um evento",
            "parameters": {
                "type": "object",
                "properties": {
                    "data_hora": { 
                        "type": "string",
                        "format": "date-time", 
                        "description": "data e hora desejada para o agendamento (formato ISO 8601)"
                    },
                    "nova_data_hora": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Nova data e hora desejada para o agendamento (formato ISO 8601)"
                    }
                },
                "required": ["data_hora", "nova_data_hora"]
            }
        }
    },
     {
        "type": "function",
        "function": {
            "name": "atendimento_humano",
            "description": "falar com o atendente",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": { "type": "string" },
                    "numero_origem": { "type": "string" }
                },
                "required": ["nome", "numero_origem"]
            }
        }
    }
];
