import { Send, Mail } from 'lucide-react'

export default function Especial_Order_Section() {
  return (
    <section data-reveal id="orcamento" className="py-16 bg-[#03050c] border-t border-cyan-950">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-[#0a0e1a] border border-cyan-950 rounded-3xl p-8 max-[380px]:p-5 md:p-12 space-y-8">
          
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Prototipagem & Orçamentos</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Tem um projeto ou arquivo 3D próprio?</h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
              Envie o arquivo STL, link do modelo ou descrição para cotarmos a sua impressão.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <a
              href={`https://wa.me/5515988324925?text=${encodeURIComponent('Olá! Gostaria de fazer um orçamento de impressão 3D na Lúmen.')}`}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal data-reveal-delay={0} className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 hover:border-cyan-400/60 transition flex items-center gap-4 group lift"
            >
              <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">WhatsApp Atendimento</span>
                <span className="text-sm font-bold text-white">(15) 98832-4925</span>
              </div>
            </a>

            <a
              href={`https://wa.me/5515981159636?text=${encodeURIComponent('Olá! Gostaria de fazer um orçamento de impressão 3D na Lúmen.')}`}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal data-reveal-delay={120} className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 hover:border-cyan-400/60 transition flex items-center gap-4 group lift"
            >
              <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">WhatsApp Comercial</span>
                <span className="text-sm font-bold text-white">(15) 98115-9636</span>
              </div>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4 border-t border-cyan-950 text-xs text-slate-400">
            <a href="mailto:lumenimpressao3d@gmail.com" className="flex items-center gap-2 hover:text-cyan-400 transition">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>lumenimpressao3d@gmail.com</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}