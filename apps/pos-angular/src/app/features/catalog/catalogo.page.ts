import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import {
  CatalogoService,
  type CatalogoProducto,
  type CatalogoCategoria,
  type CatalogoContactSettings,
} from './catalogo.service'

const DEFAULT_CONTACT_SETTINGS: CatalogoContactSettings = {
  whatsappNumber: '573012244006',
  whatsappDisplay: '+57 301 224 4006',
  instagramUrl: 'https://www.instagram.com/moveongear/',
  instagramHandle: 'moveongear',
}
const HORARIO_SEMANA = '9:00 a.m. – 9:00 p.m.'
const HORARIO_FESTIVOS = '9:00 a.m. – 5:00 p.m.'
const MAPS_URL = 'https://maps.app.goo.gl/bkRg1w8si7BK9Rtq8'

// Categorías que no se muestran en el catálogo público
const HIDDEN_CATEGORIES = ['Ingredientes para batidos']
const PRODUCTS_PAGE_SIZE = 10

const BADGE_STYLES: Record<string, [string, string]> = {
  'Más vendido': ['#F9D128', '#000000'],
  'Nuevo': ['#FFFFFF', '#000000'],
  'Promoción': ['#FF5C39', '#000000'],
}
const BADGE_DEFAULT: [string, string] = ['#161616', '#F9D128']

