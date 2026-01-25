import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, RefreshCw, Calendar, TrendingUp, MessageCircle, Download, Eye, EyeOff } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiBase, getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
// Removido react-simple-maps devido a problemas de compatibilidade
// Usaremos SVG nativo com GeoJSON

// Mapeamento de DDD para estados brasileiros
const dddToState: { [key: string]: string } = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  '68': 'AC', '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA', '99': 'MA'
};

// Códigos dos estados para o SVG
const stateCodes: { [key: string]: string } = {
  'AC': 'ac', 'AL': 'al', 'AP': 'ap', 'AM': 'am', 'BA': 'ba', 'CE': 'ce',
  'DF': 'df', 'ES': 'es', 'GO': 'go', 'MA': 'ma', 'MT': 'mt', 'MS': 'ms',
  'MG': 'mg', 'PA': 'pa', 'PB': 'pb', 'PR': 'pr', 'PE': 'pe', 'PI': 'pi',
  'RJ': 'rj', 'RN': 'rn', 'RS': 'rs', 'RO': 'ro', 'RR': 'rr', 'SC': 'sc',
  'SP': 'sp', 'SE': 'se', 'TO': 'to'
};

interface StateData {
  state: string;
  stateCode: string;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
}

interface HeatmapGeographicProps {}

