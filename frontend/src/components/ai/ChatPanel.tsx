import React from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AISession } from '@/types';

interface ChatPanelProps {
  currentSession: AISession | null;
  isLoading: boolean;
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  currentSession,
  isLoading,
  newMessage,
  setNewMessage,
  sendMessage,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bot size={20} />
          <span>Chat com IA</span>
          {currentSession && (
            <span className="text-sm text-muted-foreground">
              ({currentSession.title})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentSession ? (
          <div className="space-y-4">
            <div className="h-96 overflow-y-auto p-4 border rounded-lg bg-background space-y-3">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <span className="text-xs opacity-75 mt-1 block">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
               {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg bg-card border flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">IA está pensando...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Digite sua mensagem para a IA..."
                className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
              <Button onClick={sendMessage} disabled={!newMessage.trim() || isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Bot size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Crie uma nova sessão para começar a testar a IA
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatPanel;
