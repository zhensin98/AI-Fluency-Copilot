/**
 * update-html-data.js
 * Rebuilds the DATA block inside Copilot Value.html from the profile JSON.
 * Preserves static sections (colors, habits, roleIcons) and replaces dynamic
 * sections (byRole, byHabit, totals, roleHabitMatrix, useCases, roleNames).
 */
var fs = require('fs');

var profile = JSON.parse(fs.readFileSync('profile/chanel-1775806987479.json', 'utf8'));
var html    = fs.readFileSync('Copilot Value.html', 'utf8');

var startMarker = '// === DATA_BLOCK_START === (DO NOT MODIFY OR DELETE THIS LINE)';
var endMarker   = '// === DATA_BLOCK_END === (DO NOT MODIFY OR DELETE THIS LINE)';
var blockStart  = html.indexOf(startMarker) + startMarker.length;
var blockEnd    = html.indexOf(endMarker);
var existingBlock = html.substring(blockStart, blockEnd);

// ── Helper: extract a named property value (array or object) from a JS object literal ──
function extractProp(src, propName) {
  // Find  "propName": [  or  "propName": {
  var re = new RegExp('"' + propName + '"\\s*:\\s*([\\[{])');
  var m  = re.exec(src);
  if (!m) return null;
  var open  = m[1];
  var close = open === '[' ? ']' : '}';
  var start = m.index + m[0].length - 1; // position of the opening bracket
  var depth = 0, i = start;
  for (; i < src.length; i++) {
    if (src[i] === open)  depth++;
    if (src[i] === close) { depth--; if (depth === 0) return src.substring(start, i + 1); }
  }
  return null;
}

// ── Extract static sections from existing block ──
var colorsStr      = extractProp(existingBlock, 'colors');
var chatHabitsStr  = null;
var m365HabitsStr  = null;
var roleIconsStr   = extractProp(existingBlock, 'roleIcons');

// habits arrays are nested: find "chat": { ... "habits": [...] ... }
var chatBlockStr = extractProp(existingBlock, 'chat');
if (chatBlockStr) chatHabitsStr = extractProp(chatBlockStr, 'habits');
var m365BlockStr = extractProp(existingBlock, 'm365');
if (m365BlockStr) m365HabitsStr = extractProp(m365BlockStr, 'habits');

if (!chatHabitsStr) { console.error('Could not extract chat.habits'); process.exit(1); }
if (!m365HabitsStr) { console.error('Could not extract m365.habits'); process.exit(1); }

// ── Curated Role-Habit Relevance Matrix (manually defined, do not auto-compute) ──
var CURATED_CHAT_MATRIX = [
  {role:'LRUA', h1:3, h2:4, h3:1, h4:2, h5:5, h6:6, h7:7},
  {role:'PR',   h1:4, h2:1, h3:5, h4:3, h5:2, h6:6, h7:7},
  {role:'CM',   h1:4, h2:2, h3:3, h4:6, h5:1, h6:5, h7:7},
  {role:'MS',   h1:1, h2:4, h3:2, h4:5, h5:3, h6:6, h7:7},
  {role:'CE',   h1:3, h2:2, h3:4, h4:5, h5:1, h6:6, h7:7},
  {role:'TSD',  h1:2, h2:1, h3:5, h4:4, h5:3, h6:6, h7:7},
  {role:'IT',   h1:1, h2:2, h3:5, h4:6, h5:3, h6:7, h7:4},
  {role:'FA',   h1:5, h2:4, h3:3, h4:6, h5:2, h6:7, h7:1},
  {role:'HR',   h1:2, h2:3, h3:1, h4:5, h5:4, h6:6, h7:7},
  {role:'SR',   h1:3, h2:1, h3:5, h4:4, h5:2, h6:6, h7:7},
  {role:'LC',   h1:3, h2:1, h3:2, h4:5, h5:4, h6:6, h7:7}
];
var CURATED_M365_MATRIX = [
  {role:'LRUA', h1:2, h2:1, h3:3, h4:4, h5:5, h6:6, h7:7},
  {role:'PR',   h1:6, h2:4, h3:3, h4:1, h5:2, h6:5, h7:7},
  {role:'CM',   h1:5, h2:3, h3:6, h4:2, h5:1, h6:4, h7:7},
  {role:'MS',   h1:1, h2:2, h3:4, h4:5, h5:6, h6:3, h7:7},
  {role:'CE',   h1:2, h2:3, h3:4, h4:5, h5:1, h6:6, h7:7},
  {role:'TSD',  h1:3, h2:4, h3:5, h4:1, h5:2, h6:6, h7:7},
  {role:'IT',   h1:3, h2:5, h3:4, h4:1, h5:2, h6:6, h7:7},
  {role:'FA',   h1:2, h2:3, h3:5, h4:6, h5:4, h6:7, h7:1},
  {role:'HR',   h1:1, h2:2, h3:4, h4:5, h5:3, h6:6, h7:7},
  {role:'SR',   h1:5, h2:4, h3:3, h4:1, h5:2, h6:6, h7:7},
  {role:'LC',   h1:4, h2:2, h3:5, h4:1, h5:3, h6:6, h7:7}
];

