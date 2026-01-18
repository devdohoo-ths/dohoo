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

**Opção A: Instalação Normal (se funcionar)**
```bash
cd backend
npm install
```

**Opção B: Instalação Limpa (recomendado para novas instalações)**

**Windows:**
```bash
cd backend
install-dependencies.bat
```

**Linux/Mac:**
```bash
cd backend
chmod +x install-dependencies.sh
./install-dependencies.sh
```

**Opção C: Instalação Manual Limpa**
```bash
cd backend
# Limpar cache e dependências antigas
npm cache clean --force
rm -rf node_modules package-lock.json  # Linux/Mac
# ou
rmdir /s /q node_modules & del package-lock.json  # Windows

# Reinstalar
npm install
```

> ⚠️ **Se encontrar erros de módulos não encontrados** (como `@supabase/supabase-js`), use a **Opção B** ou **C** para fazer uma instalação limpa.

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

### 3. Configurar Banco de Dados (Supabase)

1. **Crie um projeto no [Supabase](https://supabase.com)**
   - Acesse https://app.supabase.com
   - Crie um novo projeto (se ainda não tiver)

2. **Copie as credenciais do Supabase:**
   - Vá em **Settings > API**
   - Copie os seguintes valores:
     - **Project URL** → `SUPABASE_URL` (ex: `https://xxxxx.supabase.co`)
     - **anon public** key → `SUPABASE_ANON_KEY`
     - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **MANTENHA SEGURO!**

3. **Configure as variáveis no `.env` do backend** (se ainda não fez):
   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```

4. **Execute as migrações do banco de dados:**

   Você tem **3 opções** para criar o banco de dados:

   #### Opção A: Via Supabase Dashboard (Recomendado para primeira vez)

   1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
   2. Vá em **SQL Editor** (menu lateral)
   3. Clique em **New query**
   4. Execute cada arquivo SQL da pasta `backend/supabase/migrations/` **em ordem alfabética**:
      - Comece por: `20240318000000_ai_settings.sql`
      - Continue na ordem: `20241219000001-add-poc-system.sql`, etc.
      - Execute todos os arquivos SQL (aproximadamente 66 arquivos)
   5. Para cada arquivo:
      - Abra o arquivo `.sql` em um editor de texto
      - Copie todo o conteúdo
      - Cole no SQL Editor do Supabase
      - Clique em **Run** (ou `Ctrl+Enter`)

   > ⚠️ **Importante:** Execute as migrações na ordem dos nomes dos arquivos para evitar erros de dependências. As primeiras migrações criam as tabelas base (`organizations`, `profiles`, `chats`, `messages`).

   #### Opção B: Via API do Backend (Automatizado)

   1. Certifique-se de que o backend está configurado (`.env` com credenciais do Supabase)
   2. Inicie o backend:
      ```bash
      cd backend
      npm run dev
      ```
   3. Em outro terminal, execute o setup completo:
      ```bash
      curl -X POST http://localhost:3001/api/database/setup-complete \
        -H "Content-Type: application/json" \
        -d '{
          "connection": {
            "type": "supabase",
            "url": "SUA_SUPABASE_URL",
            "service_role_key": "SUA_SERVICE_ROLE_KEY"
          }
        }'
      ```
      *(Substitua `SUA_SUPABASE_URL` e `SUA_SERVICE_ROLE_KEY` pelos valores do seu `.env`)*

   Ou use uma ferramenta como **Postman** ou **Insomnia** para fazer a requisição POST:
   - **URL:** `http://localhost:3001/api/database/setup-complete`
   - **Method:** `POST`
   - **Headers:** `Content-Type: application/json`
   - **Body (JSON):**
     ```json
     {
       "connection": {
         "type": "supabase",
         "url": "https://seu-projeto.supabase.co",
         "service_role_key": "sua-service-role-key"
       }
     }
     ```

   #### Opção C: Via Script Node.js (Parcial)

   ```bash
   cd backend
   node scripts/apply-migrations.js
   ```

   > ⚠️ **Nota:** Atualmente o script `apply-migrations.js` executa apenas migrações específicas. Para executar todas as migrações, use a **Opção A** ou **Opção B**.

   **Após executar as migrações**, seu banco de dados estará pronto! ✅

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
│   ├── supabase/           # Configurações e migrações Supabase
│   │   └── migrations/     # Migrações SQL (execute todas para criar o banco)
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

### Erro: "Cannot find module" ou módulos não encontrados

**Erro comum:** `Cannot find module '@supabase/supabase-js'` ou similar após `npm install`

**Solução:**

1. **Limpe e reinstale as dependências:**
   ```bash
   cd backend
   npm cache clean --force
   rm -rf node_modules package-lock.json  # Linux/Mac
   # ou no Windows:
   # rmdir /s /q node_modules
   # del package-lock.json
   npm install
   ```

2. **Ou use o script de instalação limpa:**
   ```bash
   cd backend
   # Windows
   install-dependencies.bat
   
   # Linux/Mac
   chmod +x install-dependencies.sh
   ./install-dependencies.sh
   ```

3. **Se o problema persistir:**
   - Verifique se está usando Node.js v18 ou superior: `node --version`
   - Tente instalar com `npm install --legacy-peer-deps`
   - Verifique sua conexão com a internet
   - Certifique-se de ter permissões de escrita na pasta

### Erro ao executar migrações

**Erro: "relation already exists" ou "column already exists"**
- Esses erros são normais quando a migração já foi executada anteriormente
- Continue executando as próximas migrações
- As migrações usam `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS` quando possível

**Erro: "foreign key constraint" ou dependências**
- Certifique-se de executar as migrações em ordem alfabética
- As primeiras migrações criam as tabelas base necessárias
- Se encontrar erros, verifique se todas as migrações anteriores foram executadas

**Erro de conexão ao usar a API (`/api/database/setup-complete`)**
- Confirme que as credenciais do Supabase estão corretas no `.env`
- Verifique se o projeto Supabase está ativo
- Confirme que o `SUPABASE_SERVICE_ROLE_KEY` está correto (não use a `ANON_KEY`)
- Consulte os logs do backend para mais detalhes

**Como verificar se as migrações foram executadas:**
- No Supabase Dashboard, vá em **Table Editor**
- Verifique se as tabelas principais existem: `organizations`, `profiles`, `chats`, `messages`

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

1. ✅ Configure o projeto no Supabase e copie as credenciais
2. ✅ Configure as variáveis de ambiente no `.env` do backend e frontend
3. ✅ **Execute as migrações do banco de dados** (veja seção [Configurar Banco de Dados](#3-configurar-banco-de-dados-supabase))
4. ✅ Inicie o backend (`npm run dev` na pasta `backend`)
5. ✅ Inicie o frontend (`npm run dev` na pasta `frontend`)
6. ✅ Acesse o sistema no navegador (geralmente `http://localhost:8080`)
7. ✅ Crie seu primeiro usuário e organização
8. ✅ Configure conexões WhatsApp (se aplicável)

**Boa sorte com o projeto! 🚀**

---

*Última atualização: 2025-01-15*

