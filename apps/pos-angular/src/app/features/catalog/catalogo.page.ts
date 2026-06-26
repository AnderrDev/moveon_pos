import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { CatalogoService, type CatalogoProducto, type CatalogoCategoria, type ComboSemana } from './catalogo.service'

const WHATSAPP_NUMBER = '573001234567'
const LOGO_WHITE = 'assets/catalog/moveon-logo-white.png'
const BATIDO_IMAGE = 'assets/catalog/batido-protein.webp'
const COMBO_IMAGE = 'assets/catalog/combo-weekly.webp'

const CATALOG_CATEGORIES = [
  'Proteínas', 'Creatinas', 'Pre-entrenos',
  'Aminoácidos y recuperación', 'Bienestar y salud',
  'Termogénicos', 'Ganadores de peso', 'Energizantes', 'Alimentos proteicos',
]

const CATEGORY_EMOJI: Record<string, string> = {
  'Proteínas': '💪', 'Creatinas': '⚡', 'Pre-entrenos': '🔥',
  'Aminoácidos y recuperación': '🔄', 'Bienestar y salud': '🌿',
  'Termogénicos': '🌡️', 'Ganadores de peso': '📈',
  'Energizantes': '⚡', 'Alimentos proteicos': '🥞',
}

const INGREDIENT_EMOJI: Record<string, string> = {
  'ARANDANOS': '🫐', 'AREQUIPE 50GR': '🍮', 'BANANO 80GR': '🍌',
  'CAFE 7GR': '☕', 'CARAMELO': '🍬', 'CHIPS CHOCOLATE': '🍫',
  'FRESA 90GR': '🍓', 'GRANOLA': '🌾', 'LECHE ALMENDRAS': '🥛',
  'MANGO 150GR': '🥭', 'MANTEQUILLA MANI 30GR': '🥜', 'MILO 30GR': '🧃',
  'MORA 80GR': '🍇', 'PIÑA 110GR': '🍍', 'SALSA CHOCOLATE': '🫖',
  'SALSA FRESA': '🍓', 'SALSA MANI': '🥜', 'YOGURTH GRIEGO': '🫙',
}

const INGREDIENT_COLOR: Record<string, string> = {
  'ARANDANOS': '#6b21a8', 'AREQUIPE 50GR': '#b45309', 'BANANO 80GR': '#ca8a04',
  'CAFE 7GR': '#44200c', 'CARAMELO': '#d97706', 'CHIPS CHOCOLATE': '#6b1a1a',
  'FRESA 90GR': '#be123c', 'GRANOLA': '#a16207', 'LECHE ALMENDRAS': '#c8a96e',
  'MANGO 150GR': '#c2410c', 'MANTEQUILLA MANI 30GR': '#854d0e', 'MILO 30GR': '#3b1515',
  'MORA 80GR': '#5b21b6', 'PIÑA 110GR': '#d97706', 'SALSA CHOCOLATE': '#4a1515',
  'SALSA FRESA': '#9f1239', 'SALSA MANI': '#713f12', 'YOGURTH GRIEGO': '#6b7280',
}

