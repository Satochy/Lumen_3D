'use client';

import { useState } from 'react';

type CityMarker = {
  id: string;
  name: string | string[];
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  dx?: number;
  dy?: number;
};

// Itapetininga
const HOME = { id: 'itapetininga', name: 'ITAPETININGA', x: 540, y: 385 };

// Cidades Vizinhas
const CITIES: CityMarker[] = [
  { id: 'angatuba', name: 'Angatuba', x: 290, y: 220, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'guarei', name: 'Guareí', x: 480, y: 170, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'tatui', name: 'Tatuí', x: 750, y: 155, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'capela-do-alto', name: 'Capela do Alto', x: 850, y: 230, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'alambari', name: 'Alambari', x: 750, y: 290, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'sarapui', name: 'Sarapuí', x: 800, y: 380, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'pilar-do-sul', name: 'Pilar do Sul', x: 850, y: 520, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'sao-miguel-arcanjo', name: 'São Miguel Arcanjo', x: 630, y: 570, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'capao-bonito', name: 'Capão Bonito', x: 380, y: 620, anchor: 'middle', dx: 0, dy: -20 },
  { id: 'buri', name: 'Buri', x: 190, y: 450, anchor: 'middle', dx: 0, dy: -20 },
  { 
    id: 'campina-do-monte-alegre',
    name: ['Campina do', 'Monte Alegre'], 
    x: 300, 
    y: 340, 
    anchor: 'middle', 
    dx: 0, 
    dy: -40
  },
];

type RegionMapProps = {
  className?: string;
};

export default function Region_Map({ className = '' }: RegionMapProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  const activeCityObj = CITIES.find((c) => c.id === hoveredCity);
  const isHomeHovered = hoveredCity === HOME.id;

  const handleCityClick = (id: string) => {
    setHoveredCity((prev) => (prev === id ? null : id));
  };

  return (
    <div className={`relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-cyan-900/50 bg-[#050811] select-none ${className}`}>
      <style jsx global>{`
        @keyframes routeDash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-route-dash {
          animation: routeDash 0.8s linear infinite;
        }
      `}</style>

      {/* Indicador Itapetininga */}
      <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 z-20 bg-[#050811]/85 backdrop-blur-md border border-cyan-500/40 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 shadow-lg pointer-events-none">
        <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
          <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-cyan-500"></span>
        </span>
        <span className="text-[9px] sm:text-[11px] font-bold text-cyan-300">Itapetininga - SP</span>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-1.5 left-1.5 sm:bottom-3 sm:left-3 z-20 flex flex-col gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] px-2 py-1 sm:px-2.5 sm:py-1.5 pointer-events-none">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400" />
          Frete grátis
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-cyan-400/80" />
          Condições especiais
        </span>
      </div>

      {/* Proporção 1000:892 mantida dinamicamente */}
      <div className="relative w-full aspect-[1000/892]">
        <img
          src="/region-map.jpg"
          alt="Mapa da Região"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#050811]/70 via-transparent to-[#050811]/30 pointer-events-none" />

        <svg
          viewBox="0 0 1000 892"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          {activeCityObj && (
            <g className="pointer-events-none">
              <line
                x1={HOME.x}
                y1={HOME.y}
                x2={activeCityObj.x}
                y2={activeCityObj.y}
                stroke="#22d3ee"
                strokeWidth="5"
                className="opacity-30 blur-[3px]"
              />
              <line
                x1={HOME.x}
                y1={HOME.y}
                x2={activeCityObj.x}
                y2={activeCityObj.y}
                stroke="#38bdf8"
                strokeWidth="2.8"
                strokeDasharray="6 6"
                className="animate-route-dash opacity-95"
              />
            </g>
          )}

          {CITIES.map((city) => {
            const isArrayName = Array.isArray(city.name);
            const isHovered = hoveredCity === city.id;

            return (
              <g
                key={city.id}
                className="cursor-pointer transition-transform duration-300 ease-out"
                style={{
                  transformOrigin: `${city.x}px ${city.y}px`,
                  transform: isHovered ? 'scale(1.15) translateY(-6px)' : 'scale(1) translateY(0)',
                }}
                onMouseEnter={() => setHoveredCity(city.id)}
                onMouseLeave={() => setHoveredCity(null)}
                onClick={() => handleCityClick(city.id)}
              >
                <circle cx={city.x} cy={city.y} r="40" className="fill-transparent" />

                {isHovered && (
                  <circle cx={city.x} cy={city.y} r="14" className="fill-cyan-400/30 blur-sm transition-all" />
                )}

                <circle
                  cx={city.x}
                  cy={city.y}
                  r="6.0"
                  className={`transition-all duration-300 ${
                    isHovered
                      ? 'fill-cyan-400 stroke-cyan-100 stroke-[3.5] drop-shadow-[0_0_10px_rgba(34,211,238,1)]'
                      : 'fill-none stroke-cyan-400 stroke-[2.7]'
                  }`}
                />

                <text
                  x={city.x + (city.dx || 0)}
                  y={city.y + (city.dy || 0)}
                  textAnchor={city.anchor}
                  style={{ fontSize: '22px' }}
                  className={`transition-all duration-300 font-semibold tracking-wide select-none ${
                    isHovered
                      ? 'fill-white drop-shadow-[0_0_12px_rgba(34,211,238,0.95)]'
                      : 'fill-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                  }`}
                >
                  {isArrayName ? (
                    city.name.map((line, index) => (
                      <tspan key={index} x={city.x + (city.dx || 0)} dy={index === 0 ? 0 : '1.2em'}>
                        {line}
                      </tspan>
                    ))
                  ) : (
                    city.name
                  )}
                </text>
              </g>
            );
          })}

          <g
            className="cursor-pointer transition-transform duration-300 ease-out"
            style={{
              transformOrigin: `${HOME.x}px ${HOME.y}px`,
              transform: isHomeHovered ? 'scale(1.12) translateY(-4px)' : 'scale(1) translateY(0)',
            }}
            onMouseEnter={() => setHoveredCity(HOME.id)}
            onMouseLeave={() => setHoveredCity(null)}
            onClick={() => handleCityClick(HOME.id)}
          >
            <circle cx={HOME.x} cy={HOME.y} r="50" className="fill-transparent" />
            <circle
              cx={HOME.x}
              cy={HOME.y}
              r="18"
              className={`transition-opacity duration-300 fill-cyan-400/30 blur-md ${
                isHomeHovered ? 'opacity-100' : 'opacity-40'
              }`}
            />
            <circle
              cx={HOME.x}
              cy={HOME.y}
              r="10.0"
              className={`transition-all duration-300 ${
                isHomeHovered
                  ? 'fill-cyan-300 stroke-white stroke-[2.5] drop-shadow-[0_0_14px_rgba(34,211,238,1)]'
                  : 'fill-cyan-400 stroke-slate-950 stroke-[2]'
              }`}
            />
            <text
              x={HOME.x}
              y={HOME.y - 48}
              textAnchor="middle"
              style={{ fontSize: '15px' }}
              className={`transition-all duration-300 font-bold tracking-widest fill-cyan-200 uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] ${
                isHomeHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              (SEDE)
            </text>
            <text
              x={HOME.x}
              y={HOME.y - 22}
              textAnchor="middle"
              style={{ fontSize: '22px' }}
              className={`transition-all duration-300 font-bold tracking-wider uppercase select-none ${
                isHomeHovered
                  ? 'fill-white drop-shadow-[0_0_12px_rgba(34,211,238,1)]'
                  : 'fill-cyan-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]'
              }`}
            >
              {HOME.name}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}