var fs = require('fs');
var profileData = JSON.parse(fs.readFileSync('profile/chanel-1775724612134.json', 'utf8'));

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
function extractActivities(text) {
  if (!text) return [];
  return text.split(',').map(function(a){return a.trim();}).filter(Boolean);
}

var HABIT_SIGNALS = {
  'CH1': [],
  'CH2': ['research','find','information','policy','knowledge','topic','best practice'],
  'CH3': ['email','write','draft','communicate','message','follow-up','reply','invite','notice'],
  'CH4': ['meeting','notes','minutes','discussion','action','recap','debrief','review','feedback'],
  'CH5': ['create','template','document','brief','guide','onboard','material','content','build','update'],
  'CH6': ['review','read','extract','summarise','report','policy','contract','document','ticket'],
  'CH7': ['data','analyse','excel','metrics','sales','dashboard','figures','variance','forecast','report','power bi'],
  'MH1': [],
  'MH2': ['email','outlook','reply','respond','communicate','message','follow-up','invite'],
  'MH3': ['meeting','teams','agenda','notes','calendar','debrief','discussion'],
  'MH4': ['search','find','document','sharepoint','file','knowledge','policy','reference'],
  'MH5': ['report','word','document','draft','write','brief','proposal','summary','guide'],
  'MH6': ['review','summarise','read','document','policy','report','ticket','contract'],
  'MH7': ['data','excel','analyse','spreadsheet','metrics','sales','power bi','dashboard','figures','variance','forecast']
};
function scoreHabitForRole(habitId, role) {
  var signals = HABIT_SIGNALS[habitId];
  if (!signals || signals.length === 0) return 100;
  var kw = ((role.keyActivities||'') + ' ' + (role.objectives||'') + ' ' + (role.painPoints||'')).toLowerCase();
  var score = 0;
  signals.forEach(function(signal) { if (kw.indexOf(signal) >= 0) score += 10; });
  return score;
}

function findWorkflowForRole(role, workflows) {
  if (!workflows || !workflows.length) return null;
  var kw = ((role.keyActivities||'') + ' ' + (role.role||'') + ' ' + (role.painPoints||'')).toLowerCase();
  var best = null, bestScore = -1;
  workflows.forEach(function(wf) {
    var wfText = (wf.name + ' ' + (wf.friction||'') + ' ' + (wf.steps||[]).map(function(s){return s.t+' '+s.d;}).join(' ')).toLowerCase();
    var score = 0;
    wfText.split(/\s+/).forEach(function(word) { if (word.length > 4 && kw.indexOf(word) >= 0) score++; });
    if (score > bestScore) { bestScore = score; best = wf; }
  });
  return best;
}

function findTechForRole(role, platforms) {
  if (!platforms || !platforms.length) return null;
  var kw = ((role.keyActivities||'') + ' ' + (role.objectives||'')).toLowerCase();
  for (var i = 0; i < platforms.length; i++) {
    var pName = platforms[i].name.toLowerCase().split(/[\s\/]/)[0];
    if (kw.indexOf(pName) >= 0) return platforms[i];
  }
  return null;
}

