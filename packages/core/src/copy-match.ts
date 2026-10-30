// Copy rule (Cisco, 2026-10-29): a post that is at least 95% the same as an earlier post that
// earned points is a copy and earns nothing. Similar topic or style is not a copy, and length is
// never a signal: the comparison is relative, character for character.
export const COPY_THRESHOLD_BPS = 9_500;

const BPS = 10_000;

// Bare domains use the IANA root snapshot, not any word after a dot or Chinese full stop.
// https://data.iana.org/TLD/tlds-alpha-by-domain.txt — version 2026103000, 2026-10-30.
const ROOT_TLDS = new Set(
  `
  aaa aarp abb abbott abbvie abc able abogado abudhabi ac academy accenture accountant
  accountants aco actor ad ads adult ae aeg aero aetna af afl africa ag agakhan agency ai
  aig airbus airforce airtel akdn al alibaba alipay allfinanz allstate ally alsace alstom
  am amazon americanexpress americanfamily amex amfam amica amsterdam analytics android
  anquan anz ao aol apartments app apple aq aquarelle ar arab aramco archi army arpa art
  arte as asda asia associates at athleta attorney au auction audi audible audio auspost
  author auto autos aw aws ax axa az azure ba baby baidu banamex band bank bar barcelona
  barclaycard barclays barefoot bargains baseball basketball bauhaus bayern bb bbc bbt
  bbva bcg bcn bd be beats beauty beer berlin best bestbuy bet bf bg bh bharti bi bible
  bid bike bing bingo bio biz bj black blackfriday blockbuster blog bloomberg blue bm bms
  bmw bn bnpparibas bo boats boehringer bofa bom bond boo book booking bosch bostik boston
  bot boutique box br bradesco bridgestone broadway broker brother brussels bs bt build
  builders business buy buzz bv bw by bz bzh ca cab cafe cal call calvinklein cam camera
  camp canon capetown capital capitalone car caravan cards care career careers cars casa
  case cash casino cat catering catholic cba cbn cbre cc cd center ceo cern cf cfa cfd cg
  ch chanel channel charity chase chat cheap chintai christmas chrome church ci cipriani
  circle cisco citadel citi citic city ck cl claims cleaning click clinic clinique
  clothing cloud club clubmed cm cn co coach codes coffee college cologne com commbank
  community company compare computer comsec condos construction consulting contact
  contractors cooking cool coop corsica country coupon coupons courses cpa cr credit
  creditcard creditunion cricket crown crs cruise cruises cu cuisinella cv cw cx cy cymru
  cyou cz dad dance data date dating datsun day dclk dds de deal dealer deals degree
  delivery dell deloitte delta democrat dental dentist desi design dev dhl diamonds diet
  digital direct directory discount discover dish diy dj dk dm dnp do docs doctor dog
  domains dot download drive dtv dubai dupont durban dvag dvr dz earth eat ec eco edeka
  edu education ee eg email emerck energy engineer engineering enterprises epson equipment
  er ericsson erni es esq estate et eu eurovision eus events exchange expert exposed
  express extraspace fage fail fairwinds faith family fan fans farm farmers fashion fast
  fedex feedback ferrari ferrero fi fidelity fido film final finance financial fire
  firestone firmdale fish fishing fit fitness fj fk flickr flights flir florist flowers
  fly fm fo foo food football ford forex forsale forum foundation fox fr free fresenius
  frl frogans frontier ftr fujitsu fun fund furniture futbol fyi ga gal gallery gallo
  gallup game games gap garden gay gb gbiz gd gdn ge gea gent genting george gf gg ggee gh
  gi gift gifts gives giving gl glass gle global globo gm gmail gmbh gmo gmx gn godaddy
  gold goldpoint golf goodyear goog google gop got gov gp gq gr grainger graphics gratis
  green gripe grocery group gs gt gu gucci guge guide guitars guru gw gy hair hamburg
  hangout haus hbo hdfc hdfcbank health healthcare help here hermes hiphop hisamitsu
  hitachi hiv hk hkt hm hn hockey holdings holiday homedepot homegoods homes homesense
  honda horse hospital host hosting hot hotels hotmail house how hr hsbc ht hu hughes
  hyatt hyundai ibm icbc ice icu id ie ieee ifm ikano il im imamat imdb immo immobilien in
  inc industries infiniti info ing ink institute insurance insure int international intuit
  investments io ipiranga iq ir irish is ismaili ist istanbul it itau itv jaguar java jcb
  je jeep jetzt jewelry jio jll jm jmp jnj jo jobs joburg jot joy jp jpmorgan jprs juegos
  kaufen kddi ke kerryhotels kerryproperties kfh kg kh ki kia kids kim kindle kitchen kiwi
  km kn koeln komatsu kosher kp kpmg kpn kr krd kred kuokgroup kw ky kyoto kz la lacaixa
  lamborghini lamer land landrover lanxess lasalle lat latino latrobe law lawyer lb lc lds
  lease leclerc lefrak legal lego lexus lgbt li lidl life lifeinsurance lifestyle lighting
  like lilly limited limo lincoln link live living lk llc llp loan loans locker locus lol
  london lotte lotto love lpl lplfinancial lr ls lt ltd ltda lu lundbeck luxe luxury lv ly
  ma madrid maif maison makeup man management mango map market marketing markets marriott
  marshalls mattel mba mc mckinsey md me med media meet melbourne meme memorial men menu
  merck merckmsd mg mh miami microsoft mil mini mint mit mitsubishi mk ml mlb mls mm mma
  mn mo mobi mobile moda moe moi mom monash money monster mormon mortgage moscow moto
  motorcycles mov movie mp mq mr ms msd mt mtn mtr mu museum music mv mw mx my mz na nab
  nagoya name navy nba nc ne nec net netbank netflix network neustar new news next
  nextdirect nexus nf nfl ng ngo nhk ni nico nike nikon ninja nissan nissay nl no nokia
  norton now nowruz nowtv np nr nra nrw ntt nu nyc nz obi observer office okinawa olayan
  olayangroup ollo om omega one ong onl online ooo open oracle orange org organic origins
  osaka otsuka ott ovh pa page panasonic paris pars partners parts party pay pccw pe pet
  pf pfizer pg ph pharmacy phd philips phone photo photography photos physio pics pictet
  pictures pid pin ping pink pioneer pizza pk pl place play playstation plumbing plus pm
  pn pnc pohl poker politie porn post pr praxi press prime pro prod productions prof
  progressive promo properties property protection pru prudential ps pt pub pw pwc py qa
  qpon quebec quest racing radio re read realestate realtor realty recipes red redumbrella
  rehab reise reisen reit reliance ren rent rentals repair report republican rest
  restaurant review reviews rexroth rich richardli ricoh ril rio rip ro rocks rodeo rogers
  room rs rsvp ru rugby ruhr run rw rwe ryukyu sa saarland safe safety sakura sale salon
  samsclub samsung sandvik sandvikcoromant sanofi sap sarl sas save saxo sb sbi sbs sc scb
  schaeffler schmidt scholarships school schule schwarz science scot sd se search seat
  secure security seek select sener services seven sew sex sexy sfr sg sh shangrila sharp
  shell shia shiksha shoes shop shopping shouji show si silk sina singles site sj sk ski
  skin sky skype sl sling sm smart smile sn sncf so soccer social softbank software sohu
  solar solutions song sony soy spa space sport spot sr srl ss st stada staples star
  statebank statefarm stc stcgroup stockholm storage store stream studio study style su
  sucks supplies supply support surf surgery suzuki sv swatch swiss sx sy sydney systems
  sz tab taipei talk taobao target tatamotors tatar tattoo tax taxi tc tci td tdk team
  tech technology tel temasek tennis teva tf tg th thd theater theatre tiaa tickets tienda
  tips tires tirol tj tjmaxx tjx tk tkmaxx tl tm tmall tn to today tokyo tools top toray
  toshiba total tours town toyota toys tr trade trading training travel travelers
  travelersinsurance trust trv tt tube tui tunes tushu tv tvs tw tz ua ubank ubs ug uk
  unicom university uno uol ups us uy uz va vacations vana vanguard vc ve vegas ventures
  verisign versicherung vet vg vi viajes video vig viking villas vin vip virgin visa
  vision viva vivo vlaanderen vn vodka volvo vote voting voto voyage vu wales walmart
  walter wang wanggou watch watches weather weatherchannel web webcam weber website wed
  wedding weibo weir wf whoswho wien wiki williamhill win windows wine winners wme
  woodside work works world wow ws wtc wtf xbox xerox xihuan xin xn--11b4c3d xn--1ck2e1b
  xn--1qqw23a xn--2scrj9c xn--30rr7y xn--3bst00m xn--3ds443g xn--3e0b707e xn--3hcrj9c
  xn--3pxu8k xn--42c2d9a xn--45br5cyl xn--45brj9c xn--45q11c xn--4dbrk0ce xn--4gbrim
  xn--54b7fta0cc xn--55qw42g xn--55qx5d xn--5su34j936bgsg xn--5tzm5g xn--6frz82g
  xn--6qq986b3xl xn--80adxhks xn--80ao21a xn--80aqecdr1a xn--80asehdb xn--80aswg
  xn--8y0a063a xn--90a3ac xn--90ae xn--90ais xn--9dbq2a xn--9et52u xn--9krt00a
  xn--b4w605ferd xn--bck1b9a5dre4c xn--c1avg xn--c2br7g xn--cck2b3b xn--cckwcxetd
  xn--cg4bki xn--clchc0ea0b2g2a9gcd xn--czr694b xn--czrs0t xn--czru2d xn--d1acj3b
  xn--d1alf xn--e1a4c xn--eckvdtc9d xn--efvy88h xn--fct429k xn--fhbei xn--fiq228c5hs
  xn--fiq64b xn--fiqs8s xn--fiqz9s xn--fjq720a xn--flw351e xn--fpcrj9c3d xn--fzc2c9e2c
  xn--fzys8d69uvgm xn--g2xx48c xn--gckr3f0f xn--gecrj9c xn--gk3at1e xn--h2breg3eve
  xn--h2brj9c xn--h2brj9c8c xn--hxt814e xn--i1b6b1a6a2e xn--imr513n xn--io0a7i xn--j1aef
  xn--j1amh xn--j6w193g xn--jlq480n2rg xn--jvr189m xn--kcrx77d1x4a xn--kprw13d xn--kpry57d
  xn--kput3i xn--l1acc xn--lgbbat1ad8j xn--mgb9awbf xn--mgba3a3ejt xn--mgba3a4f16a
  xn--mgba7c0bbn0a xn--mgbaam7a8h xn--mgbab2bd xn--mgbah1a3hjkrd xn--mgbai9azgqp6j
  xn--mgbayh7gpa xn--mgbbh1a xn--mgbbh1a71e xn--mgbc0a9azcg xn--mgbca7dzdo
  xn--mgbcpq6gpa1a xn--mgberp4a5d4ar xn--mgbgu82a xn--mgbi4ecexp xn--mgbpl2fh xn--mgbt3dhd
  xn--mgbtx2b xn--mgbx4cd0ab xn--mix891f xn--mk1bu44c xn--mxtq1m xn--ngbc5azd xn--ngbe9e0a
  xn--ngbrx xn--node xn--nqv7f xn--nqv7fs00ema xn--nyqy26a xn--o3cw4h xn--ogbpf8fl
  xn--otu796d xn--p1acf xn--p1ai xn--pgbs0dh xn--pssy2u xn--q7ce6a xn--q9jyb4c
  xn--qcka1pmc xn--qxa6a xn--qxam xn--rhqv96g xn--rovu88b xn--rvc1e0am3e xn--s9brj9c
  xn--ses554g xn--t60b56a xn--tckwe xn--tiq49xqyj xn--unup4y xn--vermgensberater-ctb
  xn--vermgensberatung-pwb xn--vhquv xn--vuq861b xn--w4r85el8fhu5dnra xn--w4rs40l
  xn--wgbh1c xn--wgbl6a xn--xhq521b xn--xkc2al3hye2a xn--xkc2dl3a5ee0h xn--y9a3aq
  xn--yfro4i67o xn--ygbi2ammx xn--zfr164b xxx xyz yachts yahoo yamaxun yandex ye yodobashi
  yoga yokohama you youtube yt yun za zappos zara zero zip zm zone zuerich zw
  `
    .trim()
    .split(/\s+/),
);

