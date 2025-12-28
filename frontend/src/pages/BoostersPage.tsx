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

interface Booster {
  id: number;
  name: string;
  description: string;
  activation: string;
  points: string;
}

interface PlayerBooster {
  playerId: number;
  boosterId: number | null;
}

const API_BASE = 'http://localhost:8000';

// Define all available boosters based on the provided document
const BOOSTERS: Booster[] = [
  {
    id: 2,
    name: 'Captain',
    activation: 'The chosen player has led his team to victory',
    points: '+5 points if success, -5 if not',
    description: 'Player must be on the winning team'
  },
  {
    id: 3,
    name: 'Noob',
    activation: 'The chosen player has the lowest p-score in a lobby',
    points: '+5 points if success, -2 if not',
    description: 'Players who did not play have a p-score of 1'
  },
  {
    id: 4,
    name: '727WYSI',
    activation: 'The chosen player gets a score or combo with "727" in it',
    points: '+7 points if success, no penalty',
    description: 'Look for 727 anywhere in the score or combo on any map'
  },
  {
    id: 5,
    name: 'Boshyman741',
    activation: 'The chosen player only shows up on one map and top scores it',
    points: '+5 points if success, -5 penalty',
    description: 'Must play exactly 1 map and have the highest score on it'
  },
  {
    id: 6,
    name: 'They Picked DT2',
    activation: 'The chosen player gets a B rank on any DT map',
    points: '+6 points if success, -2 penalty',
    description: 'Any DT map with B rank activates this'
  },
  {
    id: 7,
    name: 'Faker',
    activation: 'The chosen player has the highest p-score (≥ 1.8) in a lobby',
    points: '+5 points if success, -5 penalty',
    description: 'Must have the highest p-score and it must be at least 1.8'
  },
  {
    id: 8,
    name: 'LETS GO GAMBLING',
    activation: 'The chosen player S ranks 3 maps in a row',
    points: '+10 points if success, -10 penalty',
    description: 'Three consecutive S ranks required'
  },
  {
    id: 9,
    name: 'ITS OVER 9000(k)',
    activation: 'The chosen player scores over 900k on any map',
    points: '+5 points if success, -5 penalty',
    description: 'Single map score must exceed 900,000'
  },
  {
    id: 10,
    name: 'TB HYPE',
    activation: 'The chosen player gets to play the tiebreaker map',
    points: '+3 points if success, no penalty',
    description: 'Showcases count as playing the TB'
  },
  {
    id: 11,
    name: 'OVERWORKING',
    activation: 'The chosen player played every map in a lobby',
    points: '+5 points if success, -5 penalty',
    description: 'Must play all maps in the lobby'
  },
  {
    id: 12,
    name: 'Inconsistent',
    activation: 'The chosen player gets lower than 1000 combo on every map',
    points: 'TBD',
    description: 'All maps must have combo under 1000'
  },
];

