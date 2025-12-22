interface LeaderboardEntry {
  rank: number
  username: string
  flag: string
  user: string
  rating: number
  team: number
  roleBoost: string
  total: number
}

export function Leaderboard() {
  const entries: LeaderboardEntry[] = [
    {
      rank: 1,
      username: "loko",
      flag: "🇵🇱",
      user: "Lolko123",
      rating: 205,
      team: 54,
      roleBoost: "49 / 60",
      total: 368,
    },
    {
      rank: 2,
      username: "sdevvtgbyb",
      flag: "🇵🇱",
      user: "PjeLSjPj",
      rating: 205,
      team: 54,
      roleBoost: "52 / 55",
      total: 366,
    },
    {
      rank: 3,
      username: "Hard4ence",
      flag: "🇫🇮",
      user: "Mibrdisband",
      rating: 205,
      team: 54,
      roleBoost: "46 / 60",
      total: 365,
    },
    {
      rank: 4,
      username: "crzymenz111",
      flag: "🇵🇱",
      user: "crazyflukensen",
      rating: 205,
      team: 54,
      roleBoost: "45 / 60",
      total: 364,
    },
  ]

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇"
    if (rank === 2) return "🥈"
    if (rank === 3) return "🥉"
    return `#${rank}`
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-[#f39c12]"
    if (rank === 2) return "text-slate-300"
    if (rank === 3) return "text-[#cd7f32]"
    return "text-slate-400"
  }

  return (
    <section className="bg-[#34495e] py-12">
      <div className="container mx-auto px-6">
        <h3 className="mb-8 text-3xl font-bold text-slate-200">Leaderboard</h3>

        <div className="overflow-hidden rounded-lg bg-[#2c3e50]/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600/50 bg-[#3d4f5f]/60 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4 text-left font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left font-semibold">User</th>
                  <th className="px-6 py-4 text-right font-semibold">Rating</th>
                  <th className="px-6 py-4 text-right font-semibold">Team</th>
                  <th className="px-6 py-4 text-right font-semibold">Role / Boost</th>
                  <th className="px-6 py-4 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index} className="border-b border-slate-700/50 transition-colors hover:bg-slate-700/20">
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${getRankColor(entry.rank)}`}>
                        {getRankBadge(entry.rank)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{entry.flag}</span>
                        <div>
                          <p className="font-semibold text-slate-200">{entry.user}</p>
                          <p className="text-sm text-slate-400">{entry.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300">{entry.rating}</td>
                    <td className="px-6 py-4 text-right text-slate-300">{entry.team}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{entry.roleBoost}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-bold text-slate-200">{entry.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
