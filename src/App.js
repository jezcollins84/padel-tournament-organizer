import React, { useState, useEffect, createContext, useContext, useReducer } from 'react';
import './App.css';

// Context for global state management
const TournamentContext = createContext();

// Initial state for tournaments
const initialState = {
  tournaments: [],
  currentView: 'dashboard',
  currentTournament: null,
  isLoading: false,
  error: null
};

// Reducer for tournament state management
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
        currentTournament: action.payload.id === state.currentTournament?.id ? action.payload : state.currentTournament
      };
    case 'DELETE_TOURNAMENT':
      return {
        ...state,
        tournaments: state.tournaments.filter(t => t.id !== action.payload)
      };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload.view, currentTournament: action.payload.tournament };
    default:
      return state;
  }
}

// Americano scheduling algorithm
const generateAmericanoSchedule = (players) => {
  if (players.length < 4 || players.length % 4 !== 0) {
    throw new Error('Americano format requires multiples of 4 players');
  }

  const rounds = [];
  const playerIds = players.map(p => p.id);
  const totalRounds = Math.min((players.length - 1) * 3 / 4, 8);
  
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
      // Find the best pairing for current round
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
              
              // Check conflicts for team 1 (p1, p2) vs team 2 (p3, p4)
              const conflicts = 
                (partnerships[p1].has(p2) ? 1 : 0) +
                (partnerships[p3].has(p4) ? 1 : 0) +
                (opponents[p1].has(p3) ? 1 : 0) +
                (opponents[p1].has(p4) ? 1 : 0) +
                (opponents[p2].has(p3) ? 1 : 0) +
                (opponents[p2].has(p4) ? 1 : 0);
              
              if (conflicts < minConflicts) {
                minConflicts = conflicts;
                bestMatch = {
                  team1: [p1, p2],
                  team2: [p3, p4]
                };
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
          status: 'pending'
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
        [bestMatch.team1[0], bestMatch.team1[1], bestMatch.team2[0], bestMatch.team2[1]].forEach(pid => {
          const index = availablePlayers.indexOf(pid);
          if (index > -1) availablePlayers.splice(index, 1);
        });
      } else {
        break;
      }
    }
    
    if (matches.length > 0) {
      rounds.push({
        id: `round-${round}`,
        roundNumber: round + 1,
        matches,
        status: round === 0 ? 'active' : 'pending'
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
      points: 0
    };
  });
  
  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (match.status === 'completed') {
        const team1Players = match.team1;
        const team2Players = match.team2;
        const team1Score = match.score.team1;
        const team2Score = match.score.team2;
        
        // Update match counts
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
        
        // Determine winner and update stats
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