// Also recognize IANA special-use roots used by examples, local networks and alternate namespaces.
// https://www.iana.org/assignments/special-use-domain-names (2026-05-22).
for (const root of ["alt", "example", "invalid", "local", "localhost", "onion", "test"]) {
  ROOT_TLDS.add(root);
}

// IDNA includes contextual joiners and a small set of punctuation/symbol exceptions (RFC 5892).
const HOST_CHAR = String.raw`[\p{L}\p{M}\p{N}\p{Cf}\p{Default_Ignorable_Code_Point}\u00b7\u0375\u05f3\u05f4\u06fd\u06fe\u0f0b\u30fb_-]`;

// A link: a scheme or www with everything after it, X's own short hosts, a domain followed by a
// path, query or fragment, or a bare domain, including Unicode and punycode domains and ports.
// Without a scheme, IP literals need a port or URL suffix; version numbers remain ordinary text.
// Bare hosts must end in a registered root; ordinary prose, abbreviations and numbers stay text.
// Unicode boundaries prevent removing only the ASCII tail of a domain. A domain
// search cannot restart after one of its own labels: failed dotted tokens must stay linear.
const LINK = new RegExp(
  [
    String.raw`(?:https?:\/\/|www\.)\S+`,
    String.raw`\b(?:t\.co|pic\.twitter\.com|pic\.x\.com)\/\S*`,
    String.raw`(?<![\p{L}\p{M}\p{N}_.-])(?:[0-9]{1,3}[.\u3002]){3}[0-9]{1,3}[.\u3002]?` +
      String.raw`(?![\p{L}\p{M}\p{N}_.-])(?::[0-9]+(?:[/?#]\S*)?|[/?#]\S*)`,
    String.raw`(?<![\p{L}\p{M}\p{N}_])\[[0-9a-f:.]+\]` +
      String.raw`(?::[0-9]+(?:[/?#]\S*)?|[/?#]\S*)`,
    String.raw`(?<!${HOST_CHAR})(?<!${HOST_CHAR}[.\u3002])` +
      String.raw`(?:${HOST_CHAR}+[.\u3002])+` +
      `${HOST_CHAR}+(?!${HOST_CHAR})` +
      String.raw`[.\u3002]?(?::[0-9]+)?(?:[/?#]\S*)?`,
  ].join("|"),
  "gu",
);
const KEYCAP = /[0-9#*]\u{FE0F}?\u{20E3}/gu;
// Tag characters (U+E0020 to U+E007F) carry the subdivision of a flag such as England's.
const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u{E0020}-\u{E007F}]|\u{200D}|[\u{FE0E}\u{FE0F}]/gu;

