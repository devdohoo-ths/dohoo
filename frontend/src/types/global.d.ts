/// <reference types="vite/client" />

declare module 'react' {
  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }

  export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactFragment | ReactPortal | Iterable<ReactNode>;

  export interface ReactFragment {
    children?: ReactNode;
  }

  export interface ReactPortal {
    children?: ReactNode;
  }

  export type Key = string | number;

  export interface JSXElementConstructor<P> {
    (props: P): ReactElement<any, any> | null;
  }

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useRef<T>(initialValue: T): { current: T };
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;

  export const Fragment: ReactElement;
  export const StrictMode: ReactElement;
  export const Suspense: ReactElement;

  export default React;
  export as namespace React;
}

declare module 'react-dom' {
  export = ReactDOM;
  export as namespace ReactDOM;
}

declare module 'lucide-react' {
  export interface IconProps {
    size?: number | string;
    className?: string;
    [key: string]: any;
  }
  
  export const Send: React.FC<IconProps>;
  export const Paperclip: React.FC<IconProps>;
  export const Mic: React.FC<IconProps>;
  export const Image: React.FC<IconProps>;
  export const Smile: React.FC<IconProps>;
  export const Star: React.FC<IconProps>;
  export const Phone: React.FC<IconProps>;
  export const Video: React.FC<IconProps>;
  export const MoreVertical: React.FC<IconProps>;
  export const MessageCircle: React.FC<IconProps>;
  export const Reply: React.FC<IconProps>;
  export const Forward: React.FC<IconProps>;
  export const Copy: React.FC<IconProps>;
  export const Flag: React.FC<IconProps>;
  export const FileText: React.FC<IconProps>;
  export const FileAudio: React.FC<IconProps>;
  export const FileArchive: React.FC<IconProps>;
  export const FileVideo: React.FC<IconProps>;
  export const File: React.FC<IconProps>;
  export const Download: React.FC<IconProps>;
  export const Square: React.FC<IconProps>;
  export const RotateCcw: React.FC<IconProps>;
  export const User: React.FC<IconProps>;
  export const MapPin: React.FC<IconProps>;
  export const Eye: React.FC<IconProps>;
  export const AlertTriangle: React.FC<IconProps>;
  export const Loader2: React.FC<IconProps>;
  export const RefreshCw: React.FC<IconProps>;
  export const ThumbsUp: React.FC<IconProps>;
  export const Heart: React.FC<IconProps>;
  export const ChevronDown: React.FC<IconProps>;
  export const CheckCircle: React.FC<IconProps>;
  export const Settings: React.FC<IconProps>;
  export const AlertCircle: React.FC<IconProps>;
  export const Plus: React.FC<IconProps>;
  export const Search: React.FC<IconProps>;
  export const Archive: React.FC<IconProps>;
  export const Filter: React.FC<IconProps>;
  export const Clock: React.FC<IconProps>;
  export const TrendingUp: React.FC<IconProps>;
  export const Users: React.FC<IconProps>;
}

declare module 'axios' {
  export = axios;
  export as namespace axios;
}

declare module 'emoji-picker-react' {
  export interface EmojiClickData {
    emoji: string;
    [key: string]: any;
  }
  
  export interface EmojiPickerProps {
    onEmojiClick: (emojiData: EmojiClickData) => void;
    width?: number;
    height?: number;
    [key: string]: any;
  }
  
  const EmojiPicker: React.FC<EmojiPickerProps>;
  export default EmojiPicker;
}

declare module 'date-fns' {
  export function format(date: Date, formatStr: string, options?: any): string;
  export const ptBR: any;
}

declare module 'date-fns/locale' {
  export const ptBR: any;
}

declare module 'socket.io-client' {
  export = io;
  export as namespace io;
}

// Declarações para módulos UI
declare module '@/components/ui/button' {
  export interface ButtonProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    [key: string]: any;
  }
  
  export const Button: React.FC<ButtonProps>;
}

