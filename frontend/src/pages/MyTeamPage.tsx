import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthButton from '@/components/AuthButton';

interface Player {
  id: number;
  username: string;
  profile_url: string;
  avatar_url: string;
  country: string;
  cost: number;
  playing: boolean;
  p_score: number;
}

interface TeamData {
  player_ids: number[];
  budget_used: number;
  budget_remaining: number;
}

const API_BASE = 'http://localhost:8000';

export default function MyTeamPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [totalBudget, setTotalBudget] = useState(35000);
  const [maxTeamSize, setMaxTeamSize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  // Calculate budget used
  const budgetUsed = selectedIds.reduce((sum, id) => {
    const player = players.find(p => p.id === id);
    return sum + (player?.cost || 0);
  }, 0);
  const budgetRemaining = totalBudget - budgetUsed;

  // Get unique countries for filter
  const countries = [...new Set(players.map(p => p.country))].sort();

  // Filter players
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = !countryFilter || player.country === countryFilter;
    return matchesSearch && matchesCountry;
  });

  // Group players by country
  const playersByCountry = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.country]) {
      acc[player.country] = [];
    }
    acc[player.country].push(player);
    return acc;
  }, {} as Record<string, Player[]>);

  const sortedCountries = Object.keys(playersByCountry).sort();

  // Function to get country flag code
  const getCountryFlagCode = (country: string): string => {
    const flagMap: Record<string, string> = {
      'Argentina': 'ar',
      'Australia': 'au',
      'Austria': 'at',
      'Belgium': 'be',
      'Brazil': 'br',
      'Canada': 'ca',
      'Chile': 'cl',
      'China': 'cn',
      'Colombia': 'co',
      'Czech Republic': 'cz',
      'Denmark': 'dk',
      'Finland': 'fi',
      'France': 'fr',
      'Germany': 'de',
      'Greece': 'gr',
      'Hong Kong': 'hk',
      'Indonesia': 'id',
      'Ireland': 'ie',
      'Israel': 'il',
      'Italy': 'it',
      'Japan': 'jp',
      'Latvia': 'lv',
      'Lithuania': 'lt',
      'Malaysia': 'my',
      'Mexico': 'mx',
      'Netherlands': 'nl',
      'New Zealand': 'nz',
      'Norway': 'no',
      'Peru': 'pe',
      'Philippines': 'ph',
      'Poland': 'pl',
      'Portugal': 'pt',
      'Romania': 'ro',
      'Russia': 'ru',
      'Singapore': 'sg',
      'South Korea': 'kr',
      'Spain': 'es',
      'Sweden': 'se',
      'Switzerland': 'ch',
      'Taiwan': 'tw',
      'Thailand': 'th',
      'Turkey': 'tr',
      'Ukraine': 'ua',
      'United Kingdom': 'gb',
      'United States': 'us',
      'Uruguay': 'uy',
      'Vietnam': 'vn',
    };
    return flagMap[country] || 'un';
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch players
      const playersRes = await fetch(`${API_BASE}/api/players?tournament=owc2025`, {
        credentials: 'include'
      });
      if (!playersRes.ok) throw new Error('Failed to fetch players');
      const playersData = await playersRes.json();
      
      // Filter only playing players
      const playingPlayers = playersData.players.filter((p: Player) => p.playing);
      setPlayers(playingPlayers);
      setTotalBudget(playersData.total_budget);
      setMaxTeamSize(playersData.max_team_size);

      // Fetch current team (if authenticated)
      try {
        const teamRes = await fetch(`${API_BASE}/api/team?tournament=owc2025`, {
          credentials: 'include'
        });
        if (teamRes.ok) {
          const teamData: TeamData = await teamRes.json();
          setSelectedIds(teamData.player_ids || []);
        }
      } catch {
        // Not authenticated or no team yet - that's fine
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function togglePlayer(playerId: number) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (selectedIds.includes(playerId)) {
      // Remove player
      setSelectedIds(selectedIds.filter(id => id !== playerId));
    } else {
      // Add player (check budget and team size)
      if (selectedIds.length >= maxTeamSize) {
        setError(`Maximum team size is ${maxTeamSize} players`);
        return;
      }
      if (budgetUsed + player.cost > totalBudget) {
        setError('Not enough budget for this player');
        return;
      }
      setSelectedIds([...selectedIds, playerId]);
      setError(null);
    }
  }

  async function saveTeam() {
    // Validate before saving
    if (selectedIds.length !== maxTeamSize) {
      setError(`Please select exactly ${maxTeamSize} players`);
      return;
    }

    if (budgetRemaining < 0) {
      setError(`Total cost exceeds budget by $${Math.abs(budgetRemaining)}`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          player_ids: selectedIds,
          tournament: 'owc2025'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save team');
      }

      setSuccess('Team saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  }

  const selectedPlayers = players.filter(p => selectedIds.includes(p.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] text-white flex items-center justify-center">
        <div className="text-xl">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <AuthButton />
      <div className="pt-4">
      {/* Header */}
      <div className="bg-[#16162a] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/league/owc2025')}
            className="button-texture bg-[#2a2a4e] hover:bg-[#3a3a5e] px-4 py-2 rounded-lg flex items-center gap-2 text-white"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">My Team - OWC 2025</h1>
          <button
            onClick={saveTeam}
            disabled={saving || selectedIds.length !== maxTeamSize || budgetRemaining < 0}
            className="button-texture bg-[#f39c12] hover:bg-[#e67e22] disabled:bg-[#4a4a5e] disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold text-white"
          >
            {saving ? 'Saving...' : 'Save Team'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Budget Bar */}
        <div className="bg-[#2a2a4e] rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold text-white">Budget</span>
            <span className={`text-lg font-bold ${budgetRemaining < 10 ? 'text-red-400' : 'text-green-400'}`}>
              {budgetRemaining} / {totalBudget} remaining
            </span>
          </div>
          <div className="w-full bg-[#1a1a2e] rounded-full h-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${budgetRemaining < 10 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${(budgetRemaining / totalBudget) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-white">
            Team: {selectedIds.length} / {maxTeamSize} players
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selected Team */}
          <div className="lg:col-span-1">
            <div className="bg-[#2a2a4e] rounded-xl p-4 sticky top-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <svg className="text-[#f39c12]" style={{ width: 20, height: 20 }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                Your Team ({selectedIds.length}/{maxTeamSize})
              </h2>

              {selectedPlayers.length === 0 ? (
                <div className="text-white text-center py-8">
                  Click on players to add them to your team
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPlayers.map(player => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 bg-[#1a1a2e] rounded-lg p-3 group"
                    >
                      <button
                        type="button"
                        onClick={() => togglePlayer(player.id)}
                        className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#f39c12] focus:ring-offset-2 focus:ring-offset-[#1a1a2e]"
                        title={`Remove ${player.username}`}
                      >
                        <img
                          src={player.avatar_url || `https://a.ppy.sh/${player.id}`}
                          alt={player.username}                          className="rounded-full object-cover"
                          style={{ width: 60, height: 60 }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://osu.ppy.sh/images/layout/avatar-guest.png';
                          }}
                        />
                      </button>
                      
                      <div className="flex-1 min-w-0" style={{ marginLeft: '8px' }}>
                        <div className="font-medium truncate text-white">{player.username}</div>
                        <div className="text-sm text-white">{player.country}</div>
                        <div className="text-[#f39c12] font-bold shrink-0">${player.cost}</div>
                      </div>
                      <button
                        onClick={() => togglePlayer(player.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 shrink-0"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex  text-lg text-white">
                  <span className="text-white" >Total Cost:</span>
                  <span className="font-bold text-[#f39c12]" style={{ marginLeft: '8px' }}>${budgetUsed}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Player Selection */}
          <div className="lg:col-span-2">
            <div className="bg-[#2a2a4e] rounded-xl p-4">
              <h2 className="text-xl font-bold mb-4 text-white">Available Players ({filteredPlayers.length})</h2>

              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f39c12] text-white placeholder-white/50"
                />
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-[#f39c12] text-white"
                >
                  <option value="">All Countries</option>
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              {/* Players Grouped by Country */}
              <div className="max-h-150 overflow-y-auto pr-2 space-y-6">
                {sortedCountries.map(country => (
                  <div key={country}>
                    <h3 className="text-2xl font-bold text-white mb-4 border-b-2 border-white/30 pb-3 flex items-center gap-8">
                      <img 
                        src={`https://flagcdn.com/48x36/${getCountryFlagCode(country)}.png`}
                        alt={`${country} flag`}
                        className="w-12 h-9 object-cover rounded shadow-md"
                      />
                      <span className="text-white" style={{ marginLeft: '8px' }}>{country}</span>
                    </h3>
                    <div className="grid grid-cols-8 gap-2">
                      {playersByCountry[country].map(player => {
                        const isSelected = selectedIds.includes(player.id);
                        const canAfford = budgetRemaining >= player.cost || isSelected;
                        const teamFull = selectedIds.length >= maxTeamSize;
                        const canSelect = isSelected || (!teamFull && canAfford);

                        return (
                          <button
                            key={player.id}
                            onClick={() => togglePlayer(player.id)}
                            disabled={!canSelect}
                            className={`
                              button-texture flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                              ${isSelected
                                ? 'bg-[#f39c12]/20 border-2 border-[#f39c12]'
                                : canSelect
                                  ? 'bg-[#1a1a2e] hover:bg-[#252545] border-2 border-transparent'
                                  : 'bg-[#1a1a2e] opacity-40 cursor-not-allowed border-2 border-transparent grayscale'
                              }
                            `}
                          >
                            <div className="relative">
                              <img
                                src={player.avatar_url || `https://a.ppy.sh/${player.id}`}
                                alt={player.username}
                                className="rounded-full object-cover"
                                style={{ width: 48, height: 48 }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://osu.ppy.sh/images/layout/avatar-guest.png';
                                }}
                              />
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 bg-[#f39c12] rounded-full w-5 h-5 flex items-center justify-center">
                                  <svg style={{ width: 10, height: 10 }} fill="white" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-medium truncate w-full text-center text-white">
                              {player.username}
                            </div>
                            <div className={`text-xs font-bold ${isSelected ? 'text-[#f39c12]' : 'text-green-400'}`}>
                              ${player.cost}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
