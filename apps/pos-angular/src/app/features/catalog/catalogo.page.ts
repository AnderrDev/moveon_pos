import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { CatalogoService, type CatalogoProducto, type CatalogoCategoria } from './catalogo.service'

// TODO: datos reales del negocio (hoy placeholders)
const WHATSAPP_NUMBER = '573001234567'
const INSTAGRAM = 'moveon.suplementos'
const HORARIO_SEMANA = '10:00 a.m. – 8:00 p.m.'
const HORARIO_FESTIVOS = '11:00 a.m. – 6:00 p.m.'

// Categorías que no se muestran en el catálogo público
const HIDDEN_CATEGORIES = ['Ingredientes para batidos']

const CATEGORY_DETAIL: Record<string, string> = {
  'Proteínas': 'Whey, vegana e isolate',
  'Creatinas': 'Fuerza y rendimiento',
  'Pre-entrenos': 'Energía y enfoque',
  'Aminoácidos y recuperación': 'Recuperación muscular',
  'Bienestar y salud': 'Bienestar diario',
  'Termogénicos': 'Apoyo en definición',
  'Ganadores de peso': 'Volumen y masa',
  'Energizantes': 'Energía para tu día',
  'Alimentos proteicos': 'Snacks y comidas',
  'Batidos': 'Preparados en tienda',
}

const BADGE_STYLES: Record<string, [string, string]> = {
  'Más vendido': ['#F9D128', '#000000'],
  'Nuevo': ['#FFFFFF', '#000000'],
  'Promoción': ['#FF5C39', '#000000'],
}
const BADGE_DEFAULT: [string, string] = ['#161616', '#F9D128']

