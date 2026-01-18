import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, Users, CheckCircle, XCircle, Zap, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useCampanhasContatos, NumeroConectado, ContatoComHistorico } from '@/hooks/useCampanhasContatos';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';

interface SelecaoContatosProps {
  onContatosSelecionados: (contatos: ContatoComHistorico[]) => void;
  onNumerosSelecionados: (numeros: string[]) => void;
  numerosIniciais?: string[];
  contatosIniciais?: ContatoComHistorico[];
}

export function SelecaoContatos({
  onContatosSelecionados,
  onNumerosSelecionados,
  numerosIniciais = [],
  contatosIniciais = []
}: SelecaoContatosProps) {
  const { user, profile } = useAuth();
  
  // 🎯 VERIFICAR SE O USUÁRIO É AGENTE
  const isAgent = React.useMemo(() => {
    if (!profile) return false;
    const roleName = profile?.roles?.name || profile?.role_name || '';
    return roleName.toLowerCase().includes('agente') || roleName.toLowerCase().includes('agent');
  }, [profile]);
  const {
    numerosConectados,
    contatosComHistorico,
    contatosValidados,
    sugestaoDistribuicao,
    isLoading,
    error,
    buscarContatosComHistorico,
    validarContatos,
    sugerirDistribuicao,
    limparDados
  } = useCampanhasContatos();

  // Estados para seleção de contatos da carteira (declarados antes do useContacts)
  const [filtroUsuario, setFiltroUsuario] = useState<string>('');
  const [filtrosContatos, setFiltrosContatos] = useState({ limit: 1000 });

  // Hook para contatos da carteira
  const {
    contacts: carteiraContatos,
    loading: loadingCarteira,
    getUsers,
    refreshContacts
  } = useContacts(filtrosContatos); // Buscar contatos da carteira com filtros

  const [numerosSelecionados, setNumerosSelecionados] = useState<string[]>(numerosIniciais);
  const [contatosSelecionados, setContatosSelecionados] = useState<ContatoComHistorico[]>(contatosIniciais);
  const [mostrarDistribuicao, setMostrarDistribuicao] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Novo estado para busca
  
  // Estados para seleção de contatos da carteira
  // 🎯 AGENTES SÓ PODEM USAR CARTEIRA
  const [fonteContatos, setFonteContatos] = useState<'historico' | 'carteira'>(isAgent ? 'carteira' : 'historico');
  
  // 🎯 GARANTIR QUE AGENTES FICAM APENAS NA CARTEIRA
  React.useEffect(() => {
    if (isAgent && fonteContatos !== 'carteira') {
      setFonteContatos('carteira');
    }
  }, [isAgent, fonteContatos]);
  const [contatosCarteiraSelecionados, setContatosCarteiraSelecionados] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<Array<{id: string; name: string; email: string; roles: {name: string}}>>([]);
  
  // Estados para paginação de contatos
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [contatosPorPagina] = useState(10);
  const [totalContatos, setTotalContatos] = useState(0);
  const [carregandoContatos, setCarregandoContatos] = useState(false);


  // Carregar usuários para filtro
  useEffect(() => {
    const loadUsers = async () => {
      if (!user?.token) {
        console.log('🔍 [SelecaoContatos] Aguardando autenticação...');
        return;
      }

      try {
        const usersData = await getUsers();
        setUsuarios(usersData);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();
  }, [getUsers, user?.token]);

  // Atualizar filtros quando o filtro de usuário mudar
  useEffect(() => {
    if (fonteContatos === 'carteira' && user?.token) {
      // 🎯 AGENTES SEMPRE FILTRAM POR SEU PRÓPRIO USER_ID
      const userIdToFilter = isAgent ? (user.id || undefined) : (filtroUsuario || undefined);
      console.log('🔄 [SelecaoContatos] Atualizando filtros com usuário:', userIdToFilter, { isAgent });
      setFiltrosContatos({
        limit: 1000,
        user_id: userIdToFilter
      });
    }
  }, [filtroUsuario, fonteContatos, user?.token, isAgent]);

  // Atualizar callbacks quando seleções mudarem
  useEffect(() => {
    onNumerosSelecionados(numerosSelecionados);
  }, [numerosSelecionados, onNumerosSelecionados]);

  useEffect(() => {
    if (fonteContatos === 'carteira') {
      // Converter contatos da carteira para o formato esperado
      const contatosConvertidos = carteiraContatos
        .filter(contact => contatosCarteiraSelecionados.includes(contact.id))
        .map(contact => ({
          contato_phone: contact.phone_number,
          contato_name: contact.name || 'Cliente',
          numero_whatsapp: numerosSelecionados[0] || '', // Usar primeiro número selecionado
          ultima_conversa: contact.last_interaction_at,
          total_mensagens: 0 // Não temos essa informação na carteira
        }));
      onContatosSelecionados(contatosConvertidos);
    } else {
      onContatosSelecionados(contatosSelecionados);
    }
  }, [contatosSelecionados, contatosCarteiraSelecionados, fonteContatos, carteiraContatos, numerosSelecionados, onContatosSelecionados]);

  // Buscar contatos quando números são selecionados, página muda ou modo carteirizado muda
  useEffect(() => {
    if (numerosSelecionados.length > 0) {
      buscarContatosPaginados();
    } else {
      setContatosSelecionados([]);
      setPaginaAtual(1);
      setTotalContatos(0);
      limparDados();
    }
  }, [numerosSelecionados, paginaAtual, searchTerm]);

  const buscarContatosPaginados = async () => {
    if (numerosSelecionados.length === 0) return;
    
    setCarregandoContatos(true);
    try {
      const offset = (paginaAtual - 1) * contatosPorPagina;
      await buscarContatosComHistorico(numerosSelecionados, contatosPorPagina, offset, searchTerm);
      
      // Atualizar total de contatos (isso deveria vir da API)
      setTotalContatos(contatosComHistorico.length + offset);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
    } finally {
      setCarregandoContatos(false);
    }
  };

  const handleNumeroToggle = (numero: string) => {
    setNumerosSelecionados(prev => {
      if (prev.includes(numero)) {
        return prev.filter(n => n !== numero);
      } else {
        return [...prev, numero];
      }
    });
  };

  const handleContatoToggle = (contato: ContatoComHistorico) => {
    setContatosSelecionados(prev => {
      const jaExiste = prev.some(c => 
        c.contato_phone === contato.contato_phone && 
        c.numero_whatsapp === contato.numero_whatsapp
      );

      if (jaExiste) {
        return prev.filter(c => 
          !(c.contato_phone === contato.contato_phone && 
            c.numero_whatsapp === contato.numero_whatsapp)
        );
      } else {
        return [...prev, contato];
      }
    });
  };

  const handleSelecionarTodosContatos = () => {
    setContatosSelecionados(contatosComHistorico);
  };

  const handleDeselecionarTodosContatos = () => {
    setContatosSelecionados([]);
  };

  const isContatoSelecionado = (contato: ContatoComHistorico) => {
    return contatosSelecionados.some(c => 
      c.contato_phone === contato.contato_phone && 
      c.numero_whatsapp === contato.numero_whatsapp
    );
  };

  // Funções para gerenciar contatos da carteira
  const handleContatoCarteiraToggle = (contactId: string) => {
    setContatosCarteiraSelecionados(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };

  const handleSelecionarTodosCarteira = () => {
    const contatosFiltrados = getContatosFiltrados();
    setContatosCarteiraSelecionados(contatosFiltrados.map(c => c.id));
  };

  const handleDeselecionarTodosCarteira = () => {
    setContatosCarteiraSelecionados([]);
  };

  const isContatoCarteiraSelecionado = (contactId: string) => {
    return contatosCarteiraSelecionados.includes(contactId);
  };

  const getContatosFiltrados = () => {
    let contatos = carteiraContatos;

    // Filtrar por termo de busca (filtro de usuário já é aplicado na API)
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      contatos = contatos.filter(contact => 
        contact.name?.toLowerCase().includes(termo) ||
        contact.phone_number.includes(termo)
      );
    }

    return contatos;
  };

  const todosSelecionados = contatosComHistorico.length > 0 && 
    contatosComHistorico.every(contato => isContatoSelecionado(contato));

  const algunsSelecionados = contatosSelecionados.length > 0 && !todosSelecionados;

  const handleSugerirDistribuicao = async () => {
    if (numerosSelecionados.length === 0 || contatosComHistorico.length === 0) return;

    const contatosPhones = contatosComHistorico.map(c => c.contato_phone);
    await sugerirDistribuicao(numerosSelecionados, contatosPhones);
    setMostrarDistribuicao(true);
  };

  const aplicarDistribuicaoSugerida = () => {
    if (!sugestaoDistribuicao) return;

    const novosContatos: ContatoComHistorico[] = [];
    
    sugestaoDistribuicao.distribuicao.forEach(numero => {
      numero.contatos_sugeridos.forEach(contato => {
        novosContatos.push({
          contato_phone: contato.contact_phone,
          contato_name: contato.contact_name,
          numero_whatsapp: numero.numero_whatsapp,
          ultima_conversa: contato.ultima_conversa,
          total_mensagens: 1 // Será calculado corretamente pelo backend
        });
      });
    });

    setContatosSelecionados(novosContatos);
    setMostrarDistribuicao(false);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Buscar Contatos
          </CardTitle>
          <CardDescription>
            Digite parte do nome ou telefone para filtrar os contatos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm">
              Buscar por nome ou telefone
            </Label>
            <input
              id="search"
              type="text"
              placeholder="Digite o nome ou telefone do contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground">
              Digite parte do nome ou telefone para filtrar os contatos encontrados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Números */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Números Conectados
          </CardTitle>
            <CardDescription>
              Selecione os números que serão usados para enviar as mensagens
            </CardDescription>
          </CardHeader>
        <CardContent>
          {isLoading && numerosConectados.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando números...</span>
            </div>
          ) : numerosConectados.length === 0 ? (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p>Nenhum número conectado encontrado. Conecte um número WhatsApp primeiro.</p>
                  <div className="text-sm text-muted-foreground">
                    <p>Para conectar um número WhatsApp:</p>
                    <ol className="list-decimal list-inside space-y-1 mt-1">
                      <li>Acesse a página "Contas" no menu lateral</li>
                      <li>Clique em "Conectar Nova Conta"</li>
                      <li>Escaneie o QR Code com seu WhatsApp</li>
                      <li>Aguarde a confirmação de conexão</li>
                    </ol>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3">
              {numerosConectados.map((numero) => (
                <div key={numero.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={`numero-${numero.id}`}
                    checked={numerosSelecionados.includes(numero.phone_number)}
                    onCheckedChange={() => handleNumeroToggle(numero.phone_number)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="">{numero.session_name}</span>
                      <Badge variant="outline">{numero.phone_number}</Badge>
                      <Badge variant="secondary">{numero.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seleção de Fonte de Contatos */}
      {numerosSelecionados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Fonte de Contatos
            </CardTitle>
            <CardDescription>
              Escolha como deseja selecionar os contatos para a campanha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-6">
                {/* 🎯 OCULTAR OPÇÃO "CONTATOS COM HISTÓRICO" QUANDO FOR AGENTE */}
                {!isAgent && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="fonte-historico"
                      name="fonteContatos"
                      value="historico"
                      checked={fonteContatos === 'historico'}
                      onChange={(e) => setFonteContatos(e.target.value as 'historico' | 'carteira')}
                      className="h-4 w-4 text-blue-600"
                    />
                    <Label htmlFor="fonte-historico" className="text-sm">
                      Contatos com Histórico
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="fonte-carteira"
                    name="fonteContatos"
                    value="carteira"
                    checked={fonteContatos === 'carteira'}
                    onChange={(e) => !isAgent && setFonteContatos(e.target.value as 'historico' | 'carteira')}
                    disabled={isAgent} // 🎯 AGENTES SÓ PODEM USAR CARTEIRA
                    className="h-4 w-4 text-blue-600 disabled:opacity-50"
                  />
                  <Label htmlFor="fonte-carteira" className="text-sm">
                    Carteira de Contatos
                    {isAgent && <span className="ml-2 text-xs text-muted-foreground">(Apenas opção disponível para agentes)</span>}
                  </Label>
                </div>
              </div>
              
              {fonteContatos === 'carteira' && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="filtro-usuario" className="text-sm">
                        {isAgent ? 'Meus contatos' : 'Filtrar por usuário (opcional)'}
                      </Label>
                      <select
                        id="filtro-usuario"
                        value={isAgent ? (user?.id || '') : filtroUsuario}
                        onChange={(e) => !isAgent && setFiltroUsuario(e.target.value)}
                        disabled={isAgent} // 🎯 AGENTES NÃO PODEM FILTRAR POR OUTROS USUÁRIOS
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {isAgent ? (
                          <option value={user?.id || ''}>{profile?.name || user?.email || 'Meus contatos'}</option>
                        ) : (
                          <>
                            <option value="">Todos os usuários</option>
                            {usuarios.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.roles?.name || 'Usuário'})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {isAgent && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Agentes só podem ver seus próprios contatos
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contatos com Histórico */}
      {numerosSelecionados.length > 0 && fonteContatos === 'historico' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contatos com Histórico
            </CardTitle>
            <CardDescription>
              Contatos que já conversaram com os números selecionados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {carregandoContatos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando contatos...</span>
              </div>
            ) : contatosComHistorico.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum contato com histórico encontrado para os números selecionados.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Controles de seleção */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {contatosComHistorico.length} contatos encontrados
                    </p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={todosSelecionados}
                        ref={(el) => {
                          if (el) el.indeterminate = algunsSelecionados;
                        }}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelecionarTodosContatos();
                          } else {
                            handleDeselecionarTodosContatos();
                          }
                        }}
                      />
                      <label htmlFor="select-all" className="text-sm">
                        Selecionar todos
                      </label>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {contatosSelecionados.length} selecionados
                  </p>
                  <Button
                    onClick={handleSugerirDistribuicao}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Sugerir Distribuição
                  </Button>
                </div>

                {/* Lista de contatos */}
                <div className="grid gap-3">
                  {contatosComHistorico.map((contato, index) => (
                    <div key={`${contato.contato_phone}-${contato.numero_whatsapp}-${index}`} 
                         className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={`contato-${index}`}
                        checked={isContatoSelecionado(contato)}
                        onCheckedChange={() => handleContatoToggle(contato)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="">{contato.contato_name || 'Sem nome'}</span>
                          <Badge variant="outline">{contato.contato_phone}</Badge>
                          <Badge variant="secondary">{contato.numero_whatsapp}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {contato.total_mensagens} mensagens • Última conversa: {formatarData(contato.ultima_conversa)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                {contatosComHistorico.length >= contatosPorPagina && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Página {paginaAtual} de {Math.ceil(totalContatos / contatosPorPagina)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                        disabled={paginaAtual === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaginaAtual(prev => prev + 1)}
                        disabled={contatosComHistorico.length < contatosPorPagina}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contatos da Carteira */}
      {numerosSelecionados.length > 0 && fonteContatos === 'carteira' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Carteira de Contatos
            </CardTitle>
            <CardDescription>
              Selecione contatos da sua carteira para a campanha
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCarteira ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando contatos da carteira...</span>
              </div>
            ) : getContatosFiltrados().length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum contato encontrado na carteira com os filtros aplicados.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Controles de seleção */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {getContatosFiltrados().length} contatos encontrados
                    </p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-carteira"
                        checked={getContatosFiltrados().every(contact => isContatoCarteiraSelecionado(contact.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelecionarTodosCarteira();
                          } else {
                            handleDeselecionarTodosCarteira();
                          }
                        }}
                      />
                      <Label htmlFor="select-all-carteira" className="text-sm">
                        Selecionar todos
                      </Label>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {contatosCarteiraSelecionados.length} selecionados
                  </div>
                </div>

                {/* Lista de contatos */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {getContatosFiltrados().map((contact) => (
                    <div key={contact.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                      <Checkbox
                        id={`carteira-${contact.id}`}
                        checked={isContatoCarteiraSelecionado(contact.id)}
                        onCheckedChange={() => handleContatoCarteiraToggle(contact.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="">{contact.name || 'Cliente'}</span>
                          <Badge variant="outline">{contact.phone_number}</Badge>
                          {contact.user && (
                            <Badge variant="secondary">{contact.user.name}</Badge>
                          )}
                        </div>
                        {contact.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {contact.notes}
                          </p>
                        )}
                        {contact.last_interaction_at && (
                          <p className="text-xs text-muted-foreground">
                            Última interação: {formatarData(contact.last_interaction_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sugestão de Distribuição */}
      {mostrarDistribuicao && sugestaoDistribuicao && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Distribuição Sugerida
            </CardTitle>
            <CardDescription>
              Distribuição automática baseada no histórico de conversas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-3">
                {sugestaoDistribuicao.distribuicao.map((numero) => (
                  <div key={numero.numero_whatsapp} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="">{numero.numero_whatsapp}</span>
                        <Badge variant="outline">
                          {numero.contatos_sugeridos.length} contatos
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {numero.total_mensagens} mensagens
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {numero.contatos_sugeridos.slice(0, 3).map((contato) => (
                        <div key={contato.contact_phone} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>{contato.contact_name || 'Sem nome'}</span>
                          <Badge variant="outline" className="text-xs">
                            {contato.contact_phone}
                          </Badge>
                        </div>
                      ))}
                      {numero.contatos_sugeridos.length > 3 && (
                        <p className="text-sm text-muted-foreground">
                          +{numero.contatos_sugeridos.length - 3} contatos adicionais
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total: {sugestaoDistribuicao.total_contatos_distribuidos} contatos em {sugestaoDistribuicao.numeros_ativos} números
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setMostrarDistribuicao(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={aplicarDistribuicaoSugerida}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aplicar Distribuição
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo da Seleção */}
      {contatosSelecionados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Resumo da Seleção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm">Números Selecionados</p>
                <p className="text-2xl">{numerosSelecionados.length}</p>
              </div>
              <div>
                <p className="text-sm">Contatos Selecionados</p>
                <p className="text-2xl">{contatosSelecionados.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
