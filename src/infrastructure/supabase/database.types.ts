/**
 * Tipos generados automáticamente por Supabase CLI.
 * Regenerar con: pnpm db:types
 *
 * Este archivo es un placeholder hasta que se ejecute la migración inicial.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
