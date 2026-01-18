import { useState, useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

interface ProfilePicCache {
  [phoneNumber: string]: string | null;
}

const profilePicCache: ProfilePicCache = {};

export function useWhatsAppProfilePic(phoneNumber: string) {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { organization } = useOrganization();

  useEffect(() => {
    if (!phoneNumber) {
      setProfilePic(null);
      return;
    }

    // Limpar número de telefone para usar como chave de cache
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const cacheKey = cleanNumber;

    // Verificar cache primeiro
    if (profilePicCache[cacheKey] !== undefined) {
      setProfilePic(profilePicCache[cacheKey]);
      return;
    }

    // Buscar foto do WhatsApp
    const fetchProfilePic = async () => {
      setLoading(true);
      try {
        // Limpar número de telefone (remover caracteres especiais)
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        const headers = await getAuthHeaders();
        
        // Tentar buscar contato por número de telefone
        let contactData = null;
        
        // Buscar número completo primeiro
        try {
          const response = await fetch(
            `${apiBase}/api/contacts?search=${cleanNumber}&limit=1`,
            { headers }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              const contact = data.data[0];
              if (contact.metadata?.avatar_url) {
                contactData = contact;
              }
            }
          }
        } catch (error) {
          console.error(`[ProfilePic] Erro ao buscar contato via API:`, error);
        }
        
        // Se não encontrou e o número tem 13 dígitos (código do país), tentar sem código
        if (!contactData && cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
          const numberWithoutCountryCode = cleanNumber.substring(2);
          try {
            const response = await fetch(
              `${apiBase}/api/contacts?search=${numberWithoutCountryCode}&limit=1`,
              { headers }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data && data.data.length > 0) {
                const contact = data.data[0];
                if (contact.metadata?.avatar_url) {
                  contactData = contact;
                }
              }
            }
          } catch (error) {
            console.error(`[ProfilePic] Erro ao buscar contato alternativo via API:`, error);
          }
        }

        // Verificar se tem avatar_url e se não é do WhatsApp CDN (que bloqueia acesso direto)
        if (contactData?.metadata?.avatar_url) {
          const avatarUrl = contactData.metadata.avatar_url;
          
          // ⚠️ URLs do WhatsApp CDN (pps.whatsapp.net) não podem ser acessadas diretamente do navegador (403 Forbidden)
          // Ignorar essas URLs e usar fallback para avatar genérico
          if (avatarUrl.includes('pps.whatsapp.net') || avatarUrl.includes('whatsapp.net')) {
            console.log(`[ProfilePic] Avatar URL do WhatsApp CDN detectada, usando fallback para ${cleanNumber}`);
            // Continuar para o fallback abaixo
          } else {
            // URL válida (ex: Supabase Storage, outro CDN), usar diretamente
            console.log(`[ProfilePic] Usando avatar_url do contact para ${cleanNumber}`);
            profilePicCache[cacheKey] = avatarUrl;
            setProfilePic(avatarUrl);
            return;
          }
        }
        
        console.log(`[ProfilePic] Nenhuma foto encontrada para ${cleanNumber}, usando avatar genérico`);
        
        // 🎯 FALLBACK: Usar avatar genérico apenas se não encontrou no banco
        const response = await fetch(`https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanNumber}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`);
        
        if (response.ok) {
          const svgData = await response.text();
          // Usar encodeURIComponent para evitar erros com caracteres Unicode
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
          
          profilePicCache[cacheKey] = dataUrl;
          setProfilePic(dataUrl);
        } else {
          profilePicCache[cacheKey] = null;
          setProfilePic(null);
        }
      } catch (error) {
        console.error(`[ProfilePic] Erro ao buscar foto para ${phoneNumber}:`, error);
        profilePicCache[cacheKey] = null;
        setProfilePic(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfilePic();
  }, [phoneNumber, organization?.id]);

  return { profilePic, loading };
}
