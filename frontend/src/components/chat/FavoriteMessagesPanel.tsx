import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFavoriteMessages } from '@/hooks/useFavoriteMessages';
import { 
  Star, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  Search,
  Filter,
  MessageCircle,
  X
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FavoriteMessagesPanelProps {
  onSelectMessage: (content: string) => void;
  onClose: () => void;
}

export const FavoriteMessagesPanel: React.FC<FavoriteMessagesPanelProps> = ({
  onSelectMessage,
  onClose
}) => {
  const { favoriteMessages, loading, createFavoriteMessage, updateFavoriteMessage, deleteFavoriteMessage } = useFavoriteMessages();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newMessage, setNewMessage] = useState({ title: '', content: '', category: 'geral' });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const categories = ['geral', 'saudação', 'despedida', 'produtos', 'suporte', 'vendas'];
  
  const filteredMessages = favoriteMessages.filter(message => {
    const matchesSearch = message.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || message.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openCreateDialog = () => {
    setEditId(null);
    setNewMessage({ title: '', content: '', category: 'geral' });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (msg: typeof newMessage & { id: string }) => {
    setEditId(msg.id);
    setNewMessage({ title: msg.title, content: msg.content, category: msg.category });
    setIsCreateDialogOpen(true);
  };

  const handleCreateOrEditMessage = async () => {
    if (newMessage.title && newMessage.content) {
      setSaving(true);
      if (editId) {
        await updateFavoriteMessage(editId, newMessage);
      } else {
        await createFavoriteMessage(newMessage.title, newMessage.content, newMessage.category);
      }
      setNewMessage({ title: '', content: '', category: 'geral' });
      setSaving(false);
      setIsCreateDialogOpen(false);
      setEditId(null);
    }
  };

  const handleSelectMessage = (content: string) => {
    onSelectMessage(content);
    onClose();
  };

  return (
    <Card className="w-96 h-[600px] flex flex-col shadow-xl border-2 relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 text-gray-500 z-20"
        title="Fechar"
        style={{ right: 12, top: 12 }}
      >
        <X size={20} />
      </button>
      <CardHeader className="pb-4 pt-8">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Mensagens Favoritas
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? 'Editar Mensagem Favorita' : 'Nova Mensagem Favorita'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm">Título</label>
                  <Input
                    placeholder="Ex: Saudação inicial"
                    value={newMessage.title}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm">Categoria</label>
                  <Select 
                    value={newMessage.category} 
                    onValueChange={(value) => setNewMessage(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Mensagem</label>
                  <Textarea
                    placeholder="Digite sua mensagem favorita..."
                    value={newMessage.content}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleCreateOrEditMessage}
                  className="w-full"
                  disabled={saving || !newMessage.title || !newMessage.content}
                >
                  {saving ? (editId ? 'Salvando...' : 'Salvando...') : (editId ? 'Salvar Alterações' : 'Salvar Mensagem')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Filtros */}
        <div className="space-y-3 mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma mensagem favorita encontrada</p>
              <p className="text-sm">Crie sua primeira mensagem!</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredMessages.map((message) => (
                <li key={message.id} className="py-2 flex items-center group hover:bg-gray-50 rounded-lg px-2 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-900 truncate max-w-[120px]" title={message.title}>{message.title}</span>
                      <Badge variant="secondary" className="text-xs">{message.category}</Badge>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] cursor-help" >
                            {message.content}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>{message.content}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-1 ml-2 opacity-80 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSelectMessage(message.content)}
                      className="h-7 w-7 text-green-600 hover:bg-green-100"
                      title="Usar Mensagem"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-blue-600 hover:bg-blue-100"
                      title="Editar"
                      onClick={() => openEditDialog({ ...message })}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteFavoriteMessage(message.id); }}
                      className="h-7 w-7 text-red-500 hover:bg-red-100"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
