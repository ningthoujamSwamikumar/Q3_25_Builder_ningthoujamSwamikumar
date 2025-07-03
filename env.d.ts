// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    HELIUS_RPC_URL: string;
    // Add other env vars here
  }
}