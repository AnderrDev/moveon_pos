import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { LucideAngularModule, CupSoda, Gift } from 'lucide-angular'
import {
  ClubProgressService,
  type ClubProgress,
} from './club-progress.service'

type LookupState = 'idle' | 'loading' | 'found' | 'notFound' | 'error'

/**
 * Sección pública "Mi tarjeta MOVE ON Club" del catálogo (ADR 0016, PLAN-70).
 * Consulta efímera por celular: nada se persiste en el navegador. La tarjeta
 * replica la metáfora de sellos troquelados del POS con la identidad del
 * catálogo (negro + amarillo #F9D128, Montserrat).
 */
@Component({
  selector: 'mo-club-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  styles: `
    /* Réplica local de los tokens mo3 del catálogo: la encapsulación de
       Angular impide heredar las clases del componente padre. Las variables
       --mo-fs-* sí cascadean (custom properties heredan por DOM). */
    .club-wrap {
      max-width: 1280px;
      margin: 0 auto;
      padding: clamp(48px, 7vw, 88px) clamp(16px, 4vw, 40px);
    }
    .club-display {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
    }
    .club-btn-yellow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #f9d128;
      color: #000;
      font-size: var(--mo-fs-button);
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      border: 0;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.12s;
    }
    .club-btn-yellow:hover { background: #ffe14d; }
    .club-btn-yellow:disabled { opacity: 0.6; cursor: wait; }
    .club-card { animation: club-pop .35s ease-out; }
    @keyframes club-pop {
      from { opacity: 0; transform: translateY(10px) scale(.98); }
      to { opacity: 1; transform: none; }
    }
    .club-stamp-in { animation: club-stamp .3s ease-out backwards; }
    @keyframes club-stamp {
      from { transform: scale(.4); opacity: 0; }
      60% { transform: scale(1.15); }
      to { transform: scale(1); opacity: 1; }
    }
  `,
  template: `
    <section id="club" style="background:#0A0A0A;border-bottom:1px solid rgba(255,255,255,.12);">
      <div class="club-wrap">
        <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:10px;">
          <span class="club-display" style="color:#F9D128;font-size:clamp(18px,1.9vw,28px);letter-spacing:1.5px;line-height:1;">★</span>
          <h2 class="club-display" style="margin:0;font-size:var(--mo-fs-section);text-transform:uppercase;letter-spacing:.5px;">
            Mi tarjeta MOVE ON Club
          </h2>
        </div>
        <p style="margin:0 0 28px;max-width:52ch;font-size:var(--mo-fs-body);color:rgba(255,255,255,.65);">
          Cada batido del club suma un sello. Al completar tu tarjeta, el siguiente batido va
          por cuenta de la casa. Escribe tu celular y mira cómo vas.
        </p>

        <form
          (submit)="consultar($event)"
          style="display:flex;flex-wrap:wrap;gap:10px;max-width:480px;"
        >
          <input
            type="tel"
            name="celular"
            inputmode="tel"
            autocomplete="off"
            [value]="celular()"
            (input)="onCelular($event)"
            placeholder="Tu celular · Ej: 301 234 5678"
            aria-label="Celular registrado en la tienda"
            style="flex:1;min-width:220px;height:48px;padding:0 16px;background:#000;border:1px solid rgba(255,255,255,.25);color:#fff;font-family:inherit;font-size:var(--mo-fs-body);border-radius:2px;outline:none;"
          />
          <button
            type="submit"
            class="club-btn-yellow"
            [disabled]="state() === 'loading'"
            style="height:48px;padding:0 24px;border-radius:2px;"
          >
            {{ state() === 'loading' ? 'Consultando…' : 'Consultar' }}
          </button>
        </form>

        @if (state() === 'notFound') {
          <p
            role="status"
            style="margin:18px 0 0;font-size:var(--mo-fs-small);color:rgba(255,255,255,.65);"
          >
            No encontramos una tarjeta activa con ese número. Si compras batidos con nosotros,
            pregunta en la tienda para inscribirte al club.
          </p>
        } @else if (state() === 'error') {
          <p
            role="status"
            style="margin:18px 0 0;font-size:var(--mo-fs-small);color:#F9D128;"
          >
            No pudimos consultar en este momento. Intenta de nuevo en unos segundos.
          </p>
        } @else if (state() === 'found' && progress(); as p) {
          <div
            class="club-card"
            style="margin-top:28px;max-width:480px;background:#F9D128;color:#000;border-radius:6px;padding:24px;"
          >
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
              <p style="margin:0;font-size:var(--mo-fs-eyebrow);font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                Hola, {{ p.primerNombre }}
              </p>
              <p class="club-display" style="margin:0;font-size:22px;">
                {{ p.stampsBalance }}<span style="opacity:.55;font-size:15px;">/{{ p.sellosParaRecompensa }}</span>
              </p>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;">
              @for (filled of slots(); track $index) {
                @if (filled) {
                  <span
                    class="club-stamp-in"
                    [style.animation-delay.ms]="$index * 60"
                    style="width:44px;height:44px;border-radius:50%;background:#000;color:#F9D128;display:flex;align-items:center;justify-content:center;"
                  >
                    <lucide-angular [img]="cupIcon" style="width:22px;height:22px;display:block;" aria-hidden="true" />
                  </span>
                } @else {
                  <span
                    style="width:44px;height:44px;border-radius:50%;border:2px dashed rgba(0,0,0,.4);color:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;"
                  >
                    {{ $index + 1 }}
                  </span>
                }
              }
            </div>

            <div style="margin-top:18px;border-top:1px dashed rgba(0,0,0,.3);padding-top:14px;">
              @if (p.recompensasDisponibles > 0) {
                <p style="margin:0;display:flex;align-items:center;gap:8px;font-weight:800;font-size:var(--mo-fs-body);">
                  <lucide-angular [img]="giftIcon" style="width:18px;height:18px;display:block;flex-shrink:0;" aria-hidden="true" />
                  {{ p.recompensasDisponibles === 1 ? '¡Tienes un batido gratis!' : '¡Tienes ' + p.recompensasDisponibles + ' batidos gratis!' }}
                </p>
                <p style="margin:6px 0 0;font-size:var(--mo-fs-caption);opacity:.75;">
                  Reclámalo en la tienda antes del {{ expiracion() }}.
                </p>
              } @else if (faltan() === 0) {
                <p style="margin:0;font-weight:800;font-size:var(--mo-fs-body);">
                  ¡Tarjeta completa! Tu próxima compra desbloquea el batido gratis.
                </p>
              } @else {
                <p style="margin:0;font-size:var(--mo-fs-small);">
                  Te {{ faltan() === 1 ? 'falta' : 'faltan' }} <strong>{{ faltan() }}</strong>
                  {{ faltan() === 1 ? 'batido' : 'batidos' }} para el siguiente gratis.
                </p>
              }
            </div>
          </div>
        }

        <p style="margin:22px 0 0;font-size:var(--mo-fs-micro);color:rgba(255,255,255,.4);max-width:52ch;">
          Solo mostramos el avance de sellos de clientes inscritos que autorizaron el programa.
          No guardamos tu número en este navegador.
        </p>
      </div>
    </section>
  `,
})
export class ClubProgressComponent {
  private readonly service = inject(ClubProgressService)

  readonly cupIcon = CupSoda
  readonly giftIcon = Gift

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
