// Configuração da API com fallback inteligente
const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

// ✅ CORREÇÃO: Detectar domínio atual em produção
const getCurrentDomain = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'https://dohoo.com.br'; // Fallback padrão
};

const DNS_URL = import.meta.env.VITE_API_BASE || getCurrentDomain();
const LOCALHOST_URL = 'http://localhost:3001';

// Detectar se o frontend está rodando localmente (localhost ou 127.0.0.1)
const runningOnLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local'));

// Escolher URL base inicial
// - Em produção: sempre DNS
// - Em desenvolvimento: se rodando localmente, usar localhost direto; senão, manter DNS com fallback
let API_BASE_URL = DNS_URL;

if (isDevelopment && runningOnLocalhost) {
  API_BASE_URL = LOCALHOST_URL;
}

// Fallback garantido
const FALLBACK_URL = LOCALHOST_URL;

// Cache para armazenar se o DNS está disponível
let dnsAvailable: boolean | null = null;
let dnsCheckPromise: Promise<boolean> | null = null;

// Função para verificar se o DNS está acessível (sem fazer requisição real)
async function checkDNSAvailability(): Promise<boolean> {
  if (dnsAvailable !== null) return dnsAvailable;
  
  if (dnsCheckPromise) return dnsCheckPromise;
  
  dnsCheckPromise = (async () => {
    try {
      // Fazer uma requisição HEAD rápida para verificar conectividade
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      
      const response = await fetch(`${DNS_URL}/api/health`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Evita erro de CORS na verificação
      });
      
      clearTimeout(timeoutId);
      dnsAvailable = true;
      return true;
    } catch (error) {
      // Se falhar (CORS, timeout, network), assumir que não está disponível
      dnsAvailable = false;
      return false;
    }
  })();
  
  return dnsCheckPromise;
}

// Função para obter a URL base real (com fallback automático)
export async function getApiBaseUrl(): Promise<string> {
  // Em produção, sempre usar DNS
  if (!isDevelopment) {
    return DNS_URL;
  }
  
  // Em desenvolvimento, verificar se DNS está disponível
  // Mas não bloquear - usar DNS por padrão e deixar fallback acontecer nas requisições
  return API_BASE_URL;
}

// Variável para armazenar a URL atual (pode mudar após fallback)
// ✅ CORREÇÃO: Inicializar com a URL correta desde o início
let currentApiBase = API_BASE_URL;

// Função para atualizar a URL base atual (usado após fallback)
export function setApiBase(url: string) {
  updateExportedApiBase(url);
}

// Função para obter URL base atual (usada por Socket.IO e outros)
export function getCurrentApiBase(): string {
  return currentApiBase;
}

// URL base síncrona (para compatibilidade)
// Exportado como variável mutável para permitir atualização após fallback
// Socket.IO e outros usam esta variável diretamente
// ✅ CORREÇÃO: Inicializar com a URL correta desde o início
export let apiBase: string = API_BASE_URL;

// Função helper para atualizar apiBase exportado (chamada internamente após fallback)
function updateExportedApiBase(url: string) {
  currentApiBase = url;
  apiBase = url; // Atualizar também a exportação para compatibilidade
}

