import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/utils/apiBase';

const GoogleOAuthHelp = () => {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const { toast } = useToast();

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps(prev => 
      prev.includes(stepNumber) 
        ? prev.filter(s => s !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const steps = [
    {
      number: 1,
      title: "Acessar Google Cloud Console",
      description: "Entre no console do Google Cloud",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Acesse o Google Cloud Console para configurar suas credenciais OAuth2.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open('https://console.cloud.google.com', '_blank')}
          >
            <ExternalLink size={16} className="mr-2" />
            Abrir Google Cloud Console
          </Button>
        </div>
      )
    },
    {
      number: 2,
      title: "Criar Projeto",
      description: "Crie um novo projeto ou selecione existente",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Se você não tem um projeto, crie um novo com um nome descritivo como "Dohoo Integration".
          </p>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm">Dica:</p>
            <p className="text-sm text-muted-foreground">
              Use um nome que identifique facilmente o projeto, como "Dohoo Calendar Integration"
            </p>
          </div>
        </div>
      )
    },
    {
      number: 3,
      title: "Ativar APIs",
      description: "Ative as APIs Calendar e Drive",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você precisa ativar as seguintes APIs no seu projeto:
          </p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Calendar API</Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open('https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', '_blank')}
              >
                <ExternalLink size={14} />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Drive API</Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open('https://console.cloud.google.com/apis/library/drive.googleapis.com', '_blank')}
              >
                <ExternalLink size={14} />
              </Button>
            </div>
          </div>
        </div>
      )
    },
    {
      number: 4,
      title: "Configurar OAuth Consent Screen",
      description: "Configure a tela de consentimento OAuth",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure a tela de consentimento OAuth com as seguintes informações:
          </p>
          <div className="bg-gray-50 p-3 rounded-md space-y-2">
            <div>
              <span className="text-sm">Tipo de usuário:</span>
              <span className="text-sm text-muted-foreground ml-2">Externo</span>
            </div>
            <div>
              <span className="text-sm">Nome do app:</span>
              <span className="text-sm text-muted-foreground ml-2">Dohoo Integration</span>
            </div>
            <div>
              <span className="text-sm">Email de suporte:</span>
              <span className="text-sm text-muted-foreground ml-2">Seu email</span>
            </div>
          </div>
        </div>
      )
    },
    {
      number: 5,
      title: "Criar Credenciais OAuth2",
      description: "Crie o ID do Cliente OAuth 2.0",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure as credenciais OAuth2 com os seguintes parâmetros:
          </p>
          <div className="bg-gray-50 p-3 rounded-md space-y-2">
            <div>
              <span className="text-sm">Tipo de aplicativo:</span>
              <span className="text-sm text-muted-foreground ml-2">Aplicativo da Web</span>
            </div>
            <div>
              <span className="text-sm">Nome:</span>
              <span className="text-sm text-muted-foreground ml-2">Dohoo Web Client</span>
            </div>
            <div>
              <span className="text-sm">URIs de redirecionamento:</span>
              <div className="mt-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                    {apiBase}/api/google/callback
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(`${apiBase}/api/google/callback`, 'URI de redirecionamento')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                    {apiBase}/api/google/auth/google/callback
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(`${apiBase}/api/google/auth/google/callback`, 'URI de redirecionamento alternativo')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      number: 6,
      title: "Copiar Credenciais",
      description: "Copie Client ID e Client Secret",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Após criar as credenciais, você verá:
          </p>
          <div className="space-y-2">
            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
              <p className="text-sm text-yellow-800">⚠️ IMPORTANTE</p>
              <p className="text-sm text-yellow-700">
                Guarde essas credenciais com segurança! Você precisará delas para configurar o sistema.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm">Credenciais necessárias:</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• <strong>Client ID</strong> - ID do Cliente</li>
                <li>• <strong>Client Secret</strong> - Segredo do Cliente</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <HelpCircle size={20} />
          <span>Como Configurar OAuth2 do Google</span>
        </CardTitle>
        <CardDescription>
          Siga este guia passo a passo para configurar as credenciais OAuth2 necessárias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="border rounded-lg">
              <button
                onClick={() => toggleStep(step.number)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
                {expandedSteps.includes(step.number) ? (
                  <ChevronUp size={20} className="text-muted-foreground" />
                ) : (
                  <ChevronDown size={20} className="text-muted-foreground" />
                )}
              </button>
              
              {expandedSteps.includes(step.number) && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  {step.content}
                </div>
              )}
            </div>
          ))}
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-green-800 mb-2">✅ Próximo Passo</h3>
            <p className="text-sm text-green-700">
              Após obter suas credenciais, volte à tela de configuração e preencha os campos 
              Client ID e Client Secret.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleOAuthHelp; 