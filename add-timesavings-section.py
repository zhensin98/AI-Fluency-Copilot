import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from docx import Document
from docx.oxml import OxmlElement

doc = Document('Role-Habit Relevance Matrix Methodology.docx')

# Find paragraph index of "5. Recommended Next Steps" (already renamed in previous run)
insert_before_idx = None
for i, p in enumerate(doc.paragraphs):
    if '5.' in p.text and 'Next Steps' in p.text:
        insert_before_idx = i
        break

# Remove previously inserted section 4 paragraphs (everything from "4. How Use Case" up to section 5)
start_remove = None
for i, p in enumerate(doc.paragraphs):
    if '4.' in p.text and 'How Use Case Time Savings' in p.text:
        start_remove = i
        break

if start_remove is not None:
    # Remove paragraphs from start_remove to insert_before_idx (exclusive)
    paras_to_remove = doc.paragraphs[start_remove:insert_before_idx]
    for p in paras_to_remove:
        p._element.getparent().remove(p._element)
    print(f'Removed {len(paras_to_remove)} old paragraphs')

# Re-find insert point
insert_before_idx = None
for i, p in enumerate(doc.paragraphs):
    if '5.' in p.text and 'Next Steps' in p.text:
        insert_before_idx = i
        break

print(f'Inserting before paragraph {insert_before_idx}: "{doc.paragraphs[insert_before_idx].text[:60]}"')

def insert_para_before(doc, idx, text, style='Normal'):
    ref_para = doc.paragraphs[idx]
    new_para = OxmlElement('w:p')
    ref_para._p.addprevious(new_para)
    p_obj = doc.paragraphs[idx]
    p_obj.style = doc.styles[style]
    p_obj.text = text
    return p_obj

