import type { Database } from '@/infrastructure/supabase/database.types'

type PublicFunctions = Database['public']['Functions']

/** Argumentos de la RPC `F` admitiendo `null` en cada uno. */
export type NullableRpcArgs<F extends keyof PublicFunctions> = {
  [K in keyof PublicFunctions[F]['Args']]: PublicFunctions[F]['Args'][K] | null
}

/**
 * `supabase gen types` no marca como nullable los argumentos de las funciones
 * SQL, aunque PostgreSQL acepta NULL en cualquiera (y varias RPC lo esperan,
 * p. ej. `p_costo`, `p_motivo`). Este helper deja enviar `null` explícito —el
 * mismo payload de siempre— sin castear en cada repositorio. Es solo de tipos:
 * devuelve el mismo objeto sin tocarlo.
 */
export function rpcArgs<F extends keyof PublicFunctions>(
  _fn: F,
  args: NullableRpcArgs<F>,
): PublicFunctions[F]['Args'] {
  return args as PublicFunctions[F]['Args']
}
