// ─── Updated Transactions.jsx ───
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();

// ─── Team Logo ────────────────────────────────────────────────────────────
function TeamLogo({ code, size = 28 }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  return err ? (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f0f0',
        border: '1px solid #ddd',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 6,
        color: '#666',
      }}
    >
      {clean.slice(0, 3)}
    </div>
  ) : (
    <img
      src={`/assets/teamLogos/${clean}.png`}
      alt={clean}
      onError={() => setErr(true)}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Draft Capital Area ───────────────────────────────────────────────────
function DraftCapital({ coach, prefix }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coach || !prefix) return;
    setLoading(true);
    // Placeholder: This assumes a 'draft_picks' table for future owned assets
    supabase
      .from('draft_picks') 
      .select('*')
      .eq('owner_coach', coach)
      .ilike('lg_prefix', `${prefix}%`)
      .then(({ data }) => {
        setPicks(data || []);
        setLoading(false);
      });
  }, [coach, prefix]);

  return (
    <div style={{
      margin: '1rem 2rem',
      padding: '1rem',
      background: '#fff',
      border: '2px solid #000',
      boxShadow: '4px 4px 0px #ddd'
    }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, marginBottom: '0.5rem', color: '#333' }}>
        DRAFT CAPITAL / OWNED ASSETS
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {loading ? (
          <span style={{ fontFamily: "'VT323', monospace", color: '#999' }}>LOADING ASSETS...</span>
        ) : picks.length > 0 ? (
          picks.map((p, i) => (
            <div key={i} style={{ padding: '4px 8px', border: '1px solid #ccc', fontSize: 12, fontFamily: "'VT323', monospace", background: '#f9f9f9' }}>
              S{p.season} R{p.round} ({p.original_team})
            </div>
          ))
        ) : (
          <span style={{ fontFamily: "'VT323', monospace", color: '#999', fontSize: 16 }}>NO FUTURE PICKS RECORDED</span>
        )}
      </div>
    </div>
  );
}

// ─── Transaction badge ────────────────────────────────────────────────────
function TxnBadge({ flag, details }) {
  const [hovered, setHovered] = useState(false);
  if (!flag && !details) return null;
  const label = (details || 'TXN').toUpperCase();
  const MAX = 15;
  const truncated = label.length > MAX ? label.slice(0, MAX) + '…' : label;
  const needsTooltip = label.length > MAX;
  return (
    <div
      className="txn-badge-wrap"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}
      onMouseEnter={() => needsTooltip && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          padding: '3px 6px',
          borderRadius: 2,
          background: '#fff3e0',
          border: '1px solid #ffb74d',
          color: '#e65100',
          whiteSpace: 'nowrap',
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'inline-block',
          cursor: needsTooltip ? 'help' : 'default',
        }}
      >
        {truncated}
      </span>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            background: '#fff',
            border: '2px solid #000',
            color: '#000',
            fontFamily: "'VT323', monospace",
            fontSize: 14,
            padding: '8px',
            width: 260,
            zIndex: 9999,
            boxShadow: '4px 4px 0 rgba(0,0,0,.1)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Position badge (Simplified for light mode) ───────────────────────────
function PosBadge({ pos }) {
  const p = (pos || '-').trim().toUpperCase();
  return (
    <span
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        padding: '3px 6px',
        background: '#f0f0f0',
        border: '1px solid #ccc',
        color: '#333',
        display: 'inline-block',
        minWidth: 28,
        textAlign: 'center',
      }}
    >
      {p}
    </span>
  );
}

// ─── Round header ─────────────────────────────────────────────────────────
function RoundHeader({ round, pickCount }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '.65rem 1.2rem',
        background: '#f8f8f8',
        borderLeft: '4px solid #333',
        borderBottom: '1px solid #ddd',
      }}
    >
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#000', letterSpacing: 2 }}>
        ROUND {round}
      </span>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: '#888' }}>
        {pickCount} PICK{pickCount !== 1 ? 'S' : ''}
      </span>
    </div>
  );
}

