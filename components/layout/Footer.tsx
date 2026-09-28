export default function Footer() {
  return (
    <footer className="mt-auto border-t border-cyan-950 py-8 bg-[#020308] text-xs text-slate-500">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-300">LÚMEN 3D</span>
          <span> | Do digital ao real.</span>
        </div>

        <p>© {new Date().getFullYear()} Lúmen 3D. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}