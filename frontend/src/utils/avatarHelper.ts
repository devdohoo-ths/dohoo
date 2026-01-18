/**
 * Helper para validar e tratar URLs de avatares
 * URLs do WhatsApp CDN (pps.whatsapp.net) não podem ser acessadas diretamente do navegador
 */

/**
 * Verifica se uma URL de avatar é válida para uso direto no navegador
 * Retorna a URL se válida, ou null se for do WhatsApp CDN
 */
export function getValidAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) {
    return null;
  }

  // URLs do WhatsApp CDN são bloqueadas pelo navegador (403 Forbidden)
  // Não usar essas URLs diretamente
  if (avatarUrl.includes('pps.whatsapp.net') || avatarUrl.includes('whatsapp.net')) {
    return null;
  }

  return avatarUrl;
}

/**
 * Verifica se uma URL de avatar é do WhatsApp CDN
 */
export function isWhatsAppCDNUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  return url.includes('pps.whatsapp.net') || url.includes('whatsapp.net');
}

