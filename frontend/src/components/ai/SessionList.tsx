
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AISession } from '@/types';

interface SessionListProps {
  sessions: AISession[];
  setCurrentSession: (session: AISession) => void;
}

const SessionList: React.FC<SessionListProps> = ({ sessions, setCurrentSession }) => {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessões Anteriores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session)}
              className="p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
            >
              <h4 className="">{session.title}</h4>
              <p className="text-sm text-muted-foreground">
                {session.provider} • {session.model}
              </p>
              <p className="text-sm text-muted-foreground">
                {session.messages.length} mensagens
              </p>
              <span className="text-xs text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionList;