// Interceptor global para detectar erros de CORS e token expirado
let corsDetected = false;
if (typeof window !== 'undefined') {
  // Adicionar listener global para detectar erros de CORS e token em fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isApiRequest = urlString && (urlString.includes(currentApiBase) || urlString.includes(DNS_URL));
    
    try {
      const response = await originalFetch(input, init);
      
      // Verificar se a resposta foi bloqueada por CORS (status 0 ou erro silencioso)
      if (isApiRequest && isDevelopment && !corsDetected && currentApiBase !== FALLBACK_URL) {
        if (response.status === 0 || (response.type === 'opaque' && urlString.includes(DNS_URL))) {
          console.warn(`⚠️ [API] CORS detectado (status 0), mudando para ${FALLBACK_URL}`);
          corsDetected = true;
          updateExportedApiBase(FALLBACK_URL);
          
          // Tentar novamente com localhost
          if (urlString.includes(DNS_URL)) {
            const newUrl = urlString.replace(DNS_URL, FALLBACK_URL);
            return originalFetch(newUrl, init);
          }
        }
      }
      
      // Verificar se é erro de token expirado (403 ou 401) em requisições da API
      if (isApiRequest && !response.ok && (response.status === 401 || response.status === 403)) {
        try {
          const errorData = await response.clone().text();
          let errorMessage = '';
          try {
            const errorJson = JSON.parse(errorData);
            errorMessage = errorJson.error || errorData;
          } catch {
            errorMessage = errorData;
          }
          
          const isTokenError = response.status === 401 || 
            (response.status === 403 && (
              errorMessage.includes('Token inválido') || 
              errorMessage.includes('Token expirado') ||
              errorMessage.includes('token expirado') ||
              errorMessage.includes('token inválido')
            ));
          
          if (isTokenError) {
            console.warn('⚠️ [API Interceptor] Token expirado detectado, tentando refresh...');
            
            // Tentar fazer refresh do token via backend
            try {
              const storedSession = localStorage.getItem('auth_session');
              const session = storedSession ? JSON.parse(storedSession) : null;
              
              if (session?.refresh_token) {
                const refreshResponse = await fetch(`${currentApiBase}/api/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_token: session.refresh_token })
                });

                if (refreshResponse.ok) {
                  const data = await refreshResponse.json();
                  if (data.success && data.session?.access_token && init) {
                    // Salvar nova sessão
                    localStorage.setItem('auth_session', JSON.stringify(data.session));
                    
                    // Atualizar o header Authorization com o novo token
                    const newHeaders = new Headers(init.headers);
                    newHeaders.set('Authorization', `Bearer ${data.session.access_token}`);
                    
                    // Tentar novamente a requisição
                    const retryResponse = await originalFetch(input, {
                      ...init,
                      headers: newHeaders
                    });
                    
                    if (retryResponse.ok) {
                      return retryResponse;
                    }
                  }
                }
              }
            } catch (refreshError) {
              console.error('❌ [API Interceptor] Erro ao tentar renovar token:', refreshError);
            }
            
                // Se o refresh falhou, limpar sessão e redirecionar para login
                console.warn('⚠️ [API Interceptor] Não foi possível renovar o token, redirecionando para login');
                localStorage.removeItem('auth_session');
                localStorage.removeItem('user_data');
                sessionStorage.clear();
                window.location.href = '/login';
          }
        } catch (parseError) {
          // Se não conseguir parsear o erro, continuar normalmente
        }
      }
      
      return response;
    } catch (error: any) {
      // Se for erro de CORS/network e estivermos em desenvolvimento
      if (isApiRequest && isDevelopment && !corsDetected && currentApiBase !== FALLBACK_URL) {
        const isCorsError = 
          error?.message?.includes('CORS') ||
          error?.message?.includes('Failed to fetch') ||
          error?.name === 'TypeError' ||
          error?.code === 'ERR_FAILED' ||
          error?.code === 'ERR_NETWORK';
        
        if (isCorsError) {
          console.warn(`⚠️ [API] CORS detectado em requisição, mudando para ${FALLBACK_URL}`);
          corsDetected = true;
          updateExportedApiBase(FALLBACK_URL);
          
          // Tentar novamente com localhost se a URL contém a base anterior
          if (urlString && urlString.includes(DNS_URL)) {
            const newUrl = urlString.replace(DNS_URL, FALLBACK_URL);
            try {
              return await originalFetch(newUrl, init);
            } catch (retryError) {
              // Se o retry também falhar, lançar o erro original
            }
          }
        }
      }
      throw error;
    }
  };
}

// Logs de configuração removidos para reduzir poluição no console
// Para debug, descomente as linhas abaixo:
// console.log('🔧 [API Config] Base URL configurada:', API_BASE_URL);
// console.log('🔧 [API Config] DNS URL:', DNS_URL);
// console.log('🔧 [API Config] Fallback URL:', FALLBACK_URL);
// console.log('🔧 [API Config] Modo:', import.meta.env.MODE);

// ✅ EXPORTAR: Função para obter headers de autenticação via backend
export const getAuthHeaders = async () => {
    try {
        // 1. Tentar obter token do localStorage
        const storedSession = localStorage.getItem('auth_session');
        if (storedSession) {
            try {
                const session = JSON.parse(storedSession);
                // Verificar se token ainda é válido (com margem de 5 minutos)
                const expiresAt = session.expires_at || 0;
                const now = Date.now() / 1000;
                
                if (session.access_token && expiresAt > now + 300) {
                    return {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    };
                }
            } catch (e) {
                // Se erro ao parsear, continuar para refresh
            }
        }

        // 2. Se expirado ou não existe, tentar fazer refresh via backend
        try {
            const storedSession = localStorage.getItem('auth_session');
            const session = storedSession ? JSON.parse(storedSession) : null;
            
            if (session?.refresh_token) {
                const response = await fetch(`${currentApiBase}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: session.refresh_token })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.session) {
                        localStorage.setItem('auth_session', JSON.stringify(data.session));
                        return {
                            'Authorization': `Bearer ${data.session.access_token}`,
                            'Content-Type': 'application/json'
                        };
                    }
                }
            }
        } catch (refreshError) {
            console.error('❌ [API] Erro ao fazer refresh do token:', refreshError);
        }

        // 3. Se tudo falhar, verificar se existe sessão via /api/auth/session
        try {
            const storedSession = localStorage.getItem('auth_session');
            const session = storedSession ? JSON.parse(storedSession) : null;
            
            if (session?.access_token) {
                // Tentar validar a sessão atual
                const response = await fetch(`${currentApiBase}/api/auth/session`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    // Sessão ainda válida, retornar headers
                    return {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    };
                }
            }
        } catch (sessionError) {
            console.error('❌ [API] Erro ao verificar sessão:', sessionError);
        }

        // 4. Se tudo falhar, redirecionar para login
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user_data');
        sessionStorage.clear();
        
        // Não redirecionar automaticamente aqui, deixar o componente fazer isso
        throw new Error('Sessão não encontrada ou expirada - usuário não está logado');
    } catch (error) {
        console.error('❌ [API] Erro ao obter headers de autenticação:', error);
        throw error;
    }
};