# Insert in REVERSE order so first line ends up at the top
lines = [
    ('Heading 1', '4.  How Use Case Time Savings Are Calculated'),
    ('Normal',    'Each use case in the Chanel Copilot Value Assessment includes an estimated weekly time saving (minutes/week). This section explains the formula used, the research sources behind each component, and worked examples.'),

    ('Heading 2', '4.1  The Formula'),
    ('Normal',    'timeSaved (min/week)  =  baseTime  x  copilotSavingsPct  x  roleWeight'),
    ('Normal',    'Every number is traceable to published research. There is no arbitrary variation — the same inputs always produce the same output for the same role and habit combination.'),

    ('Heading 2', '4.2  Component 1: baseTime — How Long Does the Task Take Per Week?'),
    ('Normal',    'baseTime is the average minutes per week a typical office worker spends on that type of activity. These figures are drawn from three sources:'),
    ('List Bullet', 'Microsoft Work Trend Index 2024 — workers spend approximately 2.5 hours per day on email; roughly 25% is active drafting, giving approximately 160 min/week.'),
    ('List Bullet', 'McKinsey "The Social Economy" (2012) — knowledge workers spend 1.8 hours per day searching for and gathering information, giving approximately 120 min/week on research tasks.'),
    ('List Bullet', 'Atlassian "State of Teams" (2023) — workers attend an average of 62 meetings per month; notes and follow-up add roughly 120 min/week of effort.'),
    ('Normal',    'Base time values used in this assessment:'),
    ('Normal',    'Habit                        | baseTime  | Rationale'),
    ('Normal',    'CH1/MH1  Ask-Me-Anything      | 30 min    | Quick lookups; low frequency'),
    ('Normal',    'CH2/MH4  Research / Search     | 120 min   | McKinsey: 1.8 hrs/day searching'),
    ('Normal',    'CH3/MH2  Email Drafting        | 160 min   | Work Trend Index: ~25% of 2.5 hrs/day email time'),
    ('Normal',    'CH4/MH3  Meeting Notes         | 120 min   | Atlassian: ~3 meetings/week x 40 min notes effort'),
    ('Normal',    'CH5/MH5  Content Creation      | 180 min   | Knowledge workers: ~2 hrs/day on documents'),
    ('Normal',    'CH6/MH6  Document Review       | 120 min   | Similar to research — reading and extracting key info'),
    ('Normal',    'CH7/MH7  Data Analysis         | 90 min    | Moderate baseline; scales up significantly for FIN roles'),

    ('Heading 2', '4.3  Component 2: copilotSavingsPct — How Much Does Copilot Cut That Time?'),
    ('Normal',    'copilotSavingsPct is the percentage of task time saved by Microsoft 365 Copilot, measured by Forrester Research in an independent study commissioned by Microsoft.'),
    ('Normal',    'Source: Forrester Consulting, "The Total Economic Impact of Microsoft 365 Copilot" (2024). Methodology: interviews with 8 early-adopter organisations and a survey of 351 Microsoft 365 Copilot users across multiple industries.'),
    ('Normal',    'Available at: https://tei.forrester.com/go/microsoft/M365Copilot/'),
    ('Normal',    'Forrester measured savings across three task categories:'),
    ('List Bullet', 'Meeting notes and summarisation: 18.6% time saving'),
    ('List Bullet', 'Information search and research: 29.8% time saving'),
    ('List Bullet', 'Content and document creation: 34.2% time saving'),
    ('Normal',    'These percentages are mapped to each habit as follows:'),
    ('Normal',    'Habit                        | Savings %  | Forrester Category Applied'),
    ('Normal',    'CH1/MH1  Ask-Me-Anything      | 29.8%      | Information search (Q&A is a form of knowledge retrieval)'),
    ('Normal',    'CH2/MH4  Research / Search     | 29.8%      | Information search'),
    ('Normal',    'CH3/MH2  Email Drafting        | 34.2%      | Content creation (email drafting produces written output)'),
    ('Normal',    'CH4/MH3  Meeting Notes         | 18.6%      | Meeting notes and summarisation'),
    ('Normal',    'CH5/MH5  Content Creation      | 34.2%      | Content creation'),
    ('Normal',    'CH6/MH6  Document Review       | 18.6%      | Meeting summarisation (document review is similar in nature)'),
    ('Normal',    'CH7/MH7  Data Analysis         | 34.2%      | Content creation (data analysis produces structured output)'),

    ('Heading 2', '4.4  Component 3: roleWeight — Does This Role Actually Use This Habit?'),
    ('Normal',    'roleWeight adjusts the time saving based on how central the habit is to the role\'s day-to-day work. It is derived automatically by matching signal keywords for each habit against the role\'s keyActivities, objectives, and painPoints from the Profile Explorer.'),
    ('Normal',    'Weight range: 0.5 (role rarely performs this task) to 1.5 (role is heavily focused on this task).'),
    ('Normal',    'Formula: roleWeight = 0.5 + (keywordMatchScore / 100)'),
    ('Normal',    'Where keywordMatchScore (0-100) counts how many signal keywords for that habit appear in the role description, multiplied by 10, capped at 100.'),
    ('Normal',    'Signal keywords by habit (examples):'),
    ('List Bullet', 'CH3 Email: "email", "draft", "write", "communicate", "reply", "message", "follow-up"'),
    ('List Bullet', 'CH4 Meeting: "meeting", "notes", "minutes", "discussion", "action", "recap"'),
    ('List Bullet', 'CH7 Data: "data", "analyse", "excel", "metrics", "figures", "variance", "forecast", "report"'),
    ('Normal',    'This approach works for any company\'s roles — it does not rely on hardcoded role codes. When a new company profile is loaded with different roles, keyword matching runs automatically against whatever role descriptions are provided.'),

    ('Heading 2', '4.5  Worked Examples'),
    ('Normal',    'Example 1 — Knowledge Workers & Office Staff + Email Drafting (CH3)'),
    ('List Bullet', 'baseTime: 160 min/week (Work Trend Index: office workers spend ~25% of email time actively drafting)'),
    ('List Bullet', 'copilotSavingsPct: 34.2% (Forrester: content creation)'),
    ('List Bullet', 'roleWeight: 0.80 — KW keyActivities include "drafting internal briefs and memos", "managing inbox and responding to cross-department queries". Keywords matched: "draft", "inbox". Score = 30/100. Weight = 0.5 + 0.30 = 0.80.'),
    ('List Bullet', 'Calculation: 160 x 0.342 x 0.80 = 44 min/week saved'),

    ('Normal',    'Example 2 — Finance & Operations + Data Analysis (CH7)'),
    ('List Bullet', 'baseTime: 90 min/week'),
    ('List Bullet', 'copilotSavingsPct: 34.2% (Forrester: content creation / structured output)'),
    ('List Bullet', 'roleWeight: 1.00 — FIN keyActivities include "analyse budget variances", "building Excel models for seasonal forecasting", "preparing monthly financial reports". Keywords matched: "analyse", "excel", "variance", "report", "forecast". Score = 50/100. Weight = 0.5 + 0.50 = 1.00.'),
    ('List Bullet', 'Calculation: 90 x 0.342 x 1.00 = 31 min/week saved'),

    ('Normal',    'Example 3 — IT & Systems Administrators + Data Analysis (CH7)'),
    ('List Bullet', 'baseTime: 90 min/week'),
    ('List Bullet', 'copilotSavingsPct: 34.2%'),
    ('List Bullet', 'roleWeight: 0.50 — IT keyActivities focus on helpdesk tickets, access management, Microsoft 365 configuration, and writing technical guides. No data/analysis keywords matched. Score = 0/100. Weight = 0.5 + 0.00 = 0.50.'),
    ('List Bullet', 'Calculation: 90 x 0.342 x 0.50 = 15 min/week saved'),

    ('Normal',    'The contrast between FIN (31 min) and IT (15 min) for the same Data Analysis habit reflects the reality that Finance roles spend far more time on data analysis than IT roles. This difference is captured automatically from the role descriptions, without any manual adjustment per company.'),

    ('Heading 2', '4.6  Full Results for This Assessment (Chanel)'),
    ('Normal',    'Applying the formula across all 84 use cases (42 Copilot Chat + 42 M365 Copilot) for the six Chanel role groups:'),
    ('List Bullet', 'Copilot Chat total: 978 min/week'),
    ('List Bullet', 'M365 Copilot total: 956 min/week'),
    ('List Bullet', 'Combined total: 1,934 min/week (~32 hours/week across all six role groups combined)'),
    ('Normal',    'These figures represent the estimated aggregate weekly time saving if one representative from each role group actively uses all seven Copilot habits. In practice, individual savings will vary based on actual usage frequency and role responsibilities.'),

    ('Heading 2', '4.7  Limitations and Caveats'),
    ('List Bullet', 'Forrester percentages are averages across surveyed organisations and may not reflect Chanel-specific workflows or the luxury goods industry context.'),
    ('List Bullet', 'baseTime values are industry-wide benchmarks, not Chanel-measured figures. Actual time spent per task will vary by individual and team.'),
    ('List Bullet', 'roleWeight is derived from keyword matching on role descriptions — it is a reasonable proxy but not a direct measurement of actual time spent per task type.'),
    ('List Bullet', 'These numbers should be treated as directional estimates to support prioritisation decisions, not as precise productivity commitments. Actual savings should be validated through a pilot with Microsoft Viva Insights tracking post-deployment.'),
]

# Insert in REVERSE so the first line in the list ends up first in the document
for style, text in reversed(lines):
    insert_para_before(doc, insert_before_idx, text, style)

doc.save('Role-Habit Relevance Matrix Methodology.docx')
print('Done. Section 4 inserted in correct order.')

# Verify headings order
print('\nDocument headings:')
for p in doc.paragraphs:
    if p.style.name in ('Heading 1', 'Heading 2', 'Heading 3') and p.text.strip():
        indent = '  ' if p.style.name == 'Heading 2' else ('    ' if p.style.name == 'Heading 3' else '')
        print(indent + p.text)
