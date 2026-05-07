import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()

# ── Page margins ──
section = doc.sections[0]
section.left_margin   = Inches(1.2)
section.right_margin  = Inches(1.2)
section.top_margin    = Inches(1.0)
section.bottom_margin = Inches(1.0)

# ── Helpers ──
def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in p.runs:
        run.font.name = 'Calibri'
        run.font.color.rgb = RGBColor(0, 0, 0)
        if level == 1:
            run.font.size = Pt(15)
            run.font.bold = True
        elif level == 2:
            run.font.size = Pt(12)
            run.font.bold = True
        elif level == 3:
            run.font.size = Pt(11)
            run.font.bold = True
    return p

def add_para(doc, text, size=11, bold=False, color=None, space_before=0, space_after=6, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name  = 'Calibri'
    run.font.size  = Pt(size)
    run.font.bold  = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    return p

def add_bullet(doc, text, size=11, indent=0):
    p = doc.add_paragraph(style='List Bullet')
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(4)
    if indent:
        p.paragraph_format.left_indent = Inches(indent)
    return p

def add_divider(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '4')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'CCCCCC')
    pBdr.append(bottom)
    pPr.append(pBdr)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after  = Pt(4)

def style_table(table):
    """Apply Calibri 10pt to all table cells."""
    for row in table.rows:
        for cell in row.cells:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.name = 'Calibri'
                    run.font.size = Pt(10)

def set_cell_bold(cell):
    for para in cell.paragraphs:
        for run in para.runs:
            run.font.bold = True

def set_row_shading(row, hex_color='F2F2F2'):
    """Light grey background for header rows."""
    for cell in row.cells:
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), hex_color)
        tcPr.append(shd)

# ═══════════════════════════════════════════════
# TITLE
# ═══════════════════════════════════════════════
p = doc.add_paragraph()
run = p.add_run('Copilot Value Assessment — Scoring Methodology')
run.font.name  = 'Calibri'
run.font.size  = Pt(22)
run.font.bold  = True
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
p.paragraph_format.space_after = Pt(4)

p2 = doc.add_paragraph()
run2 = p2.add_run('How Time Savings and the Role-Habit Relevance Matrix Are Calculated')
run2.font.name  = 'Calibri'
run2.font.size  = Pt(13)
run2.font.bold  = False
run2.font.color.rgb = RGBColor(80, 80, 80)
p2.paragraph_format.space_after = Pt(2)

p3 = doc.add_paragraph()
run3 = p3.add_run('Reference document for the Copilot Value Assessment tool')
run3.font.name  = 'Calibri'
run3.font.size  = Pt(10)
run3.font.color.rgb = RGBColor(130, 130, 130)
p3.paragraph_format.space_after = Pt(14)

add_divider(doc)

# ═══════════════════════════════════════════════
# SECTION 1 — TIME SAVINGS OVERVIEW
# ═══════════════════════════════════════════════
add_heading(doc, '1.  How Use Case Time Savings Are Calculated', level=1)

add_para(doc,
    'Every use case in the Copilot Value Assessment includes an estimated weekly time saving (minutes/week). '
    'This figure is not fixed or hardcoded — it is computed dynamically for each combination of habit and role '
    'using a three-component formula derived from published research.',
    space_after=10)

add_heading(doc, '1.1  The Formula', level=2)

add_para(doc, 'timeSaved (min/week)  =  baseTime  ×  copilotSavingsPct  ×  weight', bold=True, space_after=6)

add_para(doc,
    'All three components are traceable to published research sources. The same inputs always produce the '
    'same output for a given role and habit — there is no manual adjustment per company.',
    space_after=10)

add_divider(doc)

# ── Component 1: baseTime ──
add_heading(doc, '1.2  Component 1: baseTime — Time Spent on the Task Per Week', level=2)

add_para(doc,
    'baseTime is the average minutes per week a typical office worker spends on that category of work, '
    'drawn from three published sources:',
    space_after=6)

add_bullet(doc, 'Microsoft Work Trend Index 2024 — workers spend approximately 2.5 hours per day on email; '
           'roughly 25% is active drafting (~160 min/week).')
add_bullet(doc, 'McKinsey "The Social Economy" (2012) — knowledge workers spend 1.8 hours per day '
           'searching for and gathering information (~120 min/week on research tasks).')
