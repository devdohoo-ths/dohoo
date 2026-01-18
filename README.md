# 🚀 DOHOO - Sistema de Gestão de Chat e Atendimento

Sistema completo para gerenciamento de conversas, atendimento ao cliente e automação via WhatsApp, com suporte a IA generativa.

---

## 📋 Índice

- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Executando o Projeto](#-executando-o-projeto)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Recursos Principais](#-recursos-principais)
- [Suporte](#-suporte)

---

## 🔧 Requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** v18 ou superior
- **npm** v9 ou superior (ou **yarn**/**pnpm**)
- **Git**
- Conta no **Supabase** (para banco de dados)
- (Opcional) **Redis** (para cache em produção)

---

## 💻 Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd dohoo
```

### 2. Instale as dependências do Backend

```bash
cd backend
npm install
```

### 3. Instale as dependências do Frontend

```bash
cd ../frontend
npm install
```

---

## ⚙️ Configuração

### 1. Configurar Backend

1. **Copie o arquivo de exemplo:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edite o arquivo `.env`** e configure as variáveis necessárias:

   **Obrigatórias:**
   - `SUPABASE_URL` - URL do seu projeto Supabase
   - `SUPABASE_ANON_KEY` - Chave pública do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço do Supabase ⚠️ **CRÍTICO: NUNCA exponha no frontend!**

   **Recomendadas:**
   - `FRONTEND_URL` - URL do frontend (ex: `http://localhost:8080`)
   - `PORT` - Porta do backend (padrão: `3001`)
   - `DEV_TOKEN` - Token de desenvolvimento (apenas para dev/local)

   **Opcionais (APIs de IA):**
   - `OPENAI_API_KEY` - Para funcionalidades de IA
   - `DEEPSEEK_API_KEY` - Alternativa mais barata para IA
   - `ELEVEN_LABS_API_KEY` - Para síntese de voz

   > 📖 **Dica:** Consulte `backend/.env.example` para ver todas as opções disponíveis com descrições detalhadas.

### 2. Configurar Frontend

1. **Copie o arquivo de exemplo:**
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Edite o arquivo `.env`** e configure:

   **Obrigatória:**
   - `VITE_API_BASE` - URL do backend (ex: `http://localhost:3001`)

   **Opcionais:**
   - `VITE_DEBUG_MODE` - Modo debug (padrão: `false`)
   - `VITE_LOG_LEVEL` - Nível de log (padrão: `info`)

   > ⚠️ **IMPORTANTE:** APIs de IA (`OPENAI`, `ELEVEN_LABS`, etc.) devem ser configuradas **APENAS no backend**, não no frontend!

### 3. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá em **Settings > API** e copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

3. Execute as migrações do banco de dados:
   ```bash
   cd backend
   # As migrações estão em: backend/supabase/migrations/
   # Execute conforme necessário através do Supabase Dashboard ou via script
   ```

---

## 🚀 Executando o Projeto

### Desenvolvimento

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Servidor rodando em http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Aplicação rodando em http://localhost:8080 (ou porta configurada)
```

### Produção

**Build do Frontend:**
```bash
cd frontend
npm run build
# Arquivos gerados em: frontend/dist/
```

**Iniciar Backend:**
```bash
cd backend
npm start
```

---

## 📁 Estrutura do Projeto

```
dohoo/
├── backend/                 # API Backend (Node.js + Express)
│   ├── routes/             # Rotas da API
│   ├── services/           # Serviços de negócio
│   ├── middleware/         # Middlewares (auth, etc.)
│   ├── migrations/         # Migrações SQL
│   ├── lib/                # Bibliotecas e configurações
│   ├── scripts/            # Scripts auxiliares
│   ├── server.js           # Servidor principal
│   └── .env.example        # Exemplo de configuração
│
├── frontend/               # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas
│   │   ├── services/      # Serviços frontend
│   │   ├── hooks/         # React Hooks
│   │   └── utils/         # Utilitários
│   ├── public/            # Arquivos estáticos
│   └── .env.example       # Exemplo de configuração
│
└── README.md              # Este arquivo
```

---

## 🎯 Recursos Principais

### ✅ Gestão de Conversas
- Chat em tempo real via WhatsApp
- Histórico de conversas
- Múltiplos canais de comunicação

### 🤖 Inteligência Artificial
- Respostas automáticas com IA
- Assistentes configuráveis
- Suporte a OpenAI, DeepSeek e ChatGPT
- Síntese de voz (ElevenLabs)

### 👥 Gestão de Usuários
- Sistema de autenticação via Supabase
- Perfis e permissões
- Multi-organização

### 📊 Analytics e Relatórios
- Métricas de atendimento
- Relatórios de produtividade
- Dashboards interativos

### 🔐 Segurança
- Autenticação JWT
- Variáveis de ambiente protegidas
- Chaves de API no backend (nunca no frontend)

---

## 🔑 Variáveis de Ambiente Importantes

### Backend (`.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | ✅ Sim | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | ✅ Sim | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Sim | Chave de serviço (CRÍTICO) |
| `FRONTEND_URL` | ⚠️ Recomendada | URL do frontend |
| `PORT` | ❌ Opcional | Porta do backend (padrão: 3001) |
| `OPENAI_API_KEY` | ❌ Opcional | Para funcionalidades de IA |
| `ELEVEN_LABS_API_KEY` | ❌ Opcional | Para síntese de voz |
| `DEV_TOKEN` | ❌ Opcional | Token de desenvolvimento |

### Frontend (`.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_BASE` | ✅ Sim | URL do backend (ex: http://localhost:3001) |
| `VITE_DEBUG_MODE` | ❌ Opcional | Modo debug (true/false) |

> ⚠️ **NUNCA** adicione chaves de API no `.env` do frontend! Elas serão expostas no código.

---

## 🐛 Solução de Problemas

### Erro: "Supabase URL não definida"
- Verifique se o arquivo `.env` existe no diretório `backend/`
- Confirme que `SUPABASE_URL` está configurado corretamente

### Erro: "Token de autorização não fornecido"
- Certifique-se de estar enviando o header `Authorization: Bearer <token>`
- Verifique se `DEV_TOKEN` está configurado (desenvolvimento) ou use autenticação Supabase (produção)

### Frontend não conecta ao Backend
- Verifique se `VITE_API_BASE` está correto no `.env` do frontend
- Confirme que o backend está rodando na porta configurada
- Verifique CORS no backend (variável `CORS_ALLOWED_ORIGINS`)

### Erro ao executar migrações
- Confirme que as credenciais do Supabase estão corretas
- Verifique se o projeto Supabase está ativo
- Consulte os logs para mais detalhes

---

## 📚 Documentação Adicional

- **Backend:** Veja `backend/.env.example` para todas as variáveis de ambiente
- **Frontend:** Veja `frontend/.env.example` para configurações do Vite
- **Supabase:** [Documentação oficial](https://supabase.com/docs)

---

## ⚠️ Segurança

### ✅ Boas Práticas

1. **NUNCA** commite arquivos `.env` no Git
2. **NUNCA** exponha `SERVICE_ROLE_KEY` no frontend
3. Use variáveis de ambiente do servidor em produção
4. Mantenha chaves de API seguras e rotacione periodicamente
5. Use HTTPS em produção

### 🚫 Nunca Faça

- ❌ Adicionar chaves de API no código fonte
- ❌ Usar `SERVICE_ROLE_KEY` no frontend
- ❌ Commitar arquivos `.env`
- ❌ Expor tokens ou credenciais em logs

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📝 Licença

[Adicione informações sobre licença aqui]

---

## 📞 Suporte

Para suporte, dúvidas ou problemas:

- Abra uma issue no repositório
- Entre em contato com a equipe de desenvolvimento

---

## 🎉 Próximos Passos

Após a instalação:

1. ✅ Configure o Supabase e execute as migrações
2. ✅ Configure as variáveis de ambiente
3. ✅ Inicie o backend e frontend
4. ✅ Acesse o sistema no navegador
5. ✅ Crie seu primeiro usuário e organização
6. ✅ Configure conexões WhatsApp (se aplicável)

**Boa sorte com o projeto! 🚀**

---

*Última atualização: 2025-01-15*