const HeatmapGeographic: React.FC<HeatmapGeographicProps> = () => {
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [stateData, setStateData] = useState<StateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [maxMessages, setMaxMessages] = useState(0);
  const [showStateLabels, setShowStateLabels] = useState(false); // Por padrão oculto
  const [showAllStates, setShowAllStates] = useState(false); // Por padrão mostra apenas top 10

  // Função para extrair DDD de um número de telefone
  const extractDDD = (phone: string): string | null => {
    if (!phone || typeof phone !== 'string') return null;
    
    // Remover sufixos do WhatsApp (@s.whatsapp.net, @g.us, etc)
    let cleaned = phone.split('@')[0];
    
    // Remove caracteres não numéricos
    cleaned = cleaned.replace(/\D/g, '');
    
    // Se começa com 55 (código do Brasil), remove
    const withoutCountry = cleaned.startsWith('55') ? cleaned.substring(2) : cleaned;
    
    // Pega os 2 primeiros dígitos (DDD)
    if (withoutCountry.length >= 2) {
      const ddd = withoutCountry.substring(0, 2);
      return ddd;
    }
    
    return null;
  };

  // Função para obter cor baseada na intensidade
  const getStateColor = (count: number, max: number): string => {
    if (count === 0) return '#e5e7eb'; // Cinza para zero
    if (max === 0) return '#e5e7eb';
    
    const intensity = count / max;
    
    if (intensity >= 0.8) return '#dc2626'; // Vermelho escuro
    if (intensity >= 0.6) return '#ea580c'; // Laranja
    if (intensity >= 0.4) return '#f59e0b'; // Amarelo
    if (intensity >= 0.2) return '#3b82f6'; // Azul
    return '#60a5fa'; // Azul claro
  };

  // Buscar dados do mapa de calor
  const fetchHeatmapData = useCallback(async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      // Buscar todas as mensagens no período via API do backend
      const headers = await getAuthHeaders();
      
      // Formatar datas corretamente (usar apenas a data sem hora para compatibilidade)
      const startDateFormatted = startDate; // yyyy-MM-dd
      const endDateFormatted = endDate; // yyyy-MM-dd
      
      // ✅ CORREÇÃO: Buscar mensagens com join de chats para obter os telefones
      // A API pode não retornar o chat por padrão, então vamos buscar também via endpoint que retorna chats
      const response = await fetch(
        `${apiBase}/api/messages?organization_id=${organization.id}&dateStart=${startDateFormatted}&dateEnd=${endDateFormatted}&limit=10000`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar mensagens: ${response.status}`);
      }

      const result = await response.json();
      let messages = result.messages || result.data || [];

      console.log('[Heatmap] Total de mensagens recebidas:', messages.length);
      
      // ✅ NOVO: Se as mensagens não têm dados do chat, buscar os chats separadamente
      if (messages.length > 0 && !messages[0].chat && messages[0].chat_id) {
        console.log('[Heatmap] Mensagens não têm dados do chat, buscando chats separadamente...');
        
        // Coletar todos os chat_ids únicos
        const chatIds = [...new Set(messages.map((m: any) => m.chat_id).filter(Boolean))];
        console.log('[Heatmap] Total de chats únicos:', chatIds.length);
        
        if (chatIds.length > 0) {
          // Buscar chats em lotes (limite de 100 por vez devido ao tamanho da URL)
          const batchSize = 100;
          const chatBatches = [];
          for (let i = 0; i < chatIds.length; i += batchSize) {
            chatBatches.push(chatIds.slice(i, i + batchSize));
          }
          
          const chatsMap = new Map();
          
          for (const batch of chatBatches) {
            try {
              const chatsResponse = await fetch(
                `${apiBase}/api/chat-operations/chats?ids=${batch.join(',')}&organization_id=${organization.id}`,
                { headers }
              );
              
              if (chatsResponse.ok) {
                const chatsResult = await chatsResponse.json();
                const chats = chatsResult.chats || chatsResult.data || [];
                chats.forEach((chat: any) => {
                  chatsMap.set(chat.id, chat);
                });
              }
            } catch (error) {
              console.warn('[Heatmap] Erro ao buscar lote de chats:', error);
            }
          }
          
          console.log('[Heatmap] Chats encontrados:', chatsMap.size);
          
          // Adicionar dados do chat às mensagens
          messages = messages.map((msg: any) => ({
            ...msg,
            chat: chatsMap.get(msg.chat_id) || null
          }));
        }
      }
      
      if (messages.length > 0) {
        console.log('[Heatmap] Primeira mensagem exemplo:', {
          id: messages[0].id,
          is_from_me: messages[0].is_from_me,
          sender_jid: messages[0].sender_jid,
          chat_id: messages[0].chat_id,
          chat: messages[0].chat ? {
            id: messages[0].chat.id,
            remote_jid: messages[0].chat.remote_jid,
            whatsapp_jid: messages[0].chat.whatsapp_jid
          } : null
        });
      }

      // Agrupar por estado
      const stateMap: { [key: string]: { sent: number; received: number } } = {};

      let processedCount = 0;
      let skippedCount = 0;
      let dddNotFoundCount = 0;

      messages.forEach((message: any, index: number) => {
        let phoneNumber = '';
        
        // ✅ MELHORADO: Buscar telefone em múltiplos campos possíveis
        // Tentar diferentes campos onde o telefone pode estar armazenado
        if (message.is_from_me) {
          // Mensagem enviada - destinatário pode estar em vários campos
          phoneNumber = message.sender_jid || 
                       message.chat?.remote_jid || 
                       message.chat?.whatsapp_jid ||
                       message.remote_jid ||
                       message.target_jid ||
                       message.metadata?.target_jid ||
                       message.metadata?.remote_jid ||
                       '';
        } else {
          // Mensagem recebida - remetente está em sender_jid ou outros campos
          phoneNumber = message.sender_jid || 
                       message.chat?.whatsapp_jid || 
                       message.chat?.remote_jid ||
                       message.remote_jid ||
                       message.metadata?.sender_jid ||
                       message.metadata?.remote_jid ||
                       '';
        }

        // Se ainda não encontrou, tentar extrair do chat_id ou outros campos
        if (!phoneNumber && message.chat_id) {
          // Tentar extrair número do chat_id se for um número
          const chatIdStr = String(message.chat_id);
          if (/^\d+$/.test(chatIdStr)) {
            phoneNumber = chatIdStr;
          }
        }

        // Log das primeiras mensagens para debug
        if (index < 5) {
          console.log(`[Heatmap] Mensagem ${index + 1}:`, {
            is_from_me: message.is_from_me,
            phoneNumber,
            sender_jid: message.sender_jid,
            chat_remote_jid: message.chat?.remote_jid,
            chat_whatsapp_jid: message.chat?.whatsapp_jid
          });
        }

        if (!phoneNumber) {
          skippedCount++;
          return;
        }

        // Extrair DDD e mapear para estado
        const ddd = extractDDD(phoneNumber);
        
        if (index < 5) {
          console.log(`[Heatmap] DDD extraído de "${phoneNumber}":`, ddd);
        }

        if (!ddd) {
          dddNotFoundCount++;
          return;
        }

        if (!dddToState[ddd]) {
          dddNotFoundCount++;
          console.warn(`[Heatmap] DDD ${ddd} não encontrado no mapeamento`);
          return;
        }

        const state = dddToState[ddd];
        
        if (!stateMap[state]) {
          stateMap[state] = { sent: 0, received: 0 };
        }

        if (message.is_from_me) {
          stateMap[state].sent++;
        } else {
          stateMap[state].received++;
        }

        processedCount++;
      });

      console.log('[Heatmap] Estatísticas de processamento:', {
        total: messages.length,
        processadas: processedCount,
        puladas: skippedCount,
        dddNaoEncontrado: dddNotFoundCount
      });

      // Converter para array e calcular totais
      const data: StateData[] = Object.keys(stateMap).map(state => ({
        state,
        stateCode: stateCodes[state] || state.toLowerCase(),
        messageCount: stateMap[state].sent + stateMap[state].received,
        sentCount: stateMap[state].sent,
        receivedCount: stateMap[state].received
      }));

      console.log('[Heatmap] Estados encontrados:', data.length);
      console.log('[Heatmap] Dados por estado:', data);

      // Ordenar por quantidade de mensagens
      data.sort((a, b) => b.messageCount - a.messageCount);

      // Encontrar máximo para normalização de cores
      const max = Math.max(...data.map(d => d.messageCount), 1);
      setMaxMessages(max);

      setStateData(data);

      if (data.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: `Nenhuma mensagem com telefone válido encontrada no período ${startDate} a ${endDate}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Dados carregados",
          description: `${data.length} estados com atividade encontrados`,
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar dados do mapa de calor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, startDate, endDate, toast]);

  useEffect(() => {
    if (organization?.id) {
      fetchHeatmapData();
    }
  }, [organization?.id, startDate, endDate, fetchHeatmapData]);

  // Estado para armazenar dados do GeoJSON
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [mapLoading, setMapLoading] = useState(true);

  // Carregar GeoJSON do Brasil
  useEffect(() => {
    const loadGeoJson = async () => {
      try {
        const response = await fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson");
        const data = await response.json();
        setGeoJsonData(data);
      } catch (error) {
        console.error('Erro ao carregar GeoJSON:', error);
      } finally {
        setMapLoading(false);
      }
    };

    loadGeoJson();
  }, []);

  // Função para converter coordenadas GeoJSON para SVG (projeção simplificada)
  const projectCoordinates = (coordinates: number[][], width: number, height: number) => {
    // Bounding box aproximado do Brasil
    const minLon = -73.0;
    const maxLon = -34.0;
    const minLat = -33.7;
    const maxLat = 5.3;

    return coordinates.map(([lon, lat]) => {
      const x = ((lon - minLon) / (maxLon - minLon)) * width;
      const y = ((maxLat - lat) / (maxLat - minLat)) * height;
      return [x, y];
    });
  };

  // Componente do mapa do Brasil usando SVG nativo
  const BrazilMapSVG = () => {
    const handleStateClick = (stateCode: string) => {
      const state = Object.keys(stateCodes).find(key => 
        stateCodes[key] === stateCode.toLowerCase() || 
        key === stateCode.toUpperCase()
      );
      if (state) {
        setSelectedState(state);
      }
    };

    if (mapLoading || !geoJsonData) {
      return (
        <div className="w-full h-[500px] border rounded-lg flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Carregando mapa...</p>
          </div>
        </div>
      );
    }

    const width = 800;
    const height = 600;
    const aspectRatio = width / height; // 1.333...

    return (
      <div className="w-full max-w-4xl mx-auto border rounded-lg overflow-hidden bg-gray-50">
        <div className="w-full" style={{ aspectRatio: aspectRatio, maxHeight: '600px' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
          {geoJsonData.features.map((feature: any, index: number) => {
            const stateCode = feature.properties?.sigla || feature.properties?.code || '';
            const state = Object.keys(stateCodes).find(key => 
              stateCodes[key] === stateCode.toLowerCase() || 
              key === stateCode.toUpperCase()
            ) || stateCode;
            
            const stateDataItem = stateData.find(d => 
              d.state === state || 
              d.stateCode === stateCode.toLowerCase()
            );
            
            const messageCount = stateDataItem?.messageCount || 0;
            const fillColor = getStateColor(messageCount, maxMessages);

            // Converter geometria para paths SVG
            const paths: string[] = [];
            
            if (feature.geometry.type === 'Polygon') {
              feature.geometry.coordinates.forEach((ring: number[][]) => {
                const projected = projectCoordinates(ring, width, height);
                const pathData = projected.map(([x, y], i) => 
                  i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                ).join(' ') + ' Z';
                paths.push(pathData);
              });
            } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates.forEach((polygon: number[][][]) => {
                polygon.forEach((ring: number[][]) => {
                  const projected = projectCoordinates(ring, width, height);
                  const pathData = projected.map(([x, y], i) => 
                    i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                  ).join(' ') + ' Z';
                  paths.push(pathData);
                });
              });
            }

            // Calcular centro do estado para posicionar a sigla
            let centerX = 0;
            let centerY = 0;
            let totalPoints = 0;
            
            if (feature.geometry.type === 'Polygon') {
              feature.geometry.coordinates.forEach((ring: number[][]) => {
                const projected = projectCoordinates(ring, width, height);
                projected.forEach(([x, y]) => {
                  centerX += x;
                  centerY += y;
                  totalPoints++;
                });
              });
            } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates.forEach((polygon: number[][][]) => {
                polygon.forEach((ring: number[][]) => {
                  const projected = projectCoordinates(ring, width, height);
                  projected.forEach(([x, y]) => {
                    centerX += x;
                    centerY += y;
                    totalPoints++;
                  });
                });
              });
            }
            
            if (totalPoints > 0) {
              centerX = centerX / totalPoints;
              centerY = centerY / totalPoints;
            }

            const stateSigla = state.toUpperCase();

            return (
              <g key={`state-${index}`}>
                {paths.map((pathData, pathIndex) => (
                  <path
                    key={`${index}-${pathIndex}`}
                    d={pathData}
                    fill={fillColor}
                    stroke="#fff"
                    strokeWidth={1}
                    className="cursor-pointer transition-all hover:opacity-80"
                    onClick={() => handleStateClick(stateCode)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.stroke = '#3b82f6';
                      e.currentTarget.style.strokeWidth = '2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.stroke = '#fff';
                      e.currentTarget.style.strokeWidth = '1';
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
                {/* Adicionar sigla do estado - apenas se showStateLabels estiver ativo */}
                {showStateLabels && stateSigla && (
                  <text
                    x={centerX}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none"
                    style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fill: messageCount > 0 ? '#ffffff' : '#6b7280',
                      textShadow: messageCount > 0 
                        ? '1px 1px 2px rgba(0,0,0,0.5)' 
                        : 'none',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                  >
                    {stateSigla}
                  </text>
                )}
              </g>
            );
          })}
          </svg>
        </div>
      </div>
    );
  };

  const selectedStateData = selectedState ? stateData.find(d => d.state === selectedState) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl text-gray-900">Mapa de Calor Geográfico</h1>
          <p className="text-gray-600">Distribuição de mensagens por estados do Brasil</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filtros de Data - Discretos */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36 text-sm"
              />
              <span className="text-gray-400">até</span>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>
          </div>
          <Button 
            onClick={fetchHeatmapData} 
            variant="outline" 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Mapa e Ranking lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mapa do Brasil */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa do Brasil
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStateLabels(!showStateLabels)}
                className="flex items-center gap-2"
              >
                {showStateLabels ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Ocultar Siglas
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Mostrar Siglas
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-lg">Carregando mapa...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Legenda */}
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="text-gray-600 font-semibold">Intensidade:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <span>Sem atividade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-400 rounded"></div>
                    <span>Baixa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                    <span>Média</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded"></div>
                    <span>Alta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded"></div>
                    <span>Muito Alta</span>
                  </div>
                </div>

                {/* Mapa SVG */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <BrazilMapSVG />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking de Estados */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ranking de Estados
              </CardTitle>
              {stateData.length > 10 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllStates(!showAllStates)}
                  className="flex items-center gap-2"
                >
                  {showAllStates ? 'Ver Top 10' : `Ver Todos (${stateData.length})`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {stateData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum dado disponível para o período selecionado
              </div>
            ) : (
              <div className="space-y-2">
                {(showAllStates ? stateData : stateData.slice(0, 10)).map((state, index) => (
                  <div
                    key={state.state}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedState === state.state ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedState(state.state)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 text-center">
                        {index + 1}
                      </Badge>
                      <span className="font-semibold">{state.state}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-600">
                        <span className="text-green-600">{state.sentCount}</span> /{' '}
                        <span className="text-purple-600">{state.receivedCount}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: getStateColor(state.messageCount, maxMessages),
                          color: '#fff'
                        }}
                      >
                        {state.messageCount} mensagens
                      </Badge>
                    </div>
                  </div>
                ))}
                {!showAllStates && stateData.length > 10 && (
                  <div className="text-center pt-2 text-sm text-gray-500">
                    + {stateData.length - 10} estados restantes
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Informações do Estado Selecionado */}
      {selectedStateData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selectedStateData.state} - Detalhes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 mb-1">Total de Mensagens</div>
                <div className="text-2xl font-bold text-blue-900">{selectedStateData.messageCount}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 mb-1">Enviadas</div>
                <div className="text-2xl font-bold text-green-900">{selectedStateData.sentCount}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600 mb-1">Recebidas</div>
                <div className="text-2xl font-bold text-purple-900">{selectedStateData.receivedCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HeatmapGeographic;

