import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import TwitchLiveWidget from '../components/TwitchLiveWidget';
import { useLeague } from '../components/LeagueContext';

/* ─── League Utilities from 1.txt ─────────────────────────────────── */
const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95', color: '#87CEEB' },
  { prefix: 'Q', label: 'THE Q', color: '#FFD700' },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35' },
];

const leagueCfg = (prefix) =>
  LEAGUE_CONFIG.find((l) => l.prefix === prefix) ?? {
    prefix,
    label: prefix,
    color: '#aaa',
  };

const getFullTeamName = (teamCode, teams) => {
  const t = teams.find((t) => t.code === teamCode);
  return t ? t.team : teamCode;
};

function parseTeamData(teamRow) {
  const fullName = teamRow?.team || '';
  const coach = teamRow?.coach || '';
  if (!fullName) return { city: '', nickname: '', full: '', coach };
  const parts = fullName.trim().split(' ');
  if (parts.length === 1)
    return { city: parts[0], nickname: parts[0], full: fullName, coach };
  const city = parts[0];
  const nickname = parts.slice(1).join(' ');
  return { city, nickname, full: fullName, coach };
}

/* ─── Standings Component (Integrated Logic) ───────────────────────── */
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwkKmdh-OnFgfjSAxEaiMRYu-_2zLpNQdbiav6i0RJlAAJaXcxivltKbvAqJw-NTW7loQ/exec";

const SEASON_MAX_GAMES = {
  "W01": 46, "W02": 48, "W03": 66, "W04": 66, "W05": 66, "Q02": 42, "Q03": 42, "W06": 66, "Q04": 44, "W07": 76, "Q05": 44, "Q06": 42, "W08": 50, "Q07": 42, "G01": 26, "Q08": 42, "W09": 50, "Q09": 50, "V01": 20, "Q10": 42, "W10": 50, "Q11": 42, "W11": 48, "Q12": 42, "Q13": 42, "Q14": 42, "W12": 48, "Q15": 48, "Q16": 44, "W13": 56, "Q17": 44, "W14": 60, "Q18": 60, "W15": 52, "Q19": 60, "W16": 52
};

const teamLogos = {
  "Alberta HAX HC": "https://i.imgur.com/UwfYimd.png",
  "Albany Mohawks": "https://i.imgur.com/RHviqOQ.png",
  // ... (Full logo map from user input)
};

const statHeaders = [
  {key:'seed', label:'Seed'}, {key:'team', label:'Team'}, {key:'GP', label:'GP'},
  {key:'W', label:'W'}, {key:'L', label:'L'}, {key:'T', label:'T'}, {key:'OTL', label:'OTL'},
  {key:'Pts', label:'Pts'}, {key:'GF', label:'GF'}, {key:'GA', label:'GA'}, 
  {key:'DIFF', label:'+/-'}, {key:'Home', label:'Home'}, {key:'Away', label:'Away'},
  {key:'STRK', label:'STRK'}, {key:'L10', label:'L10'}, {key:'MN', label:'MN'}
];

export default function ProHockeyStandings() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState("W16");
  const [selectedConf, setSelectedConf] = useState("ALL");
  const [selectedDiv, setSelectedDiv] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'Pts', direction: 'desc' });

  // Load Data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${WEBAPP_URL}?league=ALL`);
        const json = await res.json();
        setAllData(json);
        setLoading(false);
      } catch (e) {
        console.error("Error loading standings:", e);
      }
    }
    fetchData();
  }, []);

  // Filter & Sort Logic
  const filteredData = useMemo(() => {
    let filtered = allData.filter(t => 
      (selectedSeason === "ALL" || t.lg === selectedSeason) &&
      (selectedConf === "ALL" || t.conf === selectedConf) &&
      (selectedDiv === "ALL" || t.div === selectedDiv) &&
      t.mode === "Season" &&
      (searchTerm === "" || t.team.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (!isNaN(valA) && !isNaN(valB) && sortConfig.key !== 'team') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [allData, selectedSeason, selectedConf, selectedDiv, searchTerm, sortConfig]);

  // UI Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (loading) return <div id="loading">LOADING STANDINGS...</div>;

  return (
    <div className="standings-app">
      <style>{`
        :root {
          --nhl-navy: #111111;
          --nhl-blue: #006bb6;
          --nhl-gray: #f5f5f5;
          --border-color: #dbdbdb;
          --text-dark: #000000;
          --text-muted: #666666;
        }
        /* (Remaining CSS from user provided HTML) */
      `}</style>
      
      <div className="filter-container">
        <div className="top-row">
          <div className="season-select-container">
            <label>Season</label>
            <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}>
              <option value="ALL">ALL SEASONS</option>
              {[...new Set(allData.map(item => item.lg))].sort().reverse().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search Team..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {statHeaders.map(h => (
                <th key={h.key} onClick={() => handleSort(h.key)}>
                  {h.label} {sortConfig.key === h.key && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((team, idx) => (
              <tr key={idx}>
                {statHeaders.map(h => (
                  <td key={h.key} className={h.key === 'Pts' ? 'pts-column' : ''}>
                    {h.key === 'team' ? (
                      <div className="team-cell">
                        <img src={teamLogos[team.team] || "https://via.placeholder.com/32"} alt="" />
                        {team.team}
                      </div>
                    ) : (team[h.key] ?? "--")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