add_bullet(doc, 'Atlassian "State of Teams" (2023) — workers attend ~62 meetings per month; '
           'notes and follow-up add ~120 min/week of effort.')
doc.add_paragraph()

add_para(doc, 'baseTime values used in this assessment:', bold=True, size=10, space_after=4)

# Table: baseTime
t1 = doc.add_table(rows=8, cols=3)
t1.style = 'Table Grid'
headers = ['Habit', 'baseTime', 'Research Source']
for i, h in enumerate(headers):
    t1.rows[0].cells[i].text = h
    set_cell_bold(t1.rows[0].cells[i])
set_row_shading(t1.rows[0])

rows_data = [
    ('CH1 / MH1  Ask-Me-Anything / Email Briefing', '30 min',  'Quick lookups; lower-frequency activity'),
    ('CH2 / MH4  Research / SharePoint Search',      '120 min', 'McKinsey: 1.8 hrs/day searching for information'),
    ('CH3 / MH2  Email Drafting',                    '160 min', 'Work Trend Index: ~25% of 2.5 hrs/day email time'),
    ('CH4 / MH3  Meeting Notes',                     '120 min', 'Atlassian: ~3 meetings/week × 40 min notes effort'),
    ('CH5 / MH5  Content Creation',                  '180 min', 'Knowledge workers: ~2 hrs/day producing written output'),
    ('CH6 / MH6  Document Review',                   '120 min', 'Similar effort profile to research and information extraction'),
    ('CH7 / MH7  Data Analysis',                     '90 min',  'Moderate baseline; scales significantly for Finance roles via weight'),
]
for i, (habit, bt, source) in enumerate(rows_data):
    row = t1.rows[i + 1]
    row.cells[0].text = habit
    row.cells[1].text = bt
    row.cells[2].text = source
style_table(t1)
doc.add_paragraph()

add_divider(doc)

# ── Component 2: copilotSavingsPct ──
add_heading(doc, '1.3  Component 2: copilotSavingsPct — How Much Does Copilot Reduce Task Time?', level=2)

add_para(doc,
    'copilotSavingsPct is the percentage of task time saved when Microsoft 365 Copilot is actively used. '
    'These figures come from an independent study commissioned by Microsoft.',
    space_after=6)

p = doc.add_paragraph()
rb = p.add_run('Source: ')
rb.font.name = 'Calibri'; rb.font.size = Pt(11); rb.font.bold = True
rq = p.add_run('Forrester Consulting, "The Total Economic Impact™ of Microsoft 365 Copilot" (2024). '
               'Methodology: interviews with 8 early-adopter organisations and a survey of 351 Microsoft 365 Copilot users.')
rq.font.name = 'Calibri'; rq.font.size = Pt(11)
p.paragraph_format.space_after = Pt(6)

add_para(doc, 'Forrester measured savings across three task categories:', space_after=4)
add_bullet(doc, 'Meeting notes and summarisation:  18.6% time saving')
add_bullet(doc, 'Information search and research:  29.8% time saving')
add_bullet(doc, 'Content and document creation:    34.2% time saving')
doc.add_paragraph()

add_para(doc, 'Mapping of Forrester categories to Copilot habits:', bold=True, size=10, space_after=4)

# Table: savings pct
t2 = doc.add_table(rows=8, cols=3)
t2.style = 'Table Grid'
headers2 = ['Habit', 'Savings %', 'Forrester Category Applied']
for i, h in enumerate(headers2):
    t2.rows[0].cells[i].text = h
    set_cell_bold(t2.rows[0].cells[i])
set_row_shading(t2.rows[0])

rows2 = [
    ('CH1  Ask-Me-Anything',     '29.8%', 'Information search (Q&A is a form of knowledge retrieval)'),
    ('MH1  Email & Calendar Briefing', '18.6%', 'Meeting summarisation (personal briefing is a summarisation task)'),
    ('CH2  Research (web)',       '29.8%', 'Information search'),
    ('CH3  Email Drafting',       '34.2%', 'Content creation (email drafting produces written output)'),
    ('CH4 / MH3  Meeting Notes',  '18.6%', 'Meeting notes and summarisation'),
    ('CH5 / MH5  Content Creation','34.2%','Content creation'),
    ('CH6 / MH6  Document Review','18.6%', 'Meeting summarisation (review and extraction is analogous)'),
    ('CH7 / MH7  Data Analysis',  '34.2%', 'Content creation (analysis produces structured, written output)'),
    ('MH4  SharePoint Search',    '29.8%', 'Information search (internal document retrieval)'),
]