function findPriorityForRole(role, priorities) {
  if (!priorities || !priorities.length) return null;
  var kw = ((role.role||'') + ' ' + (role.keyActivities||'') + ' ' + (role.objectives||'')).toLowerCase();
  var best = null, bestScore = -1;
  priorities.forEach(function(p) {
    var score = 0;
    (p.roles||'').split(',').forEach(function(r) {
      var rt = r.trim().toLowerCase();
      if (rt.length > 2 && kw.indexOf(rt) >= 0) score += 3;
    });
    (p.title + ' ' + (p.pains||'')).toLowerCase().split(/\s+/).forEach(function(word) {
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

  var wf = (ctx && ctx.workflow) || null;
  var tech = (ctx && ctx.tech) || null;
  var priority = (ctx && ctx.priority) || null;
  var wfName     = wf       ? wf.name                             : '';
  var wfFriction = wf       ? (wf.friction || '')                 : '';
  var wfStep0    = wf && wf.steps && wf.steps[0] ? wf.steps[0].t : '';
  var wfStep1    = wf && wf.steps && wf.steps[1] ? wf.steps[1].t : '';
  var techName   = tech     ? tech.name                           : '';
  var techDesc   = tech     ? tech.desc                           : '';
  var priTitle   = priority ? priority.title                      : '';

  var habits = [
    { id:'CH1', baseSaved:15, highPriority:false,
      name:'Get quick answers to support ' + a0, pain:pain0,
      prompt:'Explain [concept or process relevant to ' + a0 + '] as if I\'m a ' + role.role + ' at ' + coShort
        + (priTitle ? '. This supports our goal to ' + priTitle + '.' : '.')
        + ' Include: 1) a clear plain-language explanation 2) 3 practical steps I can take 3) one common mistake to avoid.',
      inputs:'None — general knowledge query',
      metric:'Understanding new concepts reduced from 30 min to 5 min',
      guardrails:'AI explanations are not expert advice; verify key facts with authoritative sources' },

    { id:'CH2', baseSaved:30, highPriority:true,
      name:'Research information needed for ' + a1, pain:pain1,
      prompt:'I need to research [specific topic] to help with ' + a1 + ' at ' + coShort
        + (wfName ? ' as part of the ' + wfName + ' process' : '')
        + '. Context: ' + (wfFriction || obj0)
        + '. Provide: 1) key findings with sources 2) how this applies to ' + coShort + ' 3) recommended next steps.',
      inputs:'None — web research or internal documents',
      metric:'Research time reduced from 2 hours to 15 minutes',
      guardrails:'Verify all facts against primary sources before acting; note any information cutoff dates' },

    { id:'CH3', baseSaved:20, highPriority:true,
      name:'Draft email for ' + a2, pain:pain2,
      prompt:'Draft an email to [recipient] about [topic] related to ' + a2 + ' at ' + coShort
        + (wfStep0 ? '. This is for the "' + wfStep0 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + '. Key points: [list]. Tone: professional. Length: ~200 words.',
      inputs:'Recipient, key message points, any relevant context',
      metric:'Email drafting time reduced from 20 to 5 minutes',
      guardrails:'Review all drafts before sending; do not include sensitive or confidential information' },

    { id:'CH4', baseSaved:35, highPriority:true,
      name:'Create structured notes from discussion about ' + a3, pain:pain0,
      prompt:'I\'m pasting notes from a discussion about ' + a3 + ' at ' + coShort
        + (wfName ? ' (part of the ' + wfName + ' workflow)' : '')
        + '. Create a structured summary with: 1) 3-sentence overview 2) key decisions or outcomes 3) action items with owners and deadlines 4) open questions.\n\n[Paste notes or transcript here]',
      inputs:'Paste meeting notes or transcript',
      metric:'Notes creation reduced from 60 to 10 minutes',
      guardrails:'Verify all attributed decisions are accurate; mark unclear items as [To Verify]' },

    { id:'CH5', baseSaved:30, highPriority:false,
      name:'Create a document or template for ' + a4, pain:pain1,
      prompt:'I need to create a [document type] to support ' + a4 + ' at ' + coShort
        + (priTitle ? ', aligned with our priority to ' + priTitle : '')
        + (wfStep1 ? '. This document will be used during the "' + wfStep1 + '" stage' : '')
        + '. Generate a detailed outline with 6-8 sections, key points per section, and suggested content.\n\nContext: ' + obj0,
      inputs:'Topic, audience, purpose, any existing notes',
      metric:'Document outline created in 15 minutes instead of 1 hour',
      guardrails:'Validate all factual claims before publishing; get appropriate approvals' },

    { id:'CH6', baseSaved:30, highPriority:false,
      name:'Extract key information from documents for ' + a5, pain:pain2,
      prompt:'I\'m pasting a document'
        + (techName ? ' exported from ' + techName + ' (' + techDesc + ')' : '')
        + ' relevant to ' + a5 + ' at ' + coShort
        + '. Summarise: 1) key findings or decisions 2) action items 3) important dates or deadlines 4) any risks or issues flagged.\n\n[Paste document text here]',
      inputs:'Paste document, report, or ' + (techName ? techName + ' export' : 'reference text'),
      metric:'Document review time reduced from 60 to 10 minutes',
      guardrails:'Verify extracted details against original; flag any ambiguities for human review' },

    { id:'CH7', baseSaved:30, highPriority:false,
      name:'Analyse data relevant to ' + a0, pain:pain0,
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
  var timeSaved = Math.max(10, hd.baseSaved + ((codeVal*3 + habitIndex*11) % 20) - 7);
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

  var wf = (ctx && ctx.workflow) || null;
  var tech = (ctx && ctx.tech) || null;
  var priority = (ctx && ctx.priority) || null;
  var wfName     = wf       ? wf.name                             : '';
  var wfFriction = wf       ? (wf.friction || '')                 : '';
  var wfStep0    = wf && wf.steps && wf.steps[0] ? wf.steps[0].t : '';
  var wfStep1    = wf && wf.steps && wf.steps[1] ? wf.steps[1].t : '';
  var wfStep2    = wf && wf.steps && wf.steps[2] ? wf.steps[2].t : '';
  var techName   = tech     ? tech.name                           : '';
  var techDesc   = tech     ? tech.desc                           : '';
  var priTitle   = priority ? priority.title                      : '';

  var habits = [
    { id:'MH1', entry:'M365 Copilot Chat', baseSaved:25, highPriority:true,
      name:'Get a daily briefing on tasks related to ' + a0, pain:pain0,
      prompt:'Give me a daily digest as a ' + role.role + ' at ' + coShort
        + (wfName ? ' focused on the ' + wfName + ' process' : ' focused on ' + a0)
        + '. Based on my emails, chats, and calendar: 1) key updates I need to act on today 2) action items sorted by priority 3) upcoming meetings to prepare for 4) any open items from last week'
        + (wfFriction ? '. Flag anything related to: ' + wfFriction : '') + '.',
      inputs:'Emails, chats, calendar events (accessed via M365 Copilot)',
      metric:'Daily briefing prep reduced from 30 to 5 minutes',
      guardrails:'Do not share summary outputs outside your direct team; verify key action items before proceeding' },

    { id:'MH2', entry:'Outlook', baseSaved:30, highPriority:true,
      name:'Reply to emails about ' + a1 + ' using thread context', pain:pain1,
      prompt:'Write a reply to [sender] about [topic] related to ' + a1 + ' at ' + coShort
        + (wfStep0 ? '. This relates to the "' + wfStep0 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + '. Key points to include: [list]. Tone: professional. Use the email thread as context. Target length: ~150 words.',
      inputs:'Email thread (Outlook reads context automatically)',
      metric:'Email reply time reduced from 20 to 4 minutes',
      guardrails:'Review drafts carefully before sending; remove any internal-only references' },

    { id:'MH3', entry:'Teams', baseSaved:30, highPriority:true,
      name:'Prepare agenda and capture meeting notes for ' + a2, pain:pain2,
      prompt:'Using recent messages and emails about ' + a2 + ' at ' + coShort
        + (wfName ? ' (part of the ' + wfName + ' workflow)' : '')
        + ', create a structured meeting agenda with: 1) objectives 2) discussion items with time allocations 3) expected outcomes 4) pre-reads'
        + (wfStep1 ? '. Ensure the agenda covers the "' + wfStep1 + '" step' : '')
        + '. After the meeting, summarise key decisions and action items.',
      inputs:'Calendar invite, email threads, prior meeting notes (Teams reads context)',
      metric:'Meeting prep reduced from 45 to 8 minutes',
      guardrails:'Confirm agenda with all parties before distributing; verify meeting summaries are accurate' },

    { id:'MH4', entry:'M365 Copilot Chat', baseSaved:45, highPriority:false,
      name:'Search internal files and emails related to ' + a3, pain:pain0,
      prompt:'Find documents and messages related to ' + a3 + ' from our SharePoint and Teams files at ' + coShort
        + (wfName ? ' for the ' + wfName + ' process' : '')
        + (techName ? '. Also look for any exports or reports from ' + techName : '')
        + '. Summarise: 1) key content across the documents 2) any conflicting information 3) the most recent or authoritative source 4) gaps where more information is needed.',
      inputs:'SharePoint files, Teams messages' + (techName ? ', ' + techName + ' exports' : ''),
      metric:'Internal research time reduced from 90 to 15 minutes',
      guardrails:'Verify document currency; do not surface confidential files outside their intended audience' },

    { id:'MH5', entry:'Word', baseSaved:45, highPriority:false,
      name:'Draft a report or document for ' + a4, pain:pain1,
      prompt:'Create a detailed outline for a [report/brief/proposal] about ' + a4 + ' at ' + coShort
        + (wfStep2 ? '. This output will be used for the "' + wfStep2 + '" stage' + (wfName ? ' of the ' + wfName + ' process' : '') : '')
        + (techName ? '. Reference data from ' + techName + ' (' + techDesc + ')' : '')
        + '. I am a ' + role.role + '. Include: executive summary, background, key findings, recommendations, and next steps. Context: ' + obj0,
      inputs:'Brief, existing notes' + (techName ? ', ' + techName + ' data export' : '') + ' (attach to Word)',
      metric:'Report drafting time reduced from 4 hours to 1 hour',
      guardrails:'Validate all data claims; get sign-off from relevant stakeholders before distribution' },

    { id:'MH6', entry:'Word', baseSaved:40, highPriority:false,
      name:'Review and summarise documents related to ' + a5, pain:pain2,
      prompt:'Summarise the attached document'
        + (techName ? ' from ' + techName : '')
        + ' related to ' + a5 + ' at ' + coShort
        + (priTitle ? ' (this relates to our priority: ' + priTitle + ')' : '')
        + '. Extract: 1) key points and decisions 2) action items with owners 3) important dates or deadlines 4) risks or issues flagged 5) anything requiring my attention as a ' + role.role + '.',
      inputs:'Attach ' + (techName ? techName + ' report, ' : '') + 'Word document, or PDF in Word',
      metric:'Document review time reduced from 60 to 10 minutes',
      guardrails:'Cross-check AI summary against original; flag any discrepancies for human review' },

    { id:'MH7', entry:'Excel', baseSaved:45, highPriority:false,
      name:'Analyse and visualise data for ' + a0, pain:pain0,
      prompt:'Analyse the data in this spreadsheet'
        + (techName ? ' (pulled from ' + techName + ')' : '')
        + ' related to ' + a0 + ' at ' + coShort
        + (wfName ? ' as part of the ' + wfName + ' process' : '')
        + '. Identify: 1) key trends and patterns 2) outliers that need attention 3) comparison to [benchmark or prior period] 4) recommended chart types to show the most important findings.',
      inputs:(techName ? techName + ' data export in ' : '') + 'Excel spreadsheet',
      metric:'Data analysis reduced from 3 hours to 30 minutes',
      guardrails:'Validate formulas and pivot logic; do not include personally identifiable data in shared reports' }
  ];

  var hd = habits[habitIndex];
  var codeVal = (role.short||'').split('').reduce(function(s,c){return s+c.charCodeAt(0);},0);
  var timeSaved = Math.max(10, hd.baseSaved + ((codeVal*5 + habitIndex*13) % 20) - 6);
  var relevanceScore = scoreHabitForRole(hd.id, role);
  return { id:ucId, role:role.role, code:role.short, name:hd.name, pain:hd.pain,
    habitId:hd.id, entry:hd.entry,
    prompt:hd.prompt, inputs:hd.inputs, metric:hd.metric, guardrails:hd.guardrails,
    timeSaved:timeSaved, priority:hd.highPriority?'High':'Medium', relevanceScore:relevanceScore };
}

// ── Generate ──────────────────────────────────────────────────────────
var data       = profileData.data;
var roles      = (data.capabilities || []).slice(0, 6);
var clientInfo = data.client || {};
var workflows  = data.workflows || [];
var platforms  = (data.technology && data.technology.platforms) || [];
var priorities = data.priorities || [];
var MIN_RELEVANCE_SCORE    = 10; // skip habits with zero keyword match
var MIN_USE_CASES_PER_ROLE = 3;  // always keep at least 3 even if low relevance

var chat = [], m365 = [];
var chatNum = 1, m365Num = 1;

roles.forEach(function(role) {
  var ctx = {
    workflow: findWorkflowForRole(role, workflows),
    tech:     findTechForRole(role, platforms),
    priority: findPriorityForRole(role, priorities)
  };

  // Generate all 7 candidates
  var chatCandidates = [], m365Candidates = [];
  for (var hi = 0; hi < 7; hi++) {
    chatCandidates.push(buildChatUseCaseForRole(hi, role, clientInfo, '__tmp__', ctx));
    m365Candidates.push(buildM365UseCaseForRole(hi, role, clientInfo, '__tmp__', ctx));
  }

  // Sort best-fit first, then drop irrelevant ones (but keep a minimum)
  chatCandidates.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });
  m365Candidates.sort(function(a, b) { return b.relevanceScore - a.relevanceScore; });

  function keepBest(candidates, prefix, numRef) {
    var kept = candidates.filter(function(uc) { return uc.relevanceScore >= MIN_RELEVANCE_SCORE; });
    if (kept.length < MIN_USE_CASES_PER_ROLE) kept = candidates.slice(0, MIN_USE_CASES_PER_ROLE);
    kept.forEach(function(uc) { uc.id = prefix + String(numRef[0]++).padStart(2,'0'); });
    return kept;
  }

  var cn = [chatNum], mn = [m365Num];
  var keptChat = keepBest(chatCandidates, 'CH-', cn);
  var keptM365 = keepBest(m365Candidates, 'MH-', mn);
  chatNum = cn[0]; m365Num = mn[0];

  console.log('\nRole: ' + role.role + ' | kept ' + keptChat.length + ' chat, ' + keptM365.length + ' M365');
  console.log('  Workflow: ' + (ctx.workflow ? ctx.workflow.name : 'none') +
              ' | Tech: ' + (ctx.tech ? ctx.tech.name : 'none') +
              ' | Priority: ' + (ctx.priority ? ctx.priority.title : 'none'));
  keptChat.forEach(function(uc) {
    console.log('  [' + uc.habitId + ' score:' + uc.relevanceScore + '] ' + uc.name);
  });

  chat = chat.concat(keptChat);
  m365 = m365.concat(keptM365);
});

profileData.useCases = { chat: chat, m365: m365 };
fs.writeFileSync('profile/chanel-1775724612134.json', JSON.stringify(profileData, null, 2));
console.log('\nDone. ' + chat.length + ' chat + ' + m365.length + ' M365 use cases written.');
