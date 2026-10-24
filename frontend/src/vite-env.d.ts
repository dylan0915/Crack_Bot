/// <reference types="vite/client" />

/** Settings that can be supplied through a `.env` file in the frontend folder. */
interface ImportMetaEnv {
  /** Address of the backend server, for example http://127.0.0.1:8000. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
