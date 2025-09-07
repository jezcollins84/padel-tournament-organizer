
import React, { useState, useEffect, createContext, useContext, useReducer } from 'react';
import './App.css';

// Context and initial state setup
const TournamentContext = createContext();
const initialState = {
  tournaments: [],
  currentView: 'dashboard',
  currentTournament: null,
  isLoading: false,
  error: null,
};

// Reducer for tournaments
function tournamentReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_TOURNAMENTS':
      return { ...state, tournaments: action.payload };
    case 'ADD_TOURNAMENT':
      return { ...state, tournaments: [...state.tournaments, action.payload] };
    case 'UPDATE_TOURNAMENT':
      return {
        ...state,
        tournaments: state.tournaments.map(t =>
          t.id === action.payload.id ? action.payload : t
        ),
        currentTournament:
          action.payload.id === state.currentTournament?.id
            ? action.payload
            : state.currentTournament,
      };
    case 'DELETE_TOURNAMENT':
      return {
        ...state,
        tournaments: state.tournaments.filter(t => t.id !== action.payload),
      };
    case 'SET_VIEW':
      return {
        ...state,
        currentView: action.payload.view,
        currentTournament: action.payload.tournament,
      };
    default:
      return state;
  }
}

// Americano scheduling algorithm
const generateAmericanoSchedule = players => {
  if (players.length < 4 || players.length % 4 !== 0) {
    throw new Error('Americano format requires multiples of 4 players');
  }
  const rounds = [];
  const playerIds = players.map(p => p.id);
  const totalRounds = Math.min(Math.floor((players.length - 1) * 3 / 4), 8);

  // Track partnerships and opponents for each player
  const partnerships = {};
  const opponents = {};
  playerIds.forEach(id => {
    partnerships[id] = new Set();
    opponents[id] = new Set();
  });

  // Generate rounds
  for (let round = 0; round < totalRounds; round++) {
    const matches = [];
    const availablePlayers = [...playerIds];
    while (availablePlayers.length >= 4) {
      let bestMatch = null;
      let minConflicts = Infinity;
      for (let i = 0; i < availablePlayers.length - 3; i++) {
        for (let j = i + 1; j < availablePlayers.length - 2; j++) {
          for (let k = j + 1; k < availablePlayers.length - 1; k++) {
            for (let l = k + 1; l < availablePlayers.length; l++) {
              const p1 = availablePlayers[i];
              const p2 = availablePlayers[j];
              const p3 = availablePlayers[k];
              const p4 = availablePlayers[l];
              const conflicts =
                (partnerships[p1].has(p2) ? 1 : 0) +
                (partnerships[p3].has(p4) ? 1 : 0) +
                (opponents[p1].has(p3) ? 1 : 0) +
                (opponents[p1].has(p4) ? 1 : 0) +
                (opponents[p2].has(p3) ? 1 : 0) +
                (opponents[p2].has(p4) ? 1 : 0);
              if (conflicts < minConflicts) {
                minConflicts = conflicts;
                bestMatch = { team1: [p1, p2], team2: [p3, p4] };
              }
            }
          }
        }
      }
      if (bestMatch) {
        const match = {
          id: `round-${round}-match-${matches.length}`,
          team1: bestMatch.team1,
          team2: bestMatch.team2,
          court: matches.length + 1,
          score: { team1: 0, team2: 0 },
          status: 'pending',
        };
        matches.push(match);

        // Update partnerships and opponents tracking
        partnerships[bestMatch.team1[0]].add(bestMatch.team1[1]);
        partnerships[bestMatch.team1[1]].add(bestMatch.team1[0]);
        partnerships[bestMatch.team2[0]].add(bestMatch.team2[1]);
        partnerships[bestMatch.team2[1]].add(bestMatch.team2[0]);
        bestMatch.team1.forEach(p1 => {
          bestMatch.team2.forEach(p2 => {
            opponents[p1].add(p2);
            opponents[p2].add(p1);
          });
        });

        // Remove used players
        [bestMatch.team1[0], bestMatch.team1[1], bestMatch.team2[0], bestMatch.team2[1]].forEach(
          pid => {
            const index = availablePlayers.indexOf(pid);
            if (index > -1) availablePlayers.splice(index, 1);
          }
        );
      } else {
        break;
      }
    }
    if (matches.length > 0) {
      rounds.push({
        id: `round-${round}`,
        roundNumber: round + 1,
        matches,
        status: round === 0 ? 'active' : 'pending',
      });
    }
  }
  return rounds;
};