export default function BoostersPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerBoosters, setPlayerBoosters] = useState<PlayerBooster[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamData();
  }, []);

  async function fetchTeamData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch the user's team
      const teamRes = await fetch(`${API_BASE}/api/team?tournament=owc2025`, {
        credentials: 'include'
      });

      if (!teamRes.ok) {
        throw new Error('Failed to fetch team. Please create a team first.');
      }

      const teamData = await teamRes.json();
      const playerIds = teamData.player_ids || [];

      if (playerIds.length === 0) {
        throw new Error('No players in your team. Please add players first.');
      }

      // Fetch all players to get their details
      const playersRes = await fetch(`${API_BASE}/api/players?tournament=owc2025`, {
        credentials: 'include'
      });

      if (!playersRes.ok) throw new Error('Failed to fetch players');
      const playersData = await playersRes.json();

      // Filter to only the players in the user's team
      const teamPlayers = playersData.players.filter((p: Player) => playerIds.includes(p.id));
      setPlayers(teamPlayers);

      // Initialize player boosters (all set to null initially)
      const initialBoosters = teamPlayers.map((p: Player) => ({
        playerId: p.id,
        boosterId: null
      }));
      setPlayerBoosters(initialBoosters);

      // Fetch existing booster selections from backend
      if (teamData.boosters && Object.keys(teamData.boosters).length > 0) {
        const loadedBoosters = teamPlayers.map((p: Player) => ({
          playerId: p.id,
          boosterId: teamData.boosters[p.id.toString()] || null
        }));
        setPlayerBoosters(loadedBoosters);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function getPlayerBooster(playerId: number): number | null {
    const pb = playerBoosters.find(pb => pb.playerId === playerId);
    return pb?.boosterId || null;
  }

  function isBoosterUsed(boosterId: number): boolean {
    return playerBoosters.some(pb => pb.boosterId === boosterId);
  }

  function assignBooster(playerId: number, boosterId: number) {
    setPlayerBoosters(prev => {
      return prev.map(pb => {
        if (pb.playerId === playerId) {
          // If clicking the same booster, unassign it
          if (pb.boosterId === boosterId) {
            return { ...pb, boosterId: null };
          }
          // Otherwise assign the new booster
          return { ...pb, boosterId };
        }
        return pb;
      });
    });
  }

  async function saveBoosters() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert playerBoosters array to an object mapping player_id to booster_id
      const boostersMap: Record<number, number | null> = {};
      playerBoosters.forEach(pb => {
        if (pb.boosterId !== null) {
          boostersMap[pb.playerId] = pb.boosterId;
        }
      });

      // Save boosters to backend
      const res = await fetch(`${API_BASE}/api/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          player_ids: players.map(p => p.id),
          tournament: 'owc2025',
          boosters: boostersMap
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to save boosters');
      }

      setSuccess('Boosters saved successfully!');
      
      // Redirect to league page after 1 second
      setTimeout(() => {
        navigate('/league/owc2025');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save boosters');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#24222A] text-white flex items-center justify-center">
        <div className="text-xl">Loading your team...</div>
      </div>
    );
  }

  if (error && players.length === 0) {
    return (
      <div className="min-h-screen bg-[#24222A] text-white">
        <AuthButton />
        <div className="pt-4">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-6 py-4 rounded-lg mb-6">
              {error}
            </div>
            <button
              onClick={() => navigate('/league/owc2025/my-team')}
              className="button-texture bg-[#2a2a4e] hover:bg-[#3a3a5e] px-6 py-3 rounded-lg text-white"
            >
              Go to My Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#24222A] text-white">
      <AuthButton />
      <div className="pt-4">
        {/* Header */}
        <div className="bg-[#24222A] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate('/league/owc2025/my-team')}
              className="button-texture bg-[#2a2a4e] hover:bg-[#3a3a5e] px-4 py-2 rounded-lg flex items-center gap-2 text-white"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to My Team
            </button>
            <h1 className="text-2xl font-bold text-white">Pick Boosters - OWC 2025</h1>
            <button
              onClick={saveBoosters}
              disabled={saving}
              className="button-texture bg-[#f39c12] hover:bg-[#e67e22] disabled:bg-[#4a4a5e] disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold text-white"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-4">
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

          <div className="space-y-4">
            {/* Players - Horizontal Layout */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-bold text-white">Your Team</h2>
                <button
                  className="group relative p-1 hover:bg-[#2a2a4e] rounded transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4 text-[#9b59b6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {/* Tooltip */}
                  <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-[#1a1a2e] border border-white/20 rounded-lg shadow-xl z-10 w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
                    <p className="font-semibold text-sm text-white mb-1">How to use boosters:</p>
                    <p className="text-xs text-white/70 mb-1">
                      • Select a player from your team
                    </p>
                    <p className="text-xs text-white/70 mb-1">
                      • Click a booster to assign it
                    </p>
                    <p className="text-xs text-white/70 mb-1">
                      • Each booster can only be used once
                    </p>
                    <p className="text-xs text-white/70">
                      • Hover over boosters to see details
                    </p>
                  </div>
                </button>
              </div>
              <div className="flex gap-2">
                {players.map(player => {
                  const assignedBoosterId = getPlayerBooster(player.id);
                  const assignedBooster = assignedBoosterId ? BOOSTERS.find(b => b.id === assignedBoosterId) : null;
                  const isSelected = selectedPlayer === player.id;

                  return (
                    <div
                      key={player.id}
                      onClick={() => setSelectedPlayer(player.id)}
                      className={`bg-[#2a2a4e] rounded-lg p-2 cursor-pointer transition-all flex-1 ${
                        isSelected ? 'ring-2 ring-[#9b59b6] shadow-lg shadow-[#9b59b6]/20' : 'hover:bg-[#3a3a5e]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={player.avatar_url}
                          alt={player.username}
                          className="w-12 h-12 rounded-full border-2 border-white/10"
                        />
                        <div className="text-center w-full">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <img
                              src={`https://flagcdn.com/w40/${player.country.toLowerCase()}.png`}
                              alt={player.country}
                              className="w-4 h-3 object-cover rounded"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <span className="font-semibold text-white text-xs block truncate">{player.username}</span>
                        </div>
                        {assignedBooster && (
                          <div className="bg-[#9b59b6]/20 border border-[#9b59b6] px-2 py-0.5 rounded w-full">
                            <div className="text-[10px] font-semibold text-[#9b59b6] text-center truncate">{assignedBooster.name}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Boosters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">
                  {selectedPlayer ? `Boosters for ${players.find(p => p.id === selectedPlayer)?.username}` : 'Select a Player'}
                </h2>
                {selectedPlayer && (
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-xs text-white/50 hover:text-white/80"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {!selectedPlayer ? (
                <div className="bg-[#2a2a4e] rounded-lg p-4 text-center">
                  <svg className="w-6 h-6 mx-auto mb-2 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="text-white/50 text-xs">
                    Select a player from your team to assign a booster
                  </p>
                </div>
              ) : (
                <div className="bg-[#2a2a4e] rounded-lg p-3">
                  <div className="grid grid-cols-12 gap-1.5">
                    {BOOSTERS.map(booster => {
                      const isUsed = isBoosterUsed(booster.id);
                      const isAssignedToCurrent = getPlayerBooster(selectedPlayer) === booster.id;
                      const canSelect = !isUsed || isAssignedToCurrent;

                      return (
                        <div
                          key={booster.id}
                          onClick={() => canSelect && assignBooster(selectedPlayer, booster.id)}
                          className={`group rounded p-1 transition-all relative ${
                            isAssignedToCurrent
                              ? 'bg-[#9b59b6] cursor-pointer hover:bg-[#8e44ad] ring-1 ring-white/30'
                              : canSelect
                              ? 'bg-[#1a1a2e] cursor-pointer hover:bg-[#3a3a5e]'
                              : 'bg-[#0a0a1e] opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {/* Tooltip on hover */}
                          {canSelect && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a2e] border border-white/20 rounded-lg shadow-xl z-10 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
                              <h4 className="font-bold text-white text-sm mb-1">{booster.name}</h4>
                              <p className="text-xs text-white/70 mb-1">
                                <span className="font-semibold">Activation:</span> {booster.activation}
                              </p>
                              <p className="text-xs text-white/60 mb-1">{booster.description}</p>
                              <p className="text-xs text-green-400 font-semibold">{booster.points}</p>
                              {/* Arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-[#1a1a2e]"></div>
                            </div>
                          )}
                          
                          {/* Placeholder Image */}
                          <div className={`w-full aspect-square rounded flex items-center justify-center text-base ${
                            isAssignedToCurrent ? 'bg-white/20' : 'bg-white/5'
                          }`}>
                            {booster.id === 2 && '👑'}
                            {booster.id === 3 && '🆕'}
                            {booster.id === 4 && '🔢'}
                            {booster.id === 5 && '⭐'}
                            {booster.id === 6 && '⚡'}
                            {booster.id === 7 && '🎭'}
                            {booster.id === 8 && '🎰'}
                            {booster.id === 9 && '💯'}
                            {booster.id === 10 && '🎪'}
                            {booster.id === 11 && '💪'}
                            {booster.id === 12 && '📉'}
                          </div>
                          
                          {isAssignedToCurrent && (
                            <div className="absolute -top-0.5 -right-0.5">
                              <span className="bg-white/30 px-0.5 py-0.5 rounded text-[8px] text-white font-bold flex items-center justify-center w-3 h-3">
                                ✓
                              </span>
                            </div>
                          )}
                          {isUsed && !isAssignedToCurrent && (
                            <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                              <span className="text-[8px] text-white/60 font-semibold">X</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
