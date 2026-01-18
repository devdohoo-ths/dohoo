import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Plus, Edit, Trash2, Eye, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'expiring_soon' | 'expired' | 'custom';
  days_before: number | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
}

const PocEmailTemplates: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
    type: 'custom' as 'expiring_soon' | 'expired' | 'custom',
    days_before: 7,
    is_active: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/poc-email-templates`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar templates');
      }

      const result = await response.json();
      setTemplates(result.templates || []);
      
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar templates de email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (template: EmailTemplate | null = null) => {
    if (template) {
      if (template.is_default) {
        toast({
          title: "Atenção",
          description: "Templates padrão do sistema não podem ser editados, apenas ativados/desativados",
          variant: "destructive",
        });
        return;
      }
      setEditTemplate(template);
      setForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        type: template.type,
        days_before: template.days_before || 7,
        is_active: template.is_active
      });
    } else {
      setEditTemplate(null);
      setForm({
        name: '',
        subject: '',
        body: '',
        type: 'custom',
        days_before: 7,
        is_active: true
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTemplate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const url = editTemplate 
        ? `${apiBase}/api/poc-email-templates/${editTemplate.id}`
        : `${apiBase}/api/poc-email-templates`;
      
      const method = editTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar template');
      }

      toast({
        title: "Sucesso",
        description: editTemplate ? 'Template atualizado com sucesso' : 'Template criado com sucesso',
      });

      closeModal();
      fetchTemplates();
      
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      toast({
        title: "Erro",
        description: error.message || 'Falha ao salvar template',
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/poc-email-templates/${templateId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir template');
      }

      toast({
        title: "Sucesso",
        description: 'Template excluído com sucesso',
      });

      fetchTemplates();
      
    } catch (error: any) {
      console.error('Erro ao excluir template:', error);
      toast({
        title: "Erro",
        description: error.message || 'Falha ao excluir template',
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (template: EmailTemplate) => {
    try {
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/poc-email-templates/${template.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_active: !template.is_active })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      toast({
        title: "Sucesso",
        description: template.is_active ? 'Template desativado' : 'Template ativado',
      });

      fetchTemplates();
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status do template",
        variant: "destructive",
      });
    }
  };

  const openPreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewModalOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'expiring_soon':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-red-600" />;
      default:
        return <Mail className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'expiring_soon':
        return 'Expirando';
      case 'expired':
        return 'Expirado';
      default:
        return 'Personalizado';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Carregando templates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Templates de Email POC
              </CardTitle>
              <CardDescription>
                Gerencie os templates de email para notificações de POC
              </CardDescription>
            </div>
            <Button onClick={() => openModal()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templates.map((template) => (
              <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(template.type)}
                        <h3 className="">{template.name}</h3>
                        {template.is_default && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Padrão do Sistema
                          </Badge>
                        )}
                        {!template.is_active && (
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.subject}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Tipo: {getTypeLabel(template.type)}
                        </span>
                        {template.type === 'expiring_soon' && template.days_before && (
                          <span>
                            Enviar {template.days_before} dias antes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => toggleActive(template)}
                        title={template.is_active ? 'Desativar' : 'Ativar'}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPreview(template)}
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!template.is_default && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal(template)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(template.id)}
                            title="Excluir"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum template cadastrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de criação/edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
            <div>
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ex: POC Expirando em 5 dias"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(value: any) => setForm({ ...form, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expiring_soon">Expirando em breve</SelectItem>
                    <SelectItem value="expired">POC Expirada</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === 'expiring_soon' && (
                <div>
                  <Label htmlFor="days_before">Dias antes do vencimento *</Label>
                  <Input
                    id="days_before"
                    type="number"
                    min="1"
                    max="365"
                    value={form.days_before}
                    onChange={(e) => setForm({ ...form, days_before: parseInt(e.target.value) || 7 })}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="subject">Assunto do Email *</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                placeholder="Ex: Sua POC está expirando - {{organization_name}}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Variáveis disponíveis: {'{{'} organization_name {'}}'},  {'{{'} days_remaining {'}}'},  {'{{'} poc_end_date {'}}'}, etc.
              </p>
            </div>

            <div>
              <Label htmlFor="body">Corpo do Email (HTML) *</Label>
              <Textarea
                id="body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
                rows={15}
                className="font-mono text-sm"
                placeholder="<html>...</html>"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use HTML para formatar o email. Variáveis: {'{{'} organization_name {'}}'},  {'{{'} poc_start_date {'}}'},  {'{{'} poc_end_date {'}}'},  {'{{'} days_remaining {'}}'},  {'{{'} poc_duration_days {'}}'},  {'{{'} contact_url {'}}'}.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="is_active">Template ativo</Label>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" onClick={handleSubmit}>
              {editTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de visualização */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualizar Template</DialogTitle>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div>
                <Label>Nome</Label>
                <p className="text-sm">{previewTemplate.name}</p>
              </div>
              
              <div>
                <Label>Assunto</Label>
                <p className="text-sm">{previewTemplate.subject}</p>
              </div>
              
              <div>
                <Label>Preview do Email</Label>
                <div 
                  className="border rounded-lg p-4 bg-white"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PocEmailTemplates;

