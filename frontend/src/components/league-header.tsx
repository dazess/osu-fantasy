import Image from "next/image"
import Link from "next/link"

export function LeagueHeader() {
  return (
    <header className="border-b border-slate-600/50 bg-[#3d4f5f]/60 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <Image src="/esports-tournament-logo.png" alt="League Logo" width={40} height={40} className="rounded" />
          </div>
          <h1 className="text-lg font-semibold text-slate-200">HLTV x Hellcase league</h1>
        </div>
        <nav className="flex gap-6">
          <Link href="#" className="text-sm text-slate-300 transition-colors hover:text-white">
            Event overview
          </Link>
          <Link href="#" className="text-sm text-slate-300 transition-colors hover:text-white">
            My teams
          </Link>
        </nav>
      </div>
    </header>
  )
}
