import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

/* ── HELPERS ── */
const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();
const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95', color: '#87CEEB' },
  { prefix: 'Q', label: 'THE Q', color: '#FFD700' },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35' },
];
const leagueCfg = (prefix) => LEAGUE_CONFIG.find((l) => l.prefix === prefix) ?? { prefix, label: prefix, color: '#aaa' };

function parseTeamData(teamRow) {
  const fullName = teamRow?.team || '';
  const coach = teamRow?.coach || '';
  if (!fullName) return { city: '', nickname: '', full: '', coach };
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return { city: parts[0], nickname: parts[0], full: fullName, coach };
  return { city: parts[0], nickname: parts.slice(1).join(' '), full: fullName, coach };
}

/* ── SUB-COMPONENTS ── */
function ClockDisplay() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ht-clock-inner">
      <span className="ht-clock-time">{time}</span>
      <span className="ht-clock-label">ET</span>
    </div>
  );
}

function PanelHeader({ icon, title, action }) {
  return (
    <div className="ph">
      <span className="ph-icon">{icon}</span>
      <span className="ph-title">{title}</span>
      {action && <div className="ph-action">{action}</div>}
    </div>
  );
}

/* ── SPOTLIGHT COMPONENT ── */
const SL_PANELS = [
  { id: 'hot', icon: '🔥', label: 'HOTTEST', sub: 'Last 10' },
  { id: 'cold', icon: '🥶', label: 'COLDEST', sub: 'Last 10' },
  { id: 'wstreak', icon: '🏆', label: 'STREAKS', sub: 'Wins' },
  { id: 'scorers', icon: '⭐', label: 'SCORERS', sub: 'Points' },
];

function Spotlight({ recentForm, winStreaks, loading, topSeasonScorers }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SL_PANELS.length), 8000);
    return () => clearInterval(id);
  }, []);
  const p = SL_PANELS[idx];

  const renderRows = () => {
    if (loading) return <div className="sl-empty">LOADING SEGA DATA...</div>;
    const list = p.id === 'hot' ? recentForm.hot : p.id === 'cold' ? recentForm.cold : p.id === 'wstreak' ? winStreaks : topSeasonScorers;
    if (!list?.length) return <div className="sl-empty">NO DATA</div>;
    
    return list.slice(0, 5).map((t, i) => (
      <div key={i} className="sl-row">
        <span className="sl-rank">#{i + 1}</span>
        <img src={`/assets/teamLogos/${t.team || t.abr}.png`} className="sl-logo" onError={(e)=>e.target.style.display='none'} />
        <span className="sl-team">{t.team || t.name}</span>
        <span className={`sl-val ${p.id==='cold'?'sl-val-cold':'sl-val-hot'}`}>{t.w ? `${t.w}-${t.l}` : t.pts ? `${t.pts}P` : `${t.count}W`}</span>
      </div>
    ));
  };

  return (
    <section className="panel sl-panel">
      <div className="sl-tabs">
        {SL_PANELS.map((sp, i) => (
          <button key={sp.id} className={`sl-tab ${i === idx ? 'sl-tab-on' : ''}`} onClick={() => setIdx(i)}>{sp.icon}</button>
        ))}
      </div>
      <div className="sl-titlebar"><span className="sl-title">{p.label}</span><span className="sl-sub">{p.sub}</span></div>
      <div className="sl-body">{renderRows()}</div>
      <div className="sl-prog-wrap"><div className="sl-prog" key={idx} /></div>
    </section>
  );
}

/* ── LEAGUE GAZETTE ── */
function LeagueGazette({ leagueLabel, edition, meta, loading, teamNameMap, topScorers, teamCode }) {
  if (loading || !edition) return <div className="si-skel">LOADING GAZETTE...</div>;
  const teamCodeResolved = teamCode || edition.featured_team;

  return (
    <div className="si-wrap" style={{ '--acc': meta?.color || '#87CEEB' }}>
      <header className="si-mast">
        <div className="si-mast-name">NHL '95 GAZETTE</div>
        <div className="si-issue">{edition.edition}</div>
      </header>
      <div className="si-accent-rule" />
      <div className="si-cover-strip">
        <h1 className="si-cover-line">{edition.cover_line}</h1>
        <p className="si-cover-sub">{edition.cover_sub}</p>
      </div>
      <div className="si-cols">
        <div className="si-col-left">
          <div className="si-blurb">
            <div className="si-blurb-tag">{edition.blurb_1?.tag}</div>
            <div className="si-blurb-hed">{edition.blurb_1?.headline}</div>
            <div className="si-blurb-dek">{edition.blurb_1?.detail}</div>
          </div>
        </div>
        <div className="si-col-center">
          <div className="si-hero">
             <img src={`/assets/teamLogos/${teamCodeResolved}.png`} className="si-hero-logo" />
             <div className="si-hero-foot"><span className="si-hero-team">{teamNameMap[teamCodeResolved]?.full}</span></div>
          </div>
        </div>
        <div className="si-col-right">
          <div className="si-quote"><p className="si-quote-text">{edition.pull_quote}</p></div>
        </div>
      </div>
      <div className="si-footer"><span className="si-footer-label">BOTTOM LINE:</span> <span className="si-footer-text">{edition.bottom_line}</span></div>
    </div>
  );
}

