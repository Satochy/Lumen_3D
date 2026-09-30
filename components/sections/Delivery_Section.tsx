'use client';

import RegionMap from './Region_Map';
import { Truck, CheckCircle2, Compass, MapPin } from 'lucide-react';

export default function Delivery_Section() {
  const whatsappMsg = encodeURIComponent('Olá! Gostaria de confirmar a entrega grátis para o meu endereço em Itapetininga/região.');
  const whatsappUrl = `https://wa.me/5515988324925?text=${whatsappMsg}`;

  return (
    <section data-reveal className="py-16 md:py-20 border-t border-cyan-950/80 bg-[#060913] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative bg-[#0a0e1a]/90 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
          
          {/* Elemento luminoso de fundo */}
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />

          {/* Cantoneiras Estilo Lúmen 3D */}
          <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

          {/* Grid Responsivo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            
            {/* COLUNA ESQUERDA: Textos e Informações */}
            <div className="lg:col-span-6 flex flex-col space-y-5 w-full min-w-0">
              
              {/* Badge com animação de pílula igual à Hero */}
              <div className="hover-box-sway inline-flex items-center gap-2 text-cyan-400 text-xs font-bold tracking-wider uppercase px-3.5 py-1.5 bg-cyan-950/80 border border-cyan-800/50 rounded-full w-fit cursor-default transition-all duration-300">
                <Truck className="w-3.5 h-3.5" />
                <span>Logística Rápida & Local</span>
              </div>

              {/* Título: Apenas "Frete Grátis" tem o stroke/bounce; " na Região" fica ciano fixo */}
              <h2 className="hover-stroke-group text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight cursor-default">
                Entrega Facilitada & <br className="hidden sm:inline" />
                <span className="text-cyan-400 inline-block">
                  <span className="hover-stroke-target inline-block">Frete Grátis</span> na Região
                </span>
              </h2>

              {/* Descrição */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Com a <strong className="text-white">Lúmen 3D</strong>, as suas peças chegam mais rápido e sem custos adicionais de envio para entregas locais. Produzimos e entregamos diretamente em mãos com máxima segurança.
              </p>

              {/* Card 1: Efeito Sway/Bounce idêntico às pílulas/cards da Hero */}
              <div className="hover-box-sway flex items-start gap-3 p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-900/40 cursor-default transition-all duration-300">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white block">Itapetininga (Sede)</span>
                  <span className="text-xs text-slate-400">Frete 100% Grátis para qualquer bairro da cidade.</span>
                </div>
              </div>

              {/* Card 2: Efeito Sway/Bounce idêntico às pílulas/cards da Hero */}
              <div className="hover-box-sway flex items-start gap-3 p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-900/40 cursor-default transition-all duration-300">
                <Compass className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white block">Municípios Vizinhos</span>
                  <span className="text-xs text-slate-400 leading-relaxed">
                    Condições especiais e entregas rápidas para Angatuba, Buri, Campina do Monte Alegre, Capão Bonito, Capela do Alto, Guareí, Pilar do Sul, São Miguel Arcanjo, Sarapuí e Tatuí.
                  </span>
                </div>
              </div>

              {/* CTA: Animação e comportamento idênticos aos botões da Hero */}
              <div className="pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-fx hover-btn-bounce w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Consultar Meu Endereço</span>
                </a>
              </div>
            </div>

            {/* COLUNA DIREITA: Mapa Interativo */}
            <div className="btn-fx lg:col-span-6 w-full flex items-center justify-center min-w-0">
              <RegionMap className="w-full" />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}