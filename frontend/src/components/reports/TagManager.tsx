import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Search, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTags } from '@/hooks/useTags';

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  onSelectTag?: (tag: string) => void;
}

export const TagManager: React.FC<TagManagerProps> = ({
  open,
  onClose,
  onSelectTag
}) => {
  const { tags, loading, fetchTags } = useTags();
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/api/tag-categories')
      .then(res => res.json())
      .then(data => setCategories(data.categories || []));
  }, []);

  // Filtro de tags
  const filteredTags = tags.filter(tag => {
    const matchesSearch = (tag.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null ? true : tag.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Função para obter nome da categoria selecionada
  const getSelectedCategoryName = () => {
    if (selectedCategory === null) return 'Todas';
    const category = categories.find(cat => cat.id === selectedCategory);
    return category ? category.name : 'Categoria';
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) {
      toast({ title: "Erro", description: "Digite uma tag", variant: "destructive" });
      return;
    }
    if (!newCategory) {
      toast({ title: "Erro", description: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    if (tags.some(t => t.name.toLowerCase() === newTag.trim().toLowerCase())) {
      toast({ title: "Erro", description: "Esta tag já existe", variant: "destructive" });
      return;
    }
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTag.trim(), category_id: newCategory }),
    });
    setNewTag('');
    setNewCategory('');
    fetchTags();
    toast({ title: "Sucesso", description: "Tag adicionada com sucesso" });
  };

  const handleDeleteTag = async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    fetchTags();
    toast({ title: "Sucesso", description: "Tag removida com sucesso" });
  };

  const handleSelectTag = (tagName: string) => {
    if (onSelectTag) {
      onSelectTag(tagName);
    }
    onClose();
  };

  const getCategoryCount = (categoryId: string) => {
    return tags.filter(t => t.category_id === categoryId).length;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Gerenciar Tags
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Adicionar nova tag */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adicionar Nova Tag</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col md:flex-row gap-2 items-end md:items-end flex-wrap">
                <div className="flex-1">
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Digite a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                </div>
                <div className="w-48">
                  <Label htmlFor="category">Categoria</Label>
                  <select
                    id="category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Selecione</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAddTag} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Todas ({tags.length})
              </Button>
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name.charAt(0).toUpperCase() + category.name.slice(1)} ({getCategoryCount(category.id)})
                </Button>
              ))}
            </div>
          </div>

          {/* Categorias existentes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Categorias Existentes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 overflow-x-auto">
                {categories.map(category => (
                  <Badge 
                    key={category.id} 
                    className="cursor-pointer hover:opacity-80 whitespace-nowrap"
                    style={{ background: category.color || '#eee', color: '#333' }}
                  >
                    {category.name} ({getCategoryCount(category.id)})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lista de tags */}
          <Card className="flex-1 min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Tags - {getSelectedCategoryName()}</span>
                <Badge variant="secondary">{filteredTags.length} encontradas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-full">
              <div className="h-full overflow-y-auto">
                {filteredTags.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma tag encontrada</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTags.map((tag) => {
                      const category = categories.find(cat => cat.id === tag.category_id);
                      return (
                        <div key={tag.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="">{tag.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: category?.color || '#eee', color: '#333' }}>
                              {category ? category.name : 'Sem categoria'}
                            </span>
                            {tag.usage_count && (
                              <Badge variant="outline" className="text-xs">
                                {tag.usage_count} usos
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            {onSelectTag && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSelectTag(tag.name)}
                              >
                                Usar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTag(tag.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 