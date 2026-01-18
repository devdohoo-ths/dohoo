import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Plus, 
  History,
  Send,
  User,
  Mail,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';

interface PocData {
  id: string;
  name: string;
  is_poc: boolean;
  poc_start_date: string;
  poc_end_date: string;
  poc_duration_days: number;
  poc_notifications_sent: string[];
  poc_status: 'inactive' | 'active' | 'expired' | 'converted';
  contact_email: string;
  contact_phone: string;
  days_remaining: number | null;
  history: Array<{
    id: string;
    action: string;
    old_end_date: string | null;
    new_end_date: string | null;
    notes: string | null;
    created_at: string;
    profiles: {
      name: string;
      email: string;
    } | null;
  }>;
}

interface PocConfigurationProps {
  organizationId: string;
  onUpdate?: (pocData: PocData) => void;
}

const PocConfiguration: React.FC<PocConfigurationProps> = ({ 
  organizationId, 
  onUpdate 
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [pocData, setPocData] = useState<PocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estados do formulário
  const [isPoc, setIsPoc] = useState(false);
  const [durationDays, setDurationDays] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [extendDays, setExtendDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Carregar dados POC
  useEffect(() => {
    if (organizationId) {
      fetchPocData();
    }
  }, [organizationId]);


  const fetchPocData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      console.log('🔄 [POC] Buscando dados POC para organização:', organizationId);
      
      const response = await fetch(`${apiBase}/api/organizations/${organizationId}/poc`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar dados POC');
      }

      const result = await response.json();
      const data = result.poc;
      
      console.log('✅ [POC] Dados POC recebidos:', data);
      console.log('📊 [POC] is_poc:', data.is_poc, 'poc_status:', data.poc_status);
      
      setPocData(data);
      setIsPoc(data.is_poc);
      setDurationDays(data.poc_duration_days || 30);
      setStartDate(data.poc_start_date ? data.poc_start_date.split('T')[0] : '');
      setContactEmail(data.contact_email || '');
      setContactPhone(data.contact_phone || '');
      
    } catch (error) {
      console.error('❌ [POC] Erro ao carregar dados POC:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar configurações POC",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePoc = async () => {
    try {
      setSaving(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      console.log('💾 [POC] Salvando configuração POC:', {
        is_poc: isPoc,
        poc_duration_days: durationDays,
        poc_start_date: startDate,
        poc_contact_email: contactEmail,
        poc_contact_phone: contactPhone
      });
      
      const response = await fetch(`${apiBase}/api/organizations/${organizationId}/poc`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_poc: isPoc,
          poc_duration_days: durationDays,
          poc_start_date: startDate ? new Date(startDate).toISOString() : null,
          poc_contact_email: contactEmail || null,
          poc_contact_phone: contactPhone || null,
          notes: notes || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar POC');
      }

      const result = await response.json();
      
      console.log('✅ [POC] Configuração salva com sucesso:', result);
      
      toast({
        title: "Sucesso",
        description: result.message,
      });

      // Recarregar dados
      console.log('🔄 [POC] Recarregando dados após salvar...');
      await fetchPocData();
      
      // Notificar componente pai
      if (onUpdate && result.poc) {
        onUpdate(result.poc);
      }
      
      // Limpar formulário
      setNotes('');
      
    } catch (error) {
      console.error('❌ [POC] Erro ao salvar POC:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações POC",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExtendPoc = async () => {
    if (extendDays <= 0) {
      toast({
        title: "Erro",
        description: "Digite um número válido de dias para estender",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/organizations/${organizationId}/poc`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          extend_days: extendDays,
          notes: notes || `POC estendida por ${extendDays} dias`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao estender POC');
      }

      const result = await response.json();
      
      toast({
        title: "Sucesso",
        description: result.message,
      });

      // Recarregar dados
      await fetchPocData();
      
      // Notificar componente pai
      if (onUpdate && result.poc) {
        onUpdate(result.poc);
      }
      
      // Limpar formulário
      setExtendDays(0);
      setNotes('');
      
    } catch (error) {
      console.error('Erro ao estender POC:', error);
      toast({
        title: "Erro",
        description: "Falha ao estender POC",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToFull = async () => {
    try {
      setSaving(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/organizations/${organizationId}/poc`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          convert_to_full: true,
          notes: notes || 'POC convertida para plano completo'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao converter POC');
      }

      const result = await response.json();
      
      toast({
        title: "Sucesso",
        description: result.message,
      });

      // Recarregar dados
      await fetchPocData();
      
      // Notificar componente pai
      if (onUpdate && result.poc) {
        onUpdate(result.poc);
      }
      
      // Limpar formulário
      setNotes('');
      
    } catch (error) {
      console.error('Erro ao converter POC:', error);
      toast({
        title: "Erro",
        description: "Falha ao converter POC",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string, daysRemaining: number | null) => {
    if (!pocData?.is_poc) {
      return <Badge variant="secondary">Inativo</Badge>;
    }

    if (status === 'converted') {
      return <Badge className="bg-green-100 text-green-800">Convertido</Badge>;
    }

    if (status === 'expired') {
      return <Badge variant="destructive">Expirado</Badge>;
    }

    if (daysRemaining === null) {
      return <Badge variant="secondary">Ativo</Badge>;
    }

    if (daysRemaining <= 0) {
      return <Badge variant="destructive">Expirado</Badge>;
    } else if (daysRemaining <= 3) {
      return <Badge className="bg-red-100 text-red-800">Crítico ({daysRemaining} dias)</Badge>;
    } else if (daysRemaining <= 7) {
      return <Badge className="bg-yellow-100 text-yellow-800">Atenção ({daysRemaining} dias)</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Ativo ({daysRemaining} dias)</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Carregando configurações POC...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  console.log('🎨 [POC] Renderizando componente com pocData:', {
    exists: !!pocData,
    is_poc: pocData?.is_poc,
    poc_status: pocData?.poc_status,
    showStatusCard: !!pocData,
    showActionsCard: pocData?.is_poc && pocData?.poc_status === 'active'
  });

  return (
    <div className="space-y-6">
      {/* Status atual */}
      {pocData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Status da POC
            </CardTitle>
            <CardDescription>
              Informações atuais sobre o período de POC da organização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="">Status:</span>
              {getStatusBadge(pocData.poc_status, pocData.days_remaining)}
            </div>
            
            {pocData.is_poc && (
              <>
                <div className="flex items-center justify-between">
                  <span className="">Início:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(pocData.poc_start_date)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="">Fim:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(pocData.poc_end_date)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="">Duração:</span>
                  <span>{pocData.poc_duration_days} dias</span>
                </div>

                {(pocData.contact_email || pocData.contact_phone) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <span className="">Contato:</span>
                      {pocData.contact_email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {pocData.contact_email}
                        </div>
                      )}
                      {pocData.contact_phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {pocData.contact_phone}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuração POC */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração POC</CardTitle>
          <CardDescription>
            Configure se esta organização está em período de POC
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-poc"
              checked={isPoc}
              onCheckedChange={setIsPoc}
            />
            <Label htmlFor="is-poc">Esta é uma organização POC</Label>
          </div>
          

          {isPoc && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Data de início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (dias)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
          )}

          {/* Campos de contato para notificações */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <Label className="text-sm">Contatos para Notificações</Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">E-mail para notificações</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Telefone/WhatsApp</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+55 11 99999-9999"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              <Phone className="w-3 h-3 inline mr-1" />
              Estes contatos serão usados para enviar notificações sobre o status da POC
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Adicione observações sobre esta configuração..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button 
            onClick={handleSavePoc} 
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>

      {/* Ações para POC ativa */}
      {pocData?.is_poc && pocData.poc_status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Ações POC
            </CardTitle>
            <CardDescription>
              Gerencie o período de POC da organização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estender POC */}
            <div className="space-y-2">
              <Label htmlFor="extend-days">Estender POC por (dias)</Label>
              <div className="flex gap-2">
                <Input
                  id="extend-days"
                  type="number"
                  min="1"
                  max="365"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                  placeholder="Ex: 30"
                />
                <Button 
                  onClick={handleExtendPoc} 
                  disabled={saving || extendDays <= 0}
                  variant="outline"
                >
                  Estender
                </Button>
              </div>
            </div>

            <Separator />

            {/* Converter para full */}
            <div className="space-y-2">
              <Label>Converter para plano completo</Label>
              <p className="text-sm text-gray-600">
                Remove a tag POC e converte a organização para plano completo
              </p>
              <Button 
                onClick={handleConvertToFull} 
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Converter para Plano Completo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {pocData?.history && pocData.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Alterações
            </CardTitle>
            <CardDescription>
              Registro de todas as alterações na POC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pocData.history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {entry.action === 'created' && <Plus className="w-4 h-4 text-green-600" />}
                    {entry.action === 'extended' && <Clock className="w-4 h-4 text-blue-600" />}
                    {entry.action === 'converted' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {entry.action === 'expired' && <XCircle className="w-4 h-4 text-red-600" />}
                    {entry.action === 'updated' && <Send className="w-4 h-4 text-gray-600" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="capitalize">
                        {entry.action === 'created' && 'POC Criada'}
                        {entry.action === 'extended' && 'POC Estendida'}
                        {entry.action === 'converted' && 'POC Convertida'}
                        {entry.action === 'expired' && 'POC Expirada'}
                        {entry.action === 'updated' && 'POC Atualizada'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>
                    
                    {entry.profiles && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                        <User className="w-3 h-3" />
                        {entry.profiles.name} ({entry.profiles.email})
                      </div>
                    )}
                    
                    {entry.notes && (
                      <p className="text-sm text-gray-600">{entry.notes}</p>
                    )}
                    
                    {entry.old_end_date && entry.new_end_date && (
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="line-through">{formatDate(entry.old_end_date)}</span>
                        <span className="mx-2">→</span>
                        <span className="">{formatDate(entry.new_end_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PocConfiguration;