// ── Build aggregates from profile use cases ──
var chatUCs = profile.useCases.chat;
var m365UCs = profile.useCases.m365;

function buildAggregates(ucs, habitIds, curatedMatrix) {
  var roleCodes = [], seenCodes = {};
  ucs.forEach(function(u) { if (!seenCodes[u.code]) { seenCodes[u.code] = true; roleCodes.push(u.code); } });

  var byRole = roleCodes.map(function(code) {
    var group = ucs.filter(function(u) { return u.code === code; });
    var ts    = group.reduce(function(a, u) { return a + (u.timeSaved || 0); }, 0);
    var hp    = group.filter(function(u) { return u.priority === 'High'; }).length;
    var ranked = group.slice().sort(function(a, b) { return (b.timeSaved || 0) - (a.timeSaved || 0); });
    return { role: group[0].role, code: code, useCases: group.length, highPriority: hp,
             timeSaved: ts, topHabits: ranked.slice(0, 3).map(function(u) { return u.habitId; }) };
  });

  var total = ucs.length;
  var byHabit = habitIds.map(function(hid) {
    var group = ucs.filter(function(u) { return u.habitId === hid; });
    var ts    = group.reduce(function(a, u) { return a + (u.timeSaved || 0); }, 0);
    return { id: hid, count: group.length,
             pct: total ? Math.round(group.length / total * 1000) / 10 : 0, timeSaved: ts };
  });

  var totals = {
    useCases: ucs.length,
    highPriority: ucs.filter(function(u) { return u.priority === 'High'; }).length,
    timeSaved: ucs.reduce(function(a, u) { return a + (u.timeSaved || 0); }, 0)
  };

  // Use curated matrix (passed in) instead of auto-computing from timeSaved
  var roleHabitMatrix = curatedMatrix.filter(function(r) { return roleCodes.indexOf(r.role) >= 0; });

  // entryPoints derived from use cases
  var epMap = {}, epList = [];
  ucs.forEach(function(u) { if (!epMap[u.entry]) { epMap[u.entry] = true; epList.push(u.entry); } });

  return { byRole: byRole, byHabit: byHabit, totals: totals, roleHabitMatrix: roleHabitMatrix, entryPoints: epList };
}

var chatHabitIds = ['CH1','CH2','CH3','CH4','CH5','CH6','CH7'];
var m365HabitIds = ['MH1','MH2','MH3','MH4','MH5','MH6','MH7'];
var chatAgg = buildAggregates(chatUCs, chatHabitIds, CURATED_CHAT_MATRIX);
var m365Agg = buildAggregates(m365UCs, m365HabitIds, CURATED_M365_MATRIX);

// Build roleNames from use cases
var roleNames = {}, seenN = {};
chatUCs.concat(m365UCs).forEach(function(u) {
  if (!seenN[u.code]) { seenN[u.code] = true; roleNames[u.code] = u.role; }
});

// Strip relevanceScore and isGeneric from use cases before embedding
function cleanUCs(ucs) {
  return ucs.map(function(u) {
    var c = Object.assign({}, u);
    delete c.relevanceScore;
    delete c.isGeneric;
    return c;
  });
}

// ── Build new DATA block ──
var j = JSON.stringify;

var newBlock = '\nconst DATA = {\n'
  + '  "client": ' + j(profile.data.client || {name:"Chanel",tagline:""}) + ',\n'
  + '  "colors": ' + colorsStr + ',\n'
  + '  "chat": {\n'
  + '  "habits": ' + chatHabitsStr + ',\n'
  + '  "byRole": ' + j(chatAgg.byRole, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "byHabit": ' + j(chatAgg.byHabit, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "totals": ' + j(chatAgg.totals) + ',\n'
  + '  "roleHabitMatrix": ' + j(chatAgg.roleHabitMatrix, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "entryPoints": ' + j(chatAgg.entryPoints) + '\n'
  + '},\n'
  + '"m365": {\n'
  + '  "habits": ' + m365HabitsStr + ',\n'
  + '  "byRole": ' + j(m365Agg.byRole, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "byHabit": ' + j(m365Agg.byHabit, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "totals": ' + j(m365Agg.totals) + ',\n'
  + '  "roleHabitMatrix": ' + j(m365Agg.roleHabitMatrix, null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "entryPoints": ' + j(m365Agg.entryPoints) + '\n'
  + '},\n'
  + '  "useCases": {\n'
  + '  "chat": ' + j(cleanUCs(chatUCs), null, 2).replace(/\n/g, '\n  ') + ',\n'
  + '  "m365": ' + j(cleanUCs(m365UCs), null, 2).replace(/\n/g, '\n  ') + '\n'
  + '},\n'
  + '  ' + (roleIconsStr ? '"roleIcons": ' + roleIconsStr + ',\n' : '')
  + '  "roleNames": ' + j(roleNames) + '\n'
  + '};\n';

// ── Write updated HTML ──
var newHtml = html.substring(0, blockStart) + newBlock + html.substring(blockEnd);
fs.writeFileSync('Copilot Value.html', newHtml);
console.log('Done. DATA block updated in Copilot Value.html');
console.log('  Chat use cases: ' + chatUCs.length + ' | M365 use cases: ' + m365UCs.length);
console.log('  Roles:', Object.keys(roleNames).join(', '));