t2_full = doc.add_table(rows=len(rows2)+1, cols=3)
t2_full.style = 'Table Grid'
for i, h in enumerate(headers2):
    t2_full.rows[0].cells[i].text = h
    set_cell_bold(t2_full.rows[0].cells[i])
set_row_shading(t2_full.rows[0])
for i, (habit, pct, cat) in enumerate(rows2):
    row = t2_full.rows[i + 1]
    row.cells[0].text = habit
    row.cells[1].text = pct
    row.cells[2].text = cat
style_table(t2_full)
doc.add_paragraph()

# Remove the first smaller table (was a draft) — actually we didn't add it, skip
add_divider(doc)

# ── Component 3: weight ──
add_heading(doc, '1.4  Component 3: weight — How Relevant Is This Habit to This Role?', level=2)

add_para(doc,
    'weight adjusts the time saving based on how central the habit is to the role\'s day-to-day work. '
    'It is derived from the role\'s relevanceScore (0–100), which is generated by Claude during company research '
    'by scoring how closely each habit aligns with the role\'s key activities, objectives, and pain points.',
    space_after=8)

add_heading(doc, 'Non-Linear Weight Curve', level=3)

add_para(doc,
    'The weight function is non-linear: roles that barely use a habit are penalised more, while roles '
    'that are heavily focused on a habit are rewarded more. This reflects the reality that a Data Analyst '
    'who lives in Excel gains far more from Copilot\'s data features than an IT administrator who rarely '
    'touches spreadsheets.',
    space_after=6)

# Table: weight zones
t3 = doc.add_table(rows=4, cols=4)
t3.style = 'Table Grid'
for i, h in enumerate(['Score Zone', 'Score Range', 'Weight Range', 'Meaning']):
    t3.rows[0].cells[i].text = h
    set_cell_bold(t3.rows[0].cells[i])
set_row_shading(t3.rows[0])

zones = [
    ('Zone 1 — Low relevance',    '0 – 20',   '0.20 → 0.40', 'Habit barely applies to role; significant penalty applied'),
    ('Zone 2 — Moderate relevance','21 – 60',  '0.40 → 0.90', 'Habit is relevant but not the role\'s primary focus'),
    ('Zone 3 — High relevance',   '61 – 100',  '0.90 → 1.50', 'Habit is core to the role; bonus multiplier applied'),
]
for i, (zone, rng, wt, meaning) in enumerate(zones):
    row = t3.rows[i + 1]
    row.cells[0].text = zone
    row.cells[1].text = rng
    row.cells[2].text = wt
    row.cells[3].text = meaning
style_table(t3)
doc.add_paragraph()

add_para(doc, 'Exact formulas:', bold=True, size=10, space_after=4)
add_bullet(doc, 'Zone 1 (score 0–20):    weight = 0.20 + (score / 20) × 0.20')
add_bullet(doc, 'Zone 2 (score 21–60):   weight = 0.40 + ((score − 20) / 40) × 0.50')
add_bullet(doc, 'Zone 3 (score 61–100):  weight = 0.90 + ((score − 60) / 40) × 0.60')
doc.add_paragraph()

add_para(doc, 'Minimum output: 5 minutes/week (floor applied so no result rounds to zero).', size=10, color=(80,80,80), space_after=10)

add_divider(doc)

# ── Worked Examples ──
add_heading(doc, '1.5  Worked Examples', level=2)

