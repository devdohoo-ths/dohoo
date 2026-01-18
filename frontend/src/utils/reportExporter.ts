import * as XLSX from 'xlsx';

export interface ExportData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalUsageTime: number;
    avgUsageTime: number;
    totalMessages: number;
    avgResponseTime: number;
    avgProductivity: number;
    avgEfficiency: number;
  };
  users: Array<{
    user: {
      id: string;
      name: string;
      email: string;
    };
    metrics: Array<{
      date: string;
      total_usage_time_minutes: number;
      active_time_minutes: number;
      idle_time_minutes: number;
      total_messages_sent: number;
      total_messages_received: number;
      avg_response_time_seconds: number;
      productivity_score: number;
      efficiency_score: number;
    }>;
  }>;
  trends: Array<{
    date: string;
    total_usage: number;
    active_usage: number;
    users_online: number;
    messages_sent: number;
  }>;
}

export const exportToExcel = (data: ExportData, filename: string = 'relatorio_gerencial_whatsapp') => {
  const workbook = XLSX.utils.book_new();

  // 1. Resumo Executivo
  const summaryData = [
    ['Métrica', 'Valor'],
    ['Total de Usuários', data.summary.totalUsers],
    ['Usuários Ativos', data.summary.activeUsers],
    ['Tempo Total de Uso (min)', data.summary.totalUsageTime],
    ['Tempo Médio de Uso (min)', Math.round(data.summary.avgUsageTime)],
    ['Total de Mensagens', data.summary.totalMessages],
    ['Tempo Médio de Resposta (s)', Math.round(data.summary.avgResponseTime)],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo Executivo');

  // 2. Dados por Usuário
  const userData = data.users.map(user => {
    const totalUsage = user.metrics.reduce((sum, m) => sum + m.total_usage_time_minutes, 0);
    const totalActive = user.metrics.reduce((sum, m) => sum + m.active_time_minutes, 0);
    const totalMessages = user.metrics.reduce((sum, m) => sum + m.total_messages_sent, 0);
    const avgEfficiency = user.metrics.length > 0 
      ? user.metrics.reduce((sum, m) => sum + m.efficiency_score, 0) / user.metrics.length 
      : 0;
    const avgProductivity = user.metrics.length > 0 
      ? user.metrics.reduce((sum, m) => sum + m.productivity_score, 0) / user.metrics.length 
      : 0;

    return {
      'Nome': user.user.name,
      'Email': user.user.email,
      'Tempo Total (min)': totalUsage,
      'Tempo Ativo (min)': totalActive,
      'Total Mensagens': totalMessages,
      'Msgs/Hora': totalUsage > 0 ? Math.round((totalMessages / (totalUsage / 60)) * 10) / 10 : 0,
      'Dias Ativos': user.metrics.length
    };
  });

  const userSheet = XLSX.utils.json_to_sheet(userData);
  XLSX.utils.book_append_sheet(workbook, userSheet, 'Dados por Usuário');

  // 3. Evolução Temporal
  const trendsData = data.trends.map(trend => ({
    'Data': trend.date,
    'Tempo Total (min)': trend.total_usage,
    'Tempo Ativo (min)': trend.active_usage,
    'Usuários Online': trend.users_online,
    'Mensagens Enviadas': trend.messages_sent
  }));

  const trendsSheet = XLSX.utils.json_to_sheet(trendsData);
  XLSX.utils.book_append_sheet(workbook, trendsSheet, 'Evolução Temporal');

  // 4. Detalhamento Diário por Usuário
  const dailyData = data.users.flatMap(user => 
    user.metrics.map(metric => ({
      'Usuário': user.user.name,
      'Data': metric.date,
      'Tempo Total (min)': metric.total_usage_time_minutes,
      'Tempo Ativo (min)': metric.active_time_minutes,
      'Tempo Ocioso (min)': metric.idle_time_minutes,
      'Mensagens Enviadas': metric.total_messages_sent,
      'Mensagens Recebidas': metric.total_messages_received,
      'Tempo Resposta (s)': Math.round(metric.avg_response_time_seconds),
    }))
  );

  const dailySheet = XLSX.utils.json_to_sheet(dailyData);
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Detalhamento Diário');

  // Salvar arquivo
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToCSV = (data: ExportData, filename: string = 'relatorio_gerencial_whatsapp') => {
  // Exportar dados por usuário como CSV
  const userData = data.users.map(user => {
    const totalUsage = user.metrics.reduce((sum, m) => sum + m.total_usage_time_minutes, 0);
    const totalActive = user.metrics.reduce((sum, m) => sum + m.active_time_minutes, 0);
    const totalMessages = user.metrics.reduce((sum, m) => sum + m.total_messages_sent, 0);
    const avgEfficiency = user.metrics.length > 0 
      ? user.metrics.reduce((sum, m) => sum + m.efficiency_score, 0) / user.metrics.length 
      : 0;

    return {
      'Nome': user.user.name,
      'Email': user.user.email,
      'Tempo Total (min)': totalUsage,
      'Tempo Ativo (min)': totalActive,
      'Total Mensagens': totalMessages,
      'Msgs/Hora': totalUsage > 0 ? Math.round((totalMessages / (totalUsage / 60)) * 10) / 10 : 0
    };
  });

  const csvContent = [
    Object.keys(userData[0]).join(','),
    ...userData.map(row => Object.values(row).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generatePDFReport = async (data: ExportData, filename: string = 'relatorio_gerencial_whatsapp') => {
  // Esta função seria implementada com uma biblioteca como jsPDF ou react-pdf
  // Por enquanto, vamos criar um HTML que pode ser impresso como PDF
  const htmlContent = generateHTMLReport(data);
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
};

const generateHTMLReport = (data: ExportData): string => {
  const currentDate = new Date().toLocaleDateString('pt-BR');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório Gerencial WhatsApp</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
        .summary-item { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .summary-item h3 { margin: 0 0 10px 0; color: #007bff; }
        .summary-item p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório Gerencial WhatsApp</h1>
        <p>Gerado em: ${currentDate}</p>
      </div>

      <div class="section">
        <h2>Resumo Executivo</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Usuários</h3>
            <p><strong>Total:</strong> ${data.summary.totalUsers}</p>
            <p><strong>Ativos:</strong> ${data.summary.activeUsers}</p>
          </div>
          <div class="summary-item">
            <h3>Tempo de Uso</h3>
            <p><strong>Total:</strong> ${Math.round(data.summary.totalUsageTime / 60)}h ${data.summary.totalUsageTime % 60}m</p>
            <p><strong>Médio:</strong> ${Math.round(data.summary.avgUsageTime / 60)}h ${data.summary.avgUsageTime % 60}m</p>
          </div>
          <div class="summary-item">
            <h3>Mensagens</h3>
            <p><strong>Total:</strong> ${data.summary.totalMessages.toLocaleString()}</p>
            <p><strong>Tempo Resposta:</strong> ${Math.round(data.summary.avgResponseTime)}s</p>
          </div>
          <div class="summary-item">
            <h3>Performance</h3>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Dados por Usuário</h2>
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Tempo Total</th>
              <th>Tempo Ativo</th>
              <th>Mensagens</th>
              <th>Msgs/Hora</th>
            </tr>
          </thead>
          <tbody>
            ${data.users.map(user => {
              const totalUsage = user.metrics.reduce((sum, m) => sum + m.total_usage_time_minutes, 0);
              const totalActive = user.metrics.reduce((sum, m) => sum + m.active_time_minutes, 0);
              const totalMessages = user.metrics.reduce((sum, m) => sum + m.total_messages_sent, 0);
              const msgsPerHour = totalUsage > 0 ? Math.round((totalMessages / (totalUsage / 60)) * 10) / 10 : 0;
              
              return `
                <tr>
                  <td>${user.user.name}</td>
                  <td>${Math.round(totalUsage / 60)}h ${totalUsage % 60}m</td>
                  <td>${Math.round(totalActive / 60)}h ${totalActive % 60}m</td>
                  <td>${totalMessages}</td>
                  <td>${msgsPerHour}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Relatório gerado automaticamente pelo sistema Dohoo</p>
      </div>
    </body>
    </html>
  `;
};
