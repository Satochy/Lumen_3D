import { Target, Share2, Send, Mail, ArrowUpRight } from 'lucide-react'

export default function About_Section() {
  return (
    <section data-reveal id="sobre" className="py-20 bg-[#050811]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6">
            {/* Badge com animação de balanço (Sway) */}
            <div className="hover-box-sway inline-flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider max-[420px]:text-[11px] max-[420px]:tracking-wide uppercase px-3 py-1 bg-cyan-950/80 border border-cyan-800/50 rounded-full cursor-default transition-all duration-300">
              <Target className="w-3.5 h-3.5" />
              <span>Nossa Identidade & Visão</span>
            </div>

            {/* Título: "engenharia" e "arte digital." recebem o efeito especial; "&" permanece estático em ciano */}
            <h2 className="hover-stroke-group text-3xl md:text-4xl font-black text-white tracking-tight cursor-default">
              Materializando ideias com <br className="hidden sm:block" />
              <span className="text-cyan-400 inline-block">
                <span className="hover-stroke-target inline-block">engenharia</span> &amp;{' '}
                <span className="hover-stroke-target inline-block">arte digital.</span>
              </span>
            </h2>

            <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
              <p>
                A <strong className="text-white">Lúmen 3D</strong> nasceu do fascínio pela tecnologia de fabricação aditiva e pelo design geométrico. Nosso propósito vai além de apenas imprimir peças: transformamos conceitos abstratos e modelos digitais em produtos físicos tangíveis com máxima precisão milimétrica.
              </p>
              <p>
                Atuamos desde a produção de colecionáveis de alta definição e peças decorativas minimalistas até soluções personalizadas de prototipagem para projetos técnicos e acadêmicos.
              </p>
            </div>

            {/* Caixas de métricas com balanço de destaque (Sway) */}
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="hover-box-sway p-3 bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/50 rounded-xl text-center cursor-default transition-all duration-300">
                <span className="text-cyan-400 font-extrabold text-lg block">100%</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Resolução Premium</span>
              </div>
              <div className="hover-box-sway p-3 bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/50 rounded-xl text-center cursor-default transition-all duration-300">
                <span className="text-cyan-400 font-extrabold text-lg block">PLA / PETG</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Materiais Nobres</span>
              </div>
              <div className="hover-box-sway p-3 bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/50 rounded-xl text-center cursor-default transition-all duration-300">
                <span className="text-cyan-400 font-extrabold text-lg block">Sob Medida</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Prototipagem</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#0a0e1a] border border-cyan-950 p-8 max-[380px]:p-6 rounded-3xl space-y-6 relative">
              
              <div className="absolute top-3 left-3 w-4 h-4 max-[380px]:top-2 max-[380px]:left-2 border-t-2 border-l-2 border-cyan-500/60" />
              <div className="absolute bottom-3 right-3 w-4 h-4 max-[380px]:bottom-2 max-[380px]:right-2 border-b-2 border-r-2 border-cyan-500/60" />

              <div>
                <h3 className="text-xl font-extrabold text-white">Conecte-se Conosco</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Acompanhe nossos bastidores de impressão, lançamentos e projetos em tempo real.
                </p>
              </div>

              {/* Botões/Links de contato com Bounce leve (Estilo Botão) */}
              <div className="space-y-3">
                <a
                  href="https://instagram.com/lumen.3d_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-btn-bounce p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-900/50 hover:border-cyan-400/60 flex items-center justify-between transition-all duration-300 group contact-link"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Instagram Oficial</span>
                      <span className="text-[10px] text-slate-400">@lumen.3d_</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </a>

                <a
                  href="https://wa.me/5515988324925"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-btn-bounce p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-900/50 hover:border-cyan-400/60 flex items-center justify-between transition-all duration-300 group contact-link"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Atendimento Direct / Whats</span>
                      <span className="text-[10px] text-slate-400">(15) 98832-4925</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </a>

                <a
                  href="mailto:lumenimpressao3d@gmail.com"
                  className="hover-btn-bounce p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-900/50 hover:border-cyan-400/60 flex items-center justify-between transition-all duration-300 group contact-link"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">E-mail Comercial</span>
                      <span className="text-[10px] text-slate-400">lumenimpressao3d@gmail.com</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}