# 📦 Módulo de Atendimento Inteligente - ARQUIVADO

## 📅 Data de Arquivamento
Arquivado em: 2024-12-XX

## 📋 Descrição
Este módulo foi temporariamente removido do sistema para simplificar a interface. Todos os componentes, hooks, páginas e tipos relacionados ao módulo de "Atendimento Inteligente" estão preservados aqui para reutilização futura.

## 🗂️ Estrutura dos Arquivos

### Components
- `components/ConfigForm/` - Formulário de configuração de produtos de atendimento
- `components/ProductDashboard/` - Dashboard principal do módulo

### Pages
- `pages/FlowManager.tsx` - Gestão de fluxos de atendimento
- `pages/TeamStrategy.tsx` - Estratégias de distribuição de times
- `pages/ChatManager.tsx` - Gestão de chat
- `pages/PauseManagement.tsx` - Gestão de pausas
- `pages/supervisor/` - Dashboard de supervisor

### Hooks
- `hooks/useConfigs.ts` - Hook para gerenciar configurações
- `hooks/useStrategies.ts` - Hook para gerenciar estratégias

### Flow Builder
- `flow/BlockPaletteSimple.tsx` - Paleta de blocos simplificada
- `flow/FlowCanvasSimple.tsx` - Canvas de fluxo simplificado
- `flow/flowBlocksSimple.ts` - Definição de blocos

### Types
- `types/index.ts` - Tipos TypeScript do módulo

## 🔗 Funcionalidades Incluídas

Este módulo incluía:
- ✅ Dashboard de atendimento inteligente
- ✅ Gestão de fluxos de atendimento automatizado
- ✅ Estratégias de distribuição de atendimentos por times
- ✅ Gestão de chat integrada
- ✅ Gestão de pausas de agentes
- ✅ Dashboard de supervisor

## 🔄 Para Reativar

1. Mover os arquivos de volta para:
   - `src/components/products/intelligent-service/`
   - `src/pages/supervisor/`

2. Descomentar as rotas em `src/pages/Index.tsx`:
   ```typescript
   // Descomentar imports:
   // import ProductDashboard from '@/components/products/intelligent-service/components/ProductDashboard';
   // import FlowManager from '@/components/products/intelligent-service/pages/FlowManager';
   // ... etc

   // Descomentar rotas:
   // <Route path="product-dashboard" element={<ProductDashboard />} />
   // ... etc
   ```

3. Restaurar o menu no `src/components/layout/Sidebar.tsx`:
   ```typescript
   {
     id: 'intelligent-service',
     label: 'Atendimento',
     icon: Brain,
     type: 'expandable',
     children: [
       // ... itens do menu
     ]
   }
   ```

4. Verificar dependências e atualizar hooks/componentes conforme necessário

## ⚠️ Notas Importantes

- O Chat principal (`/chat`) foi mantido no sistema e não faz parte deste arquivo
- As permissões relacionadas (`view_intelligent_service`, `manage_flows`, etc.) podem ainda existir no banco de dados
- Verificar se há migrações do Supabase relacionadas que precisam ser mantidas ou revertidas

## 📝 Histórico

- **Antes**: Menu "Atendimento" com subitens (Dashboard, Dashboard Supervisor, Estratégias de Time, Gestão de Fluxos, Gestão de Chat, Gestão de Pausas, Chat)
- **Depois**: Apenas "Chat" como item direto na sidebar
- **Motivo**: Simplificação da interface e foco nas funcionalidades principais