function formatCOP(v: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

interface FilaCategoria {
  id: string
  nombre: string
  detalle: string
  num: string
  conteoTexto: string
  abierta: boolean
  productos: CatalogoProducto[]
  waLink: string
}

@Component({
  selector: 'mo-catalogo-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
<!-- ── FUENTES Y ESTILOS (diseño oficial: Catalogo Move On v4) ─────────── -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
<style>
  .mo3{min-height:100vh;background:#000000;color:#FFFFFF;font-family:'Montserrat',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
  .mo3 *{box-sizing:border-box;}
  .mo3 ::selection{background:#F9D128;color:#000000;}
  .mo3-display{font-family:'Montserrat',sans-serif;font-weight:900;}
  .mo3-wrap{max-width:1280px;margin:0 auto;padding-left:clamp(16px,4vw,40px);padding-right:clamp(16px,4vw,40px);}

  @keyframes mo-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes mo-reveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes mo-pulse{0%,100%{opacity:.35}50%{opacity:.7}}

  .mo3-headwrap{display:flex;align-items:stretch;justify-content:space-between;gap:16px;min-height:60px;}
  @media (max-width:719px){
    .mo3-headwrap{flex-wrap:wrap;align-items:center;row-gap:0;padding-top:10px;padding-bottom:12px;}
    .mo3-headwrap nav{order:3;width:100%;padding-top:10px;}
  }
  .mo3-navlink{color:#9A9A9A;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;transition:color .12s;}
  .mo3-navlink:hover{color:#F9D128;}
  .mo3-btn-yellow{display:inline-flex;align-items:center;gap:10px;background:#F9D128;color:#000000;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;transition:background .12s;border:0;cursor:pointer;font-family:inherit;}
  .mo3-btn-yellow:hover{background:#FFE159;}
  .mo3-btn-outline{background:#161616;color:#FFFFFF;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;border:1px solid rgba(255,255,255,.15);transition:all .12s;}
  .mo3-btn-outline:hover{border-color:#F9D128;color:#F9D128;}

  .mo3-catrow{width:100%;text-align:left;text-decoration:none;display:grid;grid-template-columns:3.2em 1fr auto;align-items:baseline;gap:clamp(10px,2vw,24px);padding:clamp(14px,2vw,20px) clamp(8px,1.5vw,16px);background:transparent;color:#FFFFFF;border:0;transition:background .12s,color .12s;cursor:pointer;font-family:inherit;}
  .mo3-catrow:hover,.mo3-catrow.mo3-open{background:#F9D128;color:#000000;}

  .mo3-cardwa{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.1);color:#9A9A9A;font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:12px 16px;transition:all .12s;}
  .mo3-cardwa:hover{background:#F9D128;color:#000000;}

  .mo3-footlink{color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;transition:color .12s;}
  .mo3-footlink:hover{color:#F9D128;}
  .mo3-footnav{color:#9A9A9A;text-decoration:none;font-size:14px;font-weight:600;transition:color .12s;}
  .mo3-footnav:hover{color:#F9D128;}
  .mo3-sachets-link{font-weight:700;font-size:12.5px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:#000000;border-bottom:2px solid #000000;padding-bottom:2px;white-space:nowrap;transition:opacity .12s;}
  .mo3-sachets-link:hover{opacity:.7;}
  .mo3-blackbtn{display:inline-flex;align-items:center;gap:10px;background:#000000;color:#F9D128;font-weight:700;font-size:13.5px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:16px 28px;transition:color .12s;}
  .mo3-blackbtn:hover{color:#FFE159;}
</style>

<div class="mo3">

  <!-- ══ HEADER ══ -->
  <header style="position:sticky;top:0;z-index:50;background:rgba(12,12,10,.96);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap mo3-headwrap">
      <a href="#inicio" style="display:flex;align-items:center;text-decoration:none;">
        <img src="assets/catalog/moveon-logo-brand.png" alt="Move On Nutrition" style="height:30px;width:auto;display:block;">
      </a>
      <nav style="display:flex;align-items:center;gap:clamp(12px,2.2vw,28px);flex-wrap:wrap;">
        <a href="#catalogo" class="mo3-navlink">Catálogo</a>
        <a href="#batidos" class="mo3-navlink">Batidos</a>
        <a href="#ubicacion" class="mo3-navlink">Ubicación</a>
        <a href="#contacto" class="mo3-navlink">Contacto</a>
      </nav>
      <a [href]="waGeneral" target="_blank" rel="noopener" class="mo3-btn-yellow" style="align-self:center;font-size:12.5px;padding:11px 20px;">
        Comprar por WhatsApp
      </a>
    </div>
  </header>

  <!-- ══ HERO ══ -->
  <section id="inicio">
    <div class="mo3-wrap" style="padding-top:clamp(56px,9vw,110px);padding-bottom:clamp(40px,6vw,72px);">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:clamp(20px,3vw,32px);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">
        <span style="color:#F9D128;">Tienda de suplementos deportivos</span>
        <span style="color:#606060;">/</span>
        <span style="color:#9A9A9A;">Viva Fontibón — Bogotá</span>
      </div>
      <h1 class="mo3-display" style="margin:0;font-size:clamp(34px,6.8vw,92px);line-height:1.02;text-transform:uppercase;letter-spacing:.5px;max-width:15ch;">
        Más energía. Más fuerza.
        <span style="color:#F9D128;"> Más resultados.</span>
      </h1>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:clamp(24px,4vw,56px);align-items:end;margin-top:clamp(28px,4vw,48px);">
        <p style="margin:0;color:#9A9A9A;font-size:clamp(15px,1.5vw,17px);line-height:1.65;max-width:52ch;text-wrap:pretty;">
          Proteínas, creatinas, pre entrenos, aminoácidos y batidos preparados al momento. Mira el catálogo y escríbenos por WhatsApp para comprar o preguntar disponibilidad.
        </p>
        <div style="display:flex;gap:2px;flex-wrap:wrap;justify-self:start;">
          <a href="#catalogo" class="mo3-btn-yellow" style="font-size:13.5px;padding:16px 28px;">Ver catálogo ↓</a>
          <a [href]="waGeneral" target="_blank" rel="noopener" class="mo3-btn-outline" style="font-size:13.5px;padding:16px 28px;">WhatsApp →</a>
        </div>
      </div>
    </div>
    <!-- ticker -->
    <div style="background:#F9D128;overflow:hidden;border-top:1px solid #000000;">
      <div style="display:flex;width:max-content;animation:mo-marquee 26s linear infinite;">
        <div style="display:flex;gap:0;padding:10px 0;white-space:nowrap;">
          <span class="mo3-display" style="color:#000000;font-size:15px;text-transform:uppercase;letter-spacing:2px;padding:0 22px;">Proteínas ✦ Creatinas ✦ Pre entrenos ✦ Aminoácidos ✦ Quemadores ✦ Vitaminas ✦ Batidos preparados ✦ Sachets ✦ Bebidas ✦</span>
          <span class="mo3-display" style="color:#000000;font-size:15px;text-transform:uppercase;letter-spacing:2px;padding:0 22px;">Proteínas ✦ Creatinas ✦ Pre entrenos ✦ Aminoácidos ✦ Quemadores ✦ Vitaminas ✦ Batidos preparados ✦ Sachets ✦ Bebidas ✦</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CATÁLOGO ACORDEÓN ══ -->
  <section id="catalogo" style="border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:clamp(24px,3vw,40px);">
        <div style="display:flex;align-items:baseline;gap:16px;">
          <span class="mo3-display" style="color:#F9D128;font-size:14px;letter-spacing:2px;">01</span>
          <h2 class="mo3-display" style="margin:0;font-size:clamp(26px,3.5vw,40px);text-transform:uppercase;letter-spacing:.5px;">¿Qué estás buscando?</h2>
        </div>
        <span style="color:#9A9A9A;font-size:12.5px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Toca una categoría para ver los productos</span>
      </div>

      <!-- loading -->
      @if (loading()) {
        <div style="display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.12);">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div style="border-bottom:1px solid rgba(255,255,255,.12);padding:clamp(14px,2vw,20px) clamp(8px,1.5vw,16px);">
              <div style="height:clamp(24px,2.6vw,34px);width:min(46%, 320px);background:#161616;animation:mo-pulse 1.4s ease-in-out infinite;"></div>
            </div>
          }
        </div>
      }

      <!-- error -->
      @if (loadError()) {
        <div style="border:1px solid rgba(255,255,255,.12);padding:clamp(20px,3vw,32px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <span style="color:#9A9A9A;font-size:14.5px;line-height:1.5;max-width:52ch;">No pudimos cargar el catálogo en este momento. Escríbenos por WhatsApp y te contamos qué hay disponible hoy.</span>
          <a [href]="waGeneral" target="_blank" rel="noopener" class="mo3-btn-yellow" style="font-size:12.5px;padding:13px 22px;white-space:nowrap;">Preguntar por WhatsApp →</a>
        </div>
      }

      <!-- acordeón -->
      @if (!loading() && !loadError()) {
        <div style="display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.12);">
          @for (cat of filas(); track cat.id) {
            <div style="border-bottom:1px solid rgba(255,255,255,.12);">
              <button type="button" (click)="toggle(cat.id)" class="mo3-catrow" [class.mo3-open]="cat.abierta">
                <span class="mo3-display" style="font-size:clamp(13px,1.4vw,15px);letter-spacing:1px;opacity:.55;">{{ cat.num }}</span>
                <span style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;">
                  <span class="mo3-display" style="font-size:clamp(20px,2.6vw,30px);text-transform:uppercase;letter-spacing:.5px;">{{ cat.nombre }}</span>
                  <span style="font-size:clamp(12px,1.3vw,14px);opacity:.6;font-weight:500;">{{ cat.detalle }}</span>
                </span>
                <span style="display:flex;align-items:baseline;gap:16px;">
                  <span style="font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:.55;">{{ cat.conteoTexto }}</span>
                  <span class="mo3-display" style="font-size:clamp(18px,2.2vw,26px);width:1em;text-align:center;">{{ cat.abierta ? '−' : '+' }}</span>
                </span>
              </button>

              @if (cat.abierta) {
                <div style="background:#0E0E0E;padding:clamp(14px,2vw,24px);animation:mo-reveal .18s ease-out;">
                  @if (cat.productos.length > 0) {
                    <div style="display:flex;flex-wrap:wrap;gap:2px;">
                      @for (p of cat.productos; track p.id) {
                        <article style="background:#000000;display:flex;flex-direction:column;flex:1 1 240px;min-width:min(240px,100%);max-width:520px;border:1px solid rgba(255,255,255,.12);">
                          <div style="position:relative;height:clamp(160px,20vw,210px);background:#141414;display:grid;place-items:center;border-bottom:1px solid rgba(255,255,255,.1);overflow:hidden;">
                            @if (p.imageUrl) {
                              <img [src]="p.imageUrl" [alt]="p.nombre" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
                            } @else {
                              <span style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#606060;text-align:center;padding:0 16px;">[ foto — {{ p.nombre }} ]</span>
                            }
                            @if (p.etiqueta) {
                              <span [style.background]="badgeBg(p.etiqueta)" [style.color]="badgeFg(p.etiqueta)" style="position:absolute;top:0;left:0;font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 12px;">{{ p.etiqueta }}</span>
                            }
                          </div>
                          <div style="padding:16px 16px 14px;display:flex;flex-direction:column;gap:5px;flex:1;">
                            <span style="color:#F9D128;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">{{ marcaDe(p) }}</span>
                            <h3 style="margin:0;font-size:16px;font-weight:700;color:#FFFFFF;line-height:1.3;text-wrap:pretty;">{{ p.nombre }}</h3>
                            <span class="mo3-display" style="font-size:20px;color:#FFFFFF;letter-spacing:.5px;margin-top:auto;padding-top:10px;">{{ formatPrice(p.precioVenta) }}</span>
                          </div>
                          <a [href]="waProducto(p)" target="_blank" rel="noopener" class="mo3-cardwa">
                            <span>Preguntar por WhatsApp</span><span>→</span>
                          </a>
                        </article>
                      }
                    </div>
                  } @else {
                    <div style="border:1px solid rgba(255,255,255,.12);padding:clamp(20px,3vw,32px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                      <span style="color:#9A9A9A;font-size:14.5px;line-height:1.5;max-width:52ch;">Manejamos varias marcas y presentaciones en esta categoría. Escríbenos y te contamos qué hay disponible hoy.</span>
                      <a [href]="cat.waLink" target="_blank" rel="noopener" class="mo3-btn-yellow" style="font-size:12.5px;padding:13px 22px;white-space:nowrap;">Preguntar disponibilidad →</a>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  </section>

  <!-- ══ BATIDOS ══ -->
  <section id="batidos" style="background:#F9D128;color:#000000;">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:10px;">
        <span class="mo3-display" style="font-size:14px;letter-spacing:2px;opacity:.55;">02</span>
        <h2 class="mo3-display" style="margin:0;font-size:clamp(30px,4.5vw,52px);text-transform:uppercase;letter-spacing:.5px;">Batidos preparados en tienda</h2>
      </div>
      <p style="margin:0 0 clamp(24px,3vw,40px) calc(14px + 2em);font-size:clamp(14.5px,1.5vw,16.5px);font-weight:500;line-height:1.6;max-width:56ch;text-wrap:pretty;">
        Ideal para después de entrenar o como opción rápida de proteína durante el día. Los preparamos al momento en nuestra sede de Viva Fontibón.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:2px;border:2px solid #000000;margin-bottom:clamp(20px,3vw,28px);background:#000000;">
        <div style="background:#F9D128;padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.6;">Opción ligera</span>
          <strong class="mo3-display" style="font-size:clamp(22px,2.6vw,30px);text-transform:uppercase;">Batido en agua</strong>
          <span style="font-size:14px;font-weight:500;line-height:1.55;opacity:.75;">Menos calorías, misma proteína. El favorito en definición.</span>
          <span class="mo3-display" style="font-size:clamp(24px,3vw,32px);margin-top:6px;">$8.000</span>
        </div>
        <div style="background:#F9D128;padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.6;">Opción cremosa</span>
          <strong class="mo3-display" style="font-size:clamp(22px,2.6vw,30px);text-transform:uppercase;">Batido en leche</strong>
          <span style="font-size:14px;font-weight:500;line-height:1.55;opacity:.75;">Más cremoso y con calorías extra. Ideal para volumen.</span>
          <span class="mo3-display" style="font-size:clamp(24px,3vw,32px);margin-top:6px;">$10.000</span>
        </div>
      </div>
      <div style="border:2px solid #000000;padding:clamp(18px,2.5vw,26px) clamp(20px,3vw,32px);margin-bottom:clamp(20px,3vw,28px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.6;">También en tienda</span>
          <span style="font-size:clamp(14.5px,1.5vw,16px);font-weight:600;line-height:1.5;max-width:58ch;text-wrap:pretty;">Sachets individuales de proteína, creatina y pre entreno, y bebidas listas para tomar. Perfectos para probar antes de llevar el tarro completo.</span>
        </div>
        <a href="#catalogo" class="mo3-sachets-link">Ver sachets →</a>
      </div>
      <a [href]="waBatidos" target="_blank" rel="noopener" class="mo3-blackbtn">Pedir por WhatsApp →</a>
    </div>
  </section>

  <!-- ══ CONFIANZA ══ -->
  <section style="border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(24px,3vw,40px);">
        @for (item of confianza; track item.titulo) {
          <div style="display:flex;flex-direction:column;gap:10px;border-top:2px solid #F9D128;padding-top:16px;">
            <span class="mo3-display" style="font-size:17px;text-transform:uppercase;letter-spacing:.5px;">{{ item.titulo }}</span>
            <span style="color:#9A9A9A;font-size:14px;line-height:1.6;">{{ item.texto }}</span>
          </div>
        }
      </div>
    </div>
  </section>

  <!-- ══ UBICACIÓN ══ -->
  <section id="ubicacion">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(28px,4vw,64px);align-items:start;">
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div style="display:flex;align-items:baseline;gap:16px;">
          <span class="mo3-display" style="color:#F9D128;font-size:14px;letter-spacing:2px;">03</span>
          <h2 class="mo3-display" style="margin:0;font-size:clamp(28px,4vw,46px);text-transform:uppercase;line-height:1.05;">Encuéntranos en <span style="color:#F9D128;">Viva Fontibón</span></h2>
        </div>
        <p style="margin:0;color:#9A9A9A;font-size:15.5px;line-height:1.65;max-width:48ch;">Diagonal al Éxito y Smart Fit. Pasa por tu batido después de entrenar o recoge tu pedido en tienda.</p>
        <div style="border:1px solid rgba(255,255,255,.15);">
          <div style="display:flex;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.12);">
            <span style="color:#9A9A9A;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Lunes a sábado</span>
            <span style="color:#FFFFFF;font-size:14px;font-weight:600;">{{ horarioSemana }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;padding:14px 18px;">
            <span style="color:#9A9A9A;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Domingos y festivos</span>
            <span style="color:#FFFFFF;font-size:14px;font-weight:600;">{{ horarioFestivos }}</span>
          </div>
        </div>
        <a href="https://maps.google.com/?q=Viva+Fontibon+Bogota" target="_blank" rel="noopener" class="mo3-btn-yellow" style="align-self:flex-start;font-size:13.5px;padding:15px 26px;">Cómo llegar →</a>
      </div>
      <div style="min-height:340px;align-self:stretch;border:1px solid rgba(255,255,255,.15);background:#0E0E0E;display:grid;place-items:center;">
        <div style="text-align:center;padding:24px;">
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#606060;">[ mapa — Viva Fontibón ]</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#3A3A3A;margin-top:6px;">aquí puede ir un iframe de Google Maps</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ FOOTER ══ -->
  <footer id="contacto" style="border-top:1px solid rgba(255,255,255,.12);overflow:hidden;">
    <div class="mo3-wrap" style="padding-top:clamp(40px,6vw,72px);">
      <div style="display:flex;flex-wrap:wrap;gap:clamp(28px,4vw,64px);justify-content:space-between;margin-bottom:clamp(36px,5vw,64px);">
        <div style="display:flex;flex-direction:column;gap:12px;max-width:36ch;">
          <span style="color:#F9D128;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Contacto directo</span>
          <a [href]="waGeneral" target="_blank" rel="noopener" class="mo3-footlink">WhatsApp · {{ whatsappDisplay }}</a>
          <a [href]="igLink" target="_blank" rel="noopener" class="mo3-footlink">Instagram · &#64;{{ instagram }}</a>
          <span style="color:#9A9A9A;font-size:14px;line-height:1.5;">Viva Fontibón, Bogotá · Diagonal al Éxito y Smart Fit</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <span style="color:#F9D128;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Secciones</span>
          <a href="#catalogo" class="mo3-footnav">Catálogo</a>
          <a href="#batidos" class="mo3-footnav">Batidos</a>
          <a href="#ubicacion" class="mo3-footnav">Ubicación</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;justify-content:flex-end;">
          <span style="color:#606060;font-size:12px;">Catálogo sujeto a disponibilidad.</span>
          <span style="color:#606060;font-size:12px;">Move On © {{ currentYear }} · Bogotá, Colombia</span>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:center;padding:0 clamp(16px,4vw,40px) clamp(28px,4vw,48px);">
      <img src="assets/catalog/moveon-logo-brand.png" alt="Move On Nutrition" style="width:min(560px,84vw);height:auto;display:block;opacity:.9;">
    </div>
  </footer>
</div>
`,
})
export class CatalogoPage implements OnInit {
  private readonly catalogoService = inject(CatalogoService)

  readonly loading = signal(true)
  readonly loadError = signal(false)
  private readonly categorias = signal<CatalogoCategoria[]>([])
  readonly abierta = signal<string | null>(null)

  readonly filas = computed<FilaCategoria[]>(() =>
    this.categorias()
      .filter((cat) => !HIDDEN_CATEGORIES.includes(cat.nombre))
      .map((cat, i) => ({
      id: cat.id,
      nombre: cat.nombre,
      detalle: CATEGORY_DETAIL[cat.nombre] ?? '',
      num: String(i + 1).padStart(2, '0'),
      conteoTexto:
        cat.productos.length === 0
          ? 'Preguntar'
          : `${cat.productos.length} ${cat.productos.length === 1 ? 'producto' : 'productos'}`,
      abierta: this.abierta() === cat.id,
      productos: cat.productos,
        waLink: this.wa(`Hola Move On 👋 ¿Qué ${cat.nombre.toLowerCase()} tienen disponibles?`),
      })),
  )

  readonly waGeneral = this.wa('Hola Move On 👋 Vi el catálogo y quiero más información.')
  readonly waBatidos = this.wa('Hola Move On 👋 Quiero pedir un batido de proteína.')
  readonly instagram = INSTAGRAM
  readonly igLink = `https://instagram.com/${INSTAGRAM}`
  readonly horarioSemana = HORARIO_SEMANA
  readonly horarioFestivos = HORARIO_FESTIVOS
  readonly currentYear = new Date().getFullYear()
  readonly whatsappDisplay = `+${WHATSAPP_NUMBER.slice(0, 2)} ${WHATSAPP_NUMBER.slice(2, 5)} ${WHATSAPP_NUMBER.slice(5, 8)} ${WHATSAPP_NUMBER.slice(8)}`

  readonly confianza = [
    { titulo: 'Asesoría personalizada', texto: 'Te ayudamos a elegir según tu entrenamiento y tu objetivo. Sin enredos.' },
    { titulo: 'Productos originales', texto: 'Solo marcas reconocidas y producto sellado. Lo que ves es lo que llevas.' },
    { titulo: 'Variedad de marcas', texto: 'Opciones para todos los presupuestos sin sacrificar calidad.' },
    { titulo: 'Para tu objetivo', texto: 'Ganar masa, definición, energía o recuperación: hay opción para ti.' },
  ]

  async ngOnInit(): Promise<void> {
    try {
      const categorias = await this.catalogoService.getCatalogo()
      this.categorias.set(categorias)
      if (categorias.length > 0) this.abierta.set(categorias[0].id)
    } catch {
      this.loadError.set(true)
    } finally {
      this.loading.set(false)
    }
  }

  toggle(catId: string): void {
    this.abierta.set(this.abierta() === catId ? null : catId)
  }

  marcaDe(p: CatalogoProducto): string {
    return p.marca ?? p.categoriaNombre ?? 'Move On'
  }

  badgeBg(etiqueta: string): string {
    return (BADGE_STYLES[etiqueta] ?? BADGE_DEFAULT)[0]
  }

  badgeFg(etiqueta: string): string {
    return (BADGE_STYLES[etiqueta] ?? BADGE_DEFAULT)[1]
  }

  waProducto(p: CatalogoProducto): string {
    return this.wa(`Hola Move On 👋 Quiero preguntar por: ${p.nombre}. ¿Está disponible?`)
  }

  formatPrice(v: number): string {
    return formatCOP(v)
  }

  private wa(msg: string): string {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
  }
}
