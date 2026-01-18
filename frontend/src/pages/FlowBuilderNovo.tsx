import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Search, 
  Filter,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Brain,
  MessageCircle,
  Settings,
  Zap
} from 'lucide-react';
import { useFlows } from '@/hooks/useFlows';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { apiBase } from '@/utils/apiBase';

export default function FlowBuilderNovo() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mensagemInicial, setMensagemInicial] = useState('');
  const [opcoes, setOpcoes] = useState(['']);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleAddOpcao = () => setOpcoes([...opcoes, '']);
  const handleRemoveOpcao = (idx: number) => setOpcoes(opcoes.filter((_, i) => i !== idx));
  const handleOpcaoChange = (idx: number, value: string) => setOpcoes(opcoes.map((o, i) => i === idx ? value : o));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const flow = {
      nome,
      descricao,
      nodes: [
        {
          id: `inicio-${Date.now()}`,
          type: 'inicio',
          position: { x: 0, y: 0 },
          data: {
            label: nome,
            config: { mensagemInicial, opcoes: opcoes.filter(Boolean) }
          }
        }
      ],
      edges: [],
      ativo: false,
      canal: 'whatsapp'
    };
    try {
      const response = await fetch(`${apiBase}/api/flows/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Erro ao salvar');
      toast({ title: 'Fluxo criado!', description: 'Fluxo salvo com sucesso.' });
      setOpen(false);
      setNome('');
      setDescricao('');
      setMensagemInicial('');
      setOpcoes(['']);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
          <PermissionGuard requiredPermissions={['manage_flows']}>
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>Novo Fluxo (Modal Simples)</Button>
        {open && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setOpen(false)}>&times;</button>
              <h2 className="text-xl mb-4">Criar Novo Fluxo</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1">Nome *</label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} required />
                </div>
                <div>
                  <label className="block mb-1">Descrição</label>
                  <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-1">Mensagem Inicial *</label>
                  <Input value={mensagemInicial} onChange={e => setMensagemInicial(e.target.value)} required />
                </div>
                <div>
                  <label className="block mb-1">Opções</label>
                  {opcoes.map((op, idx) => (
                    <div key={idx} className="flex gap-2 mb-1">
                      <Input value={op} onChange={e => handleOpcaoChange(idx, e.target.value)} placeholder={`Opção ${idx + 1}`} />
                      {opcoes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOpcao(idx)}>&times;</Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddOpcao}>Adicionar Opção</Button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Fluxo'}</Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
} 