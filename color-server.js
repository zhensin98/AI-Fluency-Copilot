/**
 * color-server.js  —  Copilot Training Platform
 * Standalone local server for the Copilot folder.
 * Profiles are saved to Copilot/profile/
 *
 * Usage: node color-server.js   (run from the Copilot folder)
 * Runs on port 3002 (YS server uses 3001).
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const PORT = 3002;

// ── Profile storage ───────────────────────────────────────────────────────────
const PROFILES_DIR = path.join(__dirname, 'profile');
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

// ── Fetch a URL (follows redirects, returns body string) ──────────────────────
function fetchUrl(targetUrl, redirects) {
  redirects = redirects || 0;
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise(function (resolve, reject) {
    var parsed;
    try { parsed = new URL(targetUrl); } catch(e) { return reject(new Error('Invalid URL')); }
    var client = parsed.protocol === 'https:' ? https : http;
    var options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html,text/css,*/*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    };
    var req = client.get(options, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var next = res.headers.location;
        if (next.startsWith('/')) next = parsed.origin + next;
        res.resume();
        return fetchUrl(next, redirects + 1).then(resolve).catch(reject);
      }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end',  function ()  { resolve(Buffer.concat(chunks).toString('utf8')); });
      res.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', function () { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ── Color math ────────────────────────────────────────────────────────────────
function hexToHsl(hex) {
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  var max = Math.max(r,g,b), min = Math.min(r,g,b);
  var h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    var d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6;          break;
      default:h = ((r-g)/d + 4)/6;
    }
  }
  return { h: h*360, s: s, l: l };
}
function hue2rgb(p,q,t) {
  if (t<0) t+=1; if (t>1) t-=1;
  if (t<1/6) return p+(q-p)*6*t;
  if (t<1/2) return q;
  if (t<2/3) return p+(q-p)*(2/3-t)*6;
  return p;
}
function hslToHex(h,s,l) {
  h = h/360;
  var r,g,b;
  if (s===0) { r=g=b=l; }
  else {
    var q = l<0.5 ? l*(1+s) : l+s-l*s;
    var p = 2*l-q;
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3);
  }
  function toH(x) { return ('0'+Math.round(x*255).toString(16)).slice(-2); }
  return '#'+toH(r)+toH(g)+toH(b);
}
function darken(hex, amt)  { var c=hexToHsl(hex); return hslToHex(c.h, c.s, Math.max(0,c.l-amt)); }
function lighten(hex, amt) { var c=hexToHsl(hex); return hslToHex(c.h, c.s, Math.min(1,c.l+amt)); }
function isNeutral(hex)    { var c=hexToHsl(hex); return c.s<0.12 || c.l<0.08 || c.l>0.92; }

// ── Extract hex colors from CSS ───────────────────────────────────────────────
function extractHexColors(css) {
  var out = [], m;
  var re = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  while ((m = re.exec(css)) !== null) {
    var h = m[1];
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    out.push('#'+h.toUpperCase());
  }
  return out;
}

// ── Extract brand colors from a website ──────────────────────────────────────
async function extractBrandColors(websiteUrl) {
  if (!/^https?:\/\//i.test(websiteUrl)) websiteUrl = 'https://' + websiteUrl;
  var html = await fetchUrl(websiteUrl);
  var origin = new URL(websiteUrl).origin;
  var m;

  var tier1 = [];
  var themeRe = /<meta[^>]+(?:name=["']theme-color["'][^>]+content=["'](#[0-9A-Fa-f]{6})["']|content=["'](#[0-9A-Fa-f]{6})["'][^>]+name=["']theme-color["'])/gi;
  while ((m = themeRe.exec(html)) !== null) {
    var tc = (m[1] || m[2]).toUpperCase();
    if (!isNeutral(tc)) tier1.push(tc);
  }

  var tier2 = [];
  var elemRe = /<(?:header|nav|button)[^>]+style=["']([^"']*)["'][^>]*>/gi;
  while ((m = elemRe.exec(html)) !== null) {
    var hexes = m[1].match(/#[0-9A-Fa-f]{6}/g) || [];
    hexes.forEach(function(c) { if (!isNeutral(c.toUpperCase())) tier2.push(c.toUpperCase()); });
  }

  var allCss = '';
  var styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html)) !== null) allCss += m[1] + '\n';

  var linkRe = /<link[^>]+stylesheet[^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]+stylesheet/gi;
  var cssUrls = [];
  while ((m = linkRe.exec(html)) !== null) {
    var href = m[1] || m[2];
    if (!href) continue;
    if (href.startsWith('//'))       href = 'https:' + href;
    else if (href.startsWith('/'))   href = origin + href;
    else if (!/^https?:/.test(href)) href = origin + '/' + href;
    cssUrls.push(href);
  }
  for (var i = 0; i < Math.min(cssUrls.length, 4); i++) {
    try { allCss += (await fetchUrl(cssUrls[i])) + '\n'; } catch(e) {}
  }

  var varRe = /--(primary(?:-[\w]+)?|brand(?:-[\w]+)?|[\w]+-primary|[\w]+-brand)\s*:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})\b/gi;
  var tier3 = [];
  while ((m = varRe.exec(allCss)) !== null) {
    var h = m[2];
    if (h.length === 4) h = '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    if (!isNeutral(h.toUpperCase())) tier3.push(h.toUpperCase());
  }

  var allColors = extractHexColors(allCss);
  var counts = {};
  allColors.forEach(function(c) { if (!isNeutral(c)) counts[c] = (counts[c]||0)+1; });
  var tier4 = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })
    .filter(function(c) { var hsl=hexToHsl(c); return hsl.l>=0.20 && hsl.l<=0.85; });
  if (!tier4.length) tier4 = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; });

  var seen = {}, candidates = [];
  tier1.concat(tier2).concat(tier3).concat(tier4).forEach(function(c) {
    if (!seen[c]) { seen[c]=true; candidates.push(c); }
  });
  if (!candidates.length) candidates = ['#4299E1'];

  var primary = candidates[0];
  var primaryHsl = hexToHsl(primary);
  var accent = candidates.find(function(c) {
    return Math.abs(hexToHsl(c).h - primaryHsl.h) > 40;
  }) || hslToHex((primaryHsl.h + 180) % 360, Math.min(primaryHsl.s, 0.8), Math.min(primaryHsl.l, 0.5));

  return {
    primary:      primary,
    primaryDark:  darken(primary, 0.12),
    primaryLight: lighten(primary, 0.08),
    accent:       accent,
    sidebarBg:    darken(primary, 0.22)
  };
}

