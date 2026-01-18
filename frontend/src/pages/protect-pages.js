// Script para adicionar PermissionGuard em todas as páginas principais
// Execute este script para ver quais páginas precisam de proteção

const pagesToProtect = [
  // Analytics
  { file: 'analytics-overview.tsx', permission: 'analytics' },
  { file: 'analytics-ai-conversations.tsx', permission: 'analytics' },
  { file: 'analytics-wordcloud.tsx', permission: 'analytics' },
  { file: 'analytics-sentiments.tsx', permission: 'analytics' },
  
  // Reports
  { file: 'report-attendance.tsx', permission: 'view_attendance_report' },
  { file: 'report-conversations.tsx', permission: 'view_conversation_report' },
  
  // AI & Automation
  { file: 'FlowBuilderNovo.tsx', permission: 'ai' },
  { file: 'Rules.tsx', permission: 'ai' },
  
  // Accounts
  { file: 'ConnectWhatsApp.tsx', permission: 'accounts' },
  
  // Settings
  { file: 'DatabaseManagerPage.tsx', permission: 'settings' },
  { file: 'MarketplacePage.tsx', permission: 'settings' },
  { file: 'OrganizationsPage.tsx', permission: 'settings' },
];

console.log('📋 Páginas que precisam de proteção:');
pagesToProtect.forEach(page => {
  console.log(`   - ${page.file} -> ${page.permission}`);
});

console.log('\n🔧 Como adicionar proteção:');
console.log(`
1. Importe o PermissionGuard:
   import { PermissionGuard } from '@/components/auth/PermissionGuard';

2. Envolva o conteúdo da página:
   return (
     <PermissionGuard requiredPermissions={['${pagesToProtect[0].permission}']}>
       <div className="...">
         {/* conteúdo da página */}
       </div>
     </PermissionGuard>
   );
`);

console.log('\n✅ Páginas já protegidas:');
console.log('   - DashboardPage.tsx -> analytics');
console.log('   - analytics-overview.tsx -> analytics');
console.log('   - analytics-ai-conversations.tsx -> analytics');
console.log('   - analytics-wordcloud.tsx -> analytics');
console.log('   - analytics-sentiments.tsx -> analytics');
console.log('   - report-attendance.tsx -> view_attendance_report');
console.log('   - report-conversations.tsx -> view_conversation_report'); 