/* ── MAIN HOME COMPONENT ── */
export default function Home() {
  const { selectedLeague } = useLeague();
  const cfg = leagueCfg(selectedLeague);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [winStreaks, setWinStreaks] = useState([]);
  const [recentForm, setRecentForm] = useState({ hot: [], cold: [] });
  const [teamNameMap, setTeamNameMap] = useState({});
  const [topScorers, setTopScorers] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [topSeasonScorers, setTopSeasonScorers] = useState([]);
  const [edition, setEdition] = useState(null);

  const loadData = useCallback(async (prefix) => {
    setLoading(true);
    const { data: seasons } = await supabase.from('seasons').select('*').order('year', { ascending: false });
    const latest = seasons.find(s => lgPrefix(s.lg) === prefix);
    if (!latest) return setLoading(false);
    
    setCurrentSeason(latest);

    const { data: teams } = await supabase.from('teams').select('*').eq('lg', latest.lg);
    const names = {};
    teams.forEach(t => names[t.abr] = parseTeamData(t));
    setTeamNameMap(names);

    const { data: games } = await supabase.from('games').select('*').eq('lg', latest.lg).order('id', { ascending: false });
    // logic for streaks and form...
    setWinStreaks([{team: 'NYR', count: 5}]); // Placeholder
    setRecentForm({ hot: [{team: 'NYR', w: 8, l: 2}], cold: [] });
    
    setLoading(false);
  }, []);

  useEffect(() => { loadData(selectedLeague); }, [selectedLeague, loadData]);

  return (
    <div className="hp">
      <div className="scanlines" />
      <div className="cg">
        <div className="cg-a">
          <Spotlight loading={loading} recentForm={recentForm} winStreaks={winStreaks} topSeasonScorers={topSeasonScorers} />
        </div>
        <div className="cg-b">
          <LeagueGazette leagueLabel={cfg.label} edition={edition} teamNameMap={teamNameMap} loading={loading} topScorers={topScorers} />
        </div>
      </div>

      <div className="hdtv-ticker">
        <div className="ht-brand"><div className="ht-brand-top">NHL 95</div></div>
        <div className="ht-stage">
          <div className="ht-rail">
            <div className="ht-belt">
              {newsItems.map((item, i) => <span key={i} className="ht-text">{item} • </span>)}
            </div>
          </div>
        </div>
        <div className="ht-clock"><ClockDisplay /></div>
      </div>

      <style>{`
        body { background: #000044; margin: 0; font-family: 'VT323', monospace; color: #fff; }
        .hp { padding-bottom: 60px; }
        .scanlines { position: fixed; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02)); background-size: 100% 4px, 4px 100%; pointer-events: none; z-index: 1000; }
        .cg { display: grid; grid-template-columns: 300px 1fr; gap: 20px; padding: 20px; }
        .panel { background: #000; border: 4px solid #fff; box-shadow: 8px 8px 0 #222; margin-bottom: 20px; }
        .ph { background: #000088; border-bottom: 4px solid #fff; padding: 10px; }
        .ph-title { font-family: 'Press Start 2P'; font-size: 10px; color: #fff; }
        .hdtv-ticker { position: fixed; bottom: 0; width: 100%; height: 50px; background: #000; border-top: 4px solid #fff; display: flex; align-items: center; }
        .ht-brand { background: #F80000; padding: 0 20px; height: 100%; display: flex; align-items: center; }
        .ht-brand-top { font-family: 'Press Start 2P'; font-size: 12px; }
        .ht-belt { font-family: 'Press Start 2P'; font-size: 10px; color: #00F800; }
        .si-wrap { background: #C0C0C0; color: #000; border: 6px solid #000; padding: 20px; }
        .si-mast { background: #000; color: #fff; padding: 10px; font-family: 'Press Start 2P'; }
      `}</style>
    </div>
  );
}