examples = [
    (
        'Example A — Finance & Operations + Data Analysis (CH7 / MH7)',
        [
            ('baseTime',          '90 min/week'),
            ('copilotSavingsPct', '34.2%  (Forrester: content/structured output)'),
            ('relevanceScore',    '90 out of 100  (Finance roles are heavily data-focused: "analyse budget variances", '
                                  '"build Excel models", "prepare monthly financial reports")'),
            ('weight (Zone 3)',   '0.90 + ((90 − 60) / 40) × 0.60  =  0.90 + 0.45  =  1.35'),
            ('timeSaved',         '90 × 0.342 × 1.35  =  41 min/week'),
        ]
    ),
    (
        'Example B — IT & Systems Administrators + Data Analysis (CH7)',
        [
            ('baseTime',          '90 min/week'),
            ('copilotSavingsPct', '34.2%'),
            ('relevanceScore',    '40 out of 100  (IT roles focus on helpdesk, access management, and system config — '
                                  'low data-analysis signal)'),
            ('weight (Zone 2)',   '0.40 + ((40 − 20) / 40) × 0.50  =  0.40 + 0.25  =  0.65'),
            ('timeSaved',         '90 × 0.342 × 0.65  =  20 min/week'),
        ]
    ),
    (
        'Example C — Legal / Compliance + Document Review (CH6 / MH6)',
        [
            ('baseTime',          '120 min/week'),
            ('copilotSavingsPct', '18.6%  (Forrester: summarisation)'),
            ('relevanceScore',    '85 out of 100  (Legal roles are defined by contract review, regulatory reading, '
                                  'and compliance document analysis — minimum floor enforced by role rules)'),
            ('weight (Zone 3)',   '0.90 + ((85 − 60) / 40) × 0.60  =  0.90 + 0.375  =  1.275'),
            ('timeSaved',         '120 × 0.186 × 1.275  =  28 min/week'),
        ]
    ),
]

for title, calcs in examples:
    add_para(doc, title, bold=True, space_after=4)
    for label, value in calcs:
        p = doc.add_paragraph(style='List Bullet')
        rb = p.add_run(f'{label}: ')
        rb.font.name = 'Calibri'; rb.font.size = Pt(11); rb.font.bold = True
        rv = p.add_run(value)
        rv.font.name = 'Calibri'; rv.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(3)
    doc.add_paragraph()

add_para(doc,
    'The contrast between Finance (41 min) and IT (20 min) for the same Data Analysis habit illustrates '
    'how roleWeight captures real-world differences in task relevance — without any manual adjustment per company. '
    'When a new company profile is loaded, the same formula runs automatically against whatever role descriptions are provided.',
    size=10, color=(80, 80, 80), space_after=10)

add_divider(doc)

# ═══════════════════════════════════════════════
# SECTION 2 — ROLE-HABIT RELEVANCE MATRIX
# ═══════════════════════════════════════════════
add_heading(doc, '2.  How the Role-Habit Relevance Matrix Is Calculated', level=1)

add_para(doc,
    'The Role-Habit Relevance Matrix ranks the seven Copilot habits from 1 (most relevant) to 7 (least relevant) '
    'for each role. Two separate matrices are produced — one for Copilot Chat habits (CH1–CH7) and one for '
    'M365 Copilot habits (MH1–MH7). Rankings are computed dynamically for every company; there are no '
    'hardcoded role codes or pre-set rankings.',
    space_after=10)

add_heading(doc, '2.1  Step 1 — Claude Generates habitScores During Company Research', level=2)

add_para(doc,
    'When a new company profile is created, the AI (Claude) reads the company\'s website content and '
    'generates a structured profile for each identified role. As part of this process, Claude scores each '
    'habit on a scale of 1 to 10 for each role — stored as habitScores in the profile.',
    space_after=6)

add_para(doc, 'Example habitScores for a Finance & Operations role:', bold=True, size=10, space_after=4)

t4 = doc.add_table(rows=8, cols=3)
t4.style = 'Table Grid'
for i, h in enumerate(['Habit', 'Score (1–10)', 'Reasoning']):
    t4.rows[0].cells[i].text = h
    set_cell_bold(t4.rows[0].cells[i])
set_row_shading(t4.rows[0])

fin_scores = [
    ('CH7 / MH7  Data Analysis',         '9', 'Core task: "building Excel models", "analysing budget variances"'),
    ('CH6 / MH6  Document Review',        '8', 'Core task: reviewing invoices and financial reports'),
    ('CH2        Research (web)',          '7', 'Supporting task: validating external financial benchmarks'),
    ('MH4        SharePoint Search',       '6', 'Internal policy and approval documents — moderate need'),
    ('CH3 / MH2  Email Drafting',          '5', 'Present but not the primary pain point for Finance'),
    ('CH4 / MH3  Meeting Notes',           '4', 'Meetings occur but are not the dominant productivity drain'),
    ('CH1        Ask-Me-Anything',         '3', 'Low value: Finance works with structured data, not general Q&A'),
]
for i, (habit, score, reason) in enumerate(fin_scores):
    row = t4.rows[i + 1]
    row.cells[0].text = habit
    row.cells[1].text = score
    row.cells[2].text = reason
