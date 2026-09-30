import Image from 'next/image'
import { Sparkles, Printer, Disc, ArrowUpRight } from 'lucide-react'

export default function Hero_Section() {
  return (
    <section id="hero" data-reveal className="py-12 md:py-20 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-5xl mx-auto px-6">
        <div className="relative bg-[#0a0e1a]/80 border border-cyan-950/60 rounded-3xl p-8 max-[380px]:p-6 md:p-12 backdrop-blur-xl">
          
          <div className="absolute top-4 left-4 w-6 h-6 max-[380px]:top-2 max-[380px]:left-2 max-[380px]:w-4 max-[380px]:h-4 border-t-2 border-l-2 border-cyan-500/80" />
          <div className="absolute bottom-4 right-4 w-6 h-6 max-[380px]:bottom-2 max-[380px]:right-2 max-[380px]:w-4 max-[380px]:h-4 border-b-2 border-r-2 border-cyan-500/80" />

          <div className="grid md:grid-cols-12 gap-10 items-center">
            
            <div className="hero-in md:col-span-7 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Impressão 3D & Prototipagem</span>
                </div>
                <h1 className="text-3xl max-[424px]:text-[length:clamp(1.35rem,calc((100vw_-_114px)/10.6),1.875rem)] max-[380px]:text-[length:clamp(1.2rem,calc((100vw_-_98px)/10.6),1.875rem)] md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  Transformamos suas ideias <br className="hidden sm:block" />
                  <span className="text-cyan-400 hover-stroke-group inline-block cursor-default">
                    do <span className="hover-stroke-target">digital</span> ao <span className="hover-stroke-target">real</span>.
                  </span>
                </h1>
                <p className="text-slate-400 text-sm md:text-base mt-3 leading-relaxed">
                  Peças decorativas exclusivas, colecionáveis de alta precisão e protótipos sob medida impressos com máxima resolução e acabamento refinado.
                </p>
              </div>

              <div className="grid grid-cols-2 max-[340px]:grid-cols-1 gap-3 pt-2 text-xs text-slate-300">
                <div className="p-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl flex items-center gap-2.5 hover-box-sway cursor-default">
                  <Printer className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Alta Precisão Milimétrica</span>
                </div>
                <div className="p-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl flex items-center gap-2.5 hover-box-sway cursor-default">
                  <Disc className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Filamentos Premium (PLA/PETG)</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <a
                  href="#catalogo"
                  className="btn-fx hover-btn-bounce justify-center px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                >
                  Explorar Catálogo
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <a
                  href="#orcamento"
                  className="btn-soft hover-btn-bounce text-center px-6 py-3 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/50 text-cyan-300 font-semibold text-xs rounded-xl transition"
                >
                  Cotar Peça Personalizada
                </a>
              </div>
            </div>

            <div className="hero-in hero-in-2 md:col-span-5 flex justify-center relative">
              <div className="mascot-float relative w-full max-w-xs aspect-square flex items-center justify-center">
                <Image 
                  src="/mascote.png" 
                  alt="Mascote Lúmen 3D" 
                  width={320} 
                  height={320} 
                  className="w-full h-auto object-contain drop-shadow-[0_10px_35px_rgba(0,216,255,0.2)] hover:scale-105 transition duration-500"
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}