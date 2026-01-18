import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, RefreshCw, Calendar, TrendingUp, MessageCircle, Download } from 'lucide-react';
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

  // Função para extrair DDD de um número de telefone
  const extractDDD = (phone: string): string | null => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Se começa com 55 (código do Brasil), remove
    const withoutCountry = cleaned.startsWith('55') ? cleaned.substring(2) : cleaned;
    
    // Pega os 2 primeiros dígitos (DDD)
    if (withoutCountry.length >= 2) {
      return withoutCountry.substring(0, 2);
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
      const startDateISO = new Date(startDate).toISOString();
      const endDateISO = new Date(endDate + 'T23:59:59').toISOString();
      
      const response = await fetch(
        `${apiBase}/api/messages?organization_id=${organization.id}&dateStart=${startDateISO}&dateEnd=${endDateISO}&limit=10000`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar mensagens: ${response.status}`);
      }

      const result = await response.json();
      const messages = result.messages || result.data || [];

      // Agrupar por estado
      const stateMap: { [key: string]: { sent: number; received: number } } = {};

      messages.forEach((message: any) => {
        let phoneNumber = '';
        
        // ✅ CORREÇÃO: Determinar número de telefone baseado na direção da mensagem
        // Para mensagens enviadas, o destinatário está em sender_jid ou no chat
        // Para mensagens recebidas, o remetente está em sender_jid
        if (message.is_from_me) {
          // Mensagem enviada - destinatário pode estar em sender_jid (que é o remoteJid) ou no chat
          phoneNumber = message.sender_jid || 
                       message.chat?.remote_jid || 
                       message.chat?.whatsapp_jid || 
                       '';
        } else {
          // Mensagem recebida - remetente está em sender_jid
          phoneNumber = message.sender_jid || 
                       message.chat?.whatsapp_jid || 
                       message.chat?.remote_jid || 
                       '';
        }

        // Extrair DDD e mapear para estado
        const ddd = extractDDD(phoneNumber);
        if (ddd && dddToState[ddd]) {
          const state = dddToState[ddd];
          
          if (!stateMap[state]) {
            stateMap[state] = { sent: 0, received: 0 };
          }

          if (message.is_from_me) {
            stateMap[state].sent++;
          } else {
            stateMap[state].received++;
          }
        }
      });

      // Converter para array e calcular totais
      const data: StateData[] = Object.keys(stateMap).map(state => ({
        state,
        stateCode: stateCodes[state] || state.toLowerCase(),
        messageCount: stateMap[state].sent + stateMap[state].received,
        sentCount: stateMap[state].sent,
        receivedCount: stateMap[state].received
      }));

      // Ordenar por quantidade de mensagens
      data.sort((a, b) => b.messageCount - a.messageCount);

      // Encontrar máximo para normalização de cores
      const max = Math.max(...data.map(d => d.messageCount), 1);
      setMaxMessages(max);

      setStateData(data);

      toast({
        title: "Dados carregados",
        description: `${data.length} estados com atividade encontrados`,
      });
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
  }, [organization?.id, fetchHeatmapData]);

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

            return paths.map((pathData, pathIndex) => (
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
            ));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Mapa de Calor Geográfico</h1>
          <p className="text-gray-600">Distribuição de mensagens por estados do Brasil</p>
        </div>
        <Button 
          onClick={fetchHeatmapData} 
          variant="outline" 
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros de Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapa do Brasil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa do Brasil - Distribuição de Mensagens
          </CardTitle>
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

      {/* Ranking de Estados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Ranking de Estados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stateData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum dado disponível para o período selecionado
            </div>
          ) : (
            <div className="space-y-2">
              {stateData.map((state, index) => (
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HeatmapGeographic;

