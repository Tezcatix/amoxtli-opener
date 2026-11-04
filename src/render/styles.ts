const STYLE_ID = 'amoxtli-opener-styles';

export const CSS = `
.ao-root{--ao-bg:rgba(10,10,20,.92);--ao-fg:#fff;--ao-accent:#d9a441;--ao-card-w:min(62vw,max(240px,27vh),320px);--ao-radius:12px;
position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:420px;
background:var(--ao-bg);color:var(--ao-fg);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;font-family:var(--ao-font,system-ui,sans-serif)}
.ao-root::before{content:"";position:absolute;inset:0;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 700' preserveAspectRatio='xMidYMid slice'><g transform='translate(150 150) scale(7)' fill='%238b7bff'><path d='M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z'/></g><g transform='translate(940 118) scale(6)' fill='%23d9a441'><path d='M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z'/></g><g transform='translate(90 480) scale(4)' fill='%238b7bff'><path d='M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z'/></g><g transform='translate(880 440) scale(5)' fill='%238b7bff'><path d='M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z'/></g><g transform='translate(780 60) scale(4)' fill='%23ffffff'><path d='M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z'/></g></svg>") center/cover no-repeat,repeating-linear-gradient(112deg,transparent 0 150px,rgba(255,255,255,.035) 150px 151px)}
.ao-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;width:100%;height:100%;padding:16px;box-sizing:border-box}
.ao-hint{font-size:14px;opacity:.9;text-align:center;align-self:center;padding:5px 14px;border-radius:999px;background:rgba(8,8,20,.5)}
.ao-counter{font-size:12px;letter-spacing:.2em;opacity:.8;align-self:center}
.ao-root[data-ao-no-hints] .ao-hint:not([role=alert]){display:none}
.ao-root[data-ao-no-counter] .ao-counter{display:none}
.ao-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ao-btn{appearance:none;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:inherit;border-radius:999px;padding:10px 22px;font:inherit;cursor:pointer}
/* Por encima del sobre 3D que queda detrás (un elemento absoluto pinta sobre los que están en el flujo). */
.ao-btn{position:relative;z-index:2}
.ao-btn.ao-fan-next{position:absolute;left:50%;bottom:calc(max(24px,env(safe-area-inset-bottom)) + 8px);translate:-50% 0}
.ao-btn--primary{background:var(--ao-accent);border-color:var(--ao-accent);color:var(--ao-on-accent,#1b1b2f);font-weight:600}
.ao-btn:focus-visible,.ao-pack:focus-visible,.ao-stack:focus-visible{outline:3px solid #fff;outline-offset:3px}
.ao-skip{position:absolute;top:12px;right:12px;z-index:5;padding:6px 14px;font-size:13px}
.ao-exit{position:absolute;top:max(12px,env(safe-area-inset-top));left:12px;z-index:6;padding:6px 14px;font-size:13px;background:rgba(8,8,20,.55)}

.ao-pack{position:relative;height:min(70%,420px);aspect-ratio:var(--ao-pack-ratio,.72);cursor:grab;touch-action:none}
.ao-pack__img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}
.ao-pack__body{clip-path:inset(var(--ao-strip,17.7%) 0 0 0)}
.ao-pack__strip{clip-path:inset(0 0 calc(100% - var(--ao-strip,17.7%)) 0);transition:transform calc(.45s*var(--ao-pace,1)) ease-in,opacity calc(.45s*var(--ao-pace,1)) ease-in}
.ao-pack--torn .ao-pack__strip{transform:translate(18%,-90%) rotate(14deg);opacity:0}
.ao-pack--torn .ao-pack__body{animation:ao-pack-pop .45s ease-out forwards}
.ao-pack__trail{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.ao-pack__trail polyline{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px var(--ao-accent))}
@keyframes ao-pack-pop{to{transform:translateY(6%) scale(var(--ao-from-s,.94))}}
.ao-pack--behind{position:absolute;filter:brightness(.72);transition:filter .9s ease;z-index:0}
.ao-pack--drop,.ao-carousel--drop{animation:ao-pack-drop var(--ao-drop,.9s) ease-in forwards}
@keyframes ao-pack-drop{to{transform:translateY(60px) rotate(5deg) scale(.9);opacity:0}}
.ao-carousel--behind{pointer-events:none;filter:brightness(.72);transition:filter .9s ease}

.ao-stack{position:relative;width:var(--ao-card-w);aspect-ratio:var(--ao-card-ratio,.716);cursor:pointer;perspective:1000px;touch-action:manipulation}
.ao-card{position:absolute;inset:0;transition:opacity .35s ease;transform:translateY(calc(var(--ao-depth,0)*-3px)) scale(calc(1 - var(--ao-depth,0)*.012)) rotateX(var(--ao-tx,0deg)) rotateY(var(--ao-ty,0deg));--hyp:.3;--posx:50%;--posy:50%;--mx:50%;--my:50%}
.ao-card__inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform var(--ao-flip,.7s) cubic-bezier(.2,.8,.2,1)}
.ao-card--shown .ao-card__inner{transform:rotateY(180deg)}
.ao-card__face{position:absolute;inset:0;border-radius:var(--ao-radius);overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#222;isolation:isolate}
.ao-card__face img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}
.ao-card__face--front{transform:rotateY(180deg);box-shadow:0 0 0 2px var(--ao-tier-color,#888),0 8px 24px rgba(0,0,0,.5)}
.ao-card__face--back{background:repeating-linear-gradient(45deg,#2b2b52,#2b2b52 8px,#1b1b2f 8px,#1b1b2f 16px);box-shadow:0 8px 24px rgba(0,0,0,.5)}
.ao-card--out{transition:transform calc(.8s*var(--ao-pace,1)) cubic-bezier(.2,.8,.25,1);transform:var(--ao-out-t);pointer-events:none}
.ao-card--broken .ao-card__face--front{background:#333}
.ao-badge-new{position:absolute;top:6px;left:6px;padding:2px 8px;border-radius:999px;background:var(--ao-accent);color:var(--ao-on-accent,#1b1b2f);font-size:11px;font-weight:700}

/* Foil holo por rareza guiado por el puntero (--posx/--posy/--hyp), adaptado de OpenPack (ver NOTICE.md) */
.ao-foil,.ao-sparkle,.ao-glare{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0}
.ao-foil{mix-blend-mode:color-dodge}
.ao-card[data-ao-vfx=shimmer] .ao-foil{background:linear-gradient(115deg,transparent,rgba(255,255,255,.4),transparent);background-size:200% 200%;background-position:var(--posx) var(--posy);opacity:calc(var(--hyp)*.5)}
.ao-card[data-ao-vfx=holo] .ao-foil{background:repeating-linear-gradient(115deg,transparent 0,color-mix(in srgb,var(--ao-glow,var(--ao-tier-color)) 70%,transparent) 6%,rgba(255,255,255,.6) 9%,transparent 14%);background-size:220% 220%;background-position:var(--posx) var(--posy);opacity:calc(var(--hyp)*.9)}
.ao-card[data-ao-vfx=rainbow] .ao-foil{background:repeating-linear-gradient(110deg,#ff5d8f 0%,#ffd24a 12%,#5fcf8e 24%,#3fd6c8 36%,#6ea8fe 48%,#b072e6 60%,#ff5d8f 72%);background-size:300% 300%;background-position:var(--posx) var(--posy);opacity:calc(.35 + var(--hyp)*.6)}
.ao-card[data-ao-vfx=cross] .ao-foil{background:repeating-linear-gradient(110deg,#ff5d8f 0%,#ffd24a 9%,#5fcf8e 18%,#3fd6c8 27%,#6ea8fe 36%,#b072e6 45%,#ff5d8f 54%),repeating-linear-gradient(-70deg,rgba(255,255,255,.18) 0 2px,transparent 2px 5px);background-size:280% 280%,100% 100%;background-position:var(--posx) var(--posy),0 0;background-blend-mode:color-dodge,overlay;opacity:calc(.45 + var(--hyp)*.55)}
.ao-card[data-ao-vfx=holo] .ao-foil::after,.ao-card[data-ao-vfx=rainbow] .ao-foil::after,.ao-card[data-ao-vfx=cross] .ao-foil::after{content:"";position:absolute;inset:0;border-radius:inherit;background-image:radial-gradient(circle,rgba(255,255,255,.95) 0,rgba(255,255,255,0) 45%),radial-gradient(circle,rgba(255,255,255,.7) 0,rgba(255,255,255,0) 42%);background-size:6px 6px,11px 11px;background-position:var(--posx) var(--posy),calc(var(--posx)*-.7) calc(var(--posy)*.6);mix-blend-mode:color-dodge;animation:ao-glitter 1.5s ease-in-out infinite}
@keyframes ao-glitter{0%,100%{opacity:.9}50%{opacity:.35}}
.ao-glare{background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.55),rgba(255,255,255,.08) 38%,transparent 60%);mix-blend-mode:overlay;opacity:calc(.25 + var(--hyp)*.55)}
.ao-sparkle{background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.9),transparent 14%);mix-blend-mode:color-dodge;opacity:calc(var(--hyp)*.5)}
.ao-card:not(.ao-card--shown) .ao-glare,.ao-card:not(.ao-card--shown) .ao-sparkle,.ao-card:not(.ao-card--shown) .ao-foil{display:none}
.ao-root[data-ao-profile=low] .ao-foil::after,.ao-root[data-ao-profile=low] .ao-glare,.ao-root[data-ao-profile=low] .ao-sparkle{display:none}

/* Lienzo de partículas, luz fluida del corte, destello y rayos de las cartas raras */
.ao-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
.ao-pack__flow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen}
.ao-flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 44%,#fff,var(--ao-flash-color) 35%,transparent 70%);opacity:0;animation:ao-flash-hit .46s ease-out var(--ao-flash-delay,0ms) forwards;z-index:0}
@keyframes ao-flash-hit{0%{opacity:0}8%{opacity:var(--ao-flash-peak,.3)}100%{opacity:0}}
.ao-rays{position:absolute;left:50%;top:44%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;pointer-events:none;opacity:0;z-index:0;
background:repeating-conic-gradient(from 0deg,var(--ao-rays-color) 0 4deg,transparent 4deg 18deg);-webkit-mask-image:radial-gradient(closest-side,#000,transparent 70%);mask-image:radial-gradient(closest-side,#000,transparent 70%);
animation:ao-rays 2.2s ease-out var(--ao-flash-delay,0ms) forwards}
@keyframes ao-rays{0%{opacity:0;transform:rotate(0)}15%{opacity:calc(var(--ao-rays-peak,.3)*.9)}100%{opacity:0;transform:rotate(40deg)}}

.ao-root:not([data-ao-profile=low]) .ao-card--shown:not([data-ao-hit]) .ao-card__face--front{box-shadow:0 0 0 2px var(--ao-tier-color,#888),0 0 22px 2px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color,#888)) 65%,transparent),0 8px 24px rgba(0,0,0,.5);animation:ao-reveal-glow 1.6s ease-out}
@keyframes ao-reveal-glow{0%{box-shadow:0 0 0 2px var(--ao-tier-color,#888),0 0 6px 0 transparent,0 8px 24px rgba(0,0,0,.5)}30%{box-shadow:0 0 0 2px var(--ao-tier-color,#888),0 0 46px 10px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color,#888)) 90%,transparent),0 8px 24px rgba(0,0,0,.5)}}
.ao-card[data-ao-hit] .ao-card__face--front{box-shadow:0 0 0 2px var(--ao-tier-color),0 0 34px 6px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color)) 80%,transparent),0 8px 24px rgba(0,0,0,.5)}
.ao-root:not([data-ao-profile=low]) .ao-card[data-ao-peek]:not(.ao-card--shown) .ao-card__face--back{animation:ao-peek 1.3s ease-in-out infinite}
@keyframes ao-peek{0%,100%{box-shadow:0 0 8px 0 color-mix(in srgb,var(--ao-glow,var(--ao-tier-color,#fff)) 45%,transparent),0 8px 24px rgba(0,0,0,.5)}50%{box-shadow:0 0 30px 6px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color,#fff)) 90%,transparent),0 8px 24px rgba(0,0,0,.5)}}
.ao-card--shown{animation:ao-flip-lift .6s ease-out}
@keyframes ao-flip-lift{0%{scale:1}35%{scale:1.07}100%{scale:1}}
.ao-root:not([data-ao-profile=low]) .ao-card--shown[data-ao-hit] .ao-card__inner{animation:ao-hit .9s ease-out}
@keyframes ao-hit{0%{transform:rotateY(180deg) scale(1)}40%{transform:rotateY(180deg) scale(1.12)}100%{transform:rotateY(180deg) scale(1)}}

/* Abanico del botín (adaptado de OpenPack, ver NOTICE.md) */
.ao-haul{position:relative;width:var(--ao-card-w);aspect-ratio:var(--ao-card-ratio,.716);margin:0 auto;transform-style:preserve-3d;perspective:1100px;touch-action:none;cursor:grab;outline:none}
.ao-haul__slot{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.2,.9,.25,1)}
.ao-haul--live .ao-haul__slot{transition:none}
.ao-haul__slot .ao-card{cursor:pointer}
.ao-haul__slot--hero .ao-card__face--front{box-shadow:0 0 130px 24px color-mix(in srgb,var(--ao-glow2,transparent) 38%,transparent),0 0 64px 6px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color)) 78%,transparent),0 30px 70px rgba(0,0,0,.6)}
/* Carta de cerca: se saca del abanico arrastrándola hacia arriba */
.ao-haul__slot--lifted .ao-card__face--front{box-shadow:0 0 110px 20px color-mix(in srgb,var(--ao-glow2,transparent) 38%,transparent),0 0 40px 6px color-mix(in srgb,var(--ao-glow,var(--ao-tier-color,#fff)) 70%,transparent),0 20px 50px rgba(0,0,0,.6)}
.ao-inspect{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:rgba(6,6,14,.8);outline:none;cursor:zoom-out;animation:ao-inspect-in .3s ease both}
.ao-inspect--out{pointer-events:none;animation:ao-inspect-out .2s ease both}
.ao-inspect__card{position:relative;width:min(88vw,calc(72vh*var(--ao-card-ratio,.716)),460px);aspect-ratio:var(--ao-card-ratio,.716);perspective:1000px;animation:ao-inspect-card .4s cubic-bezier(.2,.9,.25,1.05) both}
@keyframes ao-inspect-in{from{opacity:0}to{opacity:1}}
@keyframes ao-inspect-out{to{opacity:0}}
.ao-inspect--out .ao-inspect__card{animation:ao-inspect-card-out .22s ease both}
@keyframes ao-inspect-card-out{to{opacity:0;transform:translateY(14%) scale(.55)}}
@keyframes ao-inspect-card{from{opacity:0;transform:translateY(14%) scale(.55)}to{opacity:1;transform:none}}
.ao-haul__cap{text-align:center;pointer-events:none}
.ao-haul__name{margin:0;font-size:clamp(18px,5.4vw,27px);font-weight:800;text-shadow:0 0 16px var(--ao-tier-color,#fff),0 2px 10px rgba(0,0,0,.6)}
.ao-haul__tier{margin:6px 0 0;font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--ao-tier-color,#9aa3b2)}
.ao-summary{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:18px;width:100%;max-width:min(1100px,calc(var(--ao-cols,5)*(clamp(120px,13vw,190px) + 18px) + 24px));max-height:72%;overflow-y:auto;padding:16px 12px;box-sizing:border-box;touch-action:pan-y;scrollbar-width:none}
.ao-summary::-webkit-scrollbar{display:none}
.ao-tile{flex:0 0 clamp(120px,13vw,190px);position:relative;aspect-ratio:var(--ao-card-ratio,.716);border-radius:var(--ao-radius);overflow:hidden;box-shadow:0 0 0 2px var(--ao-tier-color,#888)}
.ao-tile img{width:100%;height:100%;object-fit:cover;display:block}
.ao-tile[data-ao-best]{box-shadow:0 0 0 3px #fff,0 0 28px 4px var(--ao-glow,var(--ao-tier-color));scale:1.08;z-index:1}
.ao-stage>.ao-spinner{position:absolute;left:50%;top:50%;margin:-22px 0 0 -22px}
.ao-spinner{width:44px;height:44px;border-radius:50%;border:4px solid rgba(255,255,255,.25);border-top-color:var(--ao-accent);animation:ao-spin .9s linear infinite}
@keyframes ao-spin{to{transform:rotate(360deg)}}
.ao-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}

/* Partículas ambientales (solo perfil alto) */
.ao-sparks{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ao-sparks span{position:absolute;bottom:-10px;left:var(--ao-x);width:var(--ao-s);height:var(--ao-s);border-radius:50%;background:var(--ao-accent);opacity:0;box-shadow:0 0 8px var(--ao-accent);animation:ao-spark var(--ao-d) linear var(--ao-delay) infinite}
@keyframes ao-spark{0%{transform:translateY(0);opacity:0}15%{opacity:.7}100%{transform:translateY(-105vh) translateX(18px);opacity:0}}
.ao-stage{z-index:1}

/* Carrusel 3D de sobres */
.ao-carousel{position:absolute;inset:0;outline:none;transition:opacity .35s ease .15s}
.ao-carousel__canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.ao-carousel__ui{position:absolute;left:0;right:0;bottom:max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;transition:opacity .3s}
.ao-carousel__ui>*{pointer-events:auto}
.ao-carousel__ui--hidden{opacity:0}
.ao-hint--float{background:none;position:absolute;left:0;right:0;bottom:calc(max(20px,env(safe-area-inset-bottom)) + 52px);padding:0 16px;pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.7)}
.ao-carousel__badge{font-size:12px;font-weight:700;letter-spacing:0;padding:3px 10px;border-radius:999px;color:#fff;text-shadow:none;background:color-mix(in srgb,var(--ao-accent) 45%,#0b0b1e)}
.ao-carousel__hint{padding:6px 16px;border-radius:999px;text-align:center;position:absolute;top:max(18px,env(safe-area-inset-top));left:50%;translate:-50% 0;z-index:2;width:max-content;max-width:min(92%,620px);line-height:1.35;font-size:13px;color:#cfc8ff;background:rgba(40,40,80,.45);border:1px solid rgba(255,255,255,.12);transition:opacity .3s}
.ao-carousel__hint--hidden{opacity:0}
.ao-carousel__hint--bottom{top:auto;bottom:calc(max(20px,env(safe-area-inset-bottom)) + 52px)}
.ao-zone{position:absolute;z-index:2;pointer-events:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;letter-spacing:.04em;color:rgba(255,255,255,.85);text-shadow:0 1px 6px rgba(0,0,0,.6);background:rgba(255,255,255,.05);transition:opacity .25s;opacity:0}
.ao-zone--cut{border-radius:12px 12px 0 0;background:rgba(255,255,255,.13)}
.ao-zone--hold{border-radius:0 0 12px 12px}
.ao-zone--full{border-radius:12px}
.ao-zone--on{opacity:1}
.ao-carousel__hint--box{pointer-events:none;font-size:12px}
.ao-hint__icon{display:inline-block;margin-right:8px}
.ao-nav{position:absolute;top:42%;z-index:2;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(20,20,48,.55);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 0 3px;transition:opacity .3s,background .2s}
.ao-nav:hover{background:rgba(255,255,255,.16)}
.ao-nav--prev{left:clamp(12px,4vw,56px)}
.ao-nav--next{right:clamp(12px,4vw,56px)}
.ao-nav--hidden{opacity:0;pointer-events:none}
.ao-dots{display:flex;gap:8px;align-items:center;margin-top:2px}
.ao-dot{display:block;width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.28);transition:width .3s,background .3s}
.ao-dot--on{width:28px;background:var(--ao-accent)}
.ao-carousel__caption{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;font-size:clamp(18px,5vw,26px);font-weight:800;text-shadow:0 0 16px var(--ao-accent),0 2px 10px rgba(0,0,0,.6)}

/* Selección de sobres */
.ao-shelf{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:clamp(12px,3vw,32px);width:100%;max-height:80%;overflow-y:auto;padding:24px 8px;box-sizing:border-box;perspective:900px;touch-action:pan-y}
.ao-choice{appearance:none;background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:10px;
width:clamp(96px,22vw,168px);transform-style:preserve-3d;animation:ao-drop .7s cubic-bezier(.2,.9,.25,1.15) both;animation-delay:calc(var(--ao-i,0)*110ms)}
.ao-choice__art{position:relative;display:block;width:100%;aspect-ratio:var(--ao-pack-ratio,.72);border-radius:8px;
transform:rotateX(var(--ao-rx,0deg)) rotateY(var(--ao-ry,0deg));transition:transform .18s ease-out,filter .25s,box-shadow .25s;
box-shadow:0 14px 28px rgba(0,0,0,.45);animation:ao-float 4.2s ease-in-out calc(var(--ao-i,0)*-.7s) infinite}
.ao-choice__art img{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none;-webkit-user-drag:none;border-radius:8px}
.ao-choice__shine{position:absolute;inset:0;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .2s;background:linear-gradient(115deg,transparent calc(var(--ao-gx,50%) - 22%),rgba(255,255,255,.38) var(--ao-gx,50%),transparent calc(var(--ao-gx,50%) + 22%))}
.ao-choice__caption{font-size:13px;opacity:.75;transition:opacity .2s,color .2s;text-align:center}
.ao-choice:hover .ao-choice__art,.ao-choice:focus-visible .ao-choice__art{filter:drop-shadow(0 0 16px var(--ao-choice-accent));box-shadow:0 20px 36px rgba(0,0,0,.55)}
.ao-choice:hover .ao-choice__shine,.ao-choice:focus-visible .ao-choice__shine{opacity:1}
.ao-choice:hover .ao-choice__caption,.ao-choice:focus-visible .ao-choice__caption{opacity:1;color:var(--ao-choice-accent)}
.ao-choice:focus-visible{outline:none}
.ao-choice--picked{z-index:2;animation:none;transition:transform .6s cubic-bezier(.3,.8,.3,1.2);transform:translateY(-6%) scale(1.28)}
.ao-choice--picked .ao-choice__art{animation:none;filter:drop-shadow(0 0 26px var(--ao-choice-accent))}
.ao-choice--away{animation:none;transition:transform .5s ease-in,opacity .45s ease-in,filter .45s;opacity:0;filter:blur(3px);transform:translateY(40px) scale(.8)}
@keyframes ao-drop{0%{opacity:0;transform:translateY(-70px) rotate(-8deg) scale(.7)}100%{opacity:1;transform:none}}
@keyframes ao-float{0%,100%{translate:0 0}50%{translate:0 -8px}}

/* Sobre al rasgar: entrada, flotación, brillo y destello */
.ao-pack{animation:ao-pack-in .6s cubic-bezier(.2,.9,.25,1.1) both}
.ao-pack::before{content:"";position:absolute;inset:-14%;border-radius:50%;background:radial-gradient(closest-side,var(--ao-accent),transparent 70%);opacity:.28;filter:blur(18px);pointer-events:none;z-index:-1}
.ao-pack::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.28) 50%,transparent 60%);background-size:260% 100%;background-position:150% 0;animation:ao-gloss 3.4s ease-in-out 1s infinite}
.ao-root:not([data-ao-profile=low]) .ao-pack:not(.ao-pack--torn){animation:ao-pack-in .6s cubic-bezier(.2,.9,.25,1.1) both,ao-float 4s ease-in-out .7s infinite}
.ao-pack--torn::after,.ao-pack--torn::before{display:none}
.ao-pack--split .ao-pack__body,.ao-pack--split .ao-pack__strip{display:none}
.ao-pack--split .ao-pack__piece--stay{animation:ao-pack-pop .45s ease-out .1s forwards}
.ao-pack--split .ao-pack__piece--mover{animation:ao-fly .55s cubic-bezier(.3,.1,.6,1) forwards}
@keyframes ao-fly{to{transform:translate(var(--ao-fly-x),var(--ao-fly-y)) rotate(var(--ao-fly-rot));opacity:0}}
@keyframes ao-pack-in{0%{opacity:0;transform:scale(.6) rotate(-6deg) translateY(40px)}100%{opacity:1;transform:none}}
@keyframes ao-gloss{0%{background-position:150% 0}60%,100%{background-position:-50% 0}}
.ao-burst{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:3}
.ao-burst i{position:absolute;display:block}
.ao-burst__flash{width:60vmin;height:60vmin;border-radius:50%;background:radial-gradient(closest-side,#fff,var(--ao-burst-color) 40%,transparent 72%);animation:ao-flash .7s ease-out forwards}
@keyframes ao-flash{0%{opacity:0;transform:scale(.2)}25%{opacity:.9}100%{opacity:0;transform:scale(1.2)}}

/* Pila: las cartas suben desde el sobre; onda al sacar una carta rara */
.ao-stack{animation:ao-rise calc(2.2s*var(--ao-pace,1)) cubic-bezier(.3,.6,.25,1) calc(.6s*var(--ao-pace,1)) backwards;z-index:1}
/* Las cartas salen por la boca: solo se ve lo que ya pasó la línea de la boca (el recorte baja al mismo ritmo que sube la carta); luego se acomodan al frente. */
@keyframes ao-rise{0%{clip-path:inset(0 0 100% 0);transform:translate(var(--ao-from-x,0px),calc(var(--ao-from-y,60px) + 50%)) scale(var(--ao-from-s,.94))}60%{clip-path:inset(0 0 20% 0);transform:translate(var(--ao-from-x,0px),calc(var(--ao-from-y,60px) - 30%)) scale(var(--ao-from-s,.94))}100%{clip-path:inset(-80px);transform:none}}
.ao-mouth{position:absolute;z-index:1;pointer-events:none;width:calc(var(--ao-mouth-w,var(--ao-card-w))*1.3);height:calc(var(--ao-mouth-w,var(--ao-card-w))*.55);margin:calc(var(--ao-mouth-w,var(--ao-card-w))*-.275) 0 0 calc(var(--ao-mouth-w,var(--ao-card-w))*-.65);border-radius:50%;background:radial-gradient(closest-side,#fff6dc,var(--ao-mouth-color,#ffd98a) 45%,transparent 75%);opacity:0;animation:ao-mouth calc(3s*var(--ao-pace,1)) ease-out forwards}
.ao-mouth::after{content:"";position:absolute;left:18%;right:18%;bottom:50%;height:calc(var(--ao-mouth-w,var(--ao-card-w))*1.15);clip-path:polygon(14% 100%,86% 100%,100% 0,0 0);-webkit-mask-image:linear-gradient(to right,transparent,#000 28%,#000 72%,transparent);mask-image:linear-gradient(to right,transparent,#000 28%,#000 72%,transparent);background:linear-gradient(to top,var(--ao-mouth-color,#ffd98a),transparent 85%);opacity:.75}
@keyframes ao-mouth{0%{opacity:0;scale:.4}20%{opacity:.95}65%{opacity:.85}100%{opacity:0;scale:1.3}}
.ao-shock{position:absolute;left:50%;top:50%;width:40vmin;height:40vmin;margin:-20vmin 0 0 -20vmin;border-radius:50%;pointer-events:none;border:4px solid var(--ao-shock-color);box-shadow:0 0 40px var(--ao-shock-color),inset 0 0 40px var(--ao-shock-color);opacity:0;animation:ao-shock 1s ease-out var(--ao-shock-delay,0ms) forwards;z-index:0}
@keyframes ao-shock{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(3)}}
.ao-summary .ao-tile{animation:ao-tile-in .5s cubic-bezier(.2,.9,.25,1.1) both;animation-delay:calc(var(--ao-i,0)*var(--ao-stagger,70ms))}
@keyframes ao-tile-in{0%{opacity:0;transform:translateY(24px) scale(.85)}100%{opacity:1;transform:none}}

/* Puerta de entrada: formulario previo a la experiencia (ver GateOptions) */
.ao-root[data-ao-gate] .ao-skip{display:none}
.ao-gate{position:absolute;left:50%;top:50%;translate:-50% -50%;z-index:3;display:flex;flex-direction:column;gap:14px;width:min(calc(100% - 32px),420px);max-height:calc(100% - 32px);overflow:auto;padding:24px;box-sizing:border-box;border-radius:calc(var(--ao-radius) + 4px);background:rgba(18,22,41,.82);border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 48px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);touch-action:auto;user-select:text;-webkit-user-select:text}
.ao-gate__title{margin:0;font-size:20px;font-weight:700;line-height:1.2}
.ao-gate__message{margin:0;font-size:14px;line-height:1.45;opacity:.85}
.ao-gate__field{display:flex;flex-direction:column;gap:6px}
.ao-gate__label{font-size:13px;font-weight:600}
.ao-gate__input{appearance:none;width:100%;box-sizing:border-box;padding:11px 14px;border-radius:var(--ao-radius);border:1px solid rgba(255,255,255,.28);background:rgba(0,0,0,.35);color:inherit;font:inherit;font-size:16px}
.ao-gate__input:focus-visible{outline:3px solid var(--ao-accent);outline-offset:1px}
.ao-gate__input[readonly]{opacity:.6}
.ao-gate__field--check{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:start}
.ao-gate__check{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ao-accent)}
.ao-gate__check:focus-visible{outline:3px solid var(--ao-accent);outline-offset:2px}
.ao-gate__field--check .ao-gate__label{font-weight:500;line-height:1.4}
.ao-gate__field--check .ao-gate__links,.ao-gate__field--check .ao-gate__help{grid-column:2}
.ao-gate__links{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}
.ao-gate__links a{color:var(--ao-accent);text-decoration:underline}
.ao-gate__help{font-size:12px;opacity:.7;line-height:1.4}
.ao-gate__error{margin:0;padding:9px 12px;border-radius:var(--ao-radius);background:rgba(248,113,113,.16);border:1px solid rgba(248,113,113,.5);font-size:13px;line-height:1.4}
.ao-gate__actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.ao-gate__actions .ao-btn:disabled{opacity:.6;cursor:default}

.ao-root[data-ao-reduced] *{animation:none!important;transition-duration:.01ms!important}
`;

export function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) {
    return;
  }
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
