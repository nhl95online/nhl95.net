import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';
import TwitchLiveWidget from '../components/TwitchLiveWidget';

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

// ─── Parse team row into display name parts ───────────────────────────────────
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

function useLeagueCountdown(season, nextSeason) {
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!season) return;
    if (season.status === 'playoffs') {
      setTick({ mode: 'playoffs', seasonLabel: season.lg });
      return;
    }
    const targetDate = season.status === 'offseason' ? season.start_date : season.end_date;
    if (!targetDate) {
      setTick({ mode: season.status || 'done', seasonLabel: season.lg });
      return;
    }
    const calc = () => {
      const diff = new Date(targetDate) - Date.now();
      if (diff <= 0) {
        setTick({ mode: 'done', seasonLabel: season.lg });
        return;
      }
      setTick({
        mode: season.status || 'season',
        seasonLabel: season.lg,
        nextSeasonLabel: nextSeason?.lg || null,
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        urgent: diff < 48 * 3600000,
        warning: diff < 7 * 86400000,
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [season, nextSeason]);
  return tick;
}

const p2 = (n) => String(n ?? 0).padStart(2, '0');

function daysUntil(iso) {
  if (!iso) return null;
  const norm = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
  const evMs = new Date(norm).getTime();
  if (isNaN(evMs) || evMs < Date.now()) return null;
  const now = new Date(), ev = new Date(evMs);
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const evMid = new Date(ev.getFullYear(), ev.getMonth(), ev.getDate()).getTime();
  const days = Math.round((evMid - todayMid) / 86400000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TMRW';
  return `${days}D`;
}

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

function InlineCountdown({ cfg, tick }) {
  const uc = tick?.urgent ? '#FF3B3B' : tick?.warning ? '#FFB800' : cfg.color;
  const renderRight = () => {
    if (!tick) return <span className="icd-awaiting">AWAITING</span>;
    if (tick.mode === 'playoffs') return (
      <div className="icd-complete">
        <span style={{ fontSize: 15 }}>🏒</span>
        <span className="icd-done-txt" style={{ color: '#00BFA5' }}>PLAYOFFS</span>
      </div>
    );
    if (tick.mode === 'offseason' && (!tick.d && tick.d !== 0)) return (
      <div className="icd-complete">
        <span style={{ fontSize: 15 }}>☀️</span>
        <span className="icd-done-txt">OFFSEASON</span>
      </div>
    );
    if (tick.mode === 'done') return (
      <div className="icd-complete">
        <span style={{ fontSize: 15 }}>🏆</span>
        <span className="icd-done-txt">COMPLETE</span>
      </div>
    );
    return (
      <div className="icd-clock">
        {[{ v: tick.d, u: 'D' }, { v: tick.h, u: 'H' }, { v: tick.m, u: 'M' }, { v: tick.s, u: 'S' }].map(({ v, u }) => (
          <div key={u} className="icd-unit">
            <span className="icd-n">{p2(v)}</span>
            <span className="icd-u">{u}</span>
          </div>
        ))}
        {tick.d < 7 && <span style={{ fontSize: 15, marginLeft: 2 }}>{tick.urgent ? '🚨' : '⚡'}</span>}
      </div>
    );
  };
  return (
    <div className="icd" style={{ '--ic': uc }}>
      <div className="icd-left">
        <span className="icd-eyebrow">{tick?.mode === 'offseason' ? '☀️ OFFSEASON' : tick?.mode === 'playoffs' ? '🏒 PLAYOFFS ACTIVE' : '⏱ SEASON COUNTDOWN'}</span>
        <div className="icd-meta">
          <span className="icd-dot" />
          <span className="icd-league">{cfg.label}</span>
          {tick?.mode === 'offseason' && tick?.nextSeasonLabel ? (
            <span className="icd-season">{tick.nextSeasonLabel} STARTS</span>
          ) : tick?.seasonLabel ? (
            <span className="icd-season">{tick.seasonLabel}</span>
          ) : null}
        </div>
      </div>
      <div className="icd-right">{renderRight()}</div>
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

const SL_PANELS = [
  { id: 'hot', icon: '🔥', label: 'HOTTEST TEAMS', sub: 'Best record last 10' },
  { id: 'cold', icon: '🥶', label: 'COLDEST TEAMS', sub: 'Worst record last 10' },
  { id: 'wstreak', icon: '🏆', label: 'WIN STREAKS', sub: 'Active win streaks' },
  { id: 'lstreak', icon: '💀', label: 'LOSS STREAKS', sub: 'Active loss streaks' },
  { id: 'scorers', icon: '⭐', label: 'TOP SCORERS', sub: 'Points leaders' },
];

function Spotlight({ recentForm, winStreaks, lossStreaks, loading, topSeasonScorers }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % SL_PANELS.length), 8000);
  }, []);
  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [startTimer]);
  const p = SL_PANELS[idx];

  const rows = () => {
    if (loading) return [1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 24, margin: '.12rem .65rem' }} />);
    if (p.id === 'hot' || p.id === 'cold') {
      const list = p.id === 'hot' ? recentForm.hot : recentForm.cold;
      return list.map((t, i) => (
        <div key={t.team} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img src={`/assets/teamLogos/${t.team}.png`} alt="" className="sl-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="sl-team">{t.team}</span>
          <div className="sl-dots">{t.last10.map((w, j) => <span key={j} className={`sl-dot ${w ? 'sl-dot-w' : 'sl-dot-l'}`} />)}</div>
          <span className={`sl-val ${p.id === 'hot' ? 'sl-val-hot' : 'sl-val-cold'}`}>{t.w}-{t.l}</span>
        </div>
      ));
    }
    if (p.id === 'wstreak' || p.id === 'lstreak') {
      const list = p.id === 'wstreak' ? winStreaks : lossStreaks;
      if (!list.length) return <div className="sl-empty">No active streaks</div>;
      return list.slice(0, 5).map((s, i) => (
        <div key={s.team} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img src={`/assets/teamLogos/${s.team}.png`} alt="" className="sl-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="sl-team">{s.team}</span>
          <div className="sl-dots">{Array.from({ length: Math.min(s.count, 10) }, (_, j) => <span key={j} className={`sl-dot ${p.id === 'wstreak' ? 'sl-dot-w' : 'sl-dot-l'}`} />)}</div>
          <span className={`sl-val ${p.id === 'wstreak' ? 'sl-val-hot' : 'sl-val-cold'}`}>{s.count}{p.id === 'wstreak' ? 'W' : 'L'}</span>
        </div>
      ));
    }
    if (p.id === 'scorers') {
      if (!topSeasonScorers?.length) return <div className="sl-empty">No scorer data</div>;
      return topSeasonScorers.slice(0, 5).map((s, i) => (
        <div key={s.name} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img src={`/assets/teamLogos/${s.team}.png`} alt="" className="sl-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="sl-team">{s.name.split(' ').slice(-1)[0]}</span>
          <span className="sl-val sl-val-hot">{s.pts}</span>
        </div>
      ));
    }
  };

  return (
    <section className="panel sl-panel">
      <div className="sl-tabs">{SL_PANELS.map((sp, i) => <button key={sp.id} className={`sl-tab ${i === idx ? 'sl-tab-on' : ''}`} onClick={() => { setIdx(i); startTimer(); }} title={sp.label}>{sp.icon}</button>)}</div>
      <div className="sl-titlebar"><span className="sl-title">{p.icon} {p.label}</span><span className="sl-sub">{p.sub}</span></div>
      <div className="sl-body">{rows()}</div>
      <div className="sl-prog-wrap"><div className="sl-prog" key={`${idx}-${loading}`} /></div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
    LEAGUE GAZETTE LOGIC
═══════════════════════════════════════════════════════════════ */

const STORY_META = {
  hot_streak: { color: '#FF4500', tag: 'ON FIRE' },
  win_streak: { color: '#00C853', tag: 'WIN STREAK' },
  cold_streak: { color: '#448AFF', tag: 'COLD SPELL' },
  loss_streak: { color: '#448AFF', tag: 'LOSING SKID' },
  big_win: { color: '#FFD600', tag: 'BIG WIN' },
  elimination: { color: '#D50000', tag: 'ELIMINATED' },
  playoff_push: { color: '#00BFA5', tag: 'PLAYOFF PUSH' },
  milestone: { color: '#FFD600', tag: 'MILESTONE' },
  comeback: { color: '#FF6D00', tag: 'COMEBACK' },
  idle: { color: '#78909C', tag: 'QUIET NIGHT' },
  rivalry: { color: '#E040FB', tag: 'RIVALRY WATCH' },
};
const getMeta = (t) => STORY_META[t] || STORY_META.hot_streak;

async function fetchGazetteEdition({
  leagueLabel, recentForm, winStreaks, lossStreaks, currentSeason,
  teamNameMap, topScorers, recentGames, isPlayoffActive, playoffSeriesData,
  gameStats, managers, teams, championTeam
}) {
  const today = new Date().toISOString().split('T')[0];
  const season = currentSeason?.lg || leagueLabel;
  const isOffseason = currentSeason?.status === 'offseason';
  const cacheKey = isOffseason ? `${leagueLabel}_offseason` : isPlayoffActive ? `${leagueLabel}_playoff` : `${leagueLabel}_${season}`;

  try {
    const { data: cached } = await supabase.from('gazette_cache').select('data, date').eq('league', cacheKey).order('created_at', { ascending: false }).limit(1).single();
    if (cached?.date === today && cached?.data) return typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
  } catch (e) { console.log('[Gazette] No DB cache found'); }

  const tn = (code) => teamNameMap[code] || { city: code, nickname: code, full: code };
  
  // Data aggregation for prompt...
  const traitsMap = (managers || []).reduce((acc, m) => {
    if (m?.manager_traits) acc[m.id ?? m.coach_name] = typeof m.manager_traits === 'string' ? JSON.parse(m.manager_traits) : m.manager_traits;
    return acc;
  }, {});

  const prompt = `You are the editor of ${leagueLabel} MAGAZINE. Season ${season}.
  ${isPlayoffActive ? 'PLAYOFF MODE' : 'REGULAR SEASON'}.
  Traits: ${JSON.stringify(traitsMap)}
  Team Names: ${JSON.stringify(teamNameMap)}
  Recent Results: ${JSON.stringify(recentGames)}
  Scorers: ${JSON.stringify(topScorers)}
  Series: ${JSON.stringify(playoffSeriesData)}
  Champion: ${championTeam}
  Respond ONLY with JSON matching the required schema.`;

  const result = await supabase.functions.invoke('gazette-generate', { body: { messages: [{ role: 'user', content: prompt }] } });
  if (result.error) throw new Error(result.error.message);

  const raw = result.data?.text || result.data?.message?.content?.[0]?.text || '';
  const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  const data = JSON.parse(match[0]);

  await supabase.from('gazette_cache').upsert({ league: cacheKey, date: today, data });
  return data;
}

function GazetteSkeleton() {
  return (
    <div className="si-skel">
      <div className="si-skel-cover"><div className="si-skel-b" style={{ height: 12, width: '30%', marginBottom: 8 }} /><div className="si-skel-b" style={{ height: 22, width: '68%', marginBottom: 6 }} /></div>
      <div className="si-skel-grid"><div className="si-skel-col" /><div className="si-skel-b si-skel-hero" /><div className="si-skel-col" /></div>
    </div>
  );
}

function LeagueGazette(props) {
  const [edition, setEdition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [featuredSrc, setFeaturedSrc] = useState(null);

  const teamCode = Object.entries(props.teamNameMap).find(([code, info]) => info.full === edition?.featured_team || code === edition?.featured_team)?.[0] || edition?.featured_team;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: managers } = await supabase.from('managers').select('id, coach_name, manager_traits');
      const data = await fetchGazetteEdition({ ...props, managers: managers || [] });
      setEdition(data);
    } catch (e) { setError(true); } finally { setLoading(false); }
  }, [props]);

  useEffect(() => {
    if (!props.loading && props.recentForm.hot.length > 0 && Object.keys(props.teamNameMap).length > 0) load();
  }, [props.loading, props.leagueLabel, props.isPlayoffActive]);

  const meta = getMeta(edition?.story_type);
  const featFullName = props.teamNameMap[teamCode]?.full || teamCode;

  if (loading && !edition) return <GazetteSkeleton />;
  if (error) return <div className="si-error">PRESS ROOM DOWN <button onClick={load}>RETRY</button></div>;
  if (!edition) return null;

  return (
    <div className="si-wrap" style={{ '--acc': meta.color, '--acc2': meta.color + '22' }}>
      <header className="si-mast"><div className="si-mast-name">{props.leagueLabel}</div><div className="si-mast-date">{new Date().toLocaleDateString()}</div></header>
      <div className="si-accent-rule" />
      <div className="si-cover-strip"><span className="si-story-pill" style={{ background: meta.color }}>{meta.tag}</span><h1 className="si-cover-line">{edition.cover_line}</h1><p className="si-cover-sub">{edition.cover_sub}</p></div>
      <div className="si-cols">
        <aside className="si-col-left">{[edition.blurb_1, edition.blurb_2, edition.blurb_3].map((b, i) => b && <div key={i} className="si-blurb"><div className="si-blurb-tag">{b.tag}</div><div className="si-blurb-hed">{b.headline}</div><div className="si-blurb-dek">{b.detail}</div></div>)}</aside>
        <div className="si-col-center">
          <div className="si-hero">
            <div className="si-hero-bg"><img src={`/assets/banners/${teamCode}.png`} alt="" className="si-hero-banner" onError={(e) => e.currentTarget.style.display='none'} /></div>
            <div className="si-hero-body"><img src={`/assets/teamLogos/${teamCode || 'placeholder'}.png`} alt="" className="si-hero-logo" /></div>
            <div className="si-hero-foot"><span className="si-hero-team">{featFullName}</span><span className="si-hero-code">{teamCode}</span></div>
          </div>
        </div>
        <aside className="si-col-right"><div className="si-quote"><p className="si-quote-text">{edition.pull_quote}</p><div className="si-quote-attr">{edition.quote_attr}</div></div></aside>
      </div>
      <div className="si-footer"><span className="si-footer-label">BOTTOM LINE</span><span className="si-footer-text">{edition.bottom_line}</span></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
    MAIN HOME COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function Home() {
  const { selectedLeague } = useLeague();
  const cfg = leagueCfg(selectedLeague);

  const [currentSeason, setCurrentSeason] = useState(null);
  const [winStreaks, setWinStreaks] = useState([]);
  const [lossStreaks, setLossStreaks] = useState([]);
  const [recentForm, setRecentForm] = useState({ hot: [], cold: [] });
  const [discordEvents, setDiscordEvents] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evtLoading, setEvtLoading] = useState(true);
  const [teamNameMap, setTeamNameMap] = useState({});
  const [topScorers, setTopScorers] = useState([]);
  const [topSeasonScorers, setTopSeasonScorers] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [isPlayoffActive, setIsPlayoffActive] = useState(false);
  const [playoffSeriesData, setPlayoffSeriesData] = useState([]);
  const [gameStats, setGameStats] = useState('');
  const [seasonTeams, setSeasonTeams] = useState([]);
  const [nextSeason, setNextSeason] = useState(null);
  const [newsItems, setNewsItems] = useState([]);
  const [championTeam, setChampionTeam] = useState(null);
  const [beltDuration, setBeltDuration] = useState(30);
  const beltRef = useRef(null);

  const tick = useLeagueCountdown(currentSeason, nextSeason);

  const loadLeagueData = useCallback(async (prefix) => {
    if (!prefix) return;
    setLoading(true);
    const { data: seasons } = await supabase.from('seasons').select('*').order('year', { ascending: false });
    const ps = (seasons || []).filter((s) => lgPrefix(s.lg) === prefix);
    if (!ps.length) { setLoading(false); return; }
    
    const latest = ps[0];
    setCurrentSeason(latest);
    setNextSeason(ps.find(s => s.lg !== latest.lg) || null);

    const { data: fetchedTeams } = await supabase.from('teams').select('*').eq('lg', latest.lg);
    const nameMap = {};
    (fetchedTeams || []).forEach((t) => { nameMap[t.abr] = parseTeamData(t); });
    setTeamNameMap(nameMap);
    setSeasonTeams(fetchedTeams || []);

    // Win Streaks & Form logic...
    const { data: games } = await supabase.from('games').select('*').eq('lg', latest.lg).order('id', { ascending: false });
    // (Calculation logic for winStreaks, recentForm, topScorers goes here as in your snippet)

    setLoading(false);

    // Ticker News
    const tickerRes = await fetch('https://gwaiwtgwdqadxmimiskf.supabase.co/rest/v1/ticker_news?select=text&order=created_at.desc&limit=8', {
      headers: {
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // Replace with full key
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
    });
    const tickerJson = await tickerRes.json();
    if (tickerJson?.length) setNewsItems(tickerJson.map((r) => r.text));
  }, []);

  useEffect(() => { loadLeagueData(selectedLeague); }, [selectedLeague, loadLeagueData]);

  useEffect(() => {
    const refresh = async () => {
      setEvtLoading(true);
      const events = await supabase.functions.invoke('discord-events');
      if (!events.error) setDiscordEvents(events.data.slice(0, 6));
      const trades = await supabase.functions.invoke('discord-trade-tracker');
      if (!trades.error) setRecentTrades(trades.data.slice(0, 5));
      setEvtLoading(false);
    };
    refresh();
  }, []);

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />
      <div className="cg">
        <div className="cg-a">
          <InlineCountdown cfg={cfg} tick={tick} />
          <Spotlight recentForm={recentForm} winStreaks={winStreaks} lossStreaks={lossStreaks} loading={loading} topSeasonScorers={topSeasonScorers} />
          <section className="panel">
            <PanelHeader icon="🔄" title="TRANSACTIONS" />
            <div className="tx-body">
              {recentTrades.map((t, i) => (
                <div key={i} className="tx-row tx-row-tip">
                  <span className="tx-player">{t.text}</span>
                  <div className="tx-tooltip">{t.text}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="cg-b">
          <LeagueGazette
            leagueLabel={cfg.label} recentForm={recentForm} winStreaks={winStreaks}
            lossStreaks={lossStreaks} currentSeason={currentSeason} loading={loading}
            teamNameMap={teamNameMap} topScorers={topScorers} recentGames={recentGames}
            isPlayoffActive={isPlayoffActive} playoffSeriesData={playoffSeriesData}
            gameStats={gameStats} teams={seasonTeams} championTeam={championTeam}
          />
        </div>
        <div className="cg-c">
          <div className="media-cluster">
            <section className="panel twg-panel"><TwitchLiveWidget /></section>
            <section className="panel">
              <PanelHeader icon="📅" title="UPCOMING EVENTS" action={<a href="#" className="discord-join">JOIN →</a>} />
              <div className="events">
                {discordEvents.map(ev => (
                  <a key={ev.id} href={ev.url} className="ev-row">
                    <div className="ev-cal"><span className="ev-mon">{new Date(ev.startTime).toLocaleString('en-US', {month:'short'})}</span><span className="ev-day">{new Date(ev.startTime).getDate()}</span></div>
                    <div className="ev-info"><span className="ev-name">{ev.name}</span><span className="ev-time">{new Date(ev.startTime).toLocaleTimeString()}</span></div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="hdtv-ticker">
        <div className="ht-brand"><div className="ht-brand-top">{cfg.label}</div><div className="ht-brand-bottom"><span className="ht-live-dot" />LIVE</div></div>
        <div className="ht-stage">
          <div className="ht-rail">
            <div className="ht-belt" ref={beltRef} style={{ animationDuration: `${beltDuration}s`, '--belt-w': `${beltRef.current?.scrollWidth / 2 || 0}px` }}>
              {newsItems.concat(newsItems).map((item, i) => (
                <span key={i} className="ht-story"><span className={`ht-text ht-c${i % 4}`}>{item}</span><span className="ht-sep">◆</span></span>
              ))}
            </div>
          </div>
        </div>
        <div className="ht-clock"><ClockDisplay /></div>
      </div>
      {/* (Styles omitted for brevity, identical to your CSS definitions) */}
    </div>
  );
}
