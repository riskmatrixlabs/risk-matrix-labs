// Team-logo resolver — resolve a real ESPN team crest from a bet's TEAM (logos are
// constant), so old bets whose game has aged out of the events window still show the
// right crest instead of falling back to the generic league badge.
//
// ESPN logo URL: https://a.espncdn.com/i/teamlogos/{league}/500/{abbr}.png
//   league = mlb | nba | nhl | wnba (lowercase)
//   abbr   = ESPN team abbreviation (lowercase, e.g. atl, sd, nyy)
//
// Pure module — no I/O, never throws.

const LEAGUE_PATH = { MLB: 'mlb', NBA: 'nba', NHL: 'nhl', WNBA: 'wnba' }

// Build a sport map by listing each team's ESPN abbr + the names it can be keyed by.
// `defs` is [abbr, [...aliases]]. We auto-add the abbr itself as a key.
function buildMap(defs) {
  const out = {}
  for (const [abbr, aliases] of defs) {
    out[norm(abbr)] = abbr
    for (const a of aliases) out[norm(a)] = abbr
  }
  return out
}

// Normalize a team identifier: lowercase, strip punctuation/diacritics, collapse spaces.
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const TEAM_ABBR = {
  MLB: buildMap([
    ['ari', ['Arizona Diamondbacks', 'Arizona', 'Diamondbacks', 'Dbacks', 'AZ']],
    ['atl', ['Atlanta Braves', 'Atlanta', 'Braves']],
    ['bal', ['Baltimore Orioles', 'Baltimore', 'Orioles']],
    ['bos', ['Boston Red Sox', 'Boston', 'Red Sox']],
    ['chc', ['Chicago Cubs', 'Cubs']],
    ['cws', ['Chicago White Sox', 'White Sox', 'CHW']],
    ['cin', ['Cincinnati Reds', 'Cincinnati', 'Reds']],
    ['cle', ['Cleveland Guardians', 'Cleveland', 'Guardians']],
    ['col', ['Colorado Rockies', 'Colorado', 'Rockies']],
    ['det', ['Detroit Tigers', 'Detroit', 'Tigers']],
    ['hou', ['Houston Astros', 'Houston', 'Astros']],
    ['kc', ['Kansas City Royals', 'Kansas City', 'Royals', 'KCR']],
    ['laa', ['Los Angeles Angels', 'LA Angels', 'Angels', 'Anaheim']],
    ['lad', ['Los Angeles Dodgers', 'LA Dodgers', 'Dodgers']],
    ['mia', ['Miami Marlins', 'Miami', 'Marlins']],
    ['mil', ['Milwaukee Brewers', 'Milwaukee', 'Brewers']],
    ['min', ['Minnesota Twins', 'Minnesota', 'Twins']],
    ['nym', ['New York Mets', 'NY Mets', 'Mets']],
    ['nyy', ['New York Yankees', 'NY Yankees', 'Yankees']],
    ['ath', ['Athletics', 'Oakland Athletics', 'Oakland', "A's", 'As', 'OAK']],
    ['phi', ['Philadelphia Phillies', 'Philadelphia', 'Phillies']],
    ['pit', ['Pittsburgh Pirates', 'Pittsburgh', 'Pirates']],
    ['sd', ['San Diego Padres', 'San Diego', 'Padres', 'SDP']],
    ['sf', ['San Francisco Giants', 'San Francisco', 'Giants', 'SFG']],
    ['sea', ['Seattle Mariners', 'Seattle', 'Mariners']],
    ['stl', ['St. Louis Cardinals', 'St Louis', 'St. Louis', 'Cardinals']],
    ['tb', ['Tampa Bay Rays', 'Tampa Bay', 'Rays', 'TBR']],
    ['tex', ['Texas Rangers', 'Texas', 'Rangers']],
    ['tor', ['Toronto Blue Jays', 'Toronto', 'Blue Jays']],
    ['wsh', ['Washington Nationals', 'Washington', 'Nationals', 'Nats', 'WAS', 'WSN']],
  ]),
  NBA: buildMap([
    ['atl', ['Atlanta Hawks', 'Atlanta', 'Hawks']],
    ['bos', ['Boston Celtics', 'Boston', 'Celtics']],
    ['bkn', ['Brooklyn Nets', 'Brooklyn', 'Nets', 'BRK']],
    ['cha', ['Charlotte Hornets', 'Charlotte', 'Hornets']],
    ['chi', ['Chicago Bulls', 'Bulls']],
    ['cle', ['Cleveland Cavaliers', 'Cleveland', 'Cavaliers', 'Cavs']],
    ['dal', ['Dallas Mavericks', 'Dallas', 'Mavericks', 'Mavs']],
    ['den', ['Denver Nuggets', 'Denver', 'Nuggets']],
    ['det', ['Detroit Pistons', 'Detroit', 'Pistons']],
    ['gs', ['Golden State Warriors', 'Golden State', 'Warriors', 'GSW']],
    ['hou', ['Houston Rockets', 'Houston', 'Rockets']],
    ['ind', ['Indiana Pacers', 'Indiana', 'Pacers']],
    ['lac', ['Los Angeles Clippers', 'LA Clippers', 'Clippers']],
    ['lal', ['Los Angeles Lakers', 'LA Lakers', 'Lakers']],
    ['mem', ['Memphis Grizzlies', 'Memphis', 'Grizzlies']],
    ['mia', ['Miami Heat', 'Miami', 'Heat']],
    ['mil', ['Milwaukee Bucks', 'Milwaukee', 'Bucks']],
    ['min', ['Minnesota Timberwolves', 'Minnesota', 'Timberwolves', 'Wolves']],
    ['no', ['New Orleans Pelicans', 'New Orleans', 'Pelicans', 'NOP']],
    ['ny', ['New York Knicks', 'NY Knicks', 'Knicks', 'NYK']],
    ['okc', ['Oklahoma City Thunder', 'Oklahoma City', 'Thunder']],
    ['orl', ['Orlando Magic', 'Orlando', 'Magic']],
    ['phi', ['Philadelphia 76ers', 'Philadelphia', '76ers', 'Sixers']],
    ['phx', ['Phoenix Suns', 'Phoenix', 'Suns', 'PHO']],
    ['por', ['Portland Trail Blazers', 'Portland', 'Trail Blazers', 'Blazers']],
    ['sac', ['Sacramento Kings', 'Sacramento', 'Kings']],
    ['sa', ['San Antonio Spurs', 'San Antonio', 'Spurs', 'SAS']],
    ['tor', ['Toronto Raptors', 'Toronto', 'Raptors']],
    ['utah', ['Utah Jazz', 'Utah', 'Jazz', 'UTA']],
    ['wsh', ['Washington Wizards', 'Washington', 'Wizards', 'WAS']],
  ]),
  NHL: buildMap([
    ['ana', ['Anaheim Ducks', 'Anaheim', 'Ducks']],
    ['bos', ['Boston Bruins', 'Boston', 'Bruins']],
    ['buf', ['Buffalo Sabres', 'Buffalo', 'Sabres']],
    ['cgy', ['Calgary Flames', 'Calgary', 'Flames']],
    ['car', ['Carolina Hurricanes', 'Carolina', 'Hurricanes', 'Canes']],
    ['chi', ['Chicago Blackhawks', 'Blackhawks']],
    ['col', ['Colorado Avalanche', 'Colorado', 'Avalanche', 'Avs']],
    ['cbj', ['Columbus Blue Jackets', 'Columbus', 'Blue Jackets']],
    ['dal', ['Dallas Stars', 'Dallas', 'Stars']],
    ['det', ['Detroit Red Wings', 'Detroit', 'Red Wings']],
    ['edm', ['Edmonton Oilers', 'Edmonton', 'Oilers']],
    ['fla', ['Florida Panthers', 'Florida', 'Panthers']],
    ['la', ['Los Angeles Kings', 'LA Kings', 'Kings', 'LAK']],
    ['min', ['Minnesota Wild', 'Minnesota', 'Wild']],
    ['mtl', ['Montreal Canadiens', 'Montreal', 'Canadiens', 'Habs']],
    ['nsh', ['Nashville Predators', 'Nashville', 'Predators', 'Preds']],
    ['nj', ['New Jersey Devils', 'New Jersey', 'Devils', 'NJD']],
    ['nyi', ['New York Islanders', 'NY Islanders', 'Islanders']],
    ['nyr', ['New York Rangers', 'NY Rangers', 'Rangers']],
    ['ott', ['Ottawa Senators', 'Ottawa', 'Senators', 'Sens']],
    ['phi', ['Philadelphia Flyers', 'Philadelphia', 'Flyers']],
    ['pit', ['Pittsburgh Penguins', 'Pittsburgh', 'Penguins', 'Pens']],
    ['sj', ['San Jose Sharks', 'San Jose', 'Sharks', 'SJS']],
    ['sea', ['Seattle Kraken', 'Seattle', 'Kraken']],
    ['stl', ['St. Louis Blues', 'St Louis', 'St. Louis', 'Blues']],
    ['tb', ['Tampa Bay Lightning', 'Tampa Bay', 'Lightning', 'Bolts', 'TBL']],
    ['tor', ['Toronto Maple Leafs', 'Toronto', 'Maple Leafs', 'Leafs']],
    ['uta', ['Utah Hockey Club', 'Utah Mammoth', 'Utah']],
    ['van', ['Vancouver Canucks', 'Vancouver', 'Canucks']],
    ['vgk', ['Vegas Golden Knights', 'Vegas', 'Golden Knights', 'Las Vegas']],
    ['wsh', ['Washington Capitals', 'Washington', 'Capitals', 'Caps', 'WAS']],
    ['wpg', ['Winnipeg Jets', 'Winnipeg', 'Jets']],
  ]),
  WNBA: buildMap([
    ['atl', ['Atlanta Dream', 'Atlanta', 'Dream']],
    ['chi', ['Chicago Sky', 'Sky']],
    ['conn', ['Connecticut Sun', 'Connecticut', 'Sun']],
    ['dal', ['Dallas Wings', 'Dallas', 'Wings']],
    ['gs', ['Golden State Valkyries', 'Golden State', 'Valkyries', 'GSV']],
    ['ind', ['Indiana Fever', 'Indiana', 'Fever']],
    ['lv', ['Las Vegas Aces', 'Las Vegas', 'Aces', 'LVA']],
    ['la', ['Los Angeles Sparks', 'LA Sparks', 'Sparks']],
    ['min', ['Minnesota Lynx', 'Minnesota', 'Lynx']],
    ['ny', ['New York Liberty', 'NY Liberty', 'Liberty', 'NYL']],
    ['phx', ['Phoenix Mercury', 'Phoenix', 'Mercury', 'PHO']],
    ['sea', ['Seattle Storm', 'Seattle', 'Storm']],
    ['wsh', ['Washington Mystics', 'Washington', 'Mystics', 'WAS']],
  ]),
}

