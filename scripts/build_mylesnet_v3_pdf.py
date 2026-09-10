import os, re, shutil
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle, KeepTogether

ROOT = r"C:\Users\Admin\Projects\mylesnet-dashboard"
VAULT = r"C:\Obsidian\MylesCorp-Brain\products\mylesnet\Reports"
SOURCE = os.path.join(ROOT, "docs", "architecture", "MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md")
OUT = os.path.join(ROOT, "docs", "architecture", "MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.pdf")
LOGO = r"C:\Users\Admin\.codex\skills\mylescorp-doc-template\assets\mylescorp-official-horizontal-logo-2026.png"
NAVY, GOLD, ICE, CHAR, GREY = '#1A395B', '#C79639', '#EEF2F8', '#212121', '#5A6573'

class SpecDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, leftMargin=0.68*inch, rightMargin=0.68*inch, topMargin=0.82*inch, bottomMargin=0.72*inch)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='body')
        self.addPageTemplates(PageTemplate(id='main', frames=[frame], onPage=self.decorate))
    def decorate(self, canvas, doc):
        w, h = A4
        if doc.page > 1:
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor(GOLD)); canvas.setLineWidth(0.65)
            canvas.line(self.leftMargin, h-0.52*inch, w-self.rightMargin, h-0.52*inch)
            canvas.setFont('Helvetica-Bold', 7.1); canvas.setFillColor(colors.HexColor(NAVY))
            canvas.drawRightString(w-self.rightMargin, h-0.43*inch, 'MYLESNET MULTI TENANT ISP AND RADIUS SAAS | INTERNAL CONFIDENTIAL')
            canvas.line(self.leftMargin, 0.52*inch, w-self.rightMargin, 0.52*inch)
            canvas.setFont('Helvetica', 7.1); canvas.setFillColor(colors.HexColor(GREY))
            canvas.drawCentredString(w/2, 0.38*inch, 'MylesCorp Technologies Ltd | +254743993715 | info@mylescorptech.com | https://mylescorptech.com/')
            canvas.setFillColor(colors.HexColor(GOLD)); canvas.setFont('Helvetica-Oblique', 6.8)
            canvas.drawCentredString(w/2, 0.25*inch, f'Transforming Industries, Empowering Generations. | Page {doc.page}')
            canvas.restoreState()
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and getattr(flowable, '_bookmark', None):
            key, title, level = flowable._bookmark
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, level=level, closed=False)

def pstyle(name, **kw):
    kw.setdefault('fontName', 'Helvetica')
    kw.setdefault('textColor', colors.HexColor(CHAR))
    return ParagraphStyle(name, **kw)
styles = getSampleStyleSheet()
BODY = pstyle('Body', fontSize=9.2, leading=13.3, spaceAfter=8)
H1 = pstyle('H1', fontName='Helvetica-Bold', fontSize=16.5, leading=20, textColor=colors.HexColor(NAVY), spaceAfter=9, spaceBefore=0)
H2 = pstyle('H2', fontName='Helvetica-Bold', fontSize=11.6, leading=14, textColor=colors.HexColor(NAVY), spaceBefore=8, spaceAfter=3)
TOC = pstyle('Toc', fontSize=10, leading=15, textColor=colors.HexColor(NAVY), leftIndent=8)
SMALL = pstyle('Small', fontSize=8.8, leading=12, textColor=colors.HexColor(GREY))
CENTER = pstyle('Center', fontSize=11, leading=15, alignment=TA_CENTER, textColor=colors.HexColor(GREY))

def clean(text):
    text = text.replace('[[', '').replace(']]', '')
    return text.replace('&', '&amp;').replace('<product-domain>', '&lt;product-domain&gt;')

def heading(text, key, num):
    flow = Paragraph(f'<a name="{key}"/>{num}. {clean(text)}', H1)
    flow._bookmark = (key, f'{num}. {text}', 0)
    return flow

def parse_markdown():
    raw = open(SOURCE, encoding='utf-8').read().splitlines()
    sections, current = [], None
    for line in raw:
        if line == '## Related':
            if current: sections.append(current)
            current = None
            continue
        if line.startswith('## ') and line != '## Table of contents' and line != '## Related':
            if current: sections.append(current)
            current = [re.sub(r'^\d+\.\s*', '', line[3:]), []]
        elif current and line.startswith('### '):
            current[1].append(('h2', line[4:]))
        elif current and line.strip() and not line.startswith('---') and not line.startswith('# '):
            current[1].append(('p', line))
    if current: sections.append(current)
    return sections

