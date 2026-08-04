import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  signal,
} from '@angular/core'
import type { CatalogoProducto } from './catalogo.service'

/**
 * Cinta de ofertas del header del catálogo (diseño oficial v4).
 * Banda amarilla brutalist bajo la nav sticky: carrusel de un slide con los
 * productos etiquetados (Promoción / Más vendido / Nuevo), auto-avance cada
 * 5s con pausa al hover/focus, swipe en móvil y controles cuadrados.
 * No muestra precios: la vista pública no los expone (migración 20260710000200).
 *
 * Nota: la encapsulación de Angular impide heredar las clases `mo3-*` del
 * catálogo — los tokens se replican localmente; las variables `--mo-fs-*`
 * sí cascadean por herencia de custom properties.
 */

const AUTOPLAY_MS = 5000
const SWIPE_THRESHOLD_PX = 40

// Estilos de badge propios de la banda (fondo amarillo): el mapa del catálogo
// usa amarillo/blanco sobre negro y aquí sería ilegible.
const BAND_BADGE_STYLES: Record<string, [string, string]> = {
  'Promoción': ['#FF5C39', '#000000'],
  'Más vendido': ['#000000', '#F9D128'],
  'Nuevo': ['#000000', '#FFFFFF'],
}
const BAND_BADGE_DEFAULT: [string, string] = ['#000000', '#F9D128']