// ── Strip HTML to plain text ──────────────────────────────────────────────────
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

// ── Call Claude via local CLI ─────────────────────────────────────────────────
function callClaudeLocal(prompt) {
  var spawn = require('child_process').spawn;
  return new Promise(function(resolve, reject) {
    var proc = spawn('claude', ['--print'], { windowsHide: true, shell: true });
    var output = '', errOutput = '', timedOut = false;
    var timer = setTimeout(function() {
      timedOut = true;
      proc.kill('SIGTERM');
      reject(new Error('Claude CLI timed out after 20 minutes'));
    }, 1200000);
    proc.stdout.on('data', function(d) { output    += d.toString(); });
    proc.stderr.on('data', function(d) { errOutput += d.toString(); });
    proc.on('close', function(code) {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0 && !output.trim()) {
        return reject(new Error('Claude CLI exited with code ' + code +
          (errOutput ? ': ' + errOutput.slice(0, 300) : '') +
          ' — make sure Claude Code is installed and logged in (run: claude)'));
      }
      resolve(output.trim());
    });
    proc.on('error', function(err) {
      clearTimeout(timer);
      reject(new Error('Cannot run "claude" CLI: ' + err.message));
    });
    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();
  });
}

// ── Template-based use case generation (no second AI call needed) ─────────────
function extractPain(text, index) {
  if (!text) return 'Manual, repetitive work that slows down delivery';
  var parts = text.split(/[.;]/).map(function(p){return p.trim();}).filter(Boolean);
  return parts[index % parts.length] || parts[0];
}
function extractObj(text, index) {
  if (!text) return 'Deliver high-quality outcomes efficiently';
  var parts = text.split(/[.;]/).map(function(p){return p.trim();}).filter(Boolean);
  return parts[index % parts.length] || parts[0];
}
// Split keyActivities (comma-separated) into an array
function extractActivities(text) {
  if (!text) return [];
  return text.split(',').map(function(a){return a.trim();}).filter(Boolean);
}

// ── Relevance scoring: only include habits that genuinely fit the role ────────
// Each habit has signal keywords — the more a role's activities match, the higher the score.
// A score of 0 means this habit type is irrelevant for this role and should be skipped.
var HABIT_SIGNALS = {
  'CH1': [],                                                                   // Quick answers — always useful
  'CH2': ['research','find','information','policy','knowledge','topic','best practice'],
  'CH3': ['email','write','draft','communicate','message','follow-up','reply','invite','notice'],
  'CH4': ['meeting','notes','minutes','discussion','action','recap','debrief','review','feedback'],
  'CH5': ['create','template','document','brief','guide','onboard','material','content','build','update'],
  'CH6': ['review','read','extract','summarise','report','policy','contract','document','ticket'],
  'CH7': ['data','analyse','excel','metrics','sales','dashboard','figures','variance','forecast','report','power bi'],
  'MH1': [],                                                                   // Daily briefing — always useful
  'MH2': ['email','outlook','reply','respond','communicate','message','follow-up','invite'],
  'MH3': ['meeting','teams','agenda','notes','calendar','debrief','discussion'],
  'MH4': ['search','find','document','sharepoint','file','knowledge','policy','reference'],
  'MH5': ['report','word','document','draft','write','brief','proposal','summary','guide'],
  'MH6': ['review','summarise','read','document','policy','report','ticket','contract'],
  'MH7': ['data','excel','analyse','spreadsheet','metrics','sales','power bi','dashboard','figures','variance','forecast']
};

function scoreHabitForRole(habitId, role) {
  var signals = HABIT_SIGNALS[habitId];
  if (!signals || signals.length === 0) return 100; // Always relevant
  var kw = ((role.keyActivities||'') + ' ' + (role.objectives||'') + ' ' + (role.painPoints||'')).toLowerCase();
  var score = 0;
  signals.forEach(function(signal) { if (kw.indexOf(signal) >= 0) score += 10; });
  return score;
}

// ── Context matchers: map a role to its most relevant workflow, tech, priority ──
function findWorkflowForRole(role, workflows) {
  if (!workflows || !workflows.length) return null;
  var kw = ((role.keyActivities || '') + ' ' + (role.role || '') + ' ' + (role.painPoints || '')).toLowerCase();
  var best = null, bestScore = -1;
  workflows.forEach(function(wf) {
    var wfText = (wf.name + ' ' + (wf.friction || '') + ' ' + (wf.steps || []).map(function(s){return s.t + ' ' + s.d;}).join(' ')).toLowerCase();
    var score = 0;
    wfText.split(/\s+/).forEach(function(word) {
      if (word.length > 4 && kw.indexOf(word) >= 0) score++;
    });
    if (score > bestScore) { bestScore = score; best = wf; }
  });
  return best;
}