// Calculate leaderboard from matches
const calculateLeaderboard = (players, rounds) => {
  const stats = {};
  players.forEach(player => {
    stats[player.id] = {
      id: player.id,
      name: player.name,
      matchesPlayed: 0,
      matchesWon: 0,
      setsWon: 0,
      setsLost: 0,
      points: 0,
    };
  });
  
  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (match.status === 'completed') {
        const team1Players = match.team1;
        const team2Players = match.team2;
        const team1Score = match.score.team1;
        const team2Score = match.score.team2;
        
        [...team1Players, ...team2Players].forEach(playerId => {
          if (stats[playerId]) {
            stats[playerId].matchesPlayed++;
            if (team1Players.includes(playerId)) {
              stats[playerId].setsWon += team1Score;
              stats[playerId].setsLost += team2Score;
            } else {
              stats[playerId].setsWon += team2Score;
              stats[playerId].setsLost += team1Score;
            }
          }
        });
        
        if (team1Score > team2Score) {
          team1Players.forEach(playerId => {
            if (stats[playerId]) {
              stats[playerId].matchesWon++;
              stats[playerId].points += 3;
            }
          });
          team2Players.forEach(playerId => {
            if (stats[playerId]) {
              stats[playerId].points += 1;
            }
          });
        } else if (team2Score > team1Score) {
          team2Players.forEach(playerId => {
            if (stats[playerId]) {
              stats[playerId].matchesWon++;
              stats[playerId].points += 3;
            }
          });
          team1Players.forEach(playerId => {
            if (stats[playerId]) {
              stats[playerId].points += 1;
            }
          });
        } else {
          [...team1Players, ...team2Players].forEach(playerId => {
            if (stats[playerId]) {
              stats[playerId].points += 2;
            }
          });
        }
      }
    });
  });
  
  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    return b.setsWon - b.setsLost - (a.setsWon - a.setsLost);
  });
};