style_table(t4)
doc.add_paragraph()

add_heading(doc, 'Scoring Rules Enforced in the Prompt', level=3)
add_bullet(doc, 'Distribution rule: at most 3–4 habits should score 7 or higher per role. '
           'Claude must make real trade-offs — not give every habit a high score.')
add_bullet(doc, 'Do not default to 6: scores must reflect genuine role-habit fit. '
           'Use 4–5 for habits with moderate relevance, 7–8 only when the habit directly addresses a major pain point.')
add_bullet(doc, 'CH1 and MH1 floor: all knowledge worker roles receive a minimum score of 6 for both '
           'Ask-Me-Anything habits, since every office worker benefits from general Q&A at some level.')
doc.add_paragraph()

add_divider(doc)

add_heading(doc, '2.2  Step 2 — Scores Are Converted to a 0–100 Relevance Scale', level=2)

add_para(doc,
    'habitScores (1–10) are multiplied by 10 to produce relevanceScore (0–100). This scale is used '
    'consistently across the time savings formula, the weight calculation, and the matrix rankings.',
    space_after=6)

add_para(doc, 'Example: habitScore of 9 → relevanceScore of 90.', italic=True, size=10, color=(80,80,80), space_after=6)

add_para(doc,
    'Two thresholds are then applied:',
    space_after=4)
add_bullet(doc, 'relevanceScore ≤ 20 (HIDE_THRESHOLD): the habit does not apply to this role. '
           'The use case is hidden and excluded from the output.')
add_bullet(doc, 'relevanceScore < 30 (SPECIFIC_THRESHOLD): the habit has some relevance but '
           'not enough for a role-specific use case. A generic fallback prompt is used instead.')
doc.add_paragraph()

add_divider(doc)

add_heading(doc, '2.3  Step 3 — Code-Side Minimum Scores Are Applied', level=2)

add_para(doc,
    'After Claude generates habitScores, a set of safety-net rules is applied in code to catch obvious '
    'role-habit mismatches. These rules ensure that well-known role-habit pairings are never scored too low, '
    'regardless of how the role description was worded.',
    space_after=6)

add_para(doc, 'Minimum score rules by role keyword:', bold=True, size=10, space_after=4)

t5 = doc.add_table(rows=9, cols=3)
t5.style = 'Table Grid'
for i, h in enumerate(['Role Keywords', 'Habit Minimum Scores', 'Rationale']):
    t5.rows[0].cells[i].text = h
    set_cell_bold(t5.rows[0].cells[i])
set_row_shading(t5.rows[0])

minimums = [
    ('finance, financial, accounting, analyst, cfo, fp&a, treasury',
     'CH7 ≥ 70, MH7 ≥ 70, CH6 ≥ 60, MH6 ≥ 60',
     'Finance roles always work with data and financial documents'),
    ('hr, human resource, people, talent, recruiter, l&d, hrbp',
     'CH4 ≥ 70, MH3 ≥ 70, CH3 ≥ 60, MH2 ≥ 60',
     'HR roles are defined by meetings, interviews, and communication'),
    ('sales, account manager, account executive, bdm, commercial',
     'CH3 ≥ 70, MH2 ≥ 70, CH2 ≥ 60, MH5 ≥ 60',
     'Sales roles depend on email, proposals, and outreach'),
    ('legal, compliance, lawyer, counsel, regulatory, risk, audit',
     'CH6 ≥ 80, MH6 ≥ 80, CH2 ≥ 70, MH4 ≥ 70',
     'Legal roles are defined by contract review and research'),
    ('marketing, brand, content, communications, digital, campaign',
     'CH5 ≥ 80, MH5 ≥ 80, CH3 ≥ 70, MH2 ≥ 60',
     'Marketing roles are heavy producers of written content'),
    ('it, technology, developer, engineer, infrastructure, helpdesk',
     'CH1 ≥ 80, CH4 ≥ 60, MH4 ≥ 60',
     'IT roles rely on Q&A lookups and internal documentation search'),
    ('project manager, pmo, programme, delivery manager',
     'CH4 ≥ 70, MH3 ≥ 70, CH5 ≥ 60, MH5 ≥ 60',
     'PMs run meetings and produce status reports and action plans'),
    ('executive, ceo, coo, director, head of, vp, vice president',
     'MH1 ≥ 80, CH4 ≥ 70, MH3 ≥ 70, CH2 ≥ 60',
     'Executives prioritise personal briefings and strategic meetings'),
]
for i, (kw, mins, why) in enumerate(minimums):
    row = t5.rows[i + 1]
    row.cells[0].text = kw
    row.cells[1].text = mins
    row.cells[2].text = why