def cover():
    story = [Spacer(1, 1.05*inch), Image(LOGO, width=4.75*inch, height=2.65*inch, hAlign='CENTER'), Spacer(1, 0.15*inch)]
    story += [Paragraph('MYLESCORP TECHNOLOGIES LTD', pstyle('cover1', fontName='Helvetica-Bold', fontSize=16, alignment=TA_CENTER, textColor=colors.HexColor(NAVY), leading=20)), Spacer(1, 0.18*inch)]
    story += [Paragraph('MylesNet', pstyle('cover2', fontName='Helvetica-Bold', fontSize=32, alignment=TA_CENTER, textColor=colors.HexColor(GOLD), leading=38)), Paragraph('Multi Tenant ISP and RADIUS SaaS', pstyle('cover3', fontName='Helvetica-Bold', fontSize=21, alignment=TA_CENTER, textColor=colors.HexColor(NAVY), leading=27)), Paragraph('Technical Specification v3', pstyle('cover4', fontName='Helvetica-Oblique', fontSize=13, alignment=TA_CENTER, textColor=colors.HexColor(GREY), leading=18)), Spacer(1, 0.28*inch)]
    data=[['Document control','Value'],['Classification','Internal Confidential'],['Owner and author','Jonathan Myles'],['Company','MylesCorp Technologies Ltd'],['Status','Proposed canonical v3 pending approval'],['Date','8 September 2026'],['Implementation baseline',r'C:\Users\Admin\Projects\mylesnet-dashboard']]
    t=Table(data, colWidths=[2.0*inch,4.45*inch], hAlign='CENTER')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(NAVY)),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('BACKGROUND',(0,1),(-1,-1),colors.HexColor(ICE)),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#D9D9D9')),('FONT',(0,0),(-1,-1),'Helvetica'),('FONTSIZE',(0,0),(-1,-1),8.8),('LEADING',(0,0),(-1,-1),12),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    story += [t, Spacer(1,0.3*inch), Paragraph('This specification defines the production transition of the active MylesNet dashboard into a full multi-tenant ISP and RADIUS SaaS.', CENTER), PageBreak()]
    return story

def make_table(rows, widths):
    converted = []
    for i, row in enumerate(rows):
        row_style = pstyle(f'table_{i}_{len(converted)}', fontName='Helvetica-Bold' if i == 0 else 'Helvetica', fontSize=8.4, leading=11, textColor=colors.white if i == 0 else colors.HexColor(CHAR))
        converted.append([Paragraph(clean(value), row_style) for value in row])
    t = Table(converted, colWidths=widths)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(NAVY)),('BACKGROUND',(0,1),(-1,-1),colors.HexColor(ICE)),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#D9D9D9')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9)]))
    return t

def main():
    sections = parse_markdown()
    os.makedirs(os.path.dirname(OUT), exist_ok=True); os.makedirs(VAULT, exist_ok=True)
    story = cover()
    toc_head = Paragraph('<a name="toc"/>Table of Contents', H1); toc_head._bookmark=('toc','Table of Contents',0)
    story += [toc_head, Paragraph('Select a section to navigate in compatible PDF readers. The bookmark pane also contains the document structure.', SMALL), Spacer(1,8)]
    for i,(title,_) in enumerate(sections,1):
        key=f's{i}'
        story.append(Paragraph(f'<link href="#{key}" color="{NAVY}">{i}. {clean(title)}</link>', TOC))
        story.append(Spacer(1, 1.5))
    story.append(PageBreak())
    for i,(title, paragraphs) in enumerate(sections,1):
        story.append(heading(title, f's{i}', i))
        story.append(Paragraph('<font color="#C79639">________________________________________________________________________________</font>', SMALL))
        for kind, line in paragraphs:
            story.append(Paragraph(clean(line), H2 if kind == 'h2' else BODY))
        story.append(Spacer(1,4))
        if i < len(sections): story.append(PageBreak())
    story.append(PageBreak())
    story.append(heading('Appendix A Status legend','appendix_a','A'))
    legend=[['Label','Meaning'],['Verified','Observed in the active repository or through current evidence; it remains subject to release-specific validation.'],['Historically verified','Previously tested or deployed but not reconfirmed for this release.'],['Unverified','A stated or observed condition lacking current end-to-end evidence.'],['Planned','A committed target design that has not been implemented.'],['Approval gated','Requires a provider contract, commercial decision, security review, legal review, or explicit owner approval before activation.']]
    t=make_table(legend,[1.7*inch,4.75*inch]); story.append(t)
    story.append(PageBreak()); story.append(heading('Appendix B Acceptance checklist','appendix_b','B'))
    checklist=[['Acceptance area','Minimum evidence'],['Tenant isolation','Cross-tenant read, write, export, queue, webhook and storage denial tests.'],['Identity','Authenticated WorkOS organization, role, revocation, support-grant and portal boundary tests.'],['Network and AAA','PPPoE and Hotspot lab tests, accounting, CoA, Disconnect and RADIUS failover validation.'],['Payments','Sandbox callback signature, idempotency, reversal, reconciliation and entitlement verification.'],['Operations','Alert ownership, backup restore, DR exercise, connector rotation, rollback rehearsal and runbook sign-off.']]
    t=make_table(checklist,[2.0*inch,4.45*inch]); story.append(t)
    doc=SpecDoc(OUT); doc.title='MylesNet Multi Tenant ISP and RADIUS SaaS Technical Specification v3'; doc.author='Jonathan Myles'; doc.subject='Internal Confidential technical specification'; doc.build(story)
    shutil.copy2(OUT, os.path.join(VAULT, os.path.basename(OUT)))
    print(OUT)
if __name__ == '__main__': main()