// Tournament Provider
const TournamentProvider = ({ children }) => {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);

  useEffect(() => {
    const savedTournaments = localStorage.getItem('padel_tournaments');
    if (savedTournaments) {
      try {
        const tournaments = JSON.parse(savedTournaments);
        dispatch({ type: 'SET_TOURNAMENTS', payload: tournaments });
        const urlParams = new URLSearchParams(window.location.search);
        const tournamentId = urlParams.get('tournament');
        if (tournamentId) {
          const tournament = tournaments.find(t => t.id === tournamentId);
          if (tournament) {
            dispatch({
              type: 'SET_VIEW',
              payload: { view: 'tournament-public', tournament },
            });
          }
        }
      } catch (error) {
        console.error('Error loading tournaments:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('padel_tournaments', JSON.stringify(state.tournaments));
  }, [state.tournaments]);

  return (
    <TournamentContext.Provider value={{ state, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
};

const useTournaments = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournaments must be used within TournamentProvider');
  }
  return context;
};

// Main App component
function App() {
  return (
    <TournamentProvider>
      <div className="App">
        <Router />
      </div>
    </TournamentProvider>
  );
}

// Simple Router
const Router = () => {
  const { state } = useTournaments();
  return (
    <div>
      <Header />
      {state.currentView === 'dashboard' && <Dashboard />}
      {state.currentView === 'tournament-admin' && <TournamentAdmin />}
      {state.currentView === 'tournament-public' && <TournamentPublic />}
    </div>
  );
};

// Header component
const Header = () => {
  const { state, dispatch } = useTournaments();
  return (
    <header className="app-header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🎾</span>
            <div>
              <h1>Padel Americano</h1>
              <p>Tournament Organizer</p>
            </div>
          </div>
          {state.currentView !== 'dashboard' && (
            <button
              onClick={() =>
                dispatch({
                  type: 'SET_VIEW',
                  payload: { view: 'dashboard', tournament: null },
                })
              }
              className="btn btn-secondary"
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

// Dashboard component
const Dashboard = () => {
  const { state, dispatch } = useTournaments();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const activeTournaments = state.tournaments.filter(
    t => t.status === 'active' || t.status === 'in_progress'
  );
  
  return (
    <div className="container main-content">
      <div className="dashboard-header">
        <div>
          <h2>Tournament Dashboard</h2>
          <p>Manage up to 3 active tournaments</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          disabled={activeTournaments.length >= 3}
          className="btn btn-primary"
        >
          + New Tournament
        </button>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div>
            <div className="stat-number">{activeTournaments.length}</div>
            <div className="stat-label">Active Tournaments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div>
            <div className="stat-number">
              {activeTournaments.reduce((sum, t) => sum + t.players.length, 0)}
            </div>
            <div className="stat-label">Total Players</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div>
            <div className="stat-number">
              {activeTournaments.reduce(
                (sum, t) => sum + (t.schedule?.length || 0),
                0
              )}
            </div>
            <div className="stat-label">Total Rounds</div>
          </div>
        </div>
      </div>
      
      {showCreateForm && (
        <CreateTournamentForm onClose={() => setShowCreateForm(false)} />
      )}
      
      <div className="tournaments-list">
        {activeTournaments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎾</div>
            <h3>No Active Tournaments</h3>
            <p>Create your first Americano tournament to get started</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          activeTournaments.map(tournament => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))
        )}
      </div>
    </div>
  );
};

// Create Tournament Form
const CreateTournamentForm = ({ onClose }) => {
  const { dispatch } = useTournaments();
  const [formData, setFormData] = useState({
    name: '',
    courts: 2,
    matchDuration: 15,
    breakDuration: 5,
  });
  const [errors, setErrors] = useState({});

  const generateAdminCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };
  
  const handleSubmit = e => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Tournament name is required';
    if (formData.courts < 1 || formData.courts > 10)
      newErrors.courts = 'Courts must be between 1-10';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const tournament = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      adminCode: generateAdminCode(),
      courts: parseInt(formData.courts),
      matchDuration: parseInt(formData.matchDuration),
      breakDuration: parseInt(formData.breakDuration),
      players: [],
      schedule: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    
    dispatch({ type: 'ADD_TOURNAMENT', payload: tournament });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Create New Tournament</h2>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label>Tournament Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekend Championship"
              />
              {errors.name && <span className="error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Number of Courts</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.courts}
                onChange={e => setFormData({ ...formData, courts: e.target.value })}
              />
              {errors.courts && <span className="error">{errors.courts}</span>}
            </div>
            <div className="form-group">
              <label>Match Duration (minutes)</label>
              <input
                type="number"
                min="10"
                max="60"
                value={formData.matchDuration}
                onChange={e =>
                  setFormData({ ...formData, matchDuration: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Break Duration (minutes)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={formData.breakDuration}
                onChange={e =>
                  setFormData({ ...formData, breakDuration: e.target.value })
                }
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Tournament
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Tournament Card
const TournamentCard = ({ tournament }) => {
  const { dispatch } = useTournaments();
  const completedMatches =
    tournament.schedule?.reduce(
      (sum, round) =>
        sum + round.matches.filter(m => m.status === 'completed').length,
      0
    ) || 0;
  const totalMatches =
    tournament.schedule?.reduce((sum, round) => sum + round.matches.length, 0) ||
    0;
    
  const copyPublicLink = () => {
    const publicLink = `${window.location.origin}?tournament=${tournament.id}`;
    navigator.clipboard.writeText(publicLink)
      .then(() => {
        alert('Public link copied to clipboard!');
      })
      .catch(() => {
        prompt('Copy this link:', publicLink);
      });
  };
  
  return (
    <div className="tournament-card">
      <div className="tournament-card-header">
        <div className="tournament-info">
          <h3>{tournament.name}</h3>
          <p>
            {tournament.players.length} players, {tournament.courts} courts
          </p>
          <div className="tournament-meta">
            <span className={`status ${tournament.status}`}>
              {tournament.status.replace('_', ' ')}
            </span>
            <span>Admin Code: {tournament.adminCode}</span>
          </div>
        </div>
        <div className="tournament-actions">
          <button
            onClick={() =>
              dispatch({
                type: 'SET_VIEW',
                payload: { view: 'tournament-admin', tournament },
              })
            }
            className="btn btn-primary"
          >
            Manage
          </button>
          <button onClick={copyPublicLink} className="btn btn-secondary">
            Copy Link
          </button>
        </div>
      </div>
      
      {tournament.schedule.length > 0 && (
        <div className="tournament-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: totalMatches > 0 ? `${(completedMatches / totalMatches) * 100}%` : '0%' 
              }}
            />
          </div>
          <p>
            {completedMatches} of {totalMatches} matches completed
          </p>
        </div>
      )}
    </div>
  );
};

// Tournament Admin view
const TournamentAdmin = () => {
  const { state } = useTournaments();
  const [activeTab, setActiveTab] = useState('players');
  const tournament = state.currentTournament;

  if (!tournament) {
    return <div>Tournament not found</div>;
  }

  return (
    <div className="container main-content">
      <div className="tournament-admin-header">
        <div>
          <h2>{tournament.name}</h2>
          <p>Admin Code: {tournament.adminCode}</p>
        </div>
      </div>
      
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('players')}
          className={`tab ${activeTab === 'players' ? 'active' : ''}`}
        >
          Players ({tournament.players.length})
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
        >
          Schedule ({tournament.schedule.length} rounds)
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
        >
          Leaderboard
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'players' && <PlayersTab tournament={tournament} />}
        {activeTab === 'schedule' && <ScheduleTab tournament={tournament} />}
        {activeTab === 'leaderboard' && <LeaderboardTab tournament={tournament} />}
      </div>
    </div>
  );
};

// Players Tab
const PlayersTab = ({ tournament }) => {
  const { dispatch } = useTournaments();
  const [newPlayerName, setNewPlayerName] = useState('');

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newPlayer = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
    };
    const updatedTournament = {
      ...tournament,
      players: [...tournament.players, newPlayer],
    };
    dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
    setNewPlayerName('');
  };

  const removePlayer = playerId => {
    if (tournament.schedule.length > 0) {
      alert('Cannot remove players after schedule is generated');
      return;
    }
    const updatedTournament = {
      ...tournament,
      players: tournament.players.filter(p => p.id !== playerId),
    };
    dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
  };

  const generateSchedule = () => {
    if (tournament.players.length < 4) {
      alert('Need at least 4 players to generate schedule');
      return;
    }
    if (tournament.players.length % 4 !== 0) {
      alert(
        'Americano format requires multiples of 4 players (4, 8, 12, 16, etc.)'
      );
      return;
    }

    try {
      const schedule = generateAmericanoSchedule(tournament.players);
      const updatedTournament = {
        ...tournament,
        schedule,
        status: 'in_progress',
      };
      dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
      alert('Schedule generated successfully!');
    } catch (error) {
      alert('Error generating schedule: ' + error.message);
    }
  };

  return (
    <div>
      <div className="add-player-form">
        <input
          type="text"
          value={newPlayerName}
          onChange={e => setNewPlayerName(e.target.value)}
          placeholder="Enter player name"
          onKeyPress={e => e.key === 'Enter' && addPlayer()}
        />
        <button onClick={addPlayer} className="btn btn-primary">
          Add Player
        </button>
      </div>
      
      <div className="players-list">
        {tournament.players.map(player => (
          <div key={player.id} className="player-item">
            <span>{player.name}</span>
            <button
              onClick={() => removePlayer(player.id)}
              className="btn btn-danger btn-small"
              disabled={tournament.schedule.length > 0}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      
      {tournament.players.length >= 4 && tournament.schedule.length === 0 && (
        <button
          onClick={generateSchedule}
          className="btn btn-success"
        >
          🎯 Generate Tournament Schedule
        </button>
      )}
      
      {tournament.players.length > 0 && tournament.players.length % 4 !== 0 && (
        <div className="warning">
          ⚠️ Americano format requires multiples of 4 players. 
          Current: {tournament.players.length} players. 
          Add {4 - (tournament.players.length % 4)} more players.
        </div>
      )}
    </div>
  );
};

// Schedule Tab
const ScheduleTab = ({ tournament }) => {
  const { dispatch } = useTournaments();

  const updateScore = (roundId, matchId, team, score) => {
    const updatedSchedule = tournament.schedule.map(round => {
      if (round.id === roundId) {
        return {
          ...round,
          matches: round.matches.map(match => {
            if (match.id === matchId) {
              return {
                ...match,
                score: { ...match.score, [team]: parseInt(score) },
                status: 'in_progress',
              };
            }
            return match;
          }),
        };
      }
      return round;
    });

    const updatedTournament = { ...tournament, schedule: updatedSchedule };
    dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
  };

  const completeMatch = (roundId, matchId) => {
    const updatedSchedule = tournament.schedule.map(round => {
      if (round.id === roundId) {
        return {
          ...round,
          matches: round.matches.map(match => {
            if (match.id === matchId) {
              return { ...match, status: 'completed' };
            }
            return match;
          }),
        };
      }
      return round;
    });

    const updatedTournament = { ...tournament, schedule: updatedSchedule };
    dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
  };

  if (tournament.schedule.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Schedule Generated</h3>
        <p>Add players and generate a schedule to see matches here</p>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      {tournament.schedule.map(round => (
        <div key={round.id} className="round-section">
          <h3>Round {round.roundNumber}</h3>
          <div className="matches-grid">
            {round.matches.map(match => (
              <div key={match.id} className="match-card">
                <div className="match-header">
                  <span>Court {match.court}</span>
                  <span className={`status ${match.status}`}>
                    {match.status.toUpperCase()}
                  </span>
                </div>
                <div className="match-teams">
                  <div className="team">
                    <div className="team-names">
                      {match.team1.map(id => 
                        tournament.players.find(p => p.id === id)?.name || 'Unknown'
                      ).join(' + ')}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={match.score.team1}
                      onChange={e => updateScore(round.id, match.id, 'team1', e.target.value)}
                      className="score-input"
                    />
                  </div>
                  <div className="vs">VS</div>
                  <div className="team">
                    <div className="team-names">
                      {match.team2.map(id => 
                        tournament.players.find(p => p.id === id)?.name || 'Unknown'
                      ).join(' + ')}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={match.score.team2}
                      onChange={e => updateScore(round.id, match.id, 'team2', e.target.value)}
                      className="score-input"
                    />
                  </div>
                </div>
                {match.status !== 'completed' && (
                  <button
                    onClick={() => completeMatch(round.id, match.id)}
                    className="btn btn-primary btn-small"
                  >
                    Complete Match
                  </button>
                )}
                {match.status === 'completed' && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    Score: {match.score.team1} - {match.score.team2}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Leaderboard Tab
const LeaderboardTab = ({ tournament }) => {
  const leaderboard = calculateLeaderboard(tournament.players, tournament.schedule);

  return (
    <div className="leaderboard-container">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Points</th>
            <th>Matches Won</th>
            <th>Matches Played</th>
            <th>Sets Won</th>
            <th>Sets Lost</th>
            <th>Set Difference</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.id} className={index < 3 ? `rank-${index + 1}` : ''}>
              <td>{index + 1}</td>
              <td>{player.name}</td>
              <td>{player.points}</td>
              <td>{player.matchesWon}</td>
              <td>{player.matchesPlayed}</td>
              <td>{player.setsWon}</td>
              <td>{player.setsLost}</td>
              <td>{player.setsWon - player.setsLost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
// TournamentPublic (read-only public view, basic)
const TournamentPublic = () => {
  const { state } = useTournaments();
  const tournament = state.currentTournament;
  if (!tournament) return <div>No public tournament found.</div>;
  return (
    <div className="container main-content">
      <h2>{tournament.name}</h2>
      <LeaderboardTab tournament={tournament} />
      <ScheduleTab tournament={tournament} />
    </div>
  );
};
export default App;