function findTechForRole(role, platforms) {
  if (!platforms || !platforms.length) return null;
  var kw = ((role.keyActivities || '') + ' ' + (role.objectives || '')).toLowerCase();
  for (var i = 0; i < platforms.length; i++) {
    var pName = platforms[i].name.toLowerCase().split(/[\s\/]/)[0];
    if (kw.indexOf(pName) >= 0) return platforms[i];
  }
  return null;
}

function findPriorityForRole(role, priorities) {
  if (!priorities || !priorities.length) return null;
  var kw = ((role.role || '') + ' ' + (role.keyActivities || '') + ' ' + (role.objectives || '')).toLowerCase();
  var best = null, bestScore = -1;
  priorities.forEach(function(p) {
    var score = 0;
    (p.roles || '').split(',').forEach(function(r) {
      var rt = r.trim().toLowerCase();
      if (rt.length > 2 && kw.indexOf(rt) >= 0) score += 3;
    });
    (p.title + ' ' + (p.pains || '')).toLowerCase().split(/\s+/).forEach(function(word) {
      if (word.length > 4 && kw.indexOf(word) >= 0) score++;
    });
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return best;
}

function buildChatUseCaseForRole(habitIndex, role, clientInfo, ucId, ctx) {
  var coShort = (clientInfo && (clientInfo.shortName || clientInfo.name)) || 'the organisation';
  var pain0 = extractPain(role.painPoints, 0);
  var pain1 = extractPain(role.painPoints, 1);
  var pain2 = extractPain(role.painPoints, 2);
  var obj0  = extractObj(role.objectives, 0);

  var acts = extractActivities(role.keyActivities);
  var act = function(i) { return acts[i % acts.length] || role.role + ' tasks'; };
  var a0=act(0), a1=act(1), a2=act(2), a3=act(3), a4=act(4), a5=act(5);

  // Pull workflow, tech, priority context
  var wf       = (ctx && ctx.workflow)  || null;
  var tech     = (ctx && ctx.tech)      || null;
  var priority = (ctx && ctx.priority)  || null;
  var wfName      = wf       ? wf.name                                    : '';
  var wfFriction  = wf       ? (wf.friction || '')                         : '';
  var wfStep0     = wf && wf.steps && wf.steps[0] ? wf.steps[0].t         : '';
  var wfStep1     = wf && wf.steps && wf.steps[1] ? wf.steps[1].t         : '';
  var techName    = tech     ? tech.name                                   : '';
  var techDesc    = tech     ? tech.desc                                   : '';
  var priTitle    = priority ? priority.title                              : '';

  var habits = [
    // CH1 — Quick answer: tie to strategic priority so the question feels purposeful
    { id:'CH1', baseSaved:15, highPriority:false,
      name:'Get quick answers to support ' + a0,
      pain:pain0,
      prompt:'Explain [concept or process relevant to ' + a0 + '] as if I\'m a ' + role.role + ' at ' + coShort
        + (priTitle ? '. This supports our goal to ' + priTitle + '.' : '.')
        + ' Include: 1) a clear plain-language explanation 2) 3 practical steps I can take 3) one common mistake to avoid.',
      inputs:'None — general knowledge query',
      metric:'Understanding new concepts reduced from 30 min to 5 min',
      guardrails:'AI explanations are not expert advice; verify key facts with authoritative sources' },

    // CH2 — Research: reference the workflow friction point as the reason research is needed
    { id:'CH2', baseSaved:30, highPriority:true,
      name:'Research information needed for ' + a1,
      pain:pain1,
      prompt:'I need to research [specific topic] to help with ' + a1 + ' at ' + coShort
        + (wfName ? ' as part of the ' + wfName + ' process' : '')
        + '. Context: ' + (wfFriction || obj0)
        + '. Provide: 1) key findings with sources 2) how this applies to ' + coShort + ' 3) recommended next steps.',
      inputs:'None — web research or internal documents',
      metric:'Research time reduced from 2 hours to 15 minutes',
      guardrails:'Verify all facts against primary sources before acting; note any information cutoff dates' },

    // CH3 — Draft email: tie to a specific workflow step so the email has clear context
    { id:'CH3', baseSaved:20, highPriority:true,
      name:'Draft email for ' + a2,
      pain:pain2,
      prompt:'Draft an email to [recipient] about [topic] related to ' + a2 + ' at ' + coShort
        + (wfStep0 ? '. This is for the "' + wfStep0 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + '. Key points: [list]. Tone: professional. Length: ~200 words.',
      inputs:'Recipient, key message points, any relevant context',
      metric:'Email drafting time reduced from 20 to 5 minutes',
      guardrails:'Review all drafts before sending; do not include sensitive or confidential information' },

    // CH4 — Meeting notes: reference the workflow so notes are structured for that process
    { id:'CH4', baseSaved:35, highPriority:true,
      name:'Create structured notes from discussion about ' + a3,
      pain:pain0,
      prompt:'I\'m pasting notes from a discussion about ' + a3 + ' at ' + coShort
        + (wfName ? ' (part of the ' + wfName + ' workflow)' : '')
        + '. Create a structured summary with: 1) 3-sentence overview 2) key decisions or outcomes 3) action items with owners and deadlines 4) open questions.\n\n[Paste notes or transcript here]',
      inputs:'Paste meeting notes or transcript',
      metric:'Notes creation reduced from 60 to 10 minutes',
      guardrails:'Verify all attributed decisions are accurate; mark unclear items as [To Verify]' },

    // CH5 — Create document: reference the priority goal and workflow step
    { id:'CH5', baseSaved:30, highPriority:false,
      name:'Create a document or template for ' + a4,
      pain:pain1,
      prompt:'I need to create a [document type] to support ' + a4 + ' at ' + coShort
        + (priTitle ? ', aligned with our priority to ' + priTitle : '')
        + (wfStep1 ? '. This document will be used during the "' + wfStep1 + '" stage' : '')
        + '. Generate a detailed outline with 6-8 sections, key points per section, and suggested content.\n\nContext: ' + obj0,
      inputs:'Topic, audience, purpose, any existing notes',
      metric:'Document outline created in 15 minutes instead of 1 hour',
      guardrails:'Validate all factual claims before publishing; get appropriate approvals' },

    // CH6 — Extract from document: name the system the document came from
    { id:'CH6', baseSaved:30, highPriority:false,
      name:'Extract key information from documents for ' + a5,
      pain:pain2,
      prompt:'I\'m pasting a document'
        + (techName ? ' exported from ' + techName + ' (' + techDesc + ')' : '')
        + ' relevant to ' + a5 + ' at ' + coShort
        + '. Summarise: 1) key findings or decisions 2) action items 3) important dates or deadlines 4) any risks or issues flagged.\n\n[Paste document text here]',
      inputs:'Paste document, report, or ' + (techName ? techName + ' export' : 'reference text'),
      metric:'Document review time reduced from 60 to 10 minutes',
      guardrails:'Verify extracted details against original; flag any ambiguities for human review' },

    // CH7 — Analyse data: name the system the data comes from
    { id:'CH7', baseSaved:30, highPriority:false,
      name:'Analyse data relevant to ' + a0,
      pain:pain0,
      prompt:'I\'m pasting data'
        + (techName ? ' from ' + techName : '')
        + ' related to ' + a0 + ' at ' + coShort
        + (wfName ? ' as part of the ' + wfName + ' process' : '')
        + '. Analyse it and tell me: 1) key patterns or trends 2) outliers or anomalies 3) recommended actions 4) any data quality issues.\n\n[Paste data table here]',
      inputs:'Paste data table or metrics' + (techName ? ' from ' + techName : ' from a spreadsheet or report'),
      metric:'Data analysis time reduced from 3 hours to 20 minutes',
      guardrails:'Validate interpretation with relevant stakeholders; do not share individual-level sensitive data' }
  ];

  var hd = habits[habitIndex];
  var codeVal = (role.short||'').split('').reduce(function(s,c){return s+c.charCodeAt(0);},0);
  var timeSaved = Math.max(10, hd.baseSaved + ((codeVal * 3 + habitIndex * 11) % 20) - 7);
  var relevanceScore = scoreHabitForRole(hd.id, role);
  return { id:ucId, role:role.role, code:role.short, name:hd.name, pain:hd.pain,
    habitId:hd.id, entry:'Copilot Chat (microsoft365.com)',
    prompt:hd.prompt, inputs:hd.inputs, metric:hd.metric, guardrails:hd.guardrails,
    timeSaved:timeSaved, priority:hd.highPriority?'High':'Medium', relevanceScore:relevanceScore };
}

function buildM365UseCaseForRole(habitIndex, role, clientInfo, ucId, ctx) {
  var coShort = (clientInfo && (clientInfo.shortName || clientInfo.name)) || 'the organisation';
  var pain0 = extractPain(role.painPoints, 0);
  var pain1 = extractPain(role.painPoints, 1);
  var pain2 = extractPain(role.painPoints, 2);
  var obj0  = extractObj(role.objectives, 0);

  var acts = extractActivities(role.keyActivities);
  var act = function(i) { return acts[i % acts.length] || role.role + ' tasks'; };
  var a0=act(0), a1=act(1), a2=act(2), a3=act(3), a4=act(4), a5=act(5);

  // Pull workflow, tech, priority context
  var wf       = (ctx && ctx.workflow)  || null;
  var tech     = (ctx && ctx.tech)      || null;
  var priority = (ctx && ctx.priority)  || null;
  var wfName      = wf       ? wf.name                                    : '';
  var wfFriction  = wf       ? (wf.friction || '')                        : '';
  var wfStep0     = wf && wf.steps && wf.steps[0] ? wf.steps[0].t        : '';
  var wfStep1     = wf && wf.steps && wf.steps[1] ? wf.steps[1].t        : '';
  var wfStep2     = wf && wf.steps && wf.steps[2] ? wf.steps[2].t        : '';
  var techName    = tech     ? tech.name                                  : '';
  var techDesc    = tech     ? tech.desc                                  : '';
  var priTitle    = priority ? priority.title                             : '';

  var habits = [
    // MH1 — Daily briefing: focus on the workflow to start the day ready
    { id:'MH1', entry:'M365 Copilot Chat', baseSaved:25, highPriority:true,
      name:'Get a daily briefing on tasks related to ' + a0,
      pain:pain0,
      prompt:'Give me a daily digest as a ' + role.role + ' at ' + coShort
        + (wfName ? ' focused on the ' + wfName + ' process' : ' focused on ' + a0)
        + '. Based on my emails, chats, and calendar: 1) key updates I need to act on today 2) action items sorted by priority 3) upcoming meetings to prepare for 4) any open items from last week'
        + (wfFriction ? '. Flag anything related to: ' + wfFriction : '') + '.',
      inputs:'Emails, chats, calendar events (accessed via M365 Copilot)',
      metric:'Daily briefing prep reduced from 30 to 5 minutes',
      guardrails:'Do not share summary outputs outside your direct team; verify key action items before proceeding' },

    // MH2 — Outlook reply: tie to a specific workflow step
    { id:'MH2', entry:'Outlook', baseSaved:30, highPriority:true,
      name:'Reply to emails about ' + a1 + ' using thread context',
      pain:pain1,
      prompt:'Write a reply to [sender] about [topic] related to ' + a1 + ' at ' + coShort
        + (wfStep0 ? '. This relates to the "' + wfStep0 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + '. Key points to include: [list]. Tone: professional. Use the email thread as context. Target length: ~150 words.',
      inputs:'Email thread (Outlook reads context automatically)',
      metric:'Email reply time reduced from 20 to 4 minutes',
      guardrails:'Review drafts carefully before sending; remove any internal-only references' },

    // MH3 — Teams meeting: structure agenda around the workflow
    { id:'MH3', entry:'Teams', baseSaved:30, highPriority:true,
      name:'Prepare agenda and capture meeting notes for ' + a2,
      pain:pain2,
      prompt:'Using recent messages and emails about ' + a2 + ' at ' + coShort
        + (wfName ? ' (part of the ' + wfName + ' workflow)' : '')
        + ', create a structured meeting agenda with: 1) objectives 2) discussion items with time allocations 3) expected outcomes 4) pre-reads'
        + (wfStep1 ? '. Ensure the agenda covers the "' + wfStep1 + '" step' : '')
        + '. After the meeting, summarise key decisions and action items.',
      inputs:'Calendar invite, email threads, prior meeting notes (Teams reads context)',
      metric:'Meeting prep reduced from 45 to 8 minutes',
      guardrails:'Confirm agenda with all parties before distributing; verify meeting summaries are accurate' },

    // MH4 — Internal search: search for workflow-specific documents and name the tech system
    { id:'MH4', entry:'M365 Copilot Chat', baseSaved:45, highPriority:false,
      name:'Search internal files and emails related to ' + a3,
      pain:pain0,
      prompt:'Find documents and messages related to ' + a3 + ' from our SharePoint and Teams files at ' + coShort
        + (wfName ? ' for the ' + wfName + ' process' : '')
        + (techName ? '. Also look for any exports or reports from ' + techName : '')
        + '. Summarise: 1) key content across the documents 2) any conflicting information 3) the most recent or authoritative source 4) gaps where more information is needed.',
      inputs:'SharePoint files, Teams messages' + (techName ? ', ' + techName + ' exports' : ''),
      metric:'Internal research time reduced from 90 to 15 minutes',
      guardrails:'Verify document currency; do not surface confidential files outside their intended audience' },

    // MH5 — Word report: reference the workflow output and tech data source
    { id:'MH5', entry:'Word', baseSaved:45, highPriority:false,
      name:'Draft a report or document for ' + a4,
      pain:pain1,
      prompt:'Create a detailed outline for a [report/brief/proposal] about ' + a4 + ' at ' + coShort
        + (wfStep2 ? '. This output will be used for the "' + wfStep2 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + (techName ? '. Reference data from ' + techName + ' (' + techDesc + ')' : '')
        + '. I am a ' + role.role + '. Include: executive summary, background, key findings, recommendations, and next steps. Context: ' + obj0,
      inputs:'Brief, existing notes' + (techName ? ', ' + techName + ' data export' : '') + ' (attach to Word)',
      metric:'Report drafting time reduced from 4 hours to 1 hour',
      guardrails:'Validate all data claims; get sign-off from relevant stakeholders before distribution' },

    // MH6 — Word review: name the system the document came from
    { id:'MH6', entry:'Word', baseSaved:40, highPriority:false,
      name:'Review and summarise documents related to ' + a5,
      pain:pain2,
      prompt:'Summarise the attached document'
        + (techName ? ' from ' + techName : '')
        + ' related to ' + a5 + ' at ' + coShort
        + (priTitle ? ' (this relates to our priority: ' + priTitle + ')' : '')
        + '. Extract: 1) key points and decisions 2) action items with owners 3) important dates or deadlines 4) risks or issues flagged 5) anything requiring my attention as a ' + role.role + '.',
      inputs:'Attach ' + (techName ? techName + ' report,' : '') + ' Word document, or PDF in Word',
      metric:'Document review time reduced from 60 to 10 minutes',
      guardrails:'Cross-check AI summary against original; flag any discrepancies for human review' },

    // MH7 — Excel analysis: name the data source and workflow context
    { id:'MH7', entry:'Excel', baseSaved:45, highPriority:false,
      name:'Analyse and visualise data for ' + a0,
      pain:pain0,
      prompt:'Analyse the data in this spreadsheet'
        + (techName ? ' (pulled from ' + techName + ')' : '')
        + ' related to ' + a0 + ' at ' + coShort
        + (wfName ? ' as part of the ' + wfName + ' process' : '')
        + '. Identify: 1) key trends and patterns 2) outliers that need attention 3) comparison to [benchmark or prior period] 4) recommended chart types to show the most important findings.',
      inputs:(techName ? techName + ' data export in' : '') + ' Excel spreadsheet',
      metric:'Data analysis reduced from 3 hours to 30 minutes',
      guardrails:'Validate formulas and pivot logic; do not include personally identifiable data in shared reports' }
  ];

  var hd = habits[habitIndex];
  var codeVal = (role.short||'').split('').reduce(function(s,c){return s+c.charCodeAt(0);},0);
  var timeSaved = Math.max(10, hd.baseSaved + ((codeVal * 5 + habitIndex * 13) % 20) - 6);
  var relevanceScore = scoreHabitForRole(hd.id, role);
  return { id:ucId, role:role.role, code:role.short, name:hd.name, pain:hd.pain,
    habitId:hd.id, entry:hd.entry,
    prompt:hd.prompt, inputs:hd.inputs, metric:hd.metric, guardrails:hd.guardrails,
    timeSaved:timeSaved, priority:hd.highPriority?'High':'Medium', relevanceScore:relevanceScore };
}

var MIN_USE_CASES_PER_ROLE = 3; // always keep at least this many per role even if low relevance
var MIN_RELEVANCE_SCORE    = 10; // drop habits scoring below this (no keyword match at all)

function generateUseCasesFromProfile(profileData) {
  var roles      = (profileData.capabilities || []).slice(0, 6);
  var clientInfo = profileData.client || {};
  var workflows  = profileData.workflows  || [];
  var platforms  = (profileData.technology && profileData.technology.platforms) || [];
  var priorities = profileData.priorities || [];
  var chat = [], m365 = [];
  var chatNum = 1, m365Num = 1;

  roles.forEach(function(role) {
    var ctx = {
      workflow: findWorkflowForRole(role, workflows),
      tech:     findTechForRole(role, platforms),
      priority: findPriorityForRole(role, priorities)
    };

    // Generate all 7 candidates for this role
    var chatCandidates = [], m365Candidates = [];
    for (var hi = 0; hi < 7; hi++) {
      chatCandidates.push(buildChatUseCaseForRole(hi, role, clientInfo, '__tmp__', ctx));
      m365Candidates.push(buildM365UseCaseForRole(hi, role, clientInfo, '__tmp__', ctx));
    }

    // Sort by relevanceScore descending — best fit for this role comes first
    chatCandidates.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });
    m365Candidates.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });

    // Keep all that meet the minimum score, but always keep at least MIN_USE_CASES_PER_ROLE
    function filterAndAssign(candidates, prefix, num) {
      var kept = candidates.filter(function(uc) { return uc.relevanceScore >= MIN_RELEVANCE_SCORE; });
      if (kept.length < MIN_USE_CASES_PER_ROLE) kept = candidates.slice(0, MIN_USE_CASES_PER_ROLE);
      kept.forEach(function(uc) {
        uc.id = prefix + String(num[0]).padStart(2,'0');
        num[0]++;
      });
      return kept;
    }

    var chatNum_ref  = [chatNum];
    var m365Num_ref  = [m365Num];
    var keptChat = filterAndAssign(chatCandidates, 'CH-', chatNum_ref);
    var keptM365 = filterAndAssign(m365Candidates, 'MH-', m365Num_ref);
    chatNum = chatNum_ref[0];
    m365Num = m365Num_ref[0];

    chat = chat.concat(keptChat);
    m365 = m365.concat(keptM365);
  });

  return { chat: chat, m365: m365 };
}

// ── Build research prompt (Microsoft 365 Copilot context) ────────────────────
function buildResearchPrompt(name, url, scraped) {
  var schema = {
    client: {
      name: 'Full legal company name',
      shortName: 'Common brand abbreviation used in nav/headers',
      tagline: 'Official tagline or 1-line mission statement',
      subtitle: 'Industry | Primary function e.g. "Technology | Enterprise Software"',
      description: '2-3 sentence factual overview: what they do, scale, who they serve'
    },
    keyFacts: [
      {label:'Founded', value:'YYYY', desc:'max 6 words'},
      {label:'Employees', value:'~X,000', desc:'max 6 words'},
      {label:'Revenue', value:'$X billion or key metric', desc:'max 6 words'},
      {label:'Key Business Metric', value:'...', desc:'max 6 words'},
      {label:'Workshop Focus', value:'Microsoft 365 Copilot', desc:'max 6 words'}
    ],
    serviceAreas: [{title:'Division or BU name', desc:'1 sentence, max 20 words'}],
    leadership: [
      {title:'CEO / MD', name:'Full Name'},
      {title:'CTO or Chief Digital Officer', name:'Full Name'},
      {title:'Another C-suite role', name:'Full Name'}
    ],
    locations: [{label:'Headquarters', address:'Street, City, Country'}],
    priorities: [
      {num:1, title:'Priority name 5-8 words', tagline:'Short catchy phrase', desc:'2-3 sentences on what this involves', roles:'Knowledge Workers, Managers, Operations teams', pains:'Key productivity challenges tied to this priority'}
    ],
    capabilities: [
      {role:'Department Full Name', short:'ABBR', icon:'primary', objectives:'3-4 short sentences on what this team does and why it matters', painPoints:'3-4 short sentences on the specific day-to-day friction this team faces using Microsoft 365 tools', keyActivities:'4-6 specific daily tasks for this exact role, e.g. drafting reports, reviewing contracts, scheduling interviews'}
    ],
    workflows: [
      {name:'Workflow name', steps:[{t:'Step Name (2-4 words)', d:'1 short sentence, max 15 words — who does what'}], friction:'1-2 short sentences on the main bottleneck'}
    ],
    painPoints: {
      individual: [{name:'Pain name', desc:'1 sentence only, max 20 words', freq:'Daily'}],
      team:       [{name:'Pain name', desc:'1 sentence only, max 20 words', freq:'Weekly'}],
      organisation:[{name:'Pain name', desc:'1 sentence only, max 20 words', freq:'Structural'}]
    },
    technology: {
      m365Status: '1-2 sentences on current Microsoft 365 and Copilot deployment status at this organisation',
      m365: ['Outlook','Teams','Word','Excel','PowerPoint','SharePoint','OneDrive'],
      platforms: [{name:'Platform or internal system name', desc:'max 10-12 words — what it does'}]
    },
    glossary: [{t:'Term', d:'Definition in context of this company, max 2 sentences', cat:'Organisation'}],
    brandColors: {
      primary: '#XXXXXX — the single most distinctive brand color. Typically the logo background fill or primary button color — NOT a text color or near-white background.',
      accent:  '#XXXXXX — secondary brand color used for headings, links, or highlights. Should have a different hue to primary.'
    }
  };

  return 'Research the company "' + name + '" (website: ' + url + ') and generate a complete operational profile JSON for a Microsoft 365 Copilot AI adoption training workshop.\n\n'
    + 'Website content (scraped from homepage):\n---\n' + scraped + '\n---\n\n'
    + 'Use your training knowledge plus the scraped content above. The profile contextualises Microsoft 365 Copilot AI productivity training for their knowledge workers and business teams.\n\n'
    + 'Return ONLY raw JSON — no markdown code fences, no explanation text. Start directly with { and end with }.\n\n'
    + 'WRITING STYLE — apply to ALL text fields:\n'
    + '- Write in plain, simple English. Avoid jargon, buzzwords, and corporate language.\n'
    + '- Use short sentences. Aim for clarity over sophistication.\n'
    + '- Write as if explaining to a smart non-expert — clear, direct, and easy to skim.\n'
    + '- Prefer everyday words: use "use" not "leverage", "help" not "facilitate", "find" not "ascertain", "show" not "demonstrate".\n\n'
    + 'Fill this exact schema:\n\n'
    + JSON.stringify(schema, null, 2)
    + '\n\nRequirements:\n'
    + '- priorities: exactly 5 items reflecting this organisation\'s strategic business priorities\n'
    + '- capabilities: exactly 6 items, one for each of these role groups IN THIS ORDER: Knowledge Workers & Office Staff, Managers & Team Leads, Finance & Operations, HR & People Development, Sales & Customer Service, IT & Systems Administrators — write objectives and painPoints specific to how that role group operates at THIS company using Microsoft 365\n'
    + '- workflows: exactly 4 items — common business workflows at this company where Microsoft 365 Copilot drives productivity (e.g. meeting management, document creation, reporting, communications)\n'
    + '- painPoints.individual: 6-8 items specific to knowledge workers at this company; painPoints.team: 4-6; painPoints.organisation: 4-6\n'
    + '- glossary: 25-40 terms across: Organisation, Business Units, Technology, HR & Learning, Industry — include this company\'s internal tools, systems, and business terminology\n'
    + '- icon values must rotate between: "primary", "secondary", "accent"\n'
    + '- workflows[].steps[].t: step name, 2-4 words only\n'
    + '- workflows[].steps[].d: 1 sentence, max 15 words — simply state who does what at this step\n'
    + '- workflows[].friction: 1-2 short sentences on the main bottleneck, plain language\n'
    + '- capabilities[].objectives: 3-4 short sentences only — what this team does and why it matters\n'
    + '- capabilities[].painPoints: 3-4 short sentences only — specific daily friction this team faces with Microsoft 365 tools\n'
    + '- painPoints.individual[].desc, painPoints.team[].desc, painPoints.organisation[].desc: 1 sentence only, max 20 words\n'
    + '- technology.platforms[].desc: 10-12 words maximum — what the platform does, nothing more\n'
    + '- glossary[].d: 2 sentences maximum — keep definitions short and clear\n'
    + '- capabilities[].keyActivities: 4-6 specific daily tasks for that exact role at this company — comma-separated, no generic filler like "coordination" or "process improvement". Each item should be a concrete action, e.g. "drafting client proposals", "reviewing invoices", "scheduling interviews"\n'
    + '- keyFacts[].desc: 6 words maximum — short qualifier only, no full sentences\n'
    + '- serviceAreas[].desc: 1 sentence only, maximum 20 words — no run-on descriptions\n'
    + '- All content must reflect how this specific organisation actually operates — not generic\n'
    + '- technology.m365 should list the actual Microsoft 365 apps this company uses or is likely to use based on their industry and size\n'
    + '- brandColors.primary: the hex color most associated with the brand visually — typically the logo background or primary button fill. Must NOT be near-black (lightness < 20%) or near-white.\n'
    + '- brandColors.accent: a second brand hex color with a different hue to primary\n';
}


// ── HTTP server ───────────────────────────────────────────────────────────────
var server = http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin',          '*');
  res.setHeader('Access-Control-Allow-Methods',         'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',         'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── POST /extract-colors ────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/extract-colors') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', async function() {
      try {
        var data = JSON.parse(body);
        if (!data.url) throw new Error('Missing url field');
        var colors = await extractBrandColors(data.url);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(colors));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // ── POST /research-company ──────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/research-company') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', async function() {
      try {
        var data = JSON.parse(body);
        if (!data.id)   throw new Error('Missing id');
        if (!data.name) throw new Error('Missing company name');
        if (!data.url)  throw new Error('Missing website URL');

        console.log('Researching company:', data.name, '(' + data.url + ')');

        var scraped = '';
        try {
          var targetUrl = /^https?:\/\//i.test(data.url) ? data.url : 'https://' + data.url;
          var html = await fetchUrl(targetUrl);
          scraped = htmlToText(html);
          console.log('Scraped', scraped.length, 'chars from homepage');
        } catch(e) {
          scraped = '(Could not scrape website: ' + e.message + ')';
          console.warn('Scrape warning:', e.message);
        }

        var prompt = buildResearchPrompt(data.name, data.url, scraped);
        console.log('Calling Claude CLI...');
        var raw = await callClaudeLocal(prompt);

        var jsonStr = raw.replace(/^```[a-z]*\n?/m, '').replace(/```\s*$/m, '').trim();
        var start = jsonStr.indexOf('{');
        var end   = jsonStr.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Claude did not return valid JSON. Response started with: ' + raw.slice(0, 200));
        jsonStr = jsonStr.slice(start, end + 1);

        var profileData = JSON.parse(jsonStr);

        var claudeColors = null;
        if (profileData.brandColors && /^#[0-9A-Fa-f]{6}$/.test(profileData.brandColors.primary)) {
          var cp = profileData.brandColors.primary;
          var ca = (profileData.brandColors.accent && /^#[0-9A-Fa-f]{6}$/.test(profileData.brandColors.accent))
            ? profileData.brandColors.accent
            : hslToHex((hexToHsl(cp).h + 180) % 360, 0.6, 0.4);
          claudeColors = {
            primary:      cp,
            primaryDark:  darken(cp, 0.12),
            primaryLight: lighten(cp, 0.08),
            accent:       ca,
            sidebarBg:    darken(cp, 0.22)
          };
          console.log('Brand colors from Claude:', claudeColors);
        }

        var filePath = path.join(PROFILES_DIR, data.id + '.json');
        var saved = { id: data.id, name: data.name, url: data.url, timestamp: new Date().toISOString(), data: profileData };
        fs.writeFileSync(filePath, JSON.stringify(saved, null, 2), 'utf8');
        console.log('Profile saved to', filePath);

        // ── Step 2: Generate use cases from templates (instant, no second AI call) ─
        var useCasesData = generateUseCasesFromProfile(profileData);
        saved.useCases = useCasesData;
        fs.writeFileSync(filePath, JSON.stringify(saved, null, 2), 'utf8');
        console.log('Use cases generated: ' + useCasesData.chat.length + ' chat, ' + useCasesData.m365.length + ' m365');

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ success: true, timestamp: saved.timestamp, brandColors: claudeColors }));
      } catch(e) {
        console.error('Research error:', e.message);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── GET /profile?id=&name= ──────────────────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/profile')) {
    try {
      var params = new URL('http://localhost' + req.url).searchParams;
      var id   = params.get('id')   || '';
      var name = params.get('name') || '';
      if (!id && !name) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Missing id or name'})); return; }

      var filePath = id ? path.join(PROFILES_DIR, id + '.json') : null;
      if (filePath && !fs.existsSync(filePath)) filePath = null;

      if (!filePath) {
        var searchName = (name || id).toLowerCase();
        var files = fs.readdirSync(PROFILES_DIR).filter(function(f) { return f.endsWith('.json'); });
        for (var fi = 0; fi < files.length; fi++) {
          try {
            var s = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, files[fi]), 'utf8'));
            if (s.name && s.name.toLowerCase() === searchName) { filePath = path.join(PROFILES_DIR, files[fi]); break; }
          } catch(e) {}
        }
      }

      if (!filePath) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({found:false})); return; }

      var saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!saved.data && (saved.name || name)) {
        var sn = (saved.name || name).toLowerCase();
        var all = fs.readdirSync(PROFILES_DIR).filter(function(f){ return f.endsWith('.json'); });
        for (var fi2 = 0; fi2 < all.length; fi2++) {
          try {
            var cand = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, all[fi2]), 'utf8'));
            if (cand.data && cand.name && cand.name.toLowerCase() === sn) { saved = cand; break; }
          } catch(e2) {}
        }
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({found:true, name:saved.name, url:saved.url, timestamp:saved.timestamp, data:saved.data, useCases:saved.useCases||null}));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // ── GET /list-profiles ──────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/list-profiles') {
    try {
      var files = fs.readdirSync(PROFILES_DIR).filter(function(f){ return f.endsWith('.json'); });
      var profiles = files.map(function(f) {
        try {
          var s = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf8'));
          return { id: s.id, name: s.name, url: s.url, timestamp: s.timestamp, config: s.config || null };
        } catch(e) { return null; }
      }).filter(Boolean);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({profiles: profiles}));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // ── POST /save-company-config ───────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/save-company-config') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        if (!data.id)   throw new Error('Missing id');
        if (!data.name) throw new Error('Missing name');

        var filePath = path.join(PROFILES_DIR, data.id + '.json');
        var existing = {};
        if (fs.existsSync(filePath)) { try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) {} }

        existing.id   = data.id;
        existing.name = data.name;
        existing.url  = data.url || existing.url || '';
        existing.config = {
          password:    data.password    || '',
          colors:      data.colors      || {},
          logoDataUrl: data.logoDataUrl || null
        };
        if (!existing.timestamp) existing.timestamp = new Date().toISOString();

        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
        console.log('Company config saved to', filePath);

        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success: true}));
      } catch(e) {
        console.error('Save config error:', e.message);
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  // ── POST /delete-company ────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/delete-company') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        if (!data.id) throw new Error('Missing id');
        var filePath = path.join(PROFILES_DIR, data.id + '.json');
        if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); console.log('Deleted profile:', filePath); }
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success: true}));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: e.message}));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, function() {
  console.log('');
  console.log('  Copilot Training Server running on http://localhost:' + PORT);
  console.log('  Profiles saved to: Copilot/profile/');
  console.log('  Keep this terminal open while using admin.html');
  console.log('');
});
