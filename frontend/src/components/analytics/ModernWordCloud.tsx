
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Palette } from 'lucide-react';

interface WordData {
  text: string;
  value: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface WordCloudProps {
  data?: WordData[];
  title?: string;
  height?: number;
}

const ModernWordCloud: React.FC<WordCloudProps> = ({ 
  data = [], 
  title = "Nuvem de Palavras",
  height = 400 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [colorScheme, setColorScheme] = useState('modern');
  const [isAnimating, setIsAnimating] = useState(false);

  // Usar apenas dados reais fornecidos
  const wordsToShow = data;

  const colorSchemes = {
    modern: {
      positive: ['#10b981', '#34d399', '#6ee7b7'],
      negative: ['#ef4444', '#f87171', '#fca5a5'],
      neutral: ['#6366f1', '#8b5cf6', '#a78bfa']
    },
    ocean: {
      positive: ['#0ea5e9', '#38bdf8', '#7dd3fc'],
      negative: ['#f59e0b', '#fbbf24', '#fcd34d'],
      neutral: ['#06b6d4', '#22d3ee', '#67e8f9']
    },
    sunset: {
      positive: ['#f59e0b', '#fbbf24', '#fcd34d'],
      negative: ['#dc2626', '#ef4444', '#f87171'],
      neutral: ['#7c3aed', '#8b5cf6', '#a78bfa']
    }
  };

  const getWordColor = (word: WordData, index: number) => {
    const scheme = colorSchemes[colorScheme as keyof typeof colorSchemes];
    const sentiment = word.sentiment || 'neutral';
    const colors = scheme[sentiment];
    return colors[index % colors.length];
  };

  const getWordSize = (value: number) => {
    const minSize = 14;
    const maxSize = 32;
    const maxValue = Math.max(...wordsToShow.map(w => w.value));
    const size = minSize + ((value / maxValue) * (maxSize - minSize));
    return Math.round(size);
  };

  const refreshCloud = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const exportCloud = () => {
    // Implementar exportação da nuvem de palavras
    console.log('Exportando nuvem de palavras...');
  };

  const cycleColorScheme = () => {
    const schemes = Object.keys(colorSchemes);
    const currentIndex = schemes.indexOf(colorScheme);
    const nextIndex = (currentIndex + 1) % schemes.length;
    setColorScheme(schemes[nextIndex]);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cycleColorScheme}
              className="h-8 w-8 p-0"
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshCloud}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCloud}
              className="h-8 w-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-green-600 border-green-200">
            Positivas: {wordsToShow.filter(w => w.sentiment === 'positive').length}
          </Badge>
          <Badge variant="outline" className="text-red-600 border-red-200">
            Negativas: {wordsToShow.filter(w => w.sentiment === 'negative').length}
          </Badge>
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            Neutras: {wordsToShow.filter(w => w.sentiment === 'neutral').length}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {wordsToShow && wordsToShow.length > 0 ? (
          <div 
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
            style={{ height: `${height}px` }}
          >
            <div className="absolute inset-0 flex flex-wrap items-center justify-center p-6 gap-2">
              {wordsToShow.map((word, index) => {
                const fontSize = getWordSize(word.value);
                const color = getWordColor(word, index);
                const animationDelay = `${index * 100}ms`;
                
                return (
                  <div
                    key={`${word.text}-${index}`}
                    className={`
                      inline-flex items-center justify-center px-3 py-2 rounded-full
                      backdrop-blur-sm border border-white/20 shadow-lg
                      hover:scale-110 transition-all duration-300 cursor-pointer
                      ${isAnimating ? 'animate-bounce' : ''}
                    `}
                    style={{ 
                      backgroundColor: `${color}20`,
                      borderColor: `${color}40`,
                      fontSize: `${fontSize}px`,
                      color: color,
                      fontWeight: word.value > 70 ? 'bold' : 'normal',
                      animationDelay: isAnimating ? animationDelay : '0s'
                    }}
                    title={`${word.text}: ${word.value} menções`}
                  >
                    <span className="">{word.text}</span>
                    <Badge 
                      variant="secondary" 
                      className="ml-2 text-xs"
                    >
                      {word.value}
                    </Badge>
                  </div>
                );
              })}
            </div>
            
            {/* Efeito de brilho sutil */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">🔍</div>
              <p>Sem dados de palavras-chave</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Total de palavras: {wordsToShow.length}</span>
          <span>Esquema: {colorScheme}</span>
        </div>
      </CardContent>

      <style>
        {`
          @keyframes bubble-float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(1deg); }
          }
          
          .bubble-float {
            animation: bubble-float 3s ease-in-out infinite;
          }
        `}
      </style>
    </Card>
  );
};

export default ModernWordCloud;