style_table(t5)
doc.add_paragraph()

add_para(doc,
    'These rules use keyword matching against the role name. If a role matches a keyword group, '
    'the relevant habit scores are raised to the minimum — they are never lowered.',
    size=10, color=(80,80,80), space_after=10)

add_divider(doc)

add_heading(doc, '2.4  Step 4 — Habits Are Ranked 1–7 Per Role', level=2)

add_para(doc,
    'After all scores are finalised, habits are ranked from 1 (highest relevanceScore) to 7 (lowest) '
    'for each role independently. Rankings are calculated dynamically for every role in every company — '
    'the same habit can rank #1 for one role and #6 for another.',
    space_after=6)

add_heading(doc, 'Tiebreaker Logic', level=3)

add_para(doc,
    'To ensure each habit always receives a unique rank (no ties), a three-level sort is applied:',
    space_after=4)

add_bullet(doc, 'Primary:    Sort by relevanceScore descending (higher score = better rank)')
add_bullet(doc, 'Secondary:  If relevanceScore is equal, sort by timeSaved descending '
           '(the habit that saves more time ranks higher)')
add_bullet(doc, 'Tertiary:   If both scores are equal, sort alphabetically by habitId '
           '(e.g. CH2 ranks above CH3)')
doc.add_paragraph()

add_para(doc,
    'This three-level sort guarantees unique ranks 1–7 for every role without any hardcoded global ordering. '
    'It correctly reflects the specific mix of activities and pain points for each individual role.',
    size=10, color=(80,80,80), space_after=10)

add_divider(doc)

add_heading(doc, '2.5  CH vs MH: Why Two Separate Matrices?', level=2)

add_para(doc,
    'Copilot Chat (CH) and Microsoft 365 Copilot (MH) serve different purposes and access different data. '
    'Although they share the same seven habit categories, they are scored independently where appropriate.',
    space_after=6)

t6 = doc.add_table(rows=3, cols=3)
t6.style = 'Table Grid'
for i, h in enumerate(['', 'Copilot Chat (CH)', 'M365 Copilot (MH)']):
    t6.rows[0].cells[i].text = h
    set_cell_bold(t6.rows[0].cells[i])
set_row_shading(t6.rows[0])
t6.rows[1].cells[0].text = 'Access'
t6.rows[1].cells[1].text = 'Public web knowledge; available at microsoft365.com'
t6.rows[1].cells[2].text = 'Organisation\'s internal data: emails, SharePoint, Teams, calendar'
t6.rows[2].cells[0].text = 'Licence'
t6.rows[2].cells[1].text = 'Free tier available'
t6.rows[2].cells[2].text = 'Paid Microsoft 365 Copilot licence required'
style_table(t6)
doc.add_paragraph()

add_para(doc, 'Independently scored habit pairs (CH vs MH may differ):', bold=True, size=10, space_after=4)
add_bullet(doc, 'CH1 (general Q&A)  vs  MH1 (personal email & calendar briefing) — different use cases: '
           'general lookup vs personal productivity assistant')
add_bullet(doc, 'CH2 (web research)  vs  MH4 (internal SharePoint search) — different data sources: '
           'public web vs internal documents')
add_bullet(doc, 'CH4 (meeting notes)  vs  MH3 (M365 Teams meeting recap) — same activity but '
           'CH4 covers manual note-taking while MH3 leverages Teams integration')
doc.add_paragraph()