declare module '@/components/ui/dialog' {
  export interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }
  
  export interface DialogContentProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  export interface DialogHeaderProps {
    children?: React.ReactNode;
  }
  
  export interface DialogTitleProps {
    children?: React.ReactNode;
  }
  
  export interface DialogDescriptionProps {
    children?: React.ReactNode;
  }
  
  export interface DialogFooterProps {
    children?: React.ReactNode;
  }
  
  export interface DialogTriggerProps {
    asChild?: boolean;
    children?: React.ReactNode;
  }
  
  export interface DialogCloseProps {
    children?: React.ReactNode;
  }
  
  export const Dialog: React.FC<DialogProps>;
  export const DialogContent: React.FC<DialogContentProps>;
  export const DialogHeader: React.FC<DialogHeaderProps>;
  export const DialogTitle: React.FC<DialogTitleProps>;
  export const DialogDescription: React.FC<DialogDescriptionProps>;
  export const DialogFooter: React.FC<DialogFooterProps>;
  export const DialogTrigger: React.FC<DialogTriggerProps>;
  export const DialogClose: React.FC<DialogCloseProps>;
}

declare module '@/components/ui/popover' {
  export interface PopoverProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  }
  
  export interface PopoverContentProps {
    children?: React.ReactNode;
    className?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  }
  
  export interface PopoverTriggerProps {
    asChild?: boolean;
    children?: React.ReactNode;
  }
  
  export const Popover: React.FC<PopoverProps>;
  export const PopoverContent: React.FC<PopoverContentProps>;
  export const PopoverTrigger: React.FC<PopoverTriggerProps>;
}

declare module '@/components/ui/card' {
  export interface CardProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  export interface CardContentProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  export interface CardHeaderProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  export interface CardTitleProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  export const Card: React.FC<CardProps>;
  export const CardContent: React.FC<CardContentProps>;
  export const CardHeader: React.FC<CardHeaderProps>;
  export const CardTitle: React.FC<CardTitleProps>;
}

declare module '@/components/ui/badge' {
  export interface BadgeProps {
    children?: React.ReactNode;
    className?: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }
  
  export const Badge: React.FC<BadgeProps>;
}

declare module '@/components/ui/input' {
  export interface InputProps {
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    [key: string]: any;
  }
  
  export const Input: React.FC<InputProps>;
}

declare module '@/components/ui/label' {
  export interface LabelProps {
    htmlFor?: string;
    children?: React.ReactNode;
    className?: string;
  }
  
  export const Label: React.FC<LabelProps>;
}

declare module '@/lib/utils' {
  export function cn(...classes: (string | undefined | null | false)[]): string;
}

declare module '@/utils/apiBase' {
  export const apiBase: string;
}

declare module '@/hooks/useAuth' {
  export interface User {
    id: string;
    email?: string;
    token?: string;
    [key: string]: any;
  }
  
  export interface Profile {
    id: string;
    name?: string;
    email?: string;
    [key: string]: any;
  }
  
  export function useAuth(): {
    user: User | null;
    profile: Profile | null;
    [key: string]: any;
  };
}

declare module '@/hooks/use-toast' {
  export interface ToastProps {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }
  
  export function useToast(): {
    toast: (props: ToastProps) => void;
  };
}

// ✅ Tipos do Supabase agora vêm de @/types/supabase
declare module '@/integrations/supabase/types' {
  export * from '@/types/supabase';
}

// Declarações globais
declare global {
  interface Window {
    [key: string]: any;
  }
  
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface IntrinsicElements {
      div: any;
      span: any;
      p: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      ul: any;
      li: any;
      a: any;
      img: any;
      video: any;
      audio: any;
      input: any;
      textarea: any;
      button: any;
      form: any;
      label: any;
      select: any;
      option: any;
      table: any;
      tr: any;
      td: any;
      th: any;
      thead: any;
      tbody: any;
      nav: any;
      header: any;
      footer: any;
      main: any;
      section: any;
      article: any;
      aside: any;
      canvas: any;
      svg: any;
      path: any;
      circle: any;
      rect: any;
      line: any;
      polyline: any;
      polygon: any;
      [elemName: string]: any;
    }
  }
} 