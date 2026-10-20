import { Send, Mail } from 'lucide-react'
import { siteConfig, whatsappQuoteMessage } from '@/lib/config'

export default function Especial_Order_Section() {
  return (
    <section data-reveal id="orcamento" className="py-16 bg-[#03050c] border-t border-cyan-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-[#0a0e1a] border border-cyan-950 rounded-3xl p-8 max-[380px]:p-5 md:p-12 space-y-8 relative overflow-hidden">
          
          {/* Cabeçalho */}
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Prototipagem &amp; Orçamentos</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Tem um projeto ou arquivo 3D próprio?</h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
              Envie o arquivo STL, link do modelo ou descrição para cotarmos a sua impressão.
            </p>
          </div>

          {/* Botões de Contato com Bounce Leve (Estilo Botão) */}
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <a
              href={`https://wa.me/${siteConfig.whatsapp.atendimento.number}?text=${encodeURIComponent(whatsappQuoteMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal 
              data-reveal-delay={0} 
              className="hover-btn-bounce p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 hover:border-cyan-400/60 transition-all duration-300 flex items-center gap-4 group cursor-pointer"
            >
              <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors duration-300">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">WhatsApp Atendimento</span>
                <span className="text-sm font-bold text-white">{siteConfig.whatsapp.atendimento.display}</span>
              </div>
            </a>

            <a
              href={`https://wa.me/${siteConfig.whatsapp.comercial.number}?text=${encodeURIComponent(whatsappQuoteMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal 
              data-reveal-delay={120} 
              className="hover-btn-bounce p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 hover:border-cyan-400/60 transition-all duration-300 flex items-center gap-4 group cursor-pointer"
            >
              <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors duration-300">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">WhatsApp Comercial</span>
                <span className="text-sm font-bold text-white">{siteConfig.whatsapp.comercial.display}</span>
              </div>
            </a>
          </div>

          {/* Rodapé / Link de E-mail */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4 border-t border-cyan-950 text-xs text-slate-400">
            <a 
              href={`mailto:${siteConfig.email}`} 
              className="hover-btn-bounce flex items-center gap-2 px-3 py-1.5 rounded-lg hover:text-cyan-400 transition-all duration-300"
            >
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>{siteConfig.email}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}