// ✅ EXPORTAR: Função para obter headers com usuário específico
export const getAuthHeadersWithUser = async (userIdOrUser?: string | any) => {
    try {
        const headers = await getAuthHeaders();
        
        let userId: string | undefined;
        
        // Se o primeiro parâmetro for um objeto user, extrair o ID
        if (userIdOrUser && typeof userIdOrUser === 'object' && userIdOrUser.id) {
            userId = userIdOrUser.id;
        } else if (typeof userIdOrUser === 'string') {
            userId = userIdOrUser;
        }
        
        if (userId) {
            return {
                ...headers,
                'x-user-id': userId
            } as Record<string, string>;
        }
        
        return headers;
    } catch (error) {
        console.error('❌ [API] Erro ao obter headers com usuário:', error);
        throw error;
    }
};

// ✅ EXPORTAR: Função síncrona para compatibilidade (fallback)
export const getAuthHeadersSync = (userId?: string) => {
    // Para desenvolvimento, usar token fixo
    const headers: Record<string, string> = {
        'Authorization': 'Bearer dohoo_dev_token_2024',
        'Content-Type': 'application/json'
    };
    
    // Se userId for fornecido, adicionar header x-user-id
    if (userId) {
        headers['x-user-id'] = userId;
    }
    
    return headers;
};

// Função genérica para fazer requisições autenticadas com fallback automático
const apiRequest = async (url: string, options: RequestInit = {}, triedFallback: boolean = false) => {
    try {
        // Obter headers de autenticação
        const authHeaders = await getAuthHeaders();
        
        // Configurar requisição
        const config: RequestInit = {
            ...options,
            headers: {
                ...authHeaders,
                ...options.headers
            }
        };

        // Tentar com a URL base atual
        const baseUrl = triedFallback ? FALLBACK_URL : currentApiBase;
        
        const response = await fetch(`${baseUrl}${url}`, config);
        
        // Verificar se a resposta é válida
        if (!response.ok) {
            const errorData = await response.text();
            let errorMessage = '';
            try {
                const errorJson = JSON.parse(errorData);
                errorMessage = errorJson.error || errorData;
            } catch {
                errorMessage = errorData;
            }
            
            console.error('❌ [API] Erro na requisição:', {
                status: response.status,
                statusText: response.statusText,
                error: errorMessage,
                url: baseUrl
            });
            
            // Se for erro 401 ou 403 com mensagem de token expirado, tentar refresh e redirecionar
            const isTokenError = response.status === 401 || 
                (response.status === 403 && (
                    errorMessage.includes('Token inválido') || 
                    errorMessage.includes('Token expirado') ||
                    errorMessage.includes('token expirado') ||
                    errorMessage.includes('token inválido')
                ));
            
            if (isTokenError) {
                console.warn('⚠️ [API] Token expirado ou inválido detectado, tentando refresh...');
                
                // Tentar fazer refresh do token antes de redirecionar
                try {
                    const storedSession = localStorage.getItem('auth_session');
                    const session = storedSession ? JSON.parse(storedSession) : null;
                    
                    if (session?.refresh_token) {
                        const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refresh_token: session.refresh_token })
                        });

                        if (refreshResponse.ok) {
                            const data = await refreshResponse.json();
                            if (data.success && data.session?.access_token) {
                                // Salvar nova sessão
                                localStorage.setItem('auth_session', JSON.stringify(data.session));
                                
                                // Tentar novamente a requisição com o novo token
                                const newAuthHeaders = await getAuthHeaders();
                                const retryConfig: RequestInit = {
                                    ...options,
                                    headers: {
                                        ...newAuthHeaders,
                                        ...options.headers
                                    }
                                };
                                
                                const retryResponse = await fetch(`${baseUrl}${url}`, retryConfig);
                                
                                if (retryResponse.ok) {
                                    // Se funcionou, retornar a resposta
                                    const contentType = retryResponse.headers.get('content-type');
                                    if (contentType && contentType.includes('application/json')) {
                                        return await retryResponse.json();
                                    } else {
                                        return await retryResponse.text();
                                    }
                                }
                            }
                        }
                    }
                } catch (refreshError) {
                    console.error('❌ [API] Erro ao tentar renovar token:', refreshError);
                }
                
                // Se o refresh falhou ou não funcionou, limpar sessão e redirecionar para login
                console.warn('⚠️ [API] Não foi possível renovar o token, redirecionando para login');
                localStorage.removeItem('auth_session');
                localStorage.removeItem('user_data');
                sessionStorage.clear();
                window.location.href = '/login';
                throw new Error('Token expirado - redirecionando para login');
            }
            
            throw new Error(`Erro ${response.status}: ${errorMessage}`);
        }

        // Verificar se a resposta tem conteúdo
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error: any) {
        // Se estiver em desenvolvimento, não tiver tentado fallback ainda, e o erro for CORS/network
        if (isDevelopment && !triedFallback) {
            // Detectar erros de CORS, network ou conexão
            const isNetworkError = 
                error?.message?.includes('CORS') || 
                error?.message?.includes('Failed to fetch') ||
                error?.message?.includes('NetworkError') ||
                error?.message?.includes('network') ||
                error?.name === 'TypeError' ||
                error?.code === 'ERR_NETWORK' ||
                error?.code === 'ERR_FAILED' ||
                // Erros de CORS muitas vezes aparecem como TypeError sem mensagem específica
                (error?.name === 'TypeError' && !error?.message);
            
            if (isNetworkError) {
                console.warn(`⚠️ [API] Falha ao conectar com ${API_BASE_URL}, tentando fallback para ${FALLBACK_URL}`);
                console.warn(`⚠️ [API] Erro detectado:`, error?.message || error?.name || error);
                
                // Marcar DNS como indisponível
                dnsAvailable = false;
                
                // Atualizar URL base atual para fallback (atualiza tanto currentApiBase quanto apiBase exportado)
                updateExportedApiBase(FALLBACK_URL);
                
                // Tentar novamente com localhost
                return apiRequest(url, options, true);
            }
        }
        
        console.error('❌ [API] Erro na requisição:', error);
        throw error;
    }
};

