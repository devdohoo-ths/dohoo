import React, { useState, useEffect } from 'react';
import { Settings, Type, Mic, Image as ImageIcon, Save, Play, Pause, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AIProvider } from '@/types';
import { useToast } from "@/components/ui/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAvailableVoices, Voice } from '@/services/elevenLabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAISettings, AISettings } from '@/hooks/ai/useAISettings';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Provedores de IA disponíveis
const aiProviders: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-vision'],
    features: { text: true, audio: true, image: true }
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    features: { text: true, audio: false, image: true }
  },
  {
    id: 'google',
    name: 'Google',
    models: ['gemini-pro', 'gemini-pro-vision'],
    features: { text: true, audio: true, image: true }
  }
];

const AISettingsPage = () => {
  const { toast } = useToast();
  const {
    settings,
    loading,
    saving,
    hasChanges,
    saveSettings,
    updateSettings,
    currentOrganization,
    error
  } = useAISettings();
  
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  console.log('🔧 AISettingsPage - Estado atual:', {
    loading,
    saving,
    hasChanges,
    error,
    currentOrganization,
    settings
  });

  useEffect(() => {
    if (settings.audio.provider === 'elevenlabs') {
      loadVoices();
    }
  }, [settings.audio.provider]);

  const loadVoices = async () => {
    try {
      const voices = await getAvailableVoices();
      setAvailableVoices(voices);
    } catch (error) {
      console.error('Error loading voices:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as vozes disponíveis.",
        variant: "destructive",
      });
    }
  };

  const playVoicePreview = (voice: Voice) => {
    if (!voice.preview_url) return;

    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    const audio = new Audio(voice.preview_url);
    setAudioElement(audio);
    setPlayingVoice(voice.voice_id);
    
    audio.play().catch(error => {
      console.error('Error playing voice preview:', error);
      setPlayingVoice(null);
    });

    audio.onended = () => {
      setPlayingVoice(null);
    };
  };

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl text-gray-900">Erro ao carregar configurações</h2>
          <p className="text-gray-600">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-lg">Carregando configurações...</p>
          <p className="text-sm text-muted-foreground">Aguarde enquanto carregamos as configurações de IA</p>
        </div>
      </div>
    );
  }

  return (
          <PermissionGuard requiredPermissions={['configure_prompts']}>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl">Configurações de IA</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie as configurações globais de IA para {currentOrganization?.name || 'sua organização'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                Alterações não salvas
              </Badge>
            )}
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="audio">Processamento de Áudio</TabsTrigger>
            <TabsTrigger value="image">Processamento de Imagem</TabsTrigger>
          </TabsList>

          {/* Configurações Gerais */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Configurações Gerais</span>
                </CardTitle>
                <CardDescription>
                  Configure as opções gerais de IA para sua organização
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="">Habilitar IA</h3>
                    <p className="text-sm text-muted-foreground">
                      Ativa o processamento de IA para toda a organização
                    </p>
                  </div>
                  <Switch
                    id="general-enabled"
                    checked={settings.general.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings('general', { enabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Provedor de IA</Label>
                    <Select
                      value={settings.general.provider}
                      onValueChange={(value) =>
                        updateSettings('general', { 
                          provider: value,
                          model: aiProviders.find(p => p.id === value)?.models[0] || 'gpt-4o-mini'
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center gap-2">
                              <span>{provider.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {provider.models.length} modelos
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo</Label>
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
                        {aiProviders
                          .find(p => p.id === settings.general.provider)
                          ?.models.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperatura</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="temperature"
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.general.temperature}
                        onChange={(e) =>
                          updateSettings('general', {
                            temperature: parseFloat(e.target.value),
                          })
                        }
                      />
                      <span className="text-sm text-muted-foreground w-16">
                        {settings.general.temperature}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criatividade da resposta (0 = precisa, 2 = criativa)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Máximo de Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="100"
                      max="8000"
                      step="100"
                      value={settings.general.maxTokens}
                      onChange={(e) =>
                        updateSettings('general', {
                          maxTokens: parseInt(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Limite máximo de tokens por resposta
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={saveSettings} 
                    disabled={saving || !hasChanges}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                  >
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Processamento de Áudio */}
          <TabsContent value="audio">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="w-5 h-5" />
                  <span>Processamento de Áudio</span>
                </CardTitle>
                <CardDescription>
                  Configure as opções de processamento de áudio (transcrição e síntese)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="">Habilitar Processamento de Áudio</h3>
                    <p className="text-sm text-muted-foreground">
                      Ativa recursos de áudio para transcrição e síntese de voz
                    </p>
                  </div>
                  <Switch
                    id="audio-enabled"
                    checked={settings.audio.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings('audio', { enabled: checked })
                    }
                  />
                </div>

                {settings.audio.enabled && (
                  <>
                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Transcrição de Áudio</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="transcription-enabled"
                            checked={settings.audio.transcriptionEnabled}
                            onCheckedChange={(checked) =>
                              updateSettings('audio', { transcriptionEnabled: checked })
                            }
                          />
                          <Label htmlFor="transcription-enabled" className="text-sm">
                            Converter áudio em texto
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Permite que a IA transcreva mensagens de áudio do WhatsApp
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Síntese de Voz</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="synthesis-enabled"
                            checked={settings.audio.synthesisEnabled}
                            onCheckedChange={(checked) =>
                              updateSettings('audio', { synthesisEnabled: checked })
                            }
                          />
                          <Label htmlFor="synthesis-enabled" className="text-sm">
                            Converter texto em áudio
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Permite que a IA responda com áudio no WhatsApp
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Provedor de Áudio</Label>
                      <Select
                        value={settings.audio.provider}
                        onValueChange={(value) =>
                          updateSettings('audio', {
                            provider: value as 'elevenlabs' | 'google' | 'none',
                            voiceId: '', // Reset voiceId when changing provider
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="elevenlabs">
                            <div className="flex items-center gap-2">
                              <span>Eleven Labs</span>
                              <Badge variant="outline" className="text-xs">Recomendado</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="google">Google Cloud</SelectItem>
                          <SelectItem value="none">Nenhum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {settings.audio.provider === 'elevenlabs' && (
                      <div className="space-y-2">
                        <Label>Voz para Síntese</Label>
                        <div className="flex gap-2">
                          <Select
                            value={settings.audio.voiceId}
                            onValueChange={(value) =>
                              updateSettings('audio', { voiceId: value })
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecione uma voz" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableVoices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {settings.audio.voiceId && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const voice = availableVoices.find(
                                  (v) => v.voice_id === settings.audio.voiceId
                                );
                                if (voice) playVoicePreview(voice);
                              }}
                            >
                              {playingVoice === settings.audio.voiceId ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                        {settings.audio.voiceId && (
                          <p className="text-sm text-muted-foreground">
                            {availableVoices.find((v) => v.voice_id === settings.audio.voiceId)?.description}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Idioma Principal</Label>
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
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={saveSettings} 
                    disabled={saving || !hasChanges}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                  >
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Processamento de Imagem */}
          <TabsContent value="image">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ImageIcon className="w-5 h-5" />
                  <span>Processamento de Imagem</span>
                </CardTitle>
                <CardDescription>
                  Configure as opções de processamento de imagem (em desenvolvimento)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="">Habilitar Processamento de Imagem</h3>
                    <p className="text-sm text-muted-foreground">
                      Ativa recursos de processamento e geração de imagens
                    </p>
                  </div>
                  <Switch
                    id="image-enabled"
                    checked={settings.image.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings('image', { enabled: checked })
                    }
                  />
                </div>

                {settings.image.enabled && (
                  <>
                    <Separator />

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="text-blue-900">Funcionalidade em Desenvolvimento</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            O processamento de imagem será implementado em breve. 
                            As configurações serão salvas e aplicadas quando a funcionalidade estiver disponível.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Provedor</Label>
                      <Select
                        value={settings.image.provider}
                        onValueChange={(value) =>
                          updateSettings('image', {
                            provider: value as 'dalle' | 'midjourney' | 'none',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dalle">DALL-E (OpenAI)</SelectItem>
                          <SelectItem value="midjourney">Midjourney</SelectItem>
                          <SelectItem value="none">Nenhum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {settings.image.provider !== 'none' && (
                      <>
                        <div className="space-y-2">
                          <Label>Modelo</Label>
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

                        <div className="space-y-2">
                          <Label>Tamanho da Imagem</Label>
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
                              <SelectItem value="1024x1024">1024x1024 (Quadrado)</SelectItem>
                              <SelectItem value="1024x1792">1024x1792 (Retrato)</SelectItem>
                              <SelectItem value="1792x1024">1792x1024 (Paisagem)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={saveSettings} 
                    disabled={saving || !hasChanges}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                  >
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default AISettingsPage;
