import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { LucideAngularModule, CupSoda, Gift, Sparkles } from 'lucide-angular'
import {
  ClubProgressService,
  type ClubProgress,
} from './club-progress.service'

type LookupState = 'idle' | 'loading' | 'found' | 'notFound' | 'error'

/**
 * Sección pública "Mi tarjeta MOVE ON Club" del catálogo (ADR 0016, PLAN-70).
 * Consulta efímera por celular: nada se persiste en el navegador. La tarjeta
 * replica una tarjeta de socio física (muescas de tiquete, sellos
 * troquelados, código de barras decorativo) con la identidad del catálogo
 * (negro + amarillo #F9D128, Montserrat).
 *
 * Nota: la encapsulación de Angular impide heredar las clases `mo3-*` del
 * catálogo — los tokens se replican localmente; las variables `--mo-fs-*`
 * sí cascadean por herencia de custom properties.
 */
@Component({
  selector: 'mo-club-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  styles: `
    :host { display: block; }
    .club-section {
      position: relative;
      background: #0a0a0a;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }
    /* Marca de agua editorial: palabra gigante delineada, como póster. */
    .club-watermark {
      position: absolute;
      right: -0.08em;
      bottom: -0.22em;
      margin: 0;
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: clamp(120px, 22vw, 320px);
      line-height: 1;
      letter-spacing: -0.02em;
      color: transparent;
      -webkit-text-stroke: 1.5px rgba(249, 209, 40, 0.12);
      pointer-events: none;
      user-select: none;
    }
    .club-wrap {
      position: relative;
      max-width: 1280px;
      margin: 0 auto;
      padding: clamp(48px, 7vw, 88px) clamp(16px, 4vw, 40px);
    }
    .club-grid {
      display: grid;
      gap: clamp(28px, 4vw, 56px);
      align-items: start;
    }
    @media (min-width: 900px) {
      .club-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 460px); }
    }
    .club-display { font-family: 'Montserrat', sans-serif; font-weight: 900; }
    .club-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 14px;
      padding: 6px 12px;
      border: 1px solid rgba(249, 209, 40, 0.45);
      border-radius: 999px;
      color: #f9d128;
      font-size: var(--mo-fs-eyebrow);
      font-weight: 800;
      letter-spacing: 2.5px;
      text-transform: uppercase;
    }
    .club-h2 {
      margin: 0 0 14px;
      font-size: var(--mo-fs-section);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.05;
      color: #fff;
    }
    .club-h2 em { font-style: normal; color: #f9d128; }
    .club-copy {
      margin: 0 0 26px;
      max-width: 46ch;
      font-size: var(--mo-fs-body);
      line-height: 1.65;
      color: rgba(255, 255, 255, 0.65);
    }
    .club-form { display: flex; flex-wrap: wrap; gap: 10px; max-width: 460px; }
    .club-input {
      flex: 1;
      min-width: 220px;
      height: 52px;
      padding: 0 18px;
      background: #000;
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #fff;
      font-family: inherit;
      font-size: var(--mo-fs-body);
      border-radius: 3px;
      outline: none;
      transition: border-color 0.15s;
    }
    .club-input::placeholder { color: rgba(255, 255, 255, 0.35); }
    .club-input:focus { border-color: #f9d128; }
    .club-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 52px;
      padding: 0 28px;
      background: #f9d128;
      color: #000;
      font-family: inherit;
      font-size: var(--mo-fs-button);
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border: 0;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.12s, transform 0.12s;
    }
    .club-btn:hover { background: #ffe14d; transform: translateY(-1px); }
    .club-btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
    .club-status {
      margin: 18px 0 0;
      max-width: 46ch;
      font-size: var(--mo-fs-small);
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.65);
    }
    .club-status--error { color: #f9d128; }
    .club-privacy {
      margin: 26px 0 0;
      max-width: 46ch;
      font-size: var(--mo-fs-micro);
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.38);
    }

    /* ── Tarjeta de socio ─────────────────────────────────────────── */
    .club-card,
    .club-ghost {
      position: relative;
      border-radius: 14px;
      padding: clamp(20px, 3vw, 28px);
    }
    .club-card {
      background: #f9d128;
      color: #000;
      box-shadow: 0 24px 60px -18px rgba(249, 209, 40, 0.35);
      transform: rotate(-1.2deg);
      animation: club-pop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    }
    @keyframes club-pop {
      from { opacity: 0; transform: rotate(-1.2deg) translateY(16px) scale(0.96); }
      to { opacity: 1; transform: rotate(-1.2deg); }
    }
    .club-card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .club-wordmark {
      margin: 0;
      font-size: 13px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .club-cardtype {
      margin: 2px 0 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.55;
    }
    .club-score { margin: 0; font-size: 30px; line-height: 1; }
    .club-score span { font-size: 17px; opacity: 0.5; }
    .club-holder {
      margin: 18px 0 0;
      font-size: var(--mo-fs-eyebrow);
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .club-stamps { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .club-stamp {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .club-stamp--filled {
      background: #000;
      color: #f9d128;
      box-shadow: inset 0 0 0 3px #000, inset 0 0 0 5px #f9d128;
      animation: club-stamp 0.32s ease-out backwards;
    }
    .club-stamp--empty {
      border: 2px dashed rgba(0, 0, 0, 0.4);
      color: rgba(0, 0, 0, 0.45);
      font-weight: 800;
      font-size: 13px;
    }
    @keyframes club-stamp {
      from { transform: scale(0.3) rotate(-25deg); opacity: 0; }
      65% { transform: scale(1.18) rotate(4deg); }
      to { transform: scale(1) rotate(0); opacity: 1; }
    }
    /* Perforación de tiquete: línea punteada + muescas laterales. */
    .club-tear {
      position: relative;
      margin: 20px -28px 0;
      border-top: 2px dashed rgba(0, 0, 0, 0.35);
    }
    .club-tear::before,
    .club-tear::after {
      content: '';
      position: absolute;
      top: -11px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0a0a0a;
    }
    .club-tear::before { left: -10px; }
    .club-tear::after { right: -10px; }
    .club-result { padding: 16px 0 0; }
    .club-result-main {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 9px;
      font-weight: 800;
      font-size: var(--mo-fs-body);
    }
    .club-result-sub { margin: 6px 0 0; font-size: var(--mo-fs-caption); opacity: 0.7; }
    .club-barcode {
      margin-top: 18px;
      height: 30px;
      border-radius: 2px;
      background: repeating-linear-gradient(
        90deg,
        #000 0 2px, transparent 2px 5px,
        #000 5px 8px, transparent 8px 10px,
        #000 10px 11px, transparent 11px 16px,
        #000 16px 19px, transparent 19px 21px
      );
      opacity: 0.85;
    }
    .club-barcode-label {
      margin: 6px 0 0;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 4px;
      text-transform: uppercase;
      opacity: 0.5;
      text-align: center;
    }

    /* Tarjeta fantasma (estado inicial): promete el resultado. */
    .club-ghost {
      border: 2px dashed rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.4);
      min-height: 240px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-align: center;
    }
    .club-ghost-slots { display: flex; gap: 8px; }
    .club-ghost-slot {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px dashed rgba(249, 209, 40, 0.35);
    }
    .club-ghost p { margin: 0; font-size: var(--mo-fs-small); max-width: 26ch; line-height: 1.6; }
  `,
  template: `
    <section id="club" class="club-section">
      <p class="club-watermark club-display" aria-hidden="true">CLUB</p>
      <div class="club-wrap">
        <div class="club-grid">
          <div>
            <p class="club-eyebrow">
              <lucide-angular [img]="sparklesIcon" [size]="13" style="display:block;flex-shrink:0;" aria-hidden="true" />
              Programa de fidelidad
            </p>
            <h2 class="club-display club-h2">
              Tu batido nº&nbsp;9 lo <em>invita la casa</em>
            </h2>
            <p class="club-copy">
              Cada batido del club suma un sello en tu tarjeta. Escribe el celular con el que
              te registraste en la tienda y mira cuánto te falta.
            </p>

            <form class="club-form" (submit)="consultar($event)">
              <input
                class="club-input"
                type="tel"
                name="celular"
                inputmode="tel"
                autocomplete="off"
                [value]="celular()"
                (input)="onCelular($event)"
                placeholder="Tu celular · Ej: 301 234 5678"
                aria-label="Celular registrado en la tienda"
              />
              <button type="submit" class="club-btn" [disabled]="state() === 'loading'">
                {{ state() === 'loading' ? 'Consultando…' : 'Consultar' }}
              </button>
            </form>

            @if (state() === 'notFound') {
              <p class="club-status" role="status">
                No encontramos una tarjeta activa con ese número. Si compras batidos con
                nosotros, pregunta en la tienda para inscribirte al club.
              </p>
            } @else if (state() === 'error') {
              <p class="club-status club-status--error" role="status">
                No pudimos consultar en este momento. Intenta de nuevo en unos segundos.
              </p>
            }

            <p class="club-privacy">
              Solo mostramos el avance de sellos de clientes inscritos que autorizaron el
              programa. No guardamos tu número en este navegador.
            </p>
          </div>

          <div>
            @if (state() === 'found' && progress(); as p) {
              <article class="club-card" aria-live="polite">
                <div class="club-card-head">
                  <div>
                    <p class="club-display club-wordmark">Move On Club</p>
                    <p class="club-cardtype">Tarjeta de socio</p>
                  </div>
                  <p class="club-display club-score">
                    {{ p.stampsBalance }}<span>/{{ p.sellosParaRecompensa }}</span>
                  </p>
                </div>

                <p class="club-holder">Hola, {{ p.primerNombre }}</p>

                <div class="club-stamps">
                  @for (filled of slots(); track $index) {
                    @if (filled) {
                      <span
                        class="club-stamp club-stamp--filled"
                        [style.animation-delay.ms]="$index * 65"
                      >
                        <lucide-angular [img]="cupIcon" [size]="22" style="display:block;" aria-hidden="true" />
                      </span>
                    } @else {
                      <span class="club-stamp club-stamp--empty">{{ $index + 1 }}</span>
                    }
                  }
                </div>

                <div class="club-tear" aria-hidden="true"></div>

                <div class="club-result">
                  @if (p.recompensasDisponibles > 0) {
                    <p class="club-result-main">
                      <lucide-angular [img]="giftIcon" [size]="19" style="display:block;flex-shrink:0;" aria-hidden="true" />
                      {{ p.recompensasDisponibles === 1 ? '¡Tienes un batido gratis!' : '¡Tienes ' + p.recompensasDisponibles + ' batidos gratis!' }}
                    </p>
                    <p class="club-result-sub">Reclámalo en la tienda antes del {{ expiracion() }}.</p>
                  } @else if (faltan() === 0) {
                    <p class="club-result-main">¡Tarjeta completa!</p>
                    <p class="club-result-sub">Tu próxima compra desbloquea el batido gratis.</p>
                  } @else {
                    <p class="club-result-main">
                      Te {{ faltan() === 1 ? 'falta' : 'faltan' }} {{ faltan() }}
                      {{ faltan() === 1 ? 'batido' : 'batidos' }}
                    </p>
                    <p class="club-result-sub">para el siguiente batido gratis por cuenta de la casa.</p>
                  }
                  <div class="club-barcode" aria-hidden="true"></div>
                  <p class="club-barcode-label" aria-hidden="true">Socio · Move On Nutrition</p>
                </div>
              </article>
            } @else {
              <div class="club-ghost" aria-hidden="true">
                <div class="club-ghost-slots">
                  <span class="club-ghost-slot"></span>
                  <span class="club-ghost-slot"></span>
                  <span class="club-ghost-slot"></span>
                  <span class="club-ghost-slot"></span>
                </div>
                <p>Tu tarjeta de sellos aparecerá aquí al consultar tu celular.</p>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ClubProgressComponent {
  private readonly service = inject(ClubProgressService)

  readonly cupIcon = CupSoda
  readonly giftIcon = Gift
  readonly sparklesIcon = Sparkles

  readonly celular = signal('')
  readonly state = signal<LookupState>('idle')
  readonly progress = signal<ClubProgress | null>(null)

  readonly slots = computed<boolean[]>(() => {
    const p = this.progress()
    if (!p) return []
    return Array.from({ length: Math.max(0, p.sellosParaRecompensa) }, (_, i) => i < p.stampsBalance)
  })

  readonly faltan = computed(() => {
    const p = this.progress()
    if (!p) return 0
    return Math.max(0, p.sellosParaRecompensa - p.stampsBalance)
  })

  readonly expiracion = computed(() => {
    const date = this.progress()?.proximaExpiracion
    if (!date) return ''
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(date)
  })

  onCelular(event: Event): void {
    this.celular.set((event.target as HTMLInputElement).value)
  }

  async consultar(event: Event): Promise<void> {
    event.preventDefault()
    if (this.state() === 'loading') return
    const celular = this.celular().trim()
    if (!celular) return

    this.state.set('loading')
    this.progress.set(null)
    try {
      const result = await this.service.lookup(celular)
      if (result) {
        this.progress.set(result)
        this.state.set('found')
      } else {
        this.state.set('notFound')
      }
    } catch {
      this.state.set('error')
    }
  }
}