@Component({
  selector: 'mo-offers-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .ofr {
      position: relative;
      background: #f9d128;
      color: #000000;
      font-family: 'Montserrat', system-ui, sans-serif;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }
    /* Cinta deportiva: franja de rayas diagonales negras en el borde superior. */
    .ofr::before {
      content: '';
      display: block;
      height: 8px;
      background: repeating-linear-gradient(
        -45deg,
        #000000 0 14px,
        transparent 14px 28px
      );
    }
    /* Trama halftone sutil que hace eco del fondo del hero. */
    .ofr::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: radial-gradient(rgba(0, 0, 0, 0.14) 1.5px, transparent 1.5px);
      background-size: 26px 26px;
      -webkit-mask-image: linear-gradient(100deg, transparent 55%, #000 92%);
      mask-image: linear-gradient(100deg, transparent 55%, #000 92%);
    }
    .ofr-wrap {
      position: relative;
      z-index: 1;
      max-width: 1280px;
      margin: 0 auto;
      padding: clamp(14px, 2vw, 20px) clamp(16px, 4vw, 40px);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: clamp(14px, 2.4vw, 28px);
      align-items: center;
    }
    .ofr-display { font-family: 'Montserrat', sans-serif; font-weight: 900; }

    .ofr-label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #000000;
      color: #f9d128;
      padding: 14px 18px;
      align-self: stretch;
      justify-content: center;
      min-width: 150px;
    }
    .ofr-label-big {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: clamp(20px, 2vw, 28px);
      line-height: 1;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .ofr-label-small {
      font-size: var(--mo-fs-micro, 10px);
      font-weight: 800;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: #ffffff;
      opacity: 0.75;
    }

    .ofr-viewport { overflow: hidden; min-width: 0; }
    .ofr-track {
      display: flex;
      margin: 0;
      padding: 0;
      list-style: none;
      transition: transform 0.45s cubic-bezier(0.22, 0.9, 0.3, 1);
    }
    .ofr-slide { flex: 0 0 100%; min-width: 0; }
    .ofr-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: clamp(12px, 2vw, 22px);
      color: #000000;
      text-decoration: none;
      padding: 4px 2px;
    }
    .ofr-media {
      width: clamp(72px, 8vw, 96px);
      height: clamp(72px, 8vw, 96px);
      border: 2px solid #000000;
      background: #ffffff;
      display: grid;
      place-items: center;
      overflow: hidden;
      flex: none;
    }
    .ofr-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ofr-media-fallback {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: #000000;
      color: #f9d128;
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      text-align: center;
      padding: 6px;
    }
    .ofr-info { display: grid; gap: 5px; min-width: 0; }
    .ofr-badge {
      justify-self: start;
      font-size: var(--mo-fs-micro, 10px);
      font-weight: 800;
      letter-spacing: 1.6px;
      text-transform: uppercase;
      padding: 5px 9px;
      line-height: 1;
    }
    .ofr-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: clamp(17px, 2.1vw, 26px);
      line-height: 1.05;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
    .ofr-brand {
      font-size: var(--mo-fs-caption, 12px);
      font-weight: 800;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .ofr-cta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #000000;
      color: #f9d128;
      font-size: var(--mo-fs-button, 12px);
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 14px 20px;
      white-space: nowrap;
      transition: color 0.12s;
    }
    .ofr-card:hover .ofr-cta { color: #ffe159; }
    .ofr-card:focus-visible { outline: 2px solid #000000; outline-offset: 3px; }
    .ofr-cta-short { display: none; }

    .ofr-controls {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }
    .ofr-arrows { display: flex; gap: 2px; }
    .ofr-btn {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      background: transparent;
      border: 2px solid #000000;
      color: #000000;
      font-family: inherit;
      font-size: 18px;
      font-weight: 900;
      line-height: 1;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .ofr-btn:hover { background: #000000; color: #f9d128; }
    .ofr-btn:focus-visible { outline: 2px solid #000000; outline-offset: 3px; }
    .ofr-meta { display: flex; align-items: center; gap: 10px; }
    .ofr-dots { display: flex; gap: 5px; }
    .ofr-dot { width: 9px; height: 9px; border: 2px solid #000000; }
    .ofr-dot.ofr-dot-on { background: #000000; }
    .ofr-counter {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: var(--mo-fs-caption, 12px);
      letter-spacing: 1.6px;
    }

    @media (max-width: 719px) {
      .ofr-wrap {
        grid-template-columns: 1fr;
        gap: 12px;
        padding-top: 12px;
        padding-bottom: 14px;
      }
      .ofr-label {
        flex-direction: row;
        align-items: baseline;
        gap: 10px;
        padding: 10px 14px;
        min-width: 0;
        align-self: start;
        justify-self: start;
      }
      .ofr-label-big { font-size: 16px; }
      .ofr-card { gap: 12px; }
      .ofr-cta { display: none; }
      .ofr-cta-short {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        background: #000000;
        color: #f9d128;
        font-weight: 900;
        font-size: 18px;
        flex: none;
      }
      .ofr-controls {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ofr-track { transition: none; }
    }
  `,
  template: `
    <section
      class="ofr"
      aria-roledescription="carrusel"
      aria-label="Ofertas y destacados en tienda"
      (mouseenter)="pause()"
      (mouseleave)="resume()"
      (focusin)="pause()"
      (focusout)="resume()"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
    >
      <div class="ofr-wrap">
        <div class="ofr-label" aria-hidden="true">
          <span class="ofr-label-big">Ofertas</span>
          <span class="ofr-label-small">y destacados en tienda</span>
        </div>

        <div class="ofr-viewport">
          <ul class="ofr-track" [style.transform]="'translateX(-' + index() * 100 + '%)'">
            @for (p of productos(); track p.id; let i = $index) {
              <li class="ofr-slide" [attr.aria-hidden]="i !== index()">
                <a
                  class="ofr-card"
                  [href]="waLink(p)"
                  target="_blank"
                  rel="noopener"
                  [attr.tabindex]="i === index() ? null : -1"
                  (click)="onCardClick($event)"
                >
                  <span class="ofr-media">
                    @if (p.imageUrl) {
                      <img [src]="p.imageUrl" [alt]="p.nombre" loading="lazy" draggable="false">
                    } @else {
                      <span class="ofr-media-fallback">Move On</span>
                    }
                  </span>
                  <span class="ofr-info">
                    @if (p.etiqueta) {
                      <span
                        class="ofr-badge"
                        [style.background]="badgeBg(p.etiqueta)"
                        [style.color]="badgeFg(p.etiqueta)"
                      >{{ p.etiqueta }}</span>
                    }
                    <span class="ofr-name">{{ p.nombre }}</span>
                    <span class="ofr-brand">{{ p.marca ?? p.categoriaNombre ?? 'Move On' }}</span>
                  </span>
                  <span class="ofr-cta">Pedir por WhatsApp →</span>
                  <span class="ofr-cta-short" aria-hidden="true">→</span>
                </a>
              </li>
            }
          </ul>
        </div>

        @if (count() > 1) {
          <div class="ofr-controls">
            <div class="ofr-arrows">
              <button type="button" class="ofr-btn" aria-label="Oferta anterior" (click)="prev()">←</button>
              <button type="button" class="ofr-btn" aria-label="Oferta siguiente" (click)="next()">→</button>
            </div>
            <div class="ofr-meta">
              <span class="ofr-dots" aria-hidden="true">
                @for (p of productos(); track p.id; let i = $index) {
                  <span class="ofr-dot" [class.ofr-dot-on]="i === index()"></span>
                }
              </span>
              <span class="ofr-counter" aria-live="polite">
                {{ counterLabel() }}
              </span>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class OffersCarouselComponent implements OnInit, OnDestroy {
  readonly productos = input.required<CatalogoProducto[]>()
  readonly whatsappNumber = input.required<string>()

  readonly index = signal(0)
  readonly count = computed(() => this.productos().length)
  readonly counterLabel = computed(
    () => `${this.pad(this.index() + 1)} / ${this.pad(this.count())}`,
  )

  private timer: ReturnType<typeof setInterval> | null = null
  private paused = false
  private swipeStartX: number | null = null
  private suppressClick = false

  ngOnInit(): void {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion) {
      this.timer = setInterval(() => {
        if (!this.paused && this.count() > 1) this.next()
      }, AUTOPLAY_MS)
    }
  }

  ngOnDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer)
  }

  next(): void {
    this.index.update((i) => (i + 1) % this.count())
  }

  prev(): void {
    this.index.update((i) => (i - 1 + this.count()) % this.count())
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  onPointerDown(event: PointerEvent): void {
    this.swipeStartX = event.clientX
    this.suppressClick = false
  }

  onPointerUp(event: PointerEvent): void {
    if (this.swipeStartX === null) return
    const delta = event.clientX - this.swipeStartX
    this.swipeStartX = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX || this.count() < 2) return
    // Fue un swipe, no un tap: navegar y evitar que el click abra el enlace.
    this.suppressClick = true
    if (delta < 0) this.next()
    else this.prev()
  }

  onCardClick(event: MouseEvent): void {
    if (!this.suppressClick) return
    event.preventDefault()
    this.suppressClick = false
  }

  badgeBg(etiqueta: string): string {
    return (BAND_BADGE_STYLES[etiqueta] ?? BAND_BADGE_DEFAULT)[0]
  }

  badgeFg(etiqueta: string): string {
    return (BAND_BADGE_STYLES[etiqueta] ?? BAND_BADGE_DEFAULT)[1]
  }

  waLink(p: CatalogoProducto): string {
    const msg = `Hola Move On 👋 Me interesa ${p.nombre}, que vi destacado en el catálogo. ¿Está disponible?`
    return `https://wa.me/${this.whatsappNumber()}?text=${encodeURIComponent(msg)}`
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0')
  }
}
