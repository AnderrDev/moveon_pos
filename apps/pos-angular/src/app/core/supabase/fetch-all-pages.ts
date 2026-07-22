/**
 * PostgREST limita cada respuesta a 1000 filas y trunca EN SILENCIO lo que
 * sobre (causa del bug de stock del 2026-07-21). Este helper recorre la
 * consulta por páginas de `.range()` hasta agotarla.
 *
 * Requisito: la consulta debe tener un `.order()` estable (idealmente con
 * desempate por id) para que las páginas no se solapen.
 */
const PAGE_SIZE = 1000

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1)
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}
