import QRCode from 'qrcode';

type PossibleQrPayload = string | null | undefined;

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/i;

const sanitizeBase64 = (value: string) => value.replace(/\s+/g, '');

export const pickQrValue = (data: Record<string, unknown> | null | undefined) => {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const candidates = [
    (data as Record<string, unknown>).qr,
    (data as Record<string, unknown>).qrCode,
    (data as Record<string, unknown>).qr_code,
    (data as Record<string, unknown>).code,
  ];

  const value = candidates.find((candidate) => typeof candidate === 'string') as string | undefined;
  return value ?? '';
};

const buildGoogleQrUrl = (value: string) => {
  const encoded = encodeURIComponent(value);
  return `https://chart.googleapis.com/chart?cht=qr&chs=512x512&chl=${encoded}`;
};

export const normalizeQrCode = async (rawValue: PossibleQrPayload) => {
  if (!rawValue) {
    return '';
  }

  const value = rawValue.trim();
  if (!value) {
    return '';
  }

  if (value.startsWith('data:image')) {
    return value;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
      });
    } catch (error) {
      console.error('❌ [QR] Erro ao converter URL em QR Code:', error);
      return buildGoogleQrUrl(value);
    }
  }

  const compactValue = sanitizeBase64(value);
  if (BASE64_REGEX.test(compactValue)) {
    return `data:image/png;base64,${compactValue}`;
  }

  // Se chegamos aqui, é algum payload não padronizado; ainda assim,
  // tentar renderizar via Google Charts para garantir feedback visual.
  return buildGoogleQrUrl(value);
};

