import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Search, Tag, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useKeywords } from '@/hooks/useKeywords';

interface Keyword {
  id: string;
  name: string;
  created_at?: string;
}

interface KeywordManagerProps {
  open: boolean;
  onClose: () => void;
  onSelectKeyword?: (keyword: string) => void;
}

export const KeywordManager: React.FC<KeywordManagerProps> = ({
  open,
  onClose,
  onSelectKeyword
}) => {
  const { keywords, loading, fetchKeywords, addKeyword, deleteKeyword, searchKeywords } = useKeywords();
  const [newKeyword, setNewKeyword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Keyword[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Filtro de palavras-chave cadastradas
  const filteredKeywords = keywords.filter(keyword => 
    keyword.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Buscar palavras-chave por texto
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchKeywords(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce para busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({ 
        title: "Erro", 
        description: "Digite uma palavra-chave", 
        variant: "destructive" 
      });
      return;
    }

    // Verificar se já existe
    if (keywords.some(k => k.name.toLowerCase() === newKeyword.trim().toLowerCase())) {
      toast({ 
        title: "Erro", 
        description: "Esta palavra-chave já existe", 
        variant: "destructive" 
      });
      return;
    }

    try {
      await addKeyword({ name: newKeyword.trim() });
      setNewKeyword('');
      toast({ 
        title: "Sucesso", 
        description: "Palavra-chave adicionada com sucesso" 
      });
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: error instanceof Error ? error.message : "Erro ao adicionar palavra-chave", 
        variant: "destructive" 
      });
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      await deleteKeyword(id);
      toast({ 
        title: "Sucesso", 
        description: "Palavra-chave removida com sucesso" 
      });
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: error instanceof Error ? error.message : "Erro ao remover palavra-chave", 
        variant: "destructive" 
      });
    }
  };

  const handleSelectKeyword = (keyword: string) => {
    if (onSelectKeyword) {
      onSelectKeyword(keyword);
    }
    onClose();
  };

  const handleUseSearchResult = (keyword: string) => {
    if (onSelectKeyword) {
      onSelectKeyword(keyword);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciar Palavras-chave
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Adicionar nova palavra-chave */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adicionar Nova Palavra-chave</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="keyword">Palavra-chave</Label>
                  <Input
                    id="keyword"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Digite a palavra-chave..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                  />
                </div>
                <Button 
                  onClick={handleAddKeyword}
                  disabled={loading || !newKeyword.trim()}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Busca por palavras-chave */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Buscar Palavras-chave</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Digite para buscar palavras-chave..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Resultados da busca */}
                {searchTerm && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      {isSearching ? 'Buscando...' : `Resultados para "${searchTerm}"`}
                    </div>
                    {searchResults.length > 0 ? (
                      <div className="space-y-1">
                        {searchResults.map((keyword) => (
                          <div key={keyword.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                            <span className="">{keyword.name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUseSearchResult(keyword.name)}
                            >
                              Usar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : !isSearching && (
                      <div className="text-sm text-gray-500 p-2">
                        Nenhuma palavra-chave encontrada
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de palavras-chave cadastradas */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Palavras-chave Cadastradas</span>
                <Badge variant="secondary">{filteredKeywords.length} encontradas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 h-full">
              <div className="h-full overflow-y-auto">
                {filteredKeywords.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma palavra-chave encontrada</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredKeywords.map((keyword) => (
                      <div key={keyword.id} className="flex items-center justify-between py-2 border-b gap-2">
                        <div className="flex items-center gap-3">
                          <span className="">{keyword.name}</span>
                          <Badge variant="outline" className="text-xs">
                            Cadastrada
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {onSelectKeyword && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectKeyword(keyword.name)}
                            >
                              Usar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteKeyword(keyword.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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