function formatCOP(v: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

function ingDisplayName(nombre: string): string {
  return nombre.replace(/\s+\d+\s*(G?R?|onz)$/i, '').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

// Hardcoded particles to avoid random() hydration issues
const PARTICLES = [
  { left: '3%', delay: '0s', dur: '9s', size: 18 },
  { left: '12%', delay: '1.4s', dur: '12s', size: 12 },
  { left: '22%', delay: '3.1s', dur: '8s', size: 22 },
  { left: '30%', delay: '0.7s', dur: '14s', size: 10 },
  { left: '42%', delay: '2.3s', dur: '10s', size: 16 },
  { left: '51%', delay: '4.5s', dur: '11s', size: 8 },
  { left: '60%', delay: '1.1s', dur: '13s', size: 20 },
  { left: '70%', delay: '3.8s', dur: '9s', size: 14 },
  { left: '80%', delay: '0.4s', dur: '15s', size: 11 },
  { left: '88%', delay: '2.7s', dur: '10s', size: 18 },
  { left: '95%', delay: '5.2s', dur: '8s', size: 13 },
  { left: '47%', delay: '6.0s', dur: '12s', size: 9 },
]

const WA_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`

@Component({
  selector: 'mo-catalogo-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
<!-- ── ESTILOS Y FUENTES ─────────────────────────────────────────────── -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  .mo{font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;background:#f5f5f5;color:#111;}

  /* Hero animations */
  @keyframes glow-pulse{
    0%,100%{opacity:.12;transform:scale(1);}
    50%{opacity:.22;transform:scale(1.15);}
  }
  @keyframes glow-pulse2{
    0%,100%{opacity:.06;transform:scale(1) translateX(0);}
    50%{opacity:.14;transform:scale(1.2) translateX(-30px);}
  }
  @keyframes float-up{
    0%{transform:translateY(0) rotate(0deg);opacity:0;}
    8%{opacity:.18;}
    92%{opacity:.1;}
    100%{transform:translateY(-110vh) rotate(540deg);opacity:0;}
  }
  @keyframes hero-in{
    from{opacity:0;transform:translateY(28px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes logo-in{
    from{opacity:0;transform:translateY(-20px) scale(.95);}
    to{opacity:1;transform:translateY(0) scale(1);}
  }
  @keyframes on-flash{
    0%,90%,100%{color:#F9D128;text-shadow:0 0 40px rgba(249,209,40,.4);}
    95%{color:#fff;text-shadow:none;}
  }
  @keyframes scan{
    0%{background-position:0 0;}
    100%{background-position:0 100px;}
  }
  @keyframes cup-fill{
    from{height:0%;}
    to{height:var(--fill);}
  }
  @keyframes ingredient-pop{
    0%{transform:scale(.8);opacity:0;}
    70%{transform:scale(1.1);}
    100%{transform:scale(1);opacity:1;}
  }
  @keyframes shake{
    0%,100%{transform:rotate(0deg);}
    20%{transform:rotate(-8deg);}
    40%{transform:rotate(8deg);}
    60%{transform:rotate(-5deg);}
    80%{transform:rotate(5deg);}
  }

  .hero-on{animation:on-flash 4s ease-in-out infinite;}
  .logo-anim{animation:logo-in .6s ease both;}
  .hero-text{animation:hero-in .7s .3s ease both;}
  .hero-sub{animation:hero-in .7s .55s ease both;}
  .hero-cta{animation:hero-in .7s .75s ease both;}

  .particle{
    position:absolute;bottom:-60px;pointer-events:none;
    animation:float-up var(--dur) var(--delay) linear infinite;
    opacity:0;
  }
  .ing-card{
    position:relative;
    cursor:pointer;
    transition:transform .15s,box-shadow .15s;
    user-select:none;
  }
  .ing-card:hover{transform:translateY(-2px);}
  .ing-card.selected{animation:ingredient-pop .2s ease;}
  .cup-shaking{animation:shake .4s ease;}
  .batido-grid{grid-template-columns:1fr 300px;}
  .section-media-grid{grid-template-columns:minmax(0,1fr) minmax(240px,360px);}
  @media(max-width:768px){
    .batido-grid{grid-template-columns:1fr;}
    .section-media-grid{grid-template-columns:1fr;}
  }

  .cat-btn{
    padding:.75rem 1.1rem;
    font-family:inherit;font-size:.68rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.07em;
    border:none;cursor:pointer;
    white-space:nowrap;background:transparent;
    border-bottom:2px solid transparent;
    transition:color .15s,border-color .15s;
    color:rgba(255,255,255,.4);
  }
  .cat-btn.active{color:#F9D128;border-bottom-color:#F9D128;}
  .cat-btn:hover:not(.active){color:rgba(255,255,255,.7);}

  .prod-card{
    background:#fff;border-radius:10px;overflow:hidden;
    box-shadow:0 1px 3px rgba(0,0,0,.07);
    display:flex;flex-direction:column;
    transition:transform .18s,box-shadow .18s;
  }
  .prod-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.12);}

  .combo-card{
    background:#111;
    transition:background .2s;
  }
  .combo-card:hover{background:#1a1a1a;}
</style>

<div class="mo" style="min-height:100vh;">

<!-- ══ HEADER ═══════════════════════════════════════════════════════ -->
<header style="
  position:sticky;top:0;z-index:100;
  background:#000;height:60px;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 1.5rem;
  border-bottom:2px solid #F9D128;
">
  <img [src]="logoWhite" alt="MOVE ON Nutrición Sportwear" style="height:38px;width:auto;display:block;">

  <a [href]="waUrl" target="_blank" rel="noopener" style="
    display:flex;align-items:center;gap:.4rem;
    background:#F9D128;color:#000;
    padding:.42rem .95rem;border-radius:5px;
    font-size:.72rem;font-weight:800;text-decoration:none;
    text-transform:uppercase;letter-spacing:.05em;
  " [innerHTML]="'<span style=&quot;display:flex;align-items:center;gap:.35rem;&quot;>' + waIcon + ' Consultar</span>'"></a>
</header>

<!-- ══ HERO ANIMADO ══════════════════════════════════════════════════ -->
<section style="
  position:relative;background:#000;overflow:hidden;
  min-height:92vh;display:flex;align-items:center;justify-content:center;
">
  <!-- Líneas de escaneo (textura) -->
  <div style="
    position:absolute;inset:0;pointer-events:none;z-index:0;
    background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px);
  "></div>

  <!-- Glow central pulsante -->
  <div style="
    position:absolute;top:40%;left:50%;
    transform:translate(-50%,-50%);
    width:700px;height:500px;border-radius:50%;
    background:radial-gradient(ellipse,rgba(249,209,40,.16) 0%,transparent 70%);
    animation:glow-pulse 3s ease-in-out infinite;
    pointer-events:none;
  "></div>
  <div style="
    position:absolute;top:55%;left:30%;
    width:400px;height:300px;border-radius:50%;
    background:radial-gradient(ellipse,rgba(249,209,40,.08) 0%,transparent 70%);
    animation:glow-pulse2 4s ease-in-out infinite;
    pointer-events:none;
  "></div>

  <!-- Partículas flotantes (power button icons) -->
  @for(p of particles; track p.left) {
    <div class="particle" [style]="'left:'+p.left+';--dur:'+p.dur+';--delay:'+p.delay">
      <svg [attr.width]="p.size" [attr.height]="p.size" viewBox="0 0 24 24" fill="none">
        <path d="M12 3A9.5 9.5 0 1 0 12 3.01" stroke="rgba(249,209,40,0.6)" stroke-width="2.5" stroke-dasharray="50 12" stroke-dashoffset="-4" stroke-linecap="round"/>
        <line x1="12" y1="0" x2="12" y2="9" stroke="rgba(249,209,40,0.6)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
  }

  <!-- Contenido hero -->
  <div style="position:relative;z-index:1;text-align:center;padding:2rem 1.5rem;max-width:860px;width:100%;">

    <!-- Badge -->
    <div class="hero-text" style="
      display:inline-flex;align-items:center;gap:.45rem;
      border:1px solid rgba(249,209,40,.35);
      background:rgba(249,209,40,.06);
      color:#F9D128;font-size:.65rem;font-weight:700;
      letter-spacing:.2em;text-transform:uppercase;
      padding:.28rem 1rem;border-radius:3px;margin-bottom:2rem;
    ">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F9D128" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="2" x2="12" y2="12"/><path d="M5.45 5.11A9 9 0 1 0 18.55 5.11"/>
      </svg>
      Catálogo Oficial · Bogotá
    </div>

    <!-- Logo grande en hero -->
    <div class="logo-anim" style="margin-bottom:1.25rem;">
      <img [src]="logoWhite" alt="MOVE ON Nutrición Sportwear" style="width:min(520px,88vw);height:auto;margin:0 auto;display:block;">
    </div>

    <p class="hero-sub" style="
      font-size:.72rem;color:rgba(255,255,255,.35);
      letter-spacing:.28em;text-transform:uppercase;font-weight:600;
      margin:0 0 1.75rem;
    ">NUTRICIÓN · SPORTWEAR</p>

    <p class="hero-text" style="
      font-size:clamp(.95rem,2.5vw,1.15rem);
      color:rgba(255,255,255,.6);line-height:1.65;
      margin:0 auto 2.75rem;max-width:500px;font-weight:400;
    ">
      Suplementos de las mejores marcas mundiales y batidos preparados al momento.
    </p>

    <div class="hero-cta" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
      <a href="#catalogo" style="
        background:#F9D128;color:#000;
        padding:.85rem 2.25rem;border-radius:5px;
        font-size:.8rem;font-weight:900;text-decoration:none;
        text-transform:uppercase;letter-spacing:.08em;
        box-shadow:0 0 50px rgba(249,209,40,.25);
      ">Ver suplementos</a>
      <a href="#batidos" style="
        border:2px solid rgba(255,255,255,.2);color:#fff;
        padding:.85rem 2.25rem;border-radius:5px;
        font-size:.8rem;font-weight:700;text-decoration:none;
        text-transform:uppercase;letter-spacing:.08em;
      ">Armar mi batido</a>
    </div>
  </div>

  <!-- Flecha scroll -->
  <div style="
    position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);
    display:flex;flex-direction:column;align-items:center;gap:.3rem;
    color:rgba(255,255,255,.2);font-size:.6rem;font-weight:600;
    letter-spacing:.15em;text-transform:uppercase;
  ">
    SCROLL
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </div>
</section>

<!-- ══ STATS BAR ══════════════════════════════════════════════════════ -->
<div style="background:#F9D128;display:flex;justify-content:center;">
  @for(s of stats; track s.label) {
    <div style="flex:1;max-width:220px;text-align:center;padding:.85rem 1rem;border-right:1px solid rgba(0,0,0,.1);">
      <div style="font-size:1.05rem;font-weight:900;color:#000;line-height:1;">{{s.value}}</div>
      <div style="font-size:.58rem;font-weight:700;color:rgba(0,0,0,.55);letter-spacing:.1em;text-transform:uppercase;margin-top:2px;">{{s.label}}</div>
    </div>
  }
</div>

<!-- ══ COMBOS DE LA SEMANA ════════════════════════════════════════════ -->
@if (!loading() && combos().length > 0) {
<section style="background:#111;padding:4rem 1.5rem;">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="section-media-grid" style="margin-bottom:2.5rem;display:grid;gap:1.5rem;align-items:end;">
      <div>
        <div style="font-size:.65rem;font-weight:700;color:#F9D128;letter-spacing:.2em;text-transform:uppercase;margin-bottom:.5rem;">Ofertas · Tiempo limitado</div>
        <h2 style="font-size:clamp(1.6rem,4vw,2.2rem);font-weight:900;color:#fff;margin:0;text-transform:uppercase;letter-spacing:-.02em;">
          Combos de la <span style="color:#F9D128;">semana</span>
        </h2>
      </div>
      <img [src]="comboImage" alt="Combo de suplementos MOVE ON" loading="lazy" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;border:1px solid rgba(249,209,40,.18);box-shadow:0 20px 45px rgba(0,0,0,.35);">
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem;">
      @for(combo of combos(); track combo.id) {
        <div class="combo-card" style="border-radius:12px;overflow:hidden;">

          <!-- Imagen/collage del combo -->
          <div style="
            position:relative;background:#000;
            height:200px;overflow:hidden;
            display:flex;align-items:center;justify-content:center;
          ">
            <!-- Glow de fondo -->
            <div style="
              position:absolute;inset:0;
              background:radial-gradient(ellipse at 50% 80%,rgba(249,209,40,.15) 0%,transparent 70%);
            "></div>

            <!-- Imágenes de productos del combo en collage -->
            @if (getComboImages(combo.items).length > 0) {
              <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                @for(img of getComboImages(combo.items); track img.url; let i = $index) {
                  <div style="
                    position:absolute;
                    width:120px;height:120px;
                    border-radius:10px;overflow:hidden;
                    background:#111;
                    box-shadow:0 8px 24px rgba(0,0,0,.6);
                    border:2px solid rgba(249,209,40,.2);
                  " [style.transform]="getComboImgTransform(i, getComboImages(combo.items).length)"
                     [style.z-index]="getComboImages(combo.items).length - i">
                    <img [src]="img.url" [alt]="img.nombre" style="width:100%;height:100%;object-fit:contain;padding:6px;" loading="lazy" (error)="onImgError($event)"/>
                  </div>
                }
              </div>
            } @else {
              <img [src]="comboImage" [alt]="combo.nombre" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.82;">
            }

            <!-- Badge -->
            @if(combo.etiqueta) {
              <div style="
                position:absolute;top:.75rem;left:.75rem;
                background:#F9D128;color:#000;
                font-size:.6rem;font-weight:800;
                padding:.2rem .6rem;border-radius:3px;
                text-transform:uppercase;letter-spacing:.06em;
              ">{{combo.etiqueta}}</div>
            }
            @if(combo.precioOriginal && combo.precioOriginal > combo.precio) {
              <div style="
                position:absolute;top:.75rem;right:.75rem;
                background:#000;color:#F9D128;
                font-size:.65rem;font-weight:800;
                padding:.2rem .55rem;border-radius:3px;
                border:1px solid rgba(249,209,40,.3);
              ">-{{calcDesc(combo.precio, combo.precioOriginal)}}%</div>
            }
          </div>

          <!-- Info -->
          <div style="padding:1.5rem 1.5rem 1.25rem;">
            <h3 style="font-size:1rem;font-weight:900;color:#fff;margin:0 0 .4rem;text-transform:uppercase;letter-spacing:-.01em;">{{combo.nombre}}</h3>
            @if(combo.descripcion){
              <p style="font-size:.78rem;color:rgba(255,255,255,.4);margin:0 0 1rem;line-height:1.5;">{{combo.descripcion}}</p>
            }
            <ul style="margin:0 0 1.25rem;padding:0;list-style:none;display:flex;flex-direction:column;gap:.28rem;">
              @for(item of combo.items; track item) {
                <li style="display:flex;align-items:center;gap:.45rem;font-size:.73rem;color:rgba(255,255,255,.55);font-weight:500;">
                  <span style="width:3px;height:3px;background:#F9D128;border-radius:50%;flex-shrink:0;"></span>
                  {{item | titlecase}}
                </li>
              }
            </ul>
            <div style="border-top:1px solid rgba(255,255,255,.07);padding-top:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
              <div>
                <div style="font-size:1.5rem;font-weight:900;color:#F9D128;line-height:1;">{{formatPrice(combo.precio)}}</div>
                @if(combo.precioOriginal){
                  <div style="font-size:.78rem;color:rgba(255,255,255,.25);text-decoration:line-through;">{{formatPrice(combo.precioOriginal)}}</div>
                }
              </div>
              <a [href]="buildWACombo(combo)" target="_blank" rel="noopener" style="
                border:1.5px solid #F9D128;color:#F9D128;
                padding:.5rem 1.1rem;border-radius:5px;
                font-size:.7rem;font-weight:800;text-decoration:none;
                text-transform:uppercase;letter-spacing:.06em;
                transition:background .15s,color .15s;
              ">Pedir combo</a>
            </div>
          </div>
        </div>
      }
    </div>
  </div>
</section>
}

<!-- ══ BATIDOS INTERACTIVOS ═══════════════════════════════════════════ -->
@if (!loading() && (batidos().length > 0 || ingredientes().length > 0)) {
<section id="batidos" style="background:#000;padding:4rem 1.5rem;border-top:1px solid #1a1a1a;">
  <div style="max-width:1200px;margin:0 auto;">
    <div class="section-media-grid" style="margin-bottom:2.5rem;display:grid;gap:1.5rem;align-items:end;">
      <div>
        <div style="font-size:.65rem;font-weight:700;color:#F9D128;letter-spacing:.2em;text-transform:uppercase;margin-bottom:.5rem;">100% personalizado</div>
        <h2 style="font-size:clamp(1.6rem,4vw,2.2rem);font-weight:900;color:#fff;margin:0;text-transform:uppercase;letter-spacing:-.02em;">
          Arma tu <span style="color:#F9D128;">batido</span>
        </h2>
      </div>
      <img [src]="batidoImage" alt="Batido proteico MOVE ON" loading="lazy" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;border:1px solid rgba(249,209,40,.18);box-shadow:0 20px 45px rgba(0,0,0,.35);">
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:2rem;align-items:start;" class="batido-grid">

      <!-- ── IZQUIERDA: Selección ── -->
      <div>
        <!-- Paso 1: Base -->
        <div style="margin-bottom:2rem;">
          <div style="font-size:.65rem;font-weight:700;color:rgba(255,255,255,.35);letter-spacing:.15em;text-transform:uppercase;margin-bottom:1rem;">
            01 — Elige tu base
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;max-width:460px;">
            @for(base of batidos(); track base.id) {
              <button
                (click)="selectBase(base)"
                style="
                  border-radius:10px;padding:1.25rem 1rem;text-align:center;cursor:pointer;
                  border:2px solid;font-family:inherit;
                  transition:all .2s;
                "
                [style.background]="selectedBase()?.id === base.id ? 'rgba(249,209,40,.12)' : 'rgba(255,255,255,.04)'"
                [style.border-color]="selectedBase()?.id === base.id ? '#F9D128' : 'rgba(255,255,255,.1)'"
              >
                <div style="font-size:2rem;margin-bottom:.5rem;">
                  {{base.nombre === 'BATIDO EN AGUA' ? '💧' : '🥛'}}
                </div>
                <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.3rem;"
                  [style.color]="selectedBase()?.id === base.id ? '#F9D128' : '#fff'">
                  {{base.nombre === 'BATIDO EN AGUA' ? 'En Agua' : 'En Leche'}}
                </div>
                <div style="font-size:.85rem;font-weight:900;"
                  [style.color]="selectedBase()?.id === base.id ? '#F9D128' : 'rgba(255,255,255,.5)'">
                  {{formatPrice(base.precioVenta)}}
                </div>
                @if(selectedBase()?.id === base.id){
                  <div style="margin-top:.4rem;">
                    <span style="background:#F9D128;color:#000;font-size:.55rem;font-weight:800;padding:.15rem .4rem;border-radius:2px;text-transform:uppercase;letter-spacing:.05em;">✓ Elegido</span>
                  </div>
                }
              </button>
            }
          </div>
        </div>

        <!-- Paso 2: Ingredientes -->
        @if(selectedBase()) {
          <div>
            <div style="font-size:.65rem;font-weight:700;color:rgba(255,255,255,.35);letter-spacing:.15em;text-transform:uppercase;margin-bottom:1rem;">
              02 — Agrega tus ingredientes <span style="color:rgba(255,255,255,.2);font-weight:500;">(toca para seleccionar)</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:.6rem;">
              @for(ing of ingredientes(); track ing.id) {
                <button
                  class="ing-card"
                  [class.selected]="isIngSelected(ing.id)"
                  (click)="toggleIng(ing)"
                  style="
                    border-radius:10px;padding:.9rem .5rem;text-align:center;cursor:pointer;
                    font-family:inherit;border:1.5px solid;
                    transition:all .2s;
                  "
                  [style.background]="isIngSelected(ing.id) ? ingColor(ing.nombre) + '33' : 'rgba(255,255,255,.04)'"
                  [style.border-color]="isIngSelected(ing.id) ? ingColor(ing.nombre) : 'rgba(255,255,255,.1)'"
                >
                  <div style="font-size:1.6rem;margin-bottom:.3rem;">{{ingEmoji(ing.nombre)}}</div>
                  <div style="font-size:.6rem;font-weight:700;line-height:1.2;margin-bottom:.25rem;"
                    [style.color]="isIngSelected(ing.id) ? '#fff' : 'rgba(255,255,255,.6)'">
                    {{shortIngName(ing.nombre)}}
                  </div>
                  <div style="font-size:.65rem;font-weight:800;"
                    [style.color]="isIngSelected(ing.id) ? '#F9D128' : 'rgba(255,255,255,.3)'">
                    +{{formatPrice(ing.precioVenta)}}
                  </div>
                  @if(isIngSelected(ing.id)){
                    <div style="position:absolute;top:4px;right:4px;
                      background:#F9D128;color:#000;width:14px;height:14px;
                      border-radius:50%;display:flex;align-items:center;justify-content:center;
                      font-size:8px;font-weight:900;">✓</div>
                  }
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- ── DERECHA: Preview del batido ── -->
      <div style="position:sticky;top:80px;">
        <div style="
          background:#0d0d0d;border:1px solid rgba(249,209,40,.15);
          border-radius:14px;overflow:hidden;
        ">
          <!-- Copa animada -->
          <div style="
            background:linear-gradient(135deg,#111,#0d0d0d);
            padding:2rem 1.5rem 1.5rem;text-align:center;
            border-bottom:1px solid rgba(255,255,255,.06);
            position:relative;overflow:hidden;
          ">
            <!-- Copa SVG animada -->
            <div [class.cup-shaking]="cupShaking()" style="position:relative;display:inline-block;margin-bottom:1rem;">
              <svg width="90" height="120" viewBox="0 0 90 120">
                <!-- Cuerpo de la copa -->
                <path d="M15,5 L10,95 Q10,105 20,105 L70,105 Q80,105 80,95 L75,5 Z"
                  fill="#1a1a1a" stroke="rgba(249,209,40,.3)" stroke-width="1.5"/>

                <!-- Líquido (nivel dinámico) -->
                <clipPath id="cup-clip">
                  <path d="M15,5 L10,95 Q10,105 20,105 L70,105 Q80,105 80,95 L75,5 Z"/>
                </clipPath>
                <rect x="0" y="0" width="90" [attr.height]="cupFillHeight()" style="transition:height .4s ease;"
                  [attr.fill]="cupColor()" clip-path="url(#cup-clip)"
                  [attr.y]="120 - cupFillHeight()"/>

                <!-- Burbujas -->
                @if(cupFillHeight() > 20){
                  <circle cx="32" cy="85" r="2.5" fill="rgba(255,255,255,.3)">
                    <animate attributeName="cy" values="85;60;85" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values=".3;0;.3" dur="2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="55" cy="90" r="1.8" fill="rgba(255,255,255,.25)">
                    <animate attributeName="cy" values="90;55;90" dur="2.7s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values=".25;0;.25" dur="2.7s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="44" cy="80" r="1.5" fill="rgba(255,255,255,.2)">
                    <animate attributeName="cy" values="80;50;80" dur="1.8s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values=".2;0;.2" dur="1.8s" repeatCount="indefinite"/>
                  </circle>
                }

                <!-- Paja -->
                <rect x="60" y="-5" width="5" height="70" rx="2.5" fill="#F9D128" opacity=".8"/>

                <!-- Logo MOVE ON en la copa -->
                <text x="45" y="75" text-anchor="middle"
                  font-family="Montserrat,sans-serif" font-weight="900" font-size="7"
                  fill="rgba(249,209,40,.4)" letter-spacing="1">MOVE ON</text>
              </svg>
            </div>

            @if(!selectedBase()){
              <p style="font-size:.75rem;color:rgba(255,255,255,.3);margin:0;font-weight:500;">
                Elige tu base para empezar
              </p>
            } @else if(selectedIngredients().size === 0){
              <p style="font-size:.75rem;color:rgba(255,255,255,.4);margin:0;font-weight:500;">
                Base: <span style="color:#F9D128;">{{selectedBase()?.nombre | titlecase}}</span>
                <br><span style="color:rgba(255,255,255,.25);">Ahora agrega ingredientes</span>
              </p>
            } @else {
              <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:.25rem;max-width:200px;margin:0 auto;">
                @for(ing of selectedIngredientsList(); track ing.id) {
                  <span style="
                    font-size:.65rem;padding:.15rem .45rem;border-radius:3px;
                    font-weight:600;color:#fff;
                  " [style.background]="ingColor(ing.nombre) + 'aa'">
                    {{ingEmoji(ing.nombre)}} {{shortIngName(ing.nombre)}}
                  </span>
                }
              </div>
            }
          </div>

          <!-- Total y CTA -->
          <div style="padding:1.25rem 1.5rem;">
            @if(selectedBase()){
              <!-- Desglose -->
              <div style="margin-bottom:1rem;display:flex;flex-direction:column;gap:.3rem;">
                <div style="display:flex;justify-content:space-between;font-size:.72rem;">
                  <span style="color:rgba(255,255,255,.45);">Base</span>
                  <span style="color:rgba(255,255,255,.7);font-weight:600;">{{formatPrice(selectedBase()!.precioVenta)}}</span>
                </div>
                @if(selectedIngredients().size > 0){
                  <div style="display:flex;justify-content:space-between;font-size:.72rem;">
                    <span style="color:rgba(255,255,255,.45);">Ingredientes ({{selectedIngredients().size}})</span>
                    <span style="color:rgba(255,255,255,.7);font-weight:600;">{{formatPrice(ingTotal())}}</span>
                  </div>
                }
                <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:.5rem;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:.72rem;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.05em;">Total</span>
                  <span style="font-size:1.35rem;font-weight:900;color:#F9D128;">{{formatPrice(batidoTotal())}}</span>
                </div>
              </div>

              <a [href]="buildWABatido()" target="_blank" rel="noopener" style="
                display:block;background:#F9D128;color:#000;
                text-align:center;padding:.7rem;border-radius:7px;
                font-size:.75rem;font-weight:900;text-decoration:none;
                text-transform:uppercase;letter-spacing:.07em;
                margin-bottom:.5rem;
              ">Pedir mi batido 🥤</a>

              <button (click)="resetBatido()" style="
                display:block;width:100%;background:transparent;
                color:rgba(255,255,255,.25);border:none;
                font-size:.65rem;font-weight:600;cursor:pointer;
                font-family:inherit;padding:.3rem;
                text-transform:uppercase;letter-spacing:.08em;
                transition:color .15s;
              ">Reiniciar</button>
            } @else {
              <div style="
                background:rgba(249,209,40,.06);border:1px dashed rgba(249,209,40,.2);
                border-radius:7px;padding:1rem;text-align:center;
                font-size:.72rem;color:rgba(255,255,255,.3);font-weight:500;
              ">Selecciona una base para ver el total</div>
            }
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
}

<!-- ══ CATÁLOGO DE SUPLEMENTOS ════════════════════════════════════════ -->
<section id="catalogo" style="background:#f5f5f5;padding-bottom:5rem;">

  <!-- Sticky category nav -->
  <div style="
    position:sticky;top:60px;z-index:90;
    background:#000;overflow-x:auto;
    scrollbar-width:none;border-bottom:1px solid #1a1a1a;
  ">
    <div style="display:flex;min-width:max-content;padding:0 1rem;">
      <button class="cat-btn" [class.active]="activeCategoryId() === null" (click)="setActiveCat(null)">Todos</button>
      @for(cat of suplementoCategorias(); track cat.id){
        <button class="cat-btn" [class.active]="activeCategoryId() === cat.id" (click)="setActiveCat(cat.id)">
          {{cat.nombre}}
        </button>
      }
    </div>
  </div>

  <div style="max-width:1200px;margin:0 auto;padding:2.5rem 1.5rem 0;">
    <div style="margin-bottom:2rem;">
      <h2 style="font-size:clamp(1.4rem,3.5vw,1.9rem);font-weight:900;color:#000;margin:0 0 .25rem;text-transform:uppercase;letter-spacing:-.02em;">
        {{activeCategoryId() === null ? 'Todos los suplementos' : activeCategoryLabel()}}
      </h2>
      <p style="color:#999;margin:0;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;font-weight:600;">
        {{filteredProductos().length}} productos
      </p>
    </div>

    @if(loading()){
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:1rem;">
        @for(i of [1,2,3,4,5,6,7,8,9,10,11,12]; track i){
          <div style="background:#e8e8e8;border-radius:10px;height:255px;animation:glow-pulse 1.5s ease-in-out infinite;"></div>
        }
      </div>
    }

    @if(loadError()){
      <div style="text-align:center;padding:5rem 1rem;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">⚡</div>
        <p style="color:#888;margin:0 0 1.5rem;font-size:.9rem;">No se pudo cargar el catálogo</p>
        <button (click)="retry()" style="
          background:#F9D128;color:#000;border:none;
          padding:.8rem 2rem;border-radius:5px;
          font-family:inherit;font-size:.78rem;font-weight:800;
          text-transform:uppercase;letter-spacing:.07em;cursor:pointer;
        ">Reintentar</button>
      </div>
    }

    @if(!loading() && !loadError()){
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:1rem;">
        @for(p of filteredProductos(); track p.id){
          <div class="prod-card">
            <div style="background:#f9f9f9;aspect-ratio:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              @if(p.imageUrl){
                <img [src]="p.imageUrl" [alt]="p.nombre" loading="lazy"
                  style="width:100%;height:100%;object-fit:contain;padding:.75rem;transition:transform .3s;"
                  (error)="onImgError($event)"/>
              } @else {
                <div style="font-size:2.5rem;opacity:.25;">{{catEmoji(p.categoriaNombre ?? '')}}</div>
              }
              @if(p.categoriaNombre && activeCategoryId() === null){
                <div style="
                  position:absolute;bottom:.4rem;left:.4rem;
                  background:#000;color:#F9D128;
                  font-size:.52rem;font-weight:800;
                  padding:.18rem .45rem;border-radius:2px;
                  text-transform:uppercase;letter-spacing:.04em;
                ">{{p.categoriaNombre}}</div>
              }
            </div>
            <div style="padding:.85rem;flex:1;display:flex;flex-direction:column;gap:.3rem;">
              <h3 style="font-size:.75rem;font-weight:700;color:#111;margin:0;line-height:1.35;text-transform:uppercase;letter-spacing:.01em;">
                {{p.nombre | titlecase}}
              </h3>
              @if(p.paraQueSirve){
                <p style="font-size:.66rem;color:#aaa;margin:0;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  {{p.paraQueSirve}}
                </p>
              }
              <div style="margin-top:auto;padding-top:.5rem;border-top:1px solid #f0f0f0;">
                <div style="font-size:1rem;font-weight:900;color:#000;">{{formatPrice(p.precioVenta)}}</div>
              </div>
            </div>
          </div>
        }
      </div>
    }
  </div>
</section>

<!-- ══ FOOTER ════════════════════════════════════════════════════════ -->
<footer style="background:#000;border-top:2px solid #F9D128;padding:2.5rem 1.5rem;text-align:center;">
  <img [src]="logoWhite" alt="MOVE ON Nutrición Sportwear" style="height:34px;width:auto;margin:0 auto .5rem;display:block;">
  <div style="font-size:.6rem;color:rgba(255,255,255,.25);letter-spacing:.2em;text-transform:uppercase;font-weight:600;margin-bottom:1.5rem;">NUTRICIÓN · SPORTWEAR · BOGOTÁ</div>
  <a [href]="waUrl" target="_blank" rel="noopener"
    style="display:inline-flex;align-items:center;gap:.4rem;background:#F9D128;color:#000;padding:.55rem 1.5rem;border-radius:5px;font-size:.72rem;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:.06em;"
    [innerHTML]="'<span style=&quot;display:flex;align-items:center;gap:.35rem;&quot;>' + waIcon + ' Contáctanos por WhatsApp</span>'"></a>
  <div style="margin-top:1.75rem;font-size:.62rem;color:rgba(255,255,255,.12);">© {{currentYear}} MOVE ON. Todos los derechos reservados.</div>
</footer>

</div>
  `,
})
export class CatalogoPage implements OnInit {
  readonly waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Hola%2C%20vi%20el%20cat%C3%A1logo%20y%20quiero%20m%C3%A1s%20informaci%C3%B3n`
  readonly currentYear = new Date().getFullYear()
  readonly formatPrice = formatCOP
  readonly waIcon = WA_ICON
  readonly logoWhite = LOGO_WHITE
  readonly batidoImage = BATIDO_IMAGE
  readonly comboImage = COMBO_IMAGE
  readonly particles = PARTICLES
  readonly stats = [
    { value: '50+', label: 'Productos' },
    { value: 'Top', label: 'Marcas mundiales' },
    { value: '100%', label: 'Original' },
    { value: 'Bogotá', label: 'Tienda física' },
  ]

  private readonly svc = inject(CatalogoService)

  // ── Data state ───────────────────────────────────────────────────────
  readonly loading = signal(true)
  readonly loadError = signal(false)
  private readonly categorias = signal<CatalogoCategoria[]>([])
  readonly combos = signal<ComboSemana[]>([])

  // ── Catalog filter ───────────────────────────────────────────────────
  readonly activeCategoryId = signal<string | null>(null)

  readonly suplementoCategorias = computed(() =>
    this.categorias().filter(c => CATALOG_CATEGORIES.includes(c.nombre)),
  )
  readonly filteredProductos = computed(() => {
    const id = this.activeCategoryId()
    const cats = this.suplementoCategorias()
    return id === null ? cats.flatMap(c => c.productos) : (cats.find(c => c.id === id)?.productos ?? [])
  })
  readonly activeCategoryLabel = computed(() => {
    const id = this.activeCategoryId()
    return id === null ? 'Suplementos' : (this.suplementoCategorias().find(c => c.id === id)?.nombre ?? '')
  })
  readonly batidos = computed(() => this.categorias().find(c => c.nombre === 'Batidos')?.productos ?? [])
  readonly ingredientes = computed(() =>
    this.categorias().find(c => c.nombre === 'Ingredientes para batidos')?.productos.filter(p => p.precioVenta > 0) ?? [],
  )

  // Mapa plano nombre→imagen para lookup en combos
  private readonly productByName = computed(() => {
    const map = new Map<string, CatalogoProducto>()
    for (const cat of this.categorias()) for (const p of cat.productos) map.set(p.nombre.toUpperCase(), p)
    return map
  })

  // ── Batido builder state ─────────────────────────────────────────────
  readonly selectedBase = signal<CatalogoProducto | null>(null)
  readonly selectedIngredients = signal<Map<string, CatalogoProducto>>(new Map())
  readonly cupShaking = signal(false)

  readonly selectedIngredientsList = computed(() => Array.from(this.selectedIngredients().values()))
  readonly ingTotal = computed(() => Array.from(this.selectedIngredients().values()).reduce((s, i) => s + i.precioVenta, 0))
  readonly batidoTotal = computed(() => (this.selectedBase()?.precioVenta ?? 0) + this.ingTotal())
  readonly cupFillHeight = computed(() => {
    const base = this.selectedBase() ? 30 : 0
    const ing = Math.min(this.selectedIngredients().size * 5, 70)
    return base + ing
  })
  readonly cupColor = computed(() => {
    const ings = Array.from(this.selectedIngredients().values())
    if (ings.length === 0) return this.selectedBase()?.nombre === 'BATIDO EN AGUA' ? 'rgba(147,197,253,0.6)' : 'rgba(254,240,138,0.6)'
    const colors = ings.map(i => INGREDIENT_COLOR[i.nombre] ?? '#888').slice(0, 3)
    return colors[0] + 'bb'
  })

  ngOnInit(): void { void this.load() }

  async load(): Promise<void> {
    this.loading.set(true); this.loadError.set(false)
    try {
      const [cats, combos] = await Promise.all([this.svc.getCatalogo(), this.svc.getCombos()])
      this.categorias.set(cats); this.combos.set(combos)
    } catch { this.loadError.set(true) }
    finally { this.loading.set(false) }
  }

  retry(): void { void this.load() }
  setActiveCat(id: string | null): void {
    this.activeCategoryId.set(id)
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Batido builder
  selectBase(base: CatalogoProducto): void { this.selectedBase.set(base); this.triggerShake() }
  toggleIng(ing: CatalogoProducto): void {
    const map = new Map(this.selectedIngredients())
    if (map.has(ing.id)) map.delete(ing.id); else map.set(ing.id, ing)
    this.selectedIngredients.set(map); this.triggerShake()
  }
  isIngSelected(id: string): boolean { return this.selectedIngredients().has(id) }
  resetBatido(): void { this.selectedBase.set(null); this.selectedIngredients.set(new Map()) }

  private triggerShake(): void {
    this.cupShaking.set(true)
    setTimeout(() => this.cupShaking.set(false), 450)
  }

  buildWABatido(): string {
    const base = this.selectedBase()
    if (!base) return this.waUrl
    const ings = Array.from(this.selectedIngredients().values()).map(i => ingDisplayName(i.nombre)).join(', ')
    const msg = `Hola Move On! Quiero pedir un batido:\n• Base: ${base.nombre.toLowerCase().replace('batido en ', 'En ')}\n${ings ? `• Ingredientes: ${ings}\n` : ''}• Total: ${formatCOP(this.batidoTotal())}\n¿Está disponible?`
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
  }

  // Combo images
  getComboImages(items: string[]): { url: string; nombre: string }[] {
    const map = this.productByName()
    return items.slice(0, 3).map(name => {
      const p = map.get(name.toUpperCase())
      return p?.imageUrl ? { url: p.imageUrl, nombre: p.nombre } : null
    }).filter((x): x is { url: string; nombre: string } => x !== null)
  }

  getComboImgTransform(i: number, total: number): string {
    if (total === 1) return 'rotate(-5deg) scale(1.1)'
    const offsets = [
      'rotate(-12deg) translateX(-35px) scale(.95)',
      'rotate(5deg) translateX(35px) translateY(-10px) scale(.95)',
      'rotate(0deg) translateY(10px) scale(.85)',
    ]
    return offsets[i] ?? 'rotate(0deg)'
  }

  buildWACombo(combo: ComboSemana): string {
    const msg = `Hola Move On! Quiero el combo "${combo.nombre}" (${formatCOP(combo.precio)}). ¿Está disponible?`
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
  }

  calcDesc(precio: number, original: number): number {
    return Math.round(((original - precio) / original) * 100)
  }

  // Helpers de ingredientes
  ingEmoji(nombre: string): string { return INGREDIENT_EMOJI[nombre] ?? '✨' }
  ingColor(nombre: string): string { return INGREDIENT_COLOR[nombre] ?? '#666' }
  shortIngName(nombre: string): string {
    return nombre.replace(/\s+\d+\s*(G?R?|onz)$/i, '').split(' ').slice(0, 2).join(' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }
  catEmoji(nombre: string): string { return CATEGORY_EMOJI[nombre] ?? '🏋️' }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement
    img.style.display = 'none'
    const p = img.parentElement
    if (p) { const d = document.createElement('div'); d.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem;opacity:.2;'; d.textContent = '🏋️'; p.appendChild(d) }
  }
}