// Map a team identifier to its ESPN abbr (lowercase) for a sport, or null.
// Also accepts an already-correct abbr.
export function abbrFor(sport, teamText) {
  const map = TEAM_ABBR[String(sport || '').toUpperCase()]
  if (!map) return null
  const key = norm(teamText)
  if (!key) return null
  return map[key] || null
}

// Full ESPN crest URL for a team, or null if the abbr is unknown.
export function teamLogoUrl(sport, teamText) {
  const league = LEAGUE_PATH[String(sport || '').toUpperCase()]
  const abbr = abbrFor(sport, teamText)
  if (!league || !abbr) return null
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${abbr}.png`
}

// Parse "AWAY@HOME" or "Away Name vs Home Name" → { away, home } raw strings (or nulls).
export function teamsFromText(text) {
  const t = String(text || '').trim()
  if (!t) return { away: null, home: null }
  // " vs " / " vs. " / " v " separators (whitespace-bounded).
  let m = t.split(/\s+vs?\.?\s+/i)
  if (m.length === 2) return { away: m[0].trim() || null, home: m[1].trim() || null }
  // "@" separator (with or without surrounding spaces).
  if (t.includes('@')) {
    const parts = t.split('@')
    if (parts.length === 2) return { away: parts[0].trim() || null, home: parts[1].trim() || null }
  }
  return { away: null, home: null }
}

// From a single-team pick title, extract the team token the pick names.
// e.g. "ATL ML", "PHI -1.5", "BOS@SEA Over 7.5" (team-led) → leading token.
function pickedTeamToken(title) {
  const t = String(title || '').trim()
  if (!t) return null
  // "AWAY@HOME ..." style — the pick text leads with the matchup, not one side; bail.
  if (/^[A-Za-z]+@[A-Za-z]+/.test(t)) return null
  // Leading team token: a run of letters (+ optional place words) before the market word.
  const m = t.match(/^([A-Za-z][A-Za-z.'\- ]*?)\s+(ML|[-+]?\d|moneyline|line|spread)/i)
  if (m) return m[1].trim()
  // Single bare token (e.g. "ATL").
  const bare = t.match(/^([A-Za-z]{2,4})$/)
  if (bare) return bare[1]
  return null
}

// Resolve crest(s) for a bet from the TEAM itself. Returns { logo, logo2 }, nulls graceful.
//   - isTotal (over/under) → both crests { logo: away, logo2: home }.
//   - else (ML/spread) → the picked side's crest in `logo`, logo2 null.
// Never throws.
export function resolveBetLogos({ sport, title, event, isTotal } = {}) {
  let out = { logo: null, logo2: null }
  try {
    const { away, home } = teamsFromText(event)
    const awayUrl = teamLogoUrl(sport, away)
    const homeUrl = teamLogoUrl(sport, home)
    if (isTotal) {
      out.logo = awayUrl
      out.logo2 = homeUrl
      return out
    }
    // Single-team pick: figure out which side the title names.
    const token = pickedTeamToken(title)
    const tokenUrl = token ? teamLogoUrl(sport, token) : null
    if (tokenUrl) {
      out.logo = tokenUrl
      return out
    }
    // Couldn't tell from title — prefer away, else home.
    out.logo = awayUrl || homeUrl || null
    return out
  } catch {
    return { logo: null, logo2: null }
  }
}