function formatCOP(v: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

interface CategoryChip {
  id: string
  nombre: string
  conteoTexto: string
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
  .mo3{min-height:100vh;background:#000000;color:#FFFFFF;font-family:'Montserrat',system-ui,sans-serif;-webkit-font-smoothing:antialiased;--mo-fs-micro:10px;--mo-fs-eyebrow:11px;--mo-fs-caption:12px;--mo-fs-small:13px;--mo-fs-body:15px;--mo-fs-body-lg:16px;--mo-fs-card-title:14px;--mo-fs-card-price:16px;--mo-fs-button:12px;--mo-fs-nav:11px;--mo-fs-h2:28px;--mo-fs-h3:22px;--mo-fs-section:30px;--mo-fs-hero:36px;}
  .mo3 *{box-sizing:border-box;}
  .mo3 ::selection{background:#F9D128;color:#000000;}
  .mo3-display{font-family:'Montserrat',sans-serif;font-weight:900;}
  .mo3-wrap{max-width:1280px;margin:0 auto;padding-left:clamp(16px,4vw,40px);padding-right:clamp(16px,4vw,40px);}
  .mo3-sectionindex{font-family:'Montserrat',sans-serif;font-size:clamp(18px,1.9vw,28px);font-weight:900;letter-spacing:1.5px;line-height:1;}

  @keyframes mo-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes mo-reveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes mo-pulse{0%,100%{opacity:.35}50%{opacity:.7}}

  .mo3-header{position:sticky;top:0;z-index:50;background:rgba(12,12,10,.96);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.12);}
  .mo3-headwrap{display:flex;align-items:stretch;justify-content:space-between;gap:16px;min-height:60px;}
  .mo3-brand{display:flex;align-items:center;text-decoration:none;min-width:0;}
  .mo3-logo{height:30px;width:auto;display:block;}
  .mo3-nav{display:flex;align-items:center;gap:clamp(12px,2.2vw,28px);flex-wrap:wrap;}
  .mo3-navlink{color:#9A9A9A;text-decoration:none;font-size:var(--mo-fs-nav);font-weight:600;letter-spacing:1.5px;text-transform:uppercase;transition:color .12s;}
  .mo3-navlink:hover{color:#F9D128;}
  .mo3-headercta{align-self:center;padding:11px 20px;white-space:nowrap;}
  .mo3-nav .mo3-navcta{display:none;}
  .mo3-menubtn{display:none;}
  .mo3-menulabel{display:none;}
  .mo3-menuicon{width:18px;height:14px;display:flex;flex-direction:column;justify-content:space-between;}
  .mo3-menuicon span{display:block;height:2px;background:currentColor;transition:transform .16s,opacity .16s;}
  .mo3-btn-yellow{display:inline-flex;align-items:center;gap:10px;background:#F9D128;color:#000000;font-size:var(--mo-fs-button);font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;transition:background .12s;border:0;cursor:pointer;font-family:inherit;}
  .mo3-btn-yellow:hover{background:#FFE159;}
  .mo3-btn-outline{background:#161616;color:#FFFFFF;font-size:var(--mo-fs-button);font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;border:1px solid rgba(255,255,255,.15);transition:all .12s;}
  .mo3-btn-outline:hover{border-color:#F9D128;color:#F9D128;}
  .mo3-btn-yellow:focus-visible,.mo3-btn-outline:focus-visible,.mo3-cardwa:focus-visible,.mo3-footlink:focus-visible,.mo3-footnav:focus-visible,.mo3-chip:focus-visible,.mo3-search:focus-visible,.mo3-navlink:focus-visible,.mo3-menubtn:focus-visible{outline:2px solid #F9D128;outline-offset:3px;}

  .mo3-catalogtools{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:start;margin-bottom:clamp(18px,2.5vw,28px);}
  .mo3-searchwrap{position:relative;}
  .mo3-searchlabel{display:block;color:#F9D128;font-size:var(--mo-fs-eyebrow);font-weight:800;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:8px;}
  .mo3-search{width:100%;min-height:58px;background:#0E0E0E;color:#FFFFFF;border:1px solid rgba(255,255,255,.16);border-radius:0;padding:0 60px 0 16px;font:700 var(--mo-fs-body)/1.2 'Montserrat',system-ui,sans-serif;letter-spacing:.2px;transition:border-color .14s,background .14s;}
  .mo3-search::placeholder{color:#606060;font-weight:600;}
  .mo3-search:focus{border-color:#F9D128;background:#141414;}
  .mo3-searchicon{position:absolute;right:16px;bottom:14px;width:30px;height:30px;color:#F9D128;pointer-events:none;}
  .mo3-searchicon svg{display:block;width:100%;height:100%;stroke:currentColor;stroke-width:2.35;}
  .mo3-chipbar{display:flex;gap:8px;flex-wrap:wrap;align-content:start;}
  .mo3-chip{min-height:46px;border:1px solid rgba(255,255,255,.14);background:#0E0E0E;color:#FFFFFF;display:inline-flex;align-items:center;gap:10px;padding:0 14px;font-family:inherit;font-size:13px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;cursor:pointer;transition:background .14s,color .14s,border-color .14s,transform .14s;}
  .mo3-chip:hover{border-color:#F9D128;color:#F9D128;}
  .mo3-chip.mo3-active{background:#F9D128;color:#000000;border-color:#F9D128;}
  .mo3-chipcount{min-width:24px;height:24px;border:1px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;line-height:1;opacity:.9;}
  .mo3-resultsbar{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);padding:14px 0;margin-bottom:18px;color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:700;letter-spacing:1.4px;text-transform:uppercase;}
  .mo3-productgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(245px,100%),1fr));gap:2px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.12);}
  .mo3-productcard{background:#000000;display:flex;flex-direction:column;min-width:0;transition:transform .14s,background .14s;}
  .mo3-productcard:hover{background:#050505;transform:translateY(-2px);}
  .mo3-cardmedia{position:relative;aspect-ratio:1.08;background:#141414;display:grid;place-items:center;border-bottom:1px solid rgba(255,255,255,.1);overflow:hidden;}
  .mo3-cardmedia img{width:100%;height:100%;object-fit:cover;}
  .mo3-imgfallback{width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#111 0%,#171717 48%,#0b0b0b 100%);color:#606060;text-align:center;padding:22px;}
  .mo3-imgfallback strong{display:block;color:#F9D128;font-size:var(--mo-fs-caption);letter-spacing:1.6px;text-transform:uppercase;margin-bottom:8px;}
  .mo3-cardbody{padding:16px 16px 14px;display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;}
  .mo3-cardbrand{color:#F9D128;font-size:var(--mo-fs-eyebrow);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;}
  .mo3-cardtitle{margin:0;font-size:var(--mo-fs-card-title);font-weight:700;color:#FFFFFF;line-height:1.3;text-wrap:pretty;}
  .mo3-carddesc{margin:4px 0 0;color:#9A9A9A;font-size:var(--mo-fs-caption);line-height:1.45;}
  .mo3-cardprice{font-size:var(--mo-fs-card-price);color:#FFFFFF;letter-spacing:.5px;margin-top:auto;padding-top:10px;}

  .mo3-cardwa{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.1);color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:12px 16px;transition:all .12s;}
  .mo3-cardwa:hover{background:#F9D128;color:#000000;}
  .mo3-emptycatalog{border:1px solid rgba(255,255,255,.14);background:#0E0E0E;padding:clamp(22px,3vw,34px);display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}
  .mo3-pagination{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;border:1px solid rgba(255,255,255,.12);padding:12px;background:#0E0E0E;}
  .mo3-pagebtn{min-height:44px;border:1px solid rgba(255,255,255,.14);background:#000000;color:#FFFFFF;padding:0 16px;font-family:inherit;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:background .14s,color .14s,border-color .14s;}
  .mo3-pagebtn:hover:not(:disabled){border-color:#F9D128;color:#F9D128;}
  .mo3-pagebtn:disabled{cursor:not-allowed;opacity:.4;}
  .mo3-pagebtn:focus-visible{outline:2px solid #F9D128;outline-offset:3px;}
  .mo3-pagecount{color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:1.4px;text-transform:uppercase;text-align:center;}
  @media (max-width:719px){
    .mo3-header{position:static;background:#050505;backdrop-filter:none;}
    .mo3-headwrap{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 10px;min-height:0;padding-top:8px;padding-bottom:8px;}
    .mo3-brand{grid-column:1;grid-row:1;min-height:44px;}
    .mo3-logo{height:30px;}
    .mo3-headercta{display:none;}
    .mo3-menubtn{grid-column:2;grid-row:1;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:0 12px;background:#101010;color:#F9D128;border:1px solid rgba(249,209,40,.7);font-family:inherit;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;}
    .mo3-menulabel{display:inline;}
    .mo3-menu-open .mo3-menuicon span:first-child{transform:translateY(6px) rotate(45deg);}
    .mo3-menu-open .mo3-menuicon span:nth-child(2){opacity:0;}
    .mo3-menu-open .mo3-menuicon span:last-child{transform:translateY(-6px) rotate(-45deg);}
    .mo3-nav{grid-column:1 / -1;grid-row:2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:8px;max-height:0;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;background:#0A0A0A;transform:translateY(-4px);transition:max-height .18s ease,opacity .14s ease,transform .14s ease,padding .14s ease,border-color .14s ease,visibility .18s;}
    .mo3-menu-open .mo3-nav{max-height:240px;opacity:1;visibility:visible;pointer-events:auto;margin-top:2px;padding:8px;border:1px solid rgba(255,255,255,.12);transform:translateY(0);}
    .mo3-navlink{min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid rgba(255,255,255,.12);background:#111111;color:#FFFFFF;letter-spacing:.9px;text-align:center;}
    .mo3-navlink:hover{border-color:#F9D128;background:#161616;}
    .mo3-nav .mo3-navcta{grid-column:1 / -1;display:flex;min-height:44px;justify-content:center;padding:0 14px;margin-top:2px;}
    .mo3-catalogtools{grid-template-columns:1fr;}
    .mo3-chipbar{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:none;}
    .mo3-chipbar::-webkit-scrollbar{display:none;}
    .mo3-chip{white-space:nowrap;}
    .mo3-resultsbar{align-items:flex-start;flex-direction:column;}
    .mo3-productgrid{grid-template-columns:1fr;background:transparent;border:0;gap:8px;}
    .mo3-productcard{display:grid;grid-template-columns:104px minmax(0,1fr);grid-template-rows:auto auto;border:1px solid rgba(255,255,255,.12);}
    .mo3-productcard:hover{transform:none;}
    .mo3-cardmedia{grid-row:1 / span 2;aspect-ratio:auto;height:100%;min-height:132px;border-right:1px solid rgba(255,255,255,.1);border-bottom:0;}
    .mo3-imgfallback{padding:10px;font-size:var(--mo-fs-micro);line-height:1.3;}
    .mo3-imgfallback span{font-size:0;}
    .mo3-imgfallback strong{font-size:var(--mo-fs-micro);margin-bottom:5px;}
    .mo3-cardbody{padding:11px 12px 8px;gap:4px;}
    .mo3-cardbrand{font-size:var(--mo-fs-micro);letter-spacing:1.2px;}
    .mo3-cardtitle{line-height:1.25;}
    .mo3-carddesc{display:none;}
    .mo3-cardprice{padding-top:4px;}
    .mo3-cardwa{grid-column:2;font-size:var(--mo-fs-micro);letter-spacing:1.1px;padding:9px 12px;min-height:38px;}
  }
  @media (min-width:720px){
    .mo3{--mo-fs-nav:12px;--mo-fs-body:16px;--mo-fs-body-lg:17px;--mo-fs-card-title:16px;--mo-fs-card-price:20px;--mo-fs-button:13px;--mo-fs-h2:40px;--mo-fs-h3:30px;--mo-fs-section:46px;--mo-fs-hero:72px;}
  }
  @media (min-width:1180px){
    .mo3{--mo-fs-hero:84px;}
  }
  @media (prefers-reduced-motion:reduce){
    .mo3 *{animation:none!important;transition:none!important;scroll-behavior:auto!important;}
  }

  .mo3-footlink{color:#FFFFFF;text-decoration:none;font-size:var(--mo-fs-body);font-weight:600;transition:color .12s;}
  .mo3-footlink:hover{color:#F9D128;}
  .mo3-footnav{color:#9A9A9A;text-decoration:none;font-size:var(--mo-fs-small);font-weight:600;transition:color .12s;}
  .mo3-footnav:hover{color:#F9D128;}
  .mo3-sachets-link{font-weight:700;font-size:var(--mo-fs-caption);letter-spacing:1px;text-transform:uppercase;text-decoration:none;color:#000000;border-bottom:2px solid #000000;padding-bottom:2px;white-space:nowrap;transition:opacity .12s;}
  .mo3-sachets-link:hover{opacity:.7;}
  .mo3-blackbtn{display:inline-flex;align-items:center;gap:10px;background:#000000;color:#F9D128;font-weight:700;font-size:var(--mo-fs-button);letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:16px 28px;transition:color .12s;}
  .mo3-blackbtn:hover{color:#FFE159;}
  .mo3-shakeboard{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:2px;background:#000000;border:2px solid #000000;margin-bottom:clamp(20px,3vw,28px);}
  .mo3-shakehero{position:relative;background:#F9D128;color:#000000;padding:clamp(20px,3.2vw,34px);display:grid;grid-template-rows:auto auto auto;align-content:space-between;gap:clamp(18px,2.5vw,28px);min-height:100%;overflow:hidden;}
  .mo3-shakeintro{position:relative;z-index:1;display:grid;gap:14px;}
  .mo3-shakekicker{display:inline-flex;align-items:center;width:max-content;background:#000000;color:#F9D128;padding:8px 12px;font-size:clamp(14px,1.2vw,17px);font-weight:900;letter-spacing:2px;text-transform:uppercase;}
  .mo3-proteintitle{font-size:clamp(32px,4.7vw,64px);line-height:.93;text-transform:uppercase;letter-spacing:.3px;}
  .mo3-proteintitle span{display:block;font-size:clamp(44px,6vw,78px);}
  .mo3-shakecopy{margin:0;font-size:var(--mo-fs-body);font-weight:800;line-height:1.45;max-width:48ch;}
  .mo3-shakesteps{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;background:#000000;border:2px solid #000000;}
  .mo3-shakestep{background:#F9D128;padding:10px 12px;display:grid;gap:3px;min-height:58px;}
  .mo3-shakestep b{font-size:11px;font-weight:900;letter-spacing:1.2px;opacity:.62;}
  .mo3-shakestep span{font-size:clamp(12px,1vw,14px);font-weight:900;letter-spacing:.7px;text-transform:uppercase;line-height:1.08;}
  .mo3-shakebasegrid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;background:#000000;border:2px solid #000000;}
  .mo3-shakebase{position:relative;background:#F9D128;padding:clamp(18px,2.5vw,26px);display:flex;flex-direction:column;justify-content:space-between;gap:14px;min-height:138px;overflow:hidden;}
  .mo3-shakebase::after{content:'';position:absolute;right:18px;top:18px;width:36px;height:36px;border-top:7px solid #000000;border-right:7px solid #000000;opacity:.88;}
  .mo3-basekicker{font-size:12px;font-weight:900;letter-spacing:1.8px;text-transform:uppercase;opacity:.65;}
  .mo3-basename{font-size:clamp(18px,2vw,24px);font-weight:900;letter-spacing:1.4px;text-transform:uppercase;line-height:1;}
  .mo3-shakemenu{background:#050505;color:#FFFFFF;padding:clamp(20px,3vw,34px);display:grid;gap:clamp(18px,2.6vw,28px);}
  .mo3-menusection{display:grid;gap:10px;}
  .mo3-menutitle{display:flex;align-items:center;gap:12px;color:#F9D128;font-size:clamp(13px,1.1vw,16px);font-weight:900;letter-spacing:2px;text-transform:uppercase;}
  .mo3-menutitle::after{content:'';height:2px;background:#F9D128;flex:1;opacity:.75;}
  .mo3-menuitems{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px;margin:0;padding:0;list-style:none;}
  .mo3-menuitems li{display:flex;align-items:baseline;gap:8px;color:#FFFFFF;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:.3px;text-transform:uppercase;line-height:1.25;}
  .mo3-menuitems li::before{content:'';width:5px;height:5px;border-radius:999px;background:#F9D128;flex:0 0 auto;transform:translateY(-1px);}
  .mo3-pricepill{display:inline-flex;align-items:center;justify-content:center;min-height:34px;background:#000000;color:#F9D128;border:2px solid #000000;padding:0 14px;font-size:var(--mo-fs-body);font-weight:900;}
  .mo3-pricerow{display:flex;align-items:baseline;gap:10px;color:#FFFFFF;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:.4px;text-transform:uppercase;}
  .mo3-pricerow span:first-child{white-space:nowrap;}
  .mo3-pricerow i{height:2px;min-width:20px;background:radial-gradient(circle,currentColor 1px,transparent 1.5px) repeat-x center/8px 2px;flex:1;opacity:.7;}
  .mo3-menurow{display:flex;align-items:baseline;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08);}
  .mo3-menurow:last-child{border-bottom:0;padding-bottom:2px;}
  .mo3-menurow-label{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;color:#FFFFFF;font-size:var(--mo-fs-caption);font-weight:800;letter-spacing:.4px;text-transform:uppercase;}
  .mo3-menurow-dots{flex:1;height:2px;min-width:16px;background:radial-gradient(circle,rgba(255,255,255,.5) 1px,transparent 1.5px) repeat-x center/8px 2px;}
  .mo3-menurow-price{color:#F9D128;font-size:var(--mo-fs-card-title);white-space:nowrap;}
  .mo3-proteinbadge{background:#F9D128;color:#000000;font-size:10px;font-weight:800;letter-spacing:1px;padding:3px 7px;line-height:1;white-space:nowrap;flex-shrink:0;}
  .mo3-cafeboard{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:2px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.12);margin-bottom:clamp(24px,3.5vw,34px);}
  .mo3-cafehero{background:#F9D128;color:#000000;padding:clamp(22px,3vw,34px);display:flex;flex-direction:column;justify-content:space-between;gap:clamp(24px,3vw,40px);min-height:100%;}
  .mo3-cafehero strong{font-size:clamp(34px,4.6vw,62px);line-height:.95;text-transform:uppercase;}
  .mo3-cafehero p{margin:0;font-size:var(--mo-fs-body);font-weight:800;line-height:1.45;max-width:42ch;}
  .mo3-cafefacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:2px solid #000000;background:#000000;gap:2px;}
  .mo3-cafefact{background:#F9D128;padding:14px 16px;display:grid;gap:4px;min-height:82px;}
  .mo3-cafefact b{font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;opacity:.62;}
  .mo3-cafefact span{font-size:clamp(14px,1.4vw,18px);font-weight:900;text-transform:uppercase;line-height:1.1;}
  .mo3-cafemenu{background:#000000;padding:clamp(20px,3vw,34px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(22px,3vw,36px);}
  .mo3-combogrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2px;background:#000000;border:2px solid #000000;}
  .mo3-combocard{background:#F9D128;color:#000000;padding:clamp(18px,2.4vw,26px);display:grid;gap:12px;min-height:132px;position:relative;overflow:hidden;}
  .mo3-combocard::after{content:'';position:absolute;right:16px;top:16px;width:30px;height:30px;border-top:6px solid #000000;border-right:6px solid #000000;opacity:.85;}
  .mo3-combocard span{font-size:12px;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;opacity:.64;}
  .mo3-combocard strong{font-size:clamp(15px,1.5vw,19px);font-weight:900;text-transform:uppercase;line-height:1.2;max-width:20ch;}
  .mo3-combocard b{font-size:var(--mo-fs-h3);line-height:1;}
  @media (max-width:819px){
    .mo3-shakeboard{grid-template-columns:1fr;}
    .mo3-menuitems{grid-template-columns:1fr;}
    .mo3-cafeboard,.mo3-cafemenu{grid-template-columns:1fr;}
    .mo3-cafefacts{grid-template-columns:1fr;}
    .mo3-shakebasegrid{grid-template-columns:1fr;}
    .mo3-shakesteps{grid-template-columns:1fr;}
    .mo3-shakestep{min-height:48px;grid-template-columns:34px 1fr;align-items:center;padding:8px 12px;}
    .mo3-shakestep b{font-size:12px;}
    .mo3-shakebase{min-height:132px;}
  }
</style>

<div class="mo3">

  <!-- ══ HEADER ══ -->
  <header class="mo3-header" [class.mo3-menu-open]="mobileMenuOpen()">
    <div class="mo3-wrap mo3-headwrap">
      <a href="#inicio" class="mo3-brand">
        <img src="assets/catalog/moveon-logo-brand.png" alt="Move On Nutrition" class="mo3-logo">
      </a>
      <nav id="catalog-mobile-menu" class="mo3-nav" aria-label="Secciones del catálogo">
        <a href="#catalogo" class="mo3-navlink" (click)="closeMobileMenu()">Catálogo</a>
        <a href="#batidos" class="mo3-navlink" (click)="closeMobileMenu()">Batidos</a>
        <a href="#cafe" class="mo3-navlink" (click)="closeMobileMenu()">Café</a>
        <a href="#ubicacion" class="mo3-navlink" (click)="closeMobileMenu()">Ubicación</a>
        <a href="#contacto" class="mo3-navlink" (click)="closeMobileMenu()">Contacto</a>
        <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-btn-yellow mo3-navcta" (click)="closeMobileMenu()">
          Comprar por WhatsApp
        </a>
      </nav>
      <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-btn-yellow mo3-headercta">
        Comprar por WhatsApp
      </a>
      <button
        type="button"
        class="mo3-menubtn"
        aria-controls="catalog-mobile-menu"
        [attr.aria-expanded]="mobileMenuOpen()"
        [attr.aria-label]="mobileMenuOpen() ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'"
        (click)="toggleMobileMenu()"
      >
        <span class="mo3-menulabel">Menú</span>
        <span class="mo3-menuicon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
    </div>
  </header>

  <!-- ══ HERO ══ -->
  <section id="inicio">
    <div class="mo3-wrap" style="padding-top:clamp(56px,9vw,110px);padding-bottom:clamp(40px,6vw,72px);">
      <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:clamp(20px,3vw,32px);font-size:var(--mo-fs-caption);font-weight:600;letter-spacing:2px;text-transform:uppercase;">
        <span style="color:#F9D128;">Tienda de suplementos deportivos</span>
        <span style="color:#606060;">/</span>
        <span style="color:#9A9A9A;">Viva Fontibón — Bogotá</span>
      </div>
      <h1 class="mo3-display" style="margin:0;font-size:var(--mo-fs-hero);line-height:1.02;text-transform:uppercase;letter-spacing:.5px;max-width:15ch;">
        Más energía. Más fuerza.
        <span style="color:#F9D128;"> Más resultados.</span>
      </h1>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:clamp(24px,4vw,56px);align-items:end;margin-top:clamp(28px,4vw,48px);">
        <p style="margin:0;color:#9A9A9A;font-size:var(--mo-fs-body-lg);line-height:1.65;max-width:52ch;text-wrap:pretty;">
          Proteínas, creatinas, pre entrenos, aminoácidos y batidos preparados al momento. Mira el catálogo y escríbenos por WhatsApp para comprar o preguntar disponibilidad.
        </p>
        <div style="display:flex;gap:2px;flex-wrap:wrap;justify-self:start;">
          <a href="#catalogo" class="mo3-btn-yellow" style="padding:16px 28px;">Ver catálogo ↓</a>
          <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-btn-outline" style="padding:16px 28px;">WhatsApp →</a>
        </div>
      </div>
    </div>
    <!-- ticker -->
    <div style="background:#F9D128;overflow:hidden;border-top:1px solid #000000;">
      <div style="display:flex;width:max-content;animation:mo-marquee 26s linear infinite;">
        <div style="display:flex;gap:0;padding:10px 0;white-space:nowrap;">
          <span class="mo3-display" style="color:#000000;font-size:var(--mo-fs-body);text-transform:uppercase;letter-spacing:2px;padding:0 22px;">Proteínas ✦ Creatinas ✦ Pre entrenos ✦ Aminoácidos ✦ Quemadores ✦ Vitaminas ✦ Batidos preparados ✦ Sachets ✦ Bebidas ✦</span>
          <span class="mo3-display" style="color:#000000;font-size:var(--mo-fs-body);text-transform:uppercase;letter-spacing:2px;padding:0 22px;">Proteínas ✦ Creatinas ✦ Pre entrenos ✦ Aminoácidos ✦ Quemadores ✦ Vitaminas ✦ Batidos preparados ✦ Sachets ✦ Bebidas ✦</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CATÁLOGO ══ -->
  <section id="catalogo" style="border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:clamp(24px,3vw,40px);">
        <div style="display:flex;align-items:baseline;gap:16px;">
          <span class="mo3-sectionindex" style="color:#F9D128;">01</span>
          <h2 class="mo3-display" style="margin:0;font-size:var(--mo-fs-h2);text-transform:uppercase;letter-spacing:.5px;">¿Qué estás buscando?</h2>
        </div>
        <span style="color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Busca o filtra por categoría</span>
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
          <span style="color:#9A9A9A;font-size:var(--mo-fs-body);line-height:1.5;max-width:52ch;">No pudimos cargar el catálogo en este momento. Escríbenos por WhatsApp y te contamos qué hay disponible hoy.</span>
          <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-btn-yellow" style="padding:13px 22px;white-space:nowrap;">Preguntar por WhatsApp →</a>
        </div>
      }

      <!-- buscador + filtros -->
      @if (!loading() && !loadError()) {
        <div class="mo3-catalogtools">
          <div class="mo3-searchwrap">
            <label class="mo3-searchlabel" for="catalog-search">Buscar en el catálogo</label>
            <input
              id="catalog-search"
              class="mo3-search"
              type="search"
              inputmode="search"
              autocomplete="off"
              [value]="search()"
              (input)="onSearch($event)"
              placeholder="Ej: creatina, whey, sachet, energía"
            >
            <span class="mo3-searchicon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="10.8" cy="10.8" r="6.8"></circle>
                <path d="m16 16 5 5"></path>
              </svg>
            </span>
          </div>
          <div class="mo3-chipbar" aria-label="Filtrar por categoría">
            <button
              type="button"
              class="mo3-chip"
              [class.mo3-active]="selectedCategory() === 'all'"
              [attr.aria-pressed]="selectedCategory() === 'all'"
              (click)="selectCategory('all')"
            >
              Todos <span class="mo3-chipcount">{{ totalProductos() }}</span>
            </button>
            @for (cat of categoryChips(); track cat.id) {
              <button
                type="button"
                class="mo3-chip"
                [class.mo3-active]="selectedCategory() === cat.id"
                [attr.aria-pressed]="selectedCategory() === cat.id"
                (click)="selectCategory(cat.id)"
              >
                {{ cat.nombre }} <span class="mo3-chipcount">{{ cat.conteoTexto }}</span>
              </button>
            }
          </div>
        </div>

        <div class="mo3-resultsbar" aria-live="polite">
          <span>{{ resultsLabel() }}</span>
          @if (search() || selectedCategory() !== 'all') {
            <button type="button" class="mo3-chip" (click)="clearFilters()">Limpiar filtros</button>
          }
        </div>

        @if (productosPaginados().length > 0) {
          <div class="mo3-productgrid">
            @for (p of productosPaginados(); track p.id) {
              <article class="mo3-productcard">
                <div class="mo3-cardmedia">
                  @if (p.imageUrl) {
                    <img [src]="p.imageUrl" [alt]="p.nombre" loading="lazy">
                  } @else {
                    <span class="mo3-imgfallback">
                      <span>
                        <strong>Move On</strong>
                        {{ p.nombre }}
                      </span>
                    </span>
                  }
                  @if (p.etiqueta) {
                    <span [style.background]="badgeBg(p.etiqueta)" [style.color]="badgeFg(p.etiqueta)" style="position:absolute;top:0;left:0;font-size:var(--mo-fs-micro);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 12px;">{{ p.etiqueta }}</span>
                  }
                </div>
                <div class="mo3-cardbody">
                  <span class="mo3-cardbrand">{{ marcaDe(p) }}</span>
                  <h3 class="mo3-cardtitle">{{ p.nombre }}</h3>
                  @if (p.paraQueSirve) {
                    <p class="mo3-carddesc">{{ shortText(p.paraQueSirve) }}</p>
                  }
                  <span class="mo3-display mo3-cardprice">{{ formatPrice(p.precioVenta) }}</span>
                </div>
                <a [href]="waProducto(p)" target="_blank" rel="noopener" class="mo3-cardwa">
                  <span>Preguntar por WhatsApp</span><span>→</span>
                </a>
              </article>
            }
          </div>
          @if (showPagination()) {
            <nav class="mo3-pagination" aria-label="Paginación del catálogo">
              <button type="button" class="mo3-pagebtn" [disabled]="currentPage() === 1" (click)="prevPage()">
                ← Anterior
              </button>
              <span class="mo3-pagecount">
                Página {{ currentPage() }} de {{ totalPages() }}
              </span>
              <button type="button" class="mo3-pagebtn" [disabled]="currentPage() === totalPages()" (click)="nextPage()">
                Siguiente →
              </button>
            </nav>
          }
        } @else {
          <div class="mo3-emptycatalog">
            <span style="color:#9A9A9A;font-size:var(--mo-fs-body);line-height:1.5;max-width:54ch;">
              No encontramos productos con ese filtro. Escríbenos y te confirmamos disponibilidad o alternativas similares.
            </span>
            <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-btn-yellow" style="padding:13px 22px;white-space:nowrap;">Preguntar por WhatsApp →</a>
          </div>
        }
      }
    </div>
  </section>

  <!-- ══ BATIDOS ══ -->
  <section id="batidos" style="background:#F9D128;color:#000000;">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:10px;">
          <span class="mo3-sectionindex" style="opacity:.65;">02</span>
        <h2 class="mo3-display" style="margin:0;font-size:var(--mo-fs-section);text-transform:uppercase;letter-spacing:.5px;">Batidos preparados en tienda</h2>
      </div>
      <p style="margin:0 0 clamp(24px,3vw,40px) calc(14px + 2em);font-size:var(--mo-fs-body);font-weight:500;line-height:1.6;max-width:56ch;text-wrap:pretty;">
        Ideal para después de entrenar o como opción rápida de proteína durante el día. Los preparamos al momento en nuestra sede de Viva Fontibón.
      </p>
      <div class="mo3-shakeboard">
        <div class="mo3-shakehero">
          <div class="mo3-shakeintro">
            <span class="mo3-shakekicker">Menú de proteína</span>
            <strong class="mo3-display mo3-proteintitle">Batido de <span>proteína</span></strong>
            <p class="mo3-shakecopy">Arma tu batido con base, fruta o café y toppings. Lo preparamos al momento en la barra.</p>
          </div>
          <div class="mo3-shakesteps" aria-label="Pasos para armar el batido">
            <div class="mo3-shakestep">
              <b>01</b>
              <span>Elige base</span>
            </div>
            <div class="mo3-shakestep">
              <b>02</b>
              <span>Agrega sabor</span>
            </div>
            <div class="mo3-shakestep">
              <b>03</b>
              <span>Termina con toppings</span>
            </div>
          </div>
          <div class="mo3-shakebasegrid">
            @for (base of batidoBases; track base.nombre) {
              <div class="mo3-shakebase">
                <span class="mo3-basekicker">{{ base.codigo }}</span>
                <span class="mo3-basename">{{ base.nombre }}</span>
                <span class="mo3-display" style="font-size:var(--mo-fs-h3);">{{ base.precio }}</span>
              </div>
            }
          </div>
        </div>
        <div class="mo3-shakemenu">
          <div class="mo3-menusection">
            <span class="mo3-menutitle">Adicionales</span>
            <ul class="mo3-menuitems">
              @for (item of batidoAdicionales; track item) {
                <li>{{ item }}</li>
              }
            </ul>
            <span class="mo3-pricepill">Cada ingrediente +$2.000</span>
          </div>
          <div class="mo3-menusection">
            <span class="mo3-menutitle">Complementa con toppings</span>
            @for (item of batidoToppings; track item.nombre) {
              <div class="mo3-pricerow">
                <span>{{ item.nombre }}</span><i aria-hidden="true"></i><strong>{{ item.precio }}</strong>
              </div>
            }
          </div>
          <div class="mo3-menusection">
            <span class="mo3-menutitle">Toppings premium</span>
            @for (item of batidoPremium; track item.nombre) {
              <div class="mo3-pricerow">
                <span>{{ item.nombre }}</span><i aria-hidden="true"></i><strong>{{ item.precio }}</strong>
              </div>
            }
          </div>
        </div>
      </div>
      <div style="border:2px solid #000000;padding:clamp(18px,2.5vw,26px) clamp(20px,3vw,32px);margin-bottom:clamp(20px,3vw,28px);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:var(--mo-fs-eyebrow);font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:.6;">También en tienda</span>
          <span style="font-size:var(--mo-fs-body);font-weight:600;line-height:1.5;max-width:58ch;text-wrap:pretty;">Sachets individuales de proteína, creatina y pre entreno, y bebidas listas para tomar. Perfectos para probar antes de llevar el tarro completo.</span>
        </div>
        <a href="#catalogo" class="mo3-sachets-link">Ver sachets →</a>
      </div>
      <a [href]="waBatidos()" target="_blank" rel="noopener" class="mo3-blackbtn">Pedir por WhatsApp →</a>
    </div>
  </section>

  <!-- ══ CAFÉ Y SNACKS ══ -->
  <section id="cafe" style="border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:10px;">
        <span class="mo3-sectionindex" style="color:#F9D128;">03</span>
        <h2 class="mo3-display" style="margin:0;font-size:var(--mo-fs-section);text-transform:uppercase;letter-spacing:.5px;">Café y snacks proteicos</h2>
      </div>
      <p style="margin:0 0 clamp(24px,3vw,40px) calc(14px + 2em);color:#9A9A9A;font-size:var(--mo-fs-body);font-weight:500;line-height:1.6;max-width:56ch;text-wrap:pretty;">
        Grano de la Sierra Nevada de Santa Marta, preparado en máquina automática. El complemento perfecto para tu snack proteico antes o después de entrenar.
      </p>

      <div class="mo3-cafeboard">
        <div class="mo3-cafehero">
          <div style="display:grid;gap:14px;">
            <span class="mo3-shakekicker">Barra de café</span>
            <strong class="mo3-display">Café + snack</strong>
            <p>Una pausa rápida con café caliente y opciones proteicas para antes o después de entrenar.</p>
          </div>
          <div class="mo3-cafefacts" aria-label="Datos del café en tienda">
            <div class="mo3-cafefact">
              <b>Origen</b>
              <span>Sierra Nevada</span>
            </div>
            <div class="mo3-cafefact">
              <b>Servicio</b>
              <span>Listo en tienda</span>
            </div>
          </div>
        </div>

        <div class="mo3-cafemenu">
          <div class="mo3-menusection">
            <span class="mo3-menutitle">Café</span>
            @for (item of cafeItems; track item.nombre) {
              <div class="mo3-menurow">
                <span class="mo3-menurow-label">{{ item.nombre }}</span>
                <i class="mo3-menurow-dots" aria-hidden="true"></i>
                <strong class="mo3-display mo3-menurow-price">{{ item.precio }}</strong>
              </div>
            }
          </div>
          <div class="mo3-menusection">
            <span class="mo3-menutitle">Snacks proteicos</span>
            @for (item of snackItems; track item.nombre) {
              <div class="mo3-menurow">
                <span class="mo3-menurow-label">
                  {{ item.nombre }}
                  @if (item.badge) {
                    <span class="mo3-proteinbadge">{{ item.badge }}</span>
                  }
                </span>
                <i class="mo3-menurow-dots" aria-hidden="true"></i>
                <strong class="mo3-display mo3-menurow-price">{{ item.precio }}</strong>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="mo3-menusection">
        <span class="mo3-menutitle">Combos</span>
        <div class="mo3-combogrid">
          @for (combo of combos; track combo.nombre) {
            <div class="mo3-combocard">
              <span>Combo</span>
              <strong>{{ combo.nombre }}</strong>
              <b class="mo3-display">{{ combo.precio }}</b>
            </div>
          }
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CONFIANZA ══ -->
  <section style="border-bottom:1px solid rgba(255,255,255,.12);">
    <div class="mo3-wrap" style="padding-top:clamp(48px,7vw,88px);padding-bottom:clamp(48px,7vw,88px);">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(24px,3vw,40px);">
        @for (item of confianza; track item.titulo) {
          <div style="display:flex;flex-direction:column;gap:10px;border-top:2px solid #F9D128;padding-top:16px;">
            <span class="mo3-display" style="font-size:var(--mo-fs-body-lg);text-transform:uppercase;letter-spacing:.5px;">{{ item.titulo }}</span>
            <span style="color:#9A9A9A;font-size:var(--mo-fs-small);line-height:1.6;">{{ item.texto }}</span>
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
          <span class="mo3-sectionindex" style="color:#F9D128;">04</span>
          <h2 class="mo3-display" style="margin:0;font-size:var(--mo-fs-section);text-transform:uppercase;line-height:1.05;">Encuéntranos en <span style="color:#F9D128;">Viva Fontibón</span></h2>
        </div>
        <p style="margin:0;color:#9A9A9A;font-size:var(--mo-fs-body);line-height:1.65;max-width:48ch;">Diagonal al Éxito y Smart Fit. Pasa por tu batido después de entrenar o recoge tu pedido en tienda.</p>
        <div style="border:1px solid rgba(255,255,255,.15);">
          <div style="display:flex;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.12);">
            <span style="color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Lunes a viernes</span>
            <span style="color:#FFFFFF;font-size:var(--mo-fs-small);font-weight:600;">{{ horarioSemana }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;padding:14px 18px;">
            <span style="color:#9A9A9A;font-size:var(--mo-fs-caption);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Sábados y domingos</span>
            <span style="color:#FFFFFF;font-size:var(--mo-fs-small);font-weight:600;">{{ horarioFestivos }}</span>
          </div>
        </div>
        <a [href]="mapsUrl" target="_blank" rel="noopener" class="mo3-btn-yellow" style="align-self:flex-start;padding:15px 26px;">Cómo llegar →</a>
      </div>
      <div style="min-height:340px;align-self:stretch;border:1px solid rgba(255,255,255,.15);background:#0E0E0E;overflow:hidden;">
        <iframe
          title="Ubicación de Move On Nutrition en Google Maps"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d63629.68238329992!2d-74.23709279578088!3d4.619918978575545!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f9d0486464481%3A0x9777f316ebd1e25!2sMove%20On%20Nutrition!5e0!3m2!1ses-419!2sco!4v1783659763653!5m2!1ses-419!2sco"
          width="600"
          height="450"
          style="border:0;width:100%;height:100%;min-height:340px;display:block;"
          allowfullscreen
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
    </div>
  </section>

  <!-- ══ FOOTER ══ -->
  <footer id="contacto" style="border-top:1px solid rgba(255,255,255,.12);overflow:hidden;">
    <div class="mo3-wrap" style="padding-top:clamp(40px,6vw,72px);">
      <div style="display:flex;flex-wrap:wrap;gap:clamp(28px,4vw,64px);justify-content:space-between;margin-bottom:clamp(36px,5vw,64px);">
        <div style="display:flex;flex-direction:column;gap:12px;max-width:36ch;">
          <span style="color:#F9D128;font-size:var(--mo-fs-eyebrow);font-weight:700;letter-spacing:2px;text-transform:uppercase;">Contacto directo</span>
          <a [href]="waGeneral()" target="_blank" rel="noopener" class="mo3-footlink">WhatsApp · {{ whatsappDisplay() }}</a>
          <a [href]="igLink()" target="_blank" rel="noopener" class="mo3-footlink">Instagram · &#64;{{ instagram() }}</a>
          <span style="color:#9A9A9A;font-size:var(--mo-fs-small);line-height:1.5;">Viva Fontibón, Bogotá · Diagonal al Éxito y Smart Fit</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <span style="color:#F9D128;font-size:var(--mo-fs-eyebrow);font-weight:700;letter-spacing:2px;text-transform:uppercase;">Secciones</span>
          <a href="#catalogo" class="mo3-footnav">Catálogo</a>
          <a href="#batidos" class="mo3-footnav">Batidos</a>
          <a href="#cafe" class="mo3-footnav">Café</a>
          <a href="#ubicacion" class="mo3-footnav">Ubicación</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;justify-content:flex-end;">
          <span style="color:#606060;font-size:var(--mo-fs-caption);">Catálogo sujeto a disponibilidad.</span>
          <span style="color:#606060;font-size:var(--mo-fs-caption);">Move On © {{ currentYear }} · Bogotá, Colombia</span>
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
  private readonly contactSettings = signal<CatalogoContactSettings>(DEFAULT_CONTACT_SETTINGS)
  readonly search = signal('')
  readonly selectedCategory = signal<'all' | string>('all')
  readonly currentPage = signal(1)
  readonly mobileMenuOpen = signal(false)

  readonly visibleCategories = computed(() =>
    this.categorias().filter((cat) => !HIDDEN_CATEGORIES.includes(cat.nombre)),
  )

  readonly categoryChips = computed<CategoryChip[]>(() =>
    this.visibleCategories()
      .filter((cat) => cat.productos.length > 0)
      .map((cat) => ({
        id: cat.id,
        nombre: cat.nombre,
        conteoTexto: String(cat.productos.length),
      })),
  )

  readonly allProducts = computed(() =>
    this.visibleCategories().flatMap((cat) => cat.productos),
  )

  readonly totalProductos = computed(() => this.allProducts().length)

  readonly productosFiltrados = computed(() => {
    const selected = this.selectedCategory()
    const query = this.normalize(this.search())
    return this.allProducts().filter((p) => {
      if (selected !== 'all' && p.categoriaId !== selected) return false
      if (!query) return true
      const haystack = this.normalize(
        [p.nombre, p.marca, p.categoriaNombre, p.etiqueta, p.paraQueSirve].filter(Boolean).join(' '),
      )
      return haystack.includes(query)
    })
  })

  readonly showPagination = computed(() => this.productosFiltrados().length > PRODUCTS_PAGE_SIZE)

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.productosFiltrados().length / PRODUCTS_PAGE_SIZE)),
  )

  readonly productosPaginados = computed(() => {
    const products = this.productosFiltrados()
    if (!this.showPagination()) return products
    const page = Math.min(this.currentPage(), this.totalPages())
    const start = (page - 1) * PRODUCTS_PAGE_SIZE
    return products.slice(start, start + PRODUCTS_PAGE_SIZE)
  })

  readonly resultsLabel = computed(() => {
    const count = this.productosFiltrados().length
    const label = count === 1 ? '1 producto disponible' : `${count} productos disponibles`
    if (this.showPagination()) {
      const start = (this.currentPage() - 1) * PRODUCTS_PAGE_SIZE + 1
      const end = Math.min(this.currentPage() * PRODUCTS_PAGE_SIZE, count)
      return `${label} · mostrando ${start}-${end}`
    }
    if (this.selectedCategory() === 'all' && !this.search()) return label
    return `${label} para tu búsqueda`
  })

  readonly waGeneral = computed(() => this.wa('Hola Move On 👋 Vi el catálogo y quiero más información.'))
  readonly waBatidos = computed(() => this.wa('Hola Move On 👋 Quiero pedir un batido de proteína.'))
  readonly instagram = computed(() => this.contactSettings().instagramHandle)
  readonly igLink = computed(() => this.contactSettings().instagramUrl)
  readonly horarioSemana = HORARIO_SEMANA
  readonly horarioFestivos = HORARIO_FESTIVOS
  readonly mapsUrl = MAPS_URL
  readonly currentYear = new Date().getFullYear()
  readonly whatsappDisplay = computed(() => this.contactSettings().whatsappDisplay)

  readonly confianza = [
    { titulo: 'Asesoría personalizada', texto: 'Te ayudamos a elegir según tu entrenamiento y tu objetivo. Sin enredos.' },
    { titulo: 'Productos originales', texto: 'Solo marcas reconocidas y producto sellado. Lo que ves es lo que llevas.' },
    { titulo: 'Variedad de marcas', texto: 'Opciones para todos los presupuestos sin sacrificar calidad.' },
    { titulo: 'Para tu objetivo', texto: 'Ganar masa, definición, energía o recuperación: hay opción para ti.' },
  ]

  readonly batidoBases = [
    { codigo: 'Base 01', nombre: 'En agua', precio: '$11.000' },
    { codigo: 'Base 02', nombre: 'En leche', precio: '$13.000' },
  ]

  readonly batidoAdicionales = [
    'Fresa 80gr',
    'Banano 80gr',
    'Mora 80gr',
    'Caramelo',
    'Piña 110gr',
    'Mango 150gr',
    'Café 7gr',
    'Arequipe 50gr',
    'Milo 30gr',
    'Mantequilla de maní 30gr',
  ]

  readonly batidoToppings = [
    { nombre: 'Salsa de chocolate', precio: '$1.500' },
    { nombre: 'Salsa de fresa', precio: '$1.500' },
    { nombre: 'Salsa de maní', precio: '$1.500' },
    { nombre: 'Granola', precio: '$1.500' },
    { nombre: 'Chips de chocolate', precio: '$1.500' },
  ]

  readonly batidoPremium = [
    { nombre: 'Arándanos', precio: '$3.500' },
    { nombre: 'Yogurt griego', precio: '$2.000' },
    { nombre: 'Leche de almendras', precio: '$2.000' },
    { nombre: 'Bordeado de temporada', precio: 'Consultar' },
  ]

  readonly cafeItems = [
    { nombre: 'Espresso · 7oz', precio: '$4.000' },
    { nombre: 'Leche caliente · 9oz', precio: '$4.000' },
    { nombre: 'Americano · 9oz', precio: '$4.000' },
    { nombre: 'Latte · 9oz', precio: '$6.000' },
    { nombre: 'Capuchino · 9oz', precio: '$6.000' },
  ]

  readonly snackItems = [
    { nombre: 'Galleta Oreo', badge: '21G PROTEÍNA', precio: '$12.000' },
    { nombre: 'Galleta Nutella', badge: '21G PROTEÍNA', precio: '$12.000' },
    { nombre: 'Galleta Hangry Boy', badge: '15G PROTEÍNA', precio: '$15.000' },
    { nombre: 'Barra Fitbar', badge: '25G PROTEÍNA', precio: '$15.000' },
    { nombre: 'Cereal Nutrapops', badge: null, precio: '$7.000' },
  ]

  readonly combos = [
    { nombre: 'Galleta Oreo/Nutella + Americano', precio: '$15.000' },
    { nombre: 'Galleta Oreo/Nutella + Capuchino', precio: '$16.000' },
    { nombre: 'Vaso Cereal Nutrapops + Leche', precio: '$10.000' },
  ]

  async ngOnInit(): Promise<void> {
    try {
      const [categorias, contactSettings] = await Promise.all([
        this.catalogoService.getCatalogo(),
        this.catalogoService.getContactSettings().catch(() => null),
      ])
      this.categorias.set(categorias)
      if (contactSettings) this.contactSettings.set(contactSettings)
    } catch {
      this.loadError.set(true)
    } finally {
      this.loading.set(false)
    }
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value)
    this.currentPage.set(1)
  }

  selectCategory(catId: 'all' | string): void {
    this.selectedCategory.set(catId)
    this.currentPage.set(1)
  }

  clearFilters(): void {
    this.search.set('')
    this.selectedCategory.set('all')
    this.currentPage.set(1)
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open)
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false)
  }

  prevPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1))
    this.scrollCatalogIntoView()
  }

  nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1))
    this.scrollCatalogIntoView()
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

  shortText(value: string): string {
    const clean = value.trim()
    return clean.length > 92 ? `${clean.slice(0, 89).trim()}...` : clean
  }

  private wa(msg: string): string {
    return `https://wa.me/${this.contactSettings().whatsappNumber}?text=${encodeURIComponent(msg)}`
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  private scrollCatalogIntoView(): void {
    setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ block: 'start' }))
  }
}
