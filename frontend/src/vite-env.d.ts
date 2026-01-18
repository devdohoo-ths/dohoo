/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  // adicione outras variáveis VITE_ aqui se precisar
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