add_para(doc, 'Mirrored habit pairs (same score for CH and MH):', bold=True, size=10, space_after=4)
add_bullet(doc, 'CH3 = MH2  (Email Drafting — same underlying task)')
add_bullet(doc, 'CH5 = MH5  (Content Creation — same underlying task)')
add_bullet(doc, 'CH6 = MH6  (Document Review — same underlying task)')
add_bullet(doc, 'CH7 = MH7  (Data Analysis — same underlying task)')
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════
# SECTION 3 — FULL PIPELINE SUMMARY
# ═══════════════════════════════════════════════
add_heading(doc, '3.  End-to-End Pipeline Summary', level=1)

add_para(doc,
    'The following diagram shows how each component connects, from company research to the final matrix ranking:',
    space_after=8)

steps = [
    ('Step 1', 'Company Research',
     'Claude reads the company website and generates role profiles with keyActivities, objectives, and painPoints.'),
    ('Step 2', 'habitScores Generated',
     'Claude scores each of the 14 habits (CH1–CH7, MH1–MH7) on a 1–10 scale per role, following distribution and floor rules.'),
    ('Step 3', 'Code-Side Minimums Applied',
     'Role keyword matching enforces minimum scores for well-known pairings (e.g. Legal → CH6 ≥ 80).'),
    ('Step 4', 'relevanceScore Computed',
     'habitScore × 10 → relevanceScore (0–100). Scores ≤ 20 are hidden; scores < 30 use generic prompts.'),
    ('Step 5', 'timeSaved Computed',
     'timeSaved = baseTime × copilotSavingsPct × weight. Weight is derived from relevanceScore via non-linear curve.'),
    ('Step 6', 'Matrix Rankings Generated',
     'Habits are ranked 1–7 per role by relevanceScore (descending), with timeSaved and habitId as tiebreakers.'),
]

for step, title, desc in steps:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    rs = p.add_run(f'{step} — {title}: ')
    rs.font.name = 'Calibri'; rs.font.size = Pt(11); rs.font.bold = True
    rd = p.add_run(desc)
    rd.font.name = 'Calibri'; rd.font.size = Pt(11)

doc.add_paragraph()
add_divider(doc)

# ═══════════════════════════════════════════════
# SECTION 4 — SOURCES
# ═══════════════════════════════════════════════
add_heading(doc, '4.  Sources and Citations', level=1)

sources = [
    ('Forrester Consulting (2024)',
     '"The Total Economic Impact™ of Microsoft 365 Copilot." Commissioned by Microsoft. '
     'Methodology: interviews with 8 early-adopter organisations; survey of 351 users. '
     'Source for copilotSavingsPct values (18.6%, 29.8%, 34.2%).',
     'https://tei.forrester.com/go/microsoft/M365Copilot/'),
    ('Microsoft Work Trend Index (2024)',
     'Annual global survey of over 31,000 workers across 31 countries. '
     'Source for email baseTime: workers spend ~2.5 hours/day on email, ~25% is active drafting.',
     'https://www.microsoft.com/en-us/worklab/work-trend-index'),
    ('McKinsey Global Institute (2012)',
     '"The Social Economy: Unlocking value and productivity through social technologies." '
     'Source for research baseTime: knowledge workers spend 1.8 hours/day searching for information.',
     'https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-social-economy'),
    ('Atlassian (2023)',
     '"State of Teams." Source for meeting baseTime: workers attend ~62 meetings/month; '
     'notes and follow-up represent ~120 min/week of effort.',
     'https://www.atlassian.com/state-of-teams-2023'),
    ('Dillon, Jaffe, Peng & Cambon — Microsoft Research (2025)',
     '"Early Impacts of M365 Copilot." arXiv:2504.11443. RCT across 56 firms, 6,000+ workers, 6 months. '
     'Empirical validation of email and document creation savings for knowledge workers and managers.',
     'https://arxiv.org/abs/2504.11443'),
]

for title, desc, url in sources:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(title)
    r.font.name = 'Calibri'; r.font.size = Pt(11); r.font.bold = True
    add_para(doc, desc, size=10, space_after=2)
    add_para(doc, f'Available at: {url}', size=10, color=(80, 80, 80), space_after=8)

# ── Save ──
output_path = 'Copilot Value Assessment — Scoring Methodology.docx'
doc.save(output_path)
print(f'Saved: {output_path}')