const labelCanFitDns = (label: string): boolean =>
  [...label.replace(/\p{Default_Ignorable_Code_Point}/gu, "").normalize("NFKC")].length <= 63;

function withoutLink(link: string): string {
  if (/^(?:https?:\/\/|www\.)/u.test(link)) return " ";
  if (link.startsWith("[") || /^[0-9]{1,3}(?:[.\u3002][0-9]{1,3}){3}[.\u3002]?[:/?#]/u.test(link)) {
    try {
      new URL(`https://${link}`);
      return " ";
    } catch {
      return link;
    }
  }
  const host = (link.split(/[/?#]/, 1)[0] ?? "").replace(/:[0-9]+$/, "").replace(/[.\u3002]$/, "");
  const root = host.split(/[.\u3002]/).at(-1) ?? "";
  // A root label cannot exceed 63 ASCII bytes; reject long prose before IDNA processing.
  if (!labelCanFitDns(root)) return link;
  try {
    const asciiRoot = new URL(`https://${root}`).hostname;
    if (!ROOT_TLDS.has(asciiRoot)) return link;
    // DNS labels cannot encode more than 63 bytes. Check a lower bound before IDNA work;
    // ignored characters do not contribute, so valid hosts with long ignored runs still parse.
    const labels = host.split(/[.\u3002]/);
    if (labels.some((label) => !labelCanFitDns(label))) {
      return link;
    }
    const parsedHost = new URL(`https://${link}`).hostname.replace(/\.$/, "");
    if (parsedHost.length > 253 || parsedHost.split(".").some((label) => label.length > 63)) {
      return link;
    }
    return " ";
  } catch {
    return link;
  }
}

// What the rule ignores when comparing: case, spacing, links, @mentions and emoji. Emoji go before
// the compatibility folding, which would otherwise turn some of them (TM, !!) into plain text.
export function copyNormalize(text: string): string {
  return text
    .replace(KEYCAP, "")
    .replace(EMOJI, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(LINK, withoutLink)
    .replace(/@[a-z0-9_]{1,15}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A post prepared once for many comparisons.
export interface CopyKey {
  text: string;
  chars: Uint32Array;
  counts: Map<number, number>;
}

export function copyKey(text: string): CopyKey {
  const normalized = copyNormalize(text);
  const chars = Uint32Array.from(normalized, (c) => c.codePointAt(0) ?? 0);
  const counts = new Map<number, number>();
  for (const c of chars) counts.set(c, (counts.get(c) ?? 0) + 1);
  return { text: normalized, chars, counts };
}

// Half the difference between the two character histograms never exceeds the edit distance, so a
// pair above the limit here is rejected without the quadratic work.
function histogramBound(a: CopyKey, b: CopyKey): number {
  let difference = 0;
  for (const [c, n] of a.counts) difference += Math.abs(n - (b.counts.get(c) ?? 0));
  for (const [c, n] of b.counts) if (!a.counts.has(c)) difference += n;
  return Math.ceil(difference / 2);
}

// Levenshtein distance, exact up to `limit`; any larger distance returns `limit + 1`. Only the
// diagonal band of width `limit` is computed, over two reused rows.
function boundedDistance(a: Uint32Array, b: Uint32Array, limit: number): number {
  const over = limit + 1;
  if (Math.abs(a.length - b.length) > limit) return over;
  let previous = new Int32Array(b.length + 1).fill(over);
  let current = new Int32Array(b.length + 1).fill(over);
  for (let j = 0; j <= Math.min(b.length, limit); j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const from = Math.max(1, i - limit);
    const to = Math.min(b.length, i + limit);
    current[from - 1] = from === 1 && i <= limit ? i : over;
    let rowMin = current[from - 1] as number;
    const symbol = a[i - 1];
    for (let j = from; j <= to; j++) {
      const substitution = (previous[j - 1] as number) + (symbol === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] as number) + 1;
      const insertion = (current[j - 1] as number) + 1;
      const best = Math.min(substitution, deletion, insertion, over);
      current[j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (to < b.length) current[to + 1] = over;
    if (rowMin > limit) return over;
    [previous, current] = [current, previous];
  }
  return Math.min(previous[b.length] as number, over);
}

// Positions that differ when the two are laid side by side; an upper bound on the distance when
// they have the same length.
function hammingWithin(a: Uint32Array, b: Uint32Array, limit: number): boolean {
  let differing = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++differing > limit) return false;
  }
  return true;
}

function limitFor(candidate: CopyKey, earlier: CopyKey, thresholdBps: number): number {
  if (!Number.isInteger(thresholdBps) || thresholdBps < 1 || thresholdBps > BPS) {
    throw new RangeError("thresholdBps must be an integer from 1 to 10000");
  }
  const longest = Math.max(candidate.chars.length, earlier.chars.length);
  return Math.floor(((BPS - thresholdBps) * longest) / BPS);
}

// The answer when it costs no more than a linear pass, or undefined when the edit check is needed.
export function quickCopyVerdict(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean | undefined {
  const limit = limitFor(candidate, earlier, thresholdBps);
  // Nothing left to compare (a bare link or emoji) is never a copy of anything.
  if (candidate.chars.length === 0 || earlier.chars.length === 0) return false;
  if (candidate.text === earlier.text) return true;
  if (Math.abs(candidate.chars.length - earlier.chars.length) > limit) return false;
  if (histogramBound(candidate, earlier) > limit) return false;
  if (
    candidate.chars.length === earlier.chars.length &&
    hammingWithin(candidate.chars, earlier.chars, limit)
  ) {
    return true;
  }
  return undefined;
}

// Insertion/deletion matching is limited to 2,000 normalized characters to bound each comparison.
// Longer posts still use the identical-text and positional-substitution checks above.
export function editCopyVerdict(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  const limit = limitFor(candidate, earlier, thresholdBps);
  const a = candidate.chars;
  const b = earlier.chars;
  if (a.length > 2_000 || b.length > 2_000) return false;
  // Text both posts share at either end does not change the distance and is not worked through.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return boundedDistance(a.subarray(start, endA), b.subarray(start, endB), limit) <= limit;
}

export function isCopyKey(
  candidate: CopyKey,
  earlier: CopyKey,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  return (
    quickCopyVerdict(candidate, earlier, thresholdBps) ??
    editCopyVerdict(candidate, earlier, thresholdBps)
  );
}

export function isCopy(
  candidate: string,
  earlier: string,
  thresholdBps: number = COPY_THRESHOLD_BPS,
): boolean {
  return isCopyKey(copyKey(candidate), copyKey(earlier), thresholdBps);
}

// `earlier` is ordered by acceptance (server clock, then intake id); the first match is the original.
export function firstCopyOf<T extends { text: string }>(
  candidate: string,
  earlier: readonly T[],
  thresholdBps: number = COPY_THRESHOLD_BPS,
): T | undefined {
  const key = copyKey(candidate);
  return earlier.find((post) => isCopyKey(key, copyKey(post.text), thresholdBps));
}
