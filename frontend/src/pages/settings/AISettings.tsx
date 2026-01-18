import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, CheckCircle, XCircle, Save, Volume2, Play, Mic } from 'lucide-react';
import { useAISettings } from '@/hooks/ai/useAISettings';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/utils/apiBase'; // ✅ MIGRADO: Usa getAuthHeaders do apiBase
import { apiBase } from '@/utils/apiBase';

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
}

export default function AISettings() {
  const { 
    settings, 
    processingConfig,
    loading, 
    saving, 
    hasChanges, 
    error,
    loadSettings, 
    saveSettings, 
    updateSettings, 
    resetChanges,
    testSettings 
  } = useAISettings();
  
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Estados para funcionalidades de áudio
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      console.log('🔍 Salvando configurações de IA...');
      console.log('⚙️ Configurações atuais:', settings);
      
      await saveSettings();
      
      toast({
        title: "✅ Sucesso",
        description: "Configurações de IA salvas com sucesso!",
      });
    } catch (error: any) {
      console.error('❌ Erro ao salvar configurações:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao salvar configurações: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testSettings('Teste de configurações de IA');
      setTestResult(result);
      toast({
        title: "✅ Teste Concluído",
        description: "Configurações testadas com sucesso!",
      });
    } catch (error: any) {
      setTestResult({ error: error.message });
      toast({
        title: "❌ Erro no Teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  // Carregar voices do ElevenLabs
  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${apiBase}/api/ai-settings/voices`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to load voices');
      }

      const data = await response.json();
      setVoices(data.voices);
      
      toast({
        title: "✅ Voices Carregadas",
        description: `${data.count} voices encontradas`,
      });
    } catch (error: any) {
      console.error('Error loading voices:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao carregar voices: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingVoices(false);
    }
  };

  // Testar voice específica
  const testVoice = async (voiceId: string) => {
    setTestingVoice(voiceId);
    setAudioUrl(null);
    
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${apiBase}/api/ai-settings/voices/test`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          voiceId,
          text: "Olá! Esta é uma demonstração da minha voz. Como posso ajudá-lo hoje?"
        })
      });

      if (!response.ok) {
        throw new Error('Failed to test voice');
      }

      const data = await response.json();
      setAudioUrl(data.audioUrl);
      
      toast({
        title: "✅ Teste Concluído",
        description: "Voice testada com sucesso!",
      });
    } catch (error: any) {
      console.error('Error testing voice:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao testar voice: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTestingVoice(null);
    }
  };

  // Gerar áudio para texto
  const generateAudio = async (text: string) => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${apiBase}/api/ai-settings/audio/generate`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          text,
          voiceId: settings.audio.voiceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const data = await response.json();
      setAudioUrl(data.audioUrl);
      
      toast({
        title: "✅ Áudio Gerado",
        description: "Áudio gerado com sucesso!",
      });
    } catch (error: any) {
      console.error('Error generating audio:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao gerar áudio: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">Configurações de IA</h1>
          <p className="text-muted-foreground">
            Configure as funcionalidades de inteligência artificial da sua organização
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Testar Configurações
          </Button>
          
          {hasChanges && (
            <Button
              variant="outline"
              onClick={resetChanges}
            >
              Descartar Mudanças
            </Button>
          )}
          
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Todas as Configurações
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Resultado do Teste
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResult.error ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{testResult.error}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm">Modelo</Label>
                    <p className="text-sm text-muted-foreground">{testResult.settings.model}</p>
                  </div>
                  <div>
                    <Label className="text-sm">Temperatura</Label>
                    <p className="text-sm text-muted-foreground">{testResult.settings.temperature}</p>
                  </div>
                  <div>
                    <Label className="text-sm">Max Tokens</Label>
                    <p className="text-sm text-muted-foreground">{testResult.settings.maxTokens}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Áudio</Label>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={testResult.audio.enabled ? "default" : "secondary"}>
                        {testResult.audio.enabled ? "Habilitado" : "Desabilitado"}
                      </Badge>
                      {testResult.audio.enabled && (
                        <>
                          <Badge variant={testResult.audio.transcriptionEnabled ? "default" : "secondary"}>
                            Transcrição: {testResult.audio.transcriptionEnabled ? "Sim" : "Não"}
                          </Badge>
                          <Badge variant={testResult.audio.synthesisEnabled ? "default" : "secondary"}>
                            Síntese: {testResult.audio.synthesisEnabled ? "Sim" : "Não"}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Imagem</Label>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={testResult.image.enabled ? "default" : "secondary"}>
                        {testResult.image.enabled ? "Habilitado" : "Desabilitado"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {processingConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Configurações Ativas</CardTitle>
            <CardDescription>
              Configurações que estão sendo aplicadas no processamento de IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Modelo</Label>
                <p className="text-sm text-muted-foreground">{processingConfig.model}</p>
              </div>
              <div>
                <Label className="text-sm">Temperatura</Label>
                <p className="text-sm text-muted-foreground">{processingConfig.temperature}</p>
              </div>
              <div>
                <Label className="text-sm">Max Tokens</Label>
                <p className="text-sm text-muted-foreground">{processingConfig.maxTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="audio">Áudio</TabsTrigger>
          <TabsTrigger value="image">Imagem</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configure o modelo de IA e parâmetros básicos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar IA</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativa o processamento de IA para a organização
                  </p>
                </div>
                <Switch
                  checked={settings.general.enabled}
                  onCheckedChange={(checked) => 
                    updateSettings('general', { enabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provedor</Label>
                  <Select
                    value={settings.general.provider}
                    onValueChange={(value) => 
                      updateSettings('general', { provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select
                    value={settings.general.model}
                    onValueChange={(value) => 
                      updateSettings('general', { model: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperatura</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.general.temperature}
                    onChange={(e) => 
                      updateSettings('general', { 
                        temperature: parseFloat(e.target.value) 
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Controla a criatividade das respostas (0 = mais focado, 2 = mais criativo)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Máximo de Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={settings.general.maxTokens}
                    onChange={(e) => 
                      updateSettings('general', { 
                        maxTokens: parseInt(e.target.value) 
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Limite máximo de tokens por resposta
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Áudio</CardTitle>
              <CardDescription>
                Configure transcrição e síntese de áudio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Processamento de Áudio</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativa funcionalidades de áudio para a organização
                  </p>
                </div>
                <Switch
                  checked={settings.audio.enabled}
                  onCheckedChange={(checked) => 
                    updateSettings('audio', { enabled: checked })
                  }
                />
              </div>

              {settings.audio.enabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="audioProvider">Provedor de Áudio</Label>
                      <Select
                        value={settings.audio.provider}
                        onValueChange={(value) => 
                          updateSettings('audio', { provider: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                          <SelectItem value="google">Google TTS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Idioma</Label>
                      <Select
                        value={settings.audio.language}
                        onValueChange={(value) => 
                          updateSettings('audio', { language: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en-US">Inglês (EUA)</SelectItem>
                          <SelectItem value="es-ES">Espanhol</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Transcrição de Áudio</Label>
                        <p className="text-sm text-muted-foreground">
                          Converte mensagens de áudio em texto
                        </p>
                      </div>
                      <Switch
                        checked={settings.audio.transcriptionEnabled}
                        onCheckedChange={(checked) => 
                          updateSettings('audio', { 
                            transcriptionEnabled: checked 
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Síntese de Áudio</Label>
                        <p className="text-sm text-muted-foreground">
                          Converte respostas de texto em áudio
                        </p>
                      </div>
                      <Switch
                        checked={settings.audio.synthesisEnabled}
                        onCheckedChange={(checked) => 
                          updateSettings('audio', { 
                            synthesisEnabled: checked 
                          })
                        }
                      />
                    </div>
                  </div>

                  {settings.audio.synthesisEnabled && settings.audio.provider === 'elevenlabs' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="voiceId">ID da Voz (ElevenLabs)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="voiceId"
                            placeholder="Digite o ID da voz"
                            value={settings.audio.voiceId}
                            onChange={(e) => 
                              updateSettings('audio', { 
                                voiceId: e.target.value 
                              })
                            }
                          />
                          <Button
                            variant="outline"
                            onClick={loadVoices}
                            disabled={loadingVoices}
                          >
                            {loadingVoices ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                            Carregar Voices
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ID da voz configurada no ElevenLabs
                        </p>
                      </div>

                      {voices.length > 0 && (
                        <div className="space-y-2">
                          <Label>Voices Disponíveis</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                            {voices.map((voice) => (
                              <div
                                key={voice.voice_id}
                                className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50"
                              >
                                <div className="flex-1">
                                  <p className="text-sm">{voice.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {voice.voice_id}
                                  </p>
                                  {voice.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {voice.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateSettings('audio', { voiceId: voice.voice_id })}
                                    disabled={settings.audio.voiceId === voice.voice_id}
                                  >
                                    {settings.audio.voiceId === voice.voice_id ? 'Selecionada' : 'Selecionar'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => testVoice(voice.voice_id)}
                                    disabled={testingVoice === voice.voice_id}
                                  >
                                    {testingVoice === voice.voice_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {audioUrl && (
                        <div className="space-y-2">
                          <Label>Áudio de Teste</Label>
                          <audio controls className="w-full">
                            <source src={`${apiBase}${audioUrl}`} type="audio/mpeg" />
                            Seu navegador não suporta o elemento de áudio.
                          </audio>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Teste de Geração de Áudio</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite um texto para testar"
                            defaultValue="Olá! Esta é uma demonstração da geração de áudio."
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                generateAudio(e.currentTarget.value);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              generateAudio(input.value);
                            }}
                          >
                            <Volume2 className="h-4 w-4" />
                            Gerar Áudio
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Imagem</CardTitle>
              <CardDescription>
                Configure geração e processamento de imagens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Processamento de Imagem</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativa funcionalidades de imagem para a organização
                  </p>
                </div>
                <Switch
                  checked={settings.image.enabled}
                  onCheckedChange={(checked) => 
                    updateSettings('image', { enabled: checked })
                  }
                />
              </div>

              {settings.image.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imageProvider">Provedor de Imagem</Label>
                      <Select
                        value={settings.image.provider}
                        onValueChange={(value) => 
                          updateSettings('image', { provider: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="openai">OpenAI DALL-E</SelectItem>
                          <SelectItem value="midjourney">Midjourney</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imageModel">Modelo de Imagem</Label>
                      <Select
                        value={settings.image.model}
                        onValueChange={(value) => 
                          updateSettings('image', { model: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                          <SelectItem value="dall-e-2">DALL-E 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imageSize">Tamanho da Imagem</Label>
                    <Select
                      value={settings.image.size}
                      onValueChange={(value) => 
                        updateSettings('image', { size: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">1024x1024</SelectItem>
                        <SelectItem value="1792x1024">1792x1024</SelectItem>
                        <SelectItem value="1024x1792">1024x1792</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Alert>
                <AlertDescription>
                  ⚠️ Funcionalidades de imagem estão em desenvolvimento e serão implementadas em breve.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 