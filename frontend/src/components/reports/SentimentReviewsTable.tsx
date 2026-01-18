import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Smile, Frown, Meh, Info } from 'lucide-react';

interface Review {
  id: string;
  customer_name: string;
  customer_phone?: string;
  rating: number;
  date: string;
  review: string;
  user_name?: string;
  user_id?: string;
  channel?: string;
  sentiment: 'positivo' | 'negativo' | 'neutro';
  is_example?: boolean; // 🎯 Indica que é um exemplo real
}

interface SentimentReviewsTableProps {
  reviews: Review[];
}

export const SentimentReviewsTable: React.FC<SentimentReviewsTableProps> = ({ reviews }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getPaginatedReviews = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return reviews.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(reviews.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getRatingColor = (rating: number, sentiment: string) => {
    if (sentiment === 'positivo' || rating >= 4) {
      return 'text-green-600 fill-green-600';
    } else if (sentiment === 'negativo' || rating <= 2) {
      return 'text-red-600 fill-red-600';
    } else {
      return 'text-gray-400 fill-gray-400';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positivo':
        return <Smile className="h-5 w-5 text-green-600" />;
      case 'negativo':
        return <Frown className="h-5 w-5 text-red-600" />;
      default:
        return <Meh className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positivo':
        return 'Positivo';
      case 'negativo':
        return 'Negativo';
      default:
        return 'Neutro';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month}, ${year}`;
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes}${ampm}`;
    } catch {
      return '';
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    // Formata como telefone internacional (ex: +44 141 234 5678)
    if (cleaned.length >= 10) {
      // Se começar com 55 (Brasil), formata como brasileiro
      if (cleaned.startsWith('55') && cleaned.length === 12) {
        return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9)}`;
      } else if (cleaned.length >= 10) {
        // Formata genérica internacional
        if (cleaned.length === 11) {
          return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
        } else if (cleaned.length === 10) {
          return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
        }
      }
    }
    return phone;
  };

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avaliações de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhuma avaliação encontrada. Gere um relatório para ver as avaliações.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Avaliações de Clientes</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {reviews.length} exemplo{reviews.length !== 1 ? 's' : ''} real{reviews.length !== 1 ? 'is' : ''} analisado{reviews.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {/* 🎯 NOVO: Aviso de que são exemplos */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Exemplos Reais de Análise de Sentimento
            </p>
            <p className="text-xs text-blue-800">
              Estes são exemplos reais de conversas analisadas por IA, representando clientes satisfeitos, neutros e insatisfeitos. 
              As análises são geradas automaticamente com base no conteúdo real das conversas.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Sentimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getPaginatedReviews().map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="">{review.customer_name}</span>
                      {review.customer_phone && (
                        <span className="text-sm text-muted-foreground">
                          {formatPhone(review.customer_phone)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? getRatingColor(review.rating, review.sentiment)
                              : 'text-gray-300'
                          }`}
                          fill={star <= review.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{formatDate(review.date)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(review.date)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      <p className="text-sm line-clamp-2">"{review.review}"</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{review.user_name || 'Não atribuído'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(review.sentiment)}
                      <span className="text-sm">{getSentimentLabel(review.sentiment)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {getTotalPages() > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, reviews.length)} de {reviews.length} avaliações
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              
              <div className="flex items-center space-x-1">
                {(() => {
                  const totalPages = getTotalPages();
                  const maxVisiblePages = 5;
                  const pages = [];
                  
                  if (totalPages <= maxVisiblePages) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    if (currentPage <= 3) {
                      for (let i = 1; i <= 4; i++) {
                        pages.push(i);
                      }
                      pages.push('...');
                      pages.push(totalPages);
                    } else if (currentPage >= totalPages - 2) {
                      pages.push(1);
                      pages.push('...');
                      for (let i = totalPages - 3; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      pages.push(1);
                      pages.push('...');
                      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                        pages.push(i);
                      }
                      pages.push('...');
                      pages.push(totalPages);
                    }
                  }
                  
                  return pages.map((page, index) => (
                    page === '...' ? (
                      <span key={index} className="px-2 text-muted-foreground">...</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page as number)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  ));
                })()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === getTotalPages()}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

