import { Users, Star, Quote } from 'lucide-react'

export default function Feedbacks_Section() {
  return (
    <section data-reveal className="py-20 bg-[#04060d] border-t border-cyan-950">
      <div className="max-w-6xl mx-auto px-6 space-y-12">
        
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider max-[420px]:text-[11px] max-[420px]:tracking-wide uppercase px-3 py-1 bg-cyan-950/80 border border-cyan-800/50 rounded-full">
            <Users className="w-3.5 h-3.5" />
            <span>Depoimentos & Feedbacks</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white">
            O que nossos clientes dizem
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            Qualidade de acabamento, precisão nos detalhes e satisfação garantida em cada impressão.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          
          <div data-reveal data-reveal-delay={0} className="relative bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-4 transition duration-300 group lift">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 stroke-none" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "Pedi a impressão de um boneco do Goku ssj4 cheio de detalhes complexos e o resultado superou demais minhas expectativas! O acabamento é impecável e veio super bem embalado."
              </p>
            </div>
            <div className="pt-4 border-t border-cyan-950/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Daniel Felipe</span>
                <span className="text-[10px] text-cyan-400 font-mono">Itapetininga - SP</span>
              </div>
              <Quote className="w-6 h-6 text-cyan-500/20 group-hover:text-cyan-400/40 transition" />
            </div>
          </div>

          <div data-reveal data-reveal-delay={120} className="relative bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-4 transition duration-300 group lift">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 stroke-none" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "Precisava de um protótipo sob medida para um projeto do TCC da faculdade de ADS. Atendimento rápido pelo WhatsApp e entrega grátis no mesmo dia na região!"
              </p>
            </div>
            <div className="pt-4 border-t border-cyan-950/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Maria Clara</span>
                <span className="text-[10px] text-cyan-400 font-mono">Cliente Verificado</span>
              </div>
              <Quote className="w-6 h-6 text-cyan-500/20 group-hover:text-cyan-400/40 transition" />
            </div>
          </div>

          <div data-reveal data-reveal-delay={240} className="relative bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/40 p-6 rounded-2xl flex flex-col justify-between space-y-4 transition duration-300 group lift">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 stroke-none" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "Os vasos decorativos e suportes gamer que encomendei deram outra cara pro meu setup. A qualidade do filamento é top de linha. Recomendo de olhos fechados!"
              </p>
            </div>
            <div className="pt-4 border-t border-cyan-950/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Miguel Segato</span>
                <span className="text-[10px] text-cyan-400 font-mono">Sorocaba</span>
              </div>
              <Quote className="w-6 h-6 text-cyan-500/20 group-hover:text-cyan-400/40 transition" />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}