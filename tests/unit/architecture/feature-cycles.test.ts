import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Regla de dependencias entre features (ADR 0015, decisión del dueño
// 2026-10-24): una feature puede usar el domain/ y los dialogs|components de
// otra (lo hace cumplir eslint.config.js), pero el grafo de features debe ser
// ACÍCLICO. ESLint no ve ciclos a nivel de feature; este test sí.
//
// Si falla: lo compartido se promueve a src/shared (tipos, utilidades puras)
// o a core/ (capacidades transversales como core/catalog), o la feature que
// solo necesita un tipo define el suyo mínimo (ver LoyaltyCustomerRef).

const FEATURES_DIR = join(process.cwd(), 'apps/pos-angular/src/app/features')
const IMPORT_RE = /from '@angular-app\/features\/([a-z-]+)\//g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

function featureGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  for (const feature of readdirSync(FEATURES_DIR)) {
    const dir = join(FEATURES_DIR, feature)
    if (!statSync(dir).isDirectory()) continue
    const deps = new Set<string>()
    for (const file of sourceFiles(dir)) {
      for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
        if (match[1] !== feature) deps.add(match[1]!)
      }
    }
    graph.set(feature, deps)
  }
  return graph
}

function findCycles(graph: Map<string, Set<string>>): string[] {
  const cycles = new Set<string>()
  const visit = (start: string, node: string, path: string[]): void => {
    for (const next of graph.get(node) ?? []) {
      if (next === start) cycles.add([...path, start].join(' → '))
      else if (!path.includes(next)) visit(start, next, [...path, next])
    }
  }
  for (const feature of graph.keys()) visit(feature, feature, [feature])
  return [...cycles].sort()
}

describe('arquitectura: dependencias entre features', () => {
  it('el grafo de features no tiene ciclos', () => {
    expect(findCycles(featureGraph())).toEqual([])
  })

  it('detecta un ciclo cuando existe (control del propio test)', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a'])],
    ])
    expect(findCycles(graph)).toEqual(['a → b → a', 'b → a → b'])
  })
})
