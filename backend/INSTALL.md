# 🔧 Guia de Instalação - Backend DOHOO

Este guia ajuda a resolver problemas comuns de instalação de dependências.

## ⚠️ Problema Comum: Módulos Não Encontrados

Se você encontrar erros como:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '@supabase/supabase-js/dist/index.mjs'
```

Isso geralmente acontece quando:
- O `node_modules` está corrompido
- O `package-lock.json` está desatualizado
- Há conflitos de cache do npm
- Dependências foram instaladas parcialmente

## ✅ Solução Rápida

### Windows

1. **Execute o script de instalação automática:**
   ```bash
   cd backend
   install-dependencies.bat
   ```

2. **Ou manualmente:**
   ```powershell
   cd backend
   npm cache clean --force
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
   Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
   npm install
   ```

### Linux/Mac

1. **Execute o script de instalação automática:**
   ```bash
   cd backend
   chmod +x install-dependencies.sh
   ./install-dependencies.sh
   ```

2. **Ou manualmente:**
   ```bash
   cd backend
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## 🔄 Scripts Disponíveis

### `npm run install:clean`
Limpa e reinstala todas as dependências do zero.

### `npm run verify`
Verifica se `@supabase/supabase-js` está instalado corretamente.

## 📋 Checklist de Verificação

Após a instalação, verifique:

- [ ] `node_modules` existe e contém as pastas das dependências
- [ ] `package-lock.json` foi gerado
- [ ] Não há erros no terminal
- [ ] Execute `npm run verify` para confirmar que o Supabase está instalado

## 🐛 Problemas Persistentes

Se o problema continuar:

1. **Verifique a versão do Node.js:**
   ```bash
   node --version
   ```
   Deve ser v18 ou superior.

2. **Tente instalar com flags alternativas:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Verifique permissões:**
   - Certifique-se de ter permissões de escrita na pasta
   - No Windows, pode ser necessário executar como Administrador

4. **Limpe o cache global do npm:**
   ```bash
   npm cache clean --force --global
   ```

## 📞 Suporte

Se nada funcionar:
1. Verifique os logs de erro completos
2. Confirme que todas as variáveis de ambiente estão configuradas
3. Verifique a conexão com a internet
4. Abra uma issue no repositório com os logs de erro