// Métodos HTTP para uso moderno
export const api = {
    get: (url: string, options?: RequestInit) => 
        apiRequest(url, { method: 'GET', ...options }),
    
    post: (url: string, data?: any, options?: RequestInit) => 
        apiRequest(url, { 
            method: 'POST', 
            body: data ? JSON.stringify(data) : undefined,
            ...options 
        }),
    
    put: (url: string, data?: any, options?: RequestInit) => 
        apiRequest(url, { 
            method: 'PUT', 
            body: data ? JSON.stringify(data) : undefined,
            ...options 
        }),
    
    delete: (url: string, options?: RequestInit) => 
        apiRequest(url, { method: 'DELETE', ...options }),
    
    patch: (url: string, data?: any, options?: RequestInit) => 
        apiRequest(url, { 
            method: 'PATCH', 
            body: data ? JSON.stringify(data) : undefined,
            ...options 
        })
};

// ✅ FUNÇÃO HELPER: fetch com fallback automático para uso direto
// Use esta função no lugar de fetch() quando fizer requisições com apiBase
export async function fetchWithFallback(url: string, options: RequestInit = {}, triedFallback: boolean = false): Promise<Response> {
    try {
        // Construir URL completa
        const baseUrl = triedFallback ? FALLBACK_URL : currentApiBase;
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;
        
        const response = await fetch(fullUrl, options);
        
        // Se a resposta for OK, retornar
        if (response.ok) {
            return response;
        }
        
        // Se não for OK mas não for erro de CORS/network, retornar a resposta
        return response;
    } catch (error: any) {
        // Se estiver em desenvolvimento, não tiver tentado fallback ainda, e o erro for CORS/network
        if (isDevelopment && !triedFallback) {
            const isNetworkError = 
                error?.message?.includes('CORS') || 
                error?.message?.includes('Failed to fetch') ||
                error?.message?.includes('NetworkError') ||
                error?.message?.includes('network') ||
                error?.name === 'TypeError' ||
                error?.code === 'ERR_NETWORK' ||
                error?.code === 'ERR_FAILED' ||
                (error?.name === 'TypeError' && !error?.message);
            
            if (isNetworkError) {
                console.warn(`⚠️ [API] Falha ao conectar com ${currentApiBase}, tentando fallback para ${FALLBACK_URL}`);
                
                // Atualizar URL base atual para fallback
                updateExportedApiBase(FALLBACK_URL);
                
                // Tentar novamente com localhost
                return fetchWithFallback(url, options, true);
            }
        }
        
        // Se não for erro de rede ou já tentou fallback, relançar o erro
        throw error;
    }
}

// ✅ MANTER COMPATIBILIDADE: Export default como api
export default api; 