// ─── Single pick row ──────────────────────────────────────────────────────
function PickRow({ pick, idx }) {
  const even = idx % 2 === 0;
  return (
    <div
      className="txn-pick-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 52px 90px 46px 1fr auto',
        alignItems: 'center',
        gap: '0 .5rem',
        padding: '.5rem 1.2rem',
        background: even ? '#fff' : '#fafafa',
        borderBottom: '1px solid #eee',
      }}
    >
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: '#333', textAlign: 'center' }}>
        R{pick.round}
      </span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: '#999', textAlign: 'center' }}>
        #{pick.pick ?? '-'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
        <TeamLogo code={pick.team} size={22} />
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#333' }}>
          {pick.team}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <PosBadge pos={pick.player ? pick.pos : '-'} />
      </div>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: '#000' }}>
        {pick.player || 'PASS'}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TxnBadge flag={pick.transaction_flag} details={pick.transaction_details} />
      </div>
    </div>
  );
}

// ─── Draft By Season View ─────────────────────────────────────────────────
function DraftBySeason({ selectedLeague }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedLeague) return;
    const prefix = selectedLeague.replace(/[0-9]/g, '').trim();
    supabase
      .from('draft')
      .select('lg')
      .ilike('lg', `${prefix}%`)
      .then(({ data }) => {
        const codes = [...new Set((data || []).map((r) => r.lg).filter(Boolean))];
        codes.sort((a, b) => (parseInt(b.replace(/\D/g, ''), 10) || 0) - (parseInt(a.replace(/\D/g, ''), 10) || 0));
        setSeasons(codes);
        if (codes.length > 0) setSelectedSeason(codes[0]);
      });
  }, [selectedLeague]);

  useEffect(() => {
    if (!selectedSeason) return;
    setLoading(true);
    supabase
      .from('draft')
      .select('*')
      .eq('lg', selectedSeason)
      .order('round', { ascending: true })
      .order('pick', { ascending: true })
      .then(({ data }) => {
        setPicks(data || []);
        setLoading(false);
      });
  }, [selectedSeason]);

  const byRound = useMemo(() => {
    const map = new Map();
    for (const p of picks) {
      const r = p.round ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(p);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [picks]);

  return (
    <div>
      <div className="txn-filter-bar">
        <span className="txn-filter-lbl">SEASON</span>
        <div className="txn-sel-wrap">
          <select className="txn-sel" value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="txn-draft-table">
        <div className="txn-draft-colhdr" style={{ gridTemplateColumns: '52px 52px 90px 46px 1fr auto' }}>
          <span>RND</span><span>#</span><span>TEAM</span><span>POS</span><span>PLAYER</span><span />
        </div>
        {byRound.map(([round, roundPicks]) => (
          <div key={round}>
            <RoundHeader round={round} pickCount={roundPicks.length} />
            {roundPicks.map((p, i) => <PickRow key={i} pick={p} idx={i} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Draft By Team View ───────────────────────────────────────────────────
function DraftByManager({ selectedLeague }) {
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [coachTeams, setCoachTeams] = useState([]);
  const [picks, setPicks] = useState([]);
  const prefix = (selectedLeague || '').replace(/[0-9]/g, '').trim();

  useEffect(() => {
    if (!selectedLeague) return;
    supabase.from('unique_teams_vw').select('coach').ilike('lg', `${prefix}%`)
      .then(({ data }) => {
        const list = [...new Set((data || []).map((r) => r.coach).filter(Boolean))].sort();
        setCoaches(list);
        if (list.length > 0) setSelectedCoach(list[0]);
      });
  }, [selectedLeague, prefix]);

  useEffect(() => {
    if (!selectedCoach) return;
    supabase.from('unique_teams_vw').select('abr, lg, team').eq('coach', selectedCoach).ilike('lg', `${prefix}%`)
      .then(({ data }) => setCoachTeams(data || []));
  }, [selectedCoach, prefix]);

  useEffect(() => {
    if (!selectedCoach || !coachTeams.length) return;
    const abrs = [...new Set(coachTeams.map((t) => t.abr))];
    supabase.from('draft').select('*').ilike('lg', `${prefix}%`).in('team', abrs)
      .then(({ data }) => {
        setPicks((data || []).sort((a, b) => (parseInt(b.lg.replace(/\D/g, '')) - parseInt(a.lg.replace(/\D/g, '')))));
      });
  }, [coachTeams, selectedCoach, prefix]);

  return (
    <div>
      <div className="txn-filter-bar">
        <span className="txn-filter-lbl">MANAGER</span>
        <div className="txn-sel-wrap">
          <select className="txn-sel" value={selectedCoach} onChange={(e) => setSelectedCoach(e.target.value)}>
            {coaches.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Draft Capital Feature */}
      <DraftCapital coach={selectedCoach} prefix={prefix} />

      <div className="txn-draft-table">
        {picks.map((p, i) => <PickRow key={i} pick={p} idx={i} />)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function Transactions() {
  const { selectedLeague } = useLeague();
  const [mainTab, setMainTab] = useState('draft');
  const [draftView, setDraftView] = useState('season');

  return (
    <div className="txn-page">
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">TRANSACTIONS</div>
        </div>
      </div>

      <div className="txn-main-tabs">
        <button className={`txn-tab ${mainTab === 'draft' ? 'on' : ''}`} onClick={() => setMainTab('draft')}>DRAFT</button>
        <button className={`txn-tab ${mainTab === 'trades' ? 'on' : ''}`} onClick={() => setMainTab('trades')}>TRADES</button>
      </div>

      {mainTab === 'draft' && (
        <div className="content-container">
          <div className="txn-view-toggle">
            <button className={`txn-view-btn ${draftView === 'season' ? 'on' : ''}`} onClick={() => setDraftView('season')}>BY SEASON</button>
            <button className={`txn-view-btn ${draftView === 'manager' ? 'on' : ''}`} onClick={() => setDraftView('manager')}>BY TEAM</button>
          </div>
          {draftView === 'season' ? <DraftBySeason selectedLeague={selectedLeague} /> : <DraftByManager selectedLeague={selectedLeague} />}
        </div>
      )}

      <style>{`
        .txn-page { background: #fdfdfd; min-height: 100vh; color: #000; padding: 2rem 0; }
        .scoreboard-header { background: #000; padding: 1rem 2rem; border-radius: 4px; }
        .led-text { font-family: 'Press Start 2P'; color: #FFD700; font-size: 1.5rem; }
        
        .txn-main-tabs { display: flex; gap: 1rem; border-bottom: 2px solid #eee; margin: 1rem 2rem; }
        .txn-tab { background: none; border: none; padding: 10px 20px; font-family: 'Press Start 2P'; font-size: 12px; cursor: pointer; color: #999; }
        .txn-tab.on { color: #000; border-bottom: 3px solid #000; }

        .txn-filter-bar { background: #f4f4f4; padding: 1rem 2rem; display: flex; align-items: center; gap: 1rem; }
        .txn-sel { font-family: 'Press Start 2P'; font-size: 10px; padding: 5px; border: 2px solid #000; }
        
        .txn-view-toggle { padding: 1rem 2rem; display: flex; gap: 10px; }
        .txn-view-btn { font-family: 'Press Start 2P'; font-size: 9px; padding: 8px 12px; cursor: pointer; border: 1px solid #ddd; background: #fff; }
        .txn-view-btn.on { background: #000; color: #fff; border-color: #000; }

        .txn-draft-table { border: 2px solid #000; margin: 0 2rem; background: #fff; }
        .txn-draft-colhdr { background: #000; color: #fff; padding: 8px 20px; display: grid; }
        .txn-draft-colhdr span { font-family: 'Press Start 2P'; font-size: 8px; }
      `}</style>
    </div>
  );
}
