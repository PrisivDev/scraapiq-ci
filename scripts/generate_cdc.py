#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ScrapIQ CI — Cahier des Charges Fonctionnel et Technique
Générateur de document PDF (300+ pages) avec ReportLab.

Plateforme : ScrapIQ CI — SaaS Web Scraping Intelligent pour le marché ivoirien
Sortie     : /home/z/my-project/download/cahier_des_charges_scraapiq_ci.pdf
"""

import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, NextPageTemplate,
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, Preformatted, HRFlowable,
)
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# ============================================================================
# PALETTE DE COULEURS
# ============================================================================
EMERALD       = HexColor("#059669")
EMERALD_DARK  = HexColor("#047857")
EMERALD_DEEP  = HexColor("#065f46")
EMERALD_LIGHT = HexColor("#d1fae5")
EMERALD_BG    = HexColor("#ecfdf5")
ORANGE        = HexColor("#F97316")
ORANGE_DARK   = HexColor("#c2410c")
ORANGE_LIGHT  = HexColor("#fed7aa")
ORANGE_BG     = HexColor("#fff7ed")
DARK          = HexColor("#1e293b")
DARK_SOFT     = HexColor("#334155")
GRAY          = HexColor("#64748b")
GRAY_LIGHT    = HexColor("#f1f5f9")
GRAY_BG       = HexColor("#f8fafc")
GRAY_BORDER   = HexColor("#e2e8f0")
SLATE_50      = HexColor("#f8fafc")
WHITE         = white
CODE_BG       = HexColor("#0f172a")
CODE_FG       = HexColor("#e2e8f0")

# ============================================================================
# DIMENSIONS
# ============================================================================
PAGE_W, PAGE_H = A4
MARGIN = 2 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

OUTPUT_DIR = "/home/z/my-project/download"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "cahier_des_charges_scraapiq_ci.pdf")

DOC_TITLE = "Cahier des Charges — ScrapIQ CI"
DOC_SUBTITLE = "SaaS Web Scraping Intelligent pour le marché ivoirien"
DOC_VERSION = "Version 1.0"
DOC_DATE = datetime.now().strftime("%d %B %Y")

# ============================================================================
# STYLES
# ============================================================================
def build_styles():
    ss = getSampleStyleSheet()
    base = ss["Normal"]
    styles = {}

    styles["body"] = ParagraphStyle(
        "body", parent=base, fontName="Helvetica", fontSize=10, leading=15,
        textColor=DARK, alignment=TA_JUSTIFY, spaceAfter=7,
    )
    styles["body_left"] = ParagraphStyle(
        "body_left", parent=styles["body"], alignment=TA_LEFT,
    )
    styles["intro"] = ParagraphStyle(
        "intro", parent=styles["body"], fontSize=10.5, leading=16,
        textColor=DARK_SOFT, spaceAfter=9, leftIndent=0,
    )
    styles["h1"] = ParagraphStyle(
        "h1", parent=base, fontName="Helvetica-Bold", fontSize=22, leading=27,
        textColor=EMERALD_DARK, spaceBefore=2, spaceAfter=6, alignment=TA_LEFT,
    )
    styles["h1num"] = ParagraphStyle(
        "h1num", parent=base, fontName="Helvetica-Bold", fontSize=13, leading=16,
        textColor=ORANGE, spaceBefore=0, spaceAfter=2, alignment=TA_LEFT,
    )
    styles["h2"] = ParagraphStyle(
        "h2", parent=base, fontName="Helvetica-Bold", fontSize=14, leading=19,
        textColor=EMERALD_DEEP, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT,
    )
    styles["h3"] = ParagraphStyle(
        "h3", parent=base, fontName="Helvetica-Bold", fontSize=11.5, leading=15,
        textColor=DARK, spaceBefore=10, spaceAfter=4, alignment=TA_LEFT,
    )
    styles["h4"] = ParagraphStyle(
        "h4", parent=base, fontName="Helvetica-BoldOblique", fontSize=10.5, leading=14,
        textColor=DARK_SOFT, spaceBefore=7, spaceAfter=3, alignment=TA_LEFT,
    )
    styles["bullet"] = ParagraphStyle(
        "bullet", parent=styles["body"], leftIndent=16, bulletIndent=4,
        spaceAfter=3, alignment=TA_LEFT,
    )
    styles["subbullet"] = ParagraphStyle(
        "subbullet", parent=styles["body"], leftIndent=32, bulletIndent=20,
        spaceAfter=2, alignment=TA_LEFT, fontSize=9.5,
    )
    styles["table_cell"] = ParagraphStyle(
        "table_cell", parent=base, fontName="Helvetica", fontSize=8.5, leading=11,
        textColor=DARK, alignment=TA_LEFT,
    )
    styles["table_cell_center"] = ParagraphStyle(
        "table_cell_center", parent=styles["table_cell"], alignment=TA_CENTER,
    )
    styles["table_head"] = ParagraphStyle(
        "table_head", parent=base, fontName="Helvetica-Bold", fontSize=8.8, leading=11,
        textColor=WHITE, alignment=TA_LEFT,
    )
    styles["table_head_center"] = ParagraphStyle(
        "table_head_center", parent=styles["table_head"], alignment=TA_CENTER,
    )
    styles["code"] = ParagraphStyle(
        "code", parent=base, fontName="Courier", fontSize=8, leading=10.5,
        textColor=CODE_FG, alignment=TA_LEFT, leftIndent=0, rightIndent=0,
        spaceBefore=0, spaceAfter=0,
    )
    styles["caption"] = ParagraphStyle(
        "caption", parent=base, fontName="Helvetica-Oblique", fontSize=8.5, leading=11,
        textColor=GRAY, alignment=TA_CENTER, spaceBefore=3, spaceAfter=10,
    )
    styles["note"] = ParagraphStyle(
        "note", parent=base, fontName="Helvetica", fontSize=9, leading=13,
        textColor=DARK_SOFT, alignment=TA_LEFT, leftIndent=10, rightIndent=10,
        spaceBefore=4, spaceAfter=8,
    )
    styles["cover_title"] = ParagraphStyle(
        "cover_title", parent=base, fontName="Helvetica-Bold", fontSize=40, leading=46,
        textColor=WHITE, alignment=TA_CENTER, spaceAfter=10,
    )
    styles["cover_sub"] = ParagraphStyle(
        "cover_sub", parent=base, fontName="Helvetica", fontSize=16, leading=22,
        textColor=EMERALD_LIGHT, alignment=TA_CENTER, spaceAfter=6,
    )
    styles["cover_meta"] = ParagraphStyle(
        "cover_meta", parent=base, fontName="Helvetica", fontSize=12, leading=18,
        textColor=WHITE, alignment=TA_CENTER,
    )
    styles["toc1"] = ParagraphStyle(
        "toc1", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=18,
        textColor=EMERALD_DARK, spaceAfter=2,
    )
    styles["toc2"] = ParagraphStyle(
        "toc2", parent=base, fontName="Helvetica", fontSize=9.5, leading=14,
        textColor=DARK_SOFT, leftIndent=18, spaceAfter=1,
    )
    styles["toc3"] = ParagraphStyle(
        "toc3", parent=base, fontName="Helvetica", fontSize=9, leading=13,
        textColor=GRAY, leftIndent=36, spaceAfter=1,
    )
    styles["chap_intro"] = ParagraphStyle(
        "chap_intro", parent=styles["body"], fontSize=10.5, leading=16,
        textColor=DARK_SOFT, leftIndent=0, spaceAfter=10, backColor=EMERALD_BG,
        borderPadding=8, borderColor=EMERALD, borderWidth=0,
    )
    return styles

STYLES = build_styles()

# ============================================================================
# COMPTEURS DE SECTION
# ============================================================================
class SectionCounter:
    def __init__(self):
        self.chapter = 0
        self.s2 = 0
        self.s3 = 0
    def reset_chapter(self, n):
        self.chapter = n
        self.s2 = 0
        self.s3 = 0
    def level2(self):
        self.s2 += 1
        self.s3 = 0
        return f"{self.chapter}.{self.s2}"
    def level3(self):
        self.s3 += 1
        return f"{self.chapter}.{self.s2}.{self.s3}"

SC = SectionCounter()

# ============================================================================
# FLOWABLES STORY
# ============================================================================
story = []

def P(text, style="body"):
    story.append(Paragraph(text, STYLES[style]))

def SP(h=6):
    story.append(Spacer(1, h))

def PB():
    story.append(PageBreak())

def hr(color=GRAY_BORDER, w=0.7, space_before=2, space_after=8):
    story.append(Spacer(1, space_before))
    story.append(HRFlowable(width="100%", thickness=w, color=color,
                            spaceBefore=0, spaceAfter=0))
    story.append(Spacer(1, space_after))

def chapter_title(num, title):
    """Titre de chapitre avec page break et bandeau."""
    PB()
    SC.reset_chapter(num)
    # Bandeau de chapitre
    banner = Table(
        [[Paragraph(f"CHAPITRE {num}", STYLES["h1num"]),
          Paragraph(title, STYLES["h1"])]],
        colWidths=[3.2 * cm, CONTENT_W - 3.2 * cm],
    )
    banner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, 0), EMERALD),
        ("TEXTCOLOR", (0, 0), (0, 0), WHITE),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("TOPPADDING", (0, 0), (0, 0), 12),
        ("BOTTOMPADDING", (0, 0), (0, 0), 12),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
        ("RIGHTPADDING", (1, 0), (1, 0), 6),
        ("TOPPADDING", (1, 0), (1, 0), 12),
        ("BOTTOMPADDING", (1, 0), (1, 0), 12),
        ("BACKGROUND", (1, 0), (1, 0), GRAY_BG),
    ]))
    # Remplacer le texte du numéro
    banner = Table(
        [[Paragraph(f'<font color="white"><b>CHAPITRE {num}</b></font>',
                    ParagraphStyle("cn", parent=STYLES["body"],
                                   fontName="Helvetica-Bold", fontSize=13,
                                   textColor=WHITE, alignment=TA_CENTER, leading=16)),
          Paragraph(title, STYLES["h1"])]],
        colWidths=[3.4 * cm, CONTENT_W - 3.4 * cm],
    )
    banner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, 0), EMERALD),
        ("LEFTPADDING", (0, 0), (0, 0), 8),
        ("RIGHTPADDING", (0, 0), (0, 0), 8),
        ("TOPPADDING", (0, 0), (0, -1), 14),
        ("BOTTOMPADDING", (0, 0), (0, -1), 14),
        ("LEFTPADDING", (1, 0), (1, 0), 14),
        ("RIGHTPADDING", (1, 0), (1, 0), 8),
        ("BACKGROUND", (1, 0), (1, 0), GRAY_BG),
        ("LINEBELOW", (0, 0), (-1, -1), 2, EMERALD_DARK),
    ]))
    story.append(banner)
    SP(10)

def h2(title):
    n = SC.level2()
    story.append(Paragraph(f'{n}. {title}', STYLES["h2"]))
    hr(EMERALD, 1.2, 0, 6)

def h3(title):
    n = SC.level3()
    story.append(Paragraph(f'{n} {title}', STYLES["h3"]))

def h4(title):
    story.append(Paragraph(title, STYLES["h4"]))

def intro(text):
    story.append(Paragraph(text, STYLES["chap_intro"]))

def bullets(items, sub=False):
    style = STYLES["subbullet"] if sub else STYLES["bullet"]
    lst = []
    for it in items:
        if isinstance(it, tuple):
            txt, subs = it
            lst.append(ListItem(Paragraph(txt, style), leftIndent=16 if sub else 16,
                                value="•" if not sub else "–"))
            if subs:
                lst.append(bullets(subs, sub=True))
        else:
            lst.append(ListItem(Paragraph(it, style), leftIndent=16,
                                value="•" if not sub else "–"))
    lf = ListFlowable(lst, bulletType="bullet", start="•",
                      leftIndent=16 if not sub else 32,
                      bulletFontName="Helvetica", bulletFontSize=8,
                      bulletColor=ORANGE if not sub else GRAY)
    if sub:
        return lf
    story.append(lf)
    SP(5)

def make_table(header, rows, col_widths=None, header_bg=EMERALD, zebra=True,
               font_size=8.5, align_center_cols=None):
    """Crée un tableau stylé."""
    if col_widths is None:
        n = len(header)
        col_widths = [CONTENT_W / n] * n
    align_center_cols = align_center_cols or []
    # En-tête
    head_row = []
    for i, h in enumerate(header):
        st = STYLES["table_head_center"] if i in align_center_cols else STYLES["table_head"]
        head_row.append(Paragraph(str(h), st))
    data = [head_row]
    for r in rows:
        row = []
        for i, c in enumerate(r):
            st = STYLES["table_cell_center"] if i in align_center_cols else STYLES["table_cell"]
            row.append(Paragraph(str(c), st))
        data.append(row)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, 0), 1, EMERALD_DARK),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY_BORDER),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                ts.append(("BACKGROUND", (0, i), (-1, i), GRAY_LIGHT))
    t.setStyle(TableStyle(ts))
    return t

def table(header, rows, col_widths=None, **kw):
    story.append(make_table(header, rows, col_widths, **kw))
    SP(7)

def caption(text):
    story.append(Paragraph(text, STYLES["caption"]))

def code_block(code, caption_text=None):
    """Bloc de code avec fond sombre."""
    # Préserver les espaces : utiliser Preformatted dans une cellule
    pre = Preformatted(code, STYLES["code"])
    t = Table([[pre]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, EMERALD_DARK),
    ]))
    story.append(t)
    if caption_text:
        story.append(Paragraph(caption_text, STYLES["caption"]))
    else:
        SP(8)

def info_box(title, text, color=EMERALD):
    """Encadré d'information."""
    bg = EMERALD_BG if color == EMERALD else (ORANGE_BG if color == ORANGE else GRAY_LIGHT)
    inner = [
        [Paragraph(f'<font color="{color.hexval()}"><b>{title}</b></font>',
                   ParagraphStyle("ib_t", parent=STYLES["body"],
                                  fontName="Helvetica-Bold", fontSize=9.5,
                                  textColor=color, spaceAfter=3))],
        [Paragraph(text, ParagraphStyle("ib_b", parent=STYLES["body"],
                                        fontSize=9, leading=12.5, spaceAfter=0,
                                        alignment=TA_LEFT))],
    ]
    t = Table(inner, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (0, 0), 7),
        ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("TOPPADDING", (0, 1), (0, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ("LINEBEFORE", (0, 0), (0, -1), 3, color),
    ]))
    story.append(t)
    SP(8)

def two_col(key, value):
    """Ligne clé-valeur stylée."""
    t = Table([[Paragraph(f"<b>{key}</b>", STYLES["table_cell"]),
                Paragraph(value, STYLES["table_cell"])]],
              colWidths=[4.5 * cm, CONTENT_W - 4.5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), EMERALD_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.4, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, GRAY_BORDER),
    ]))
    story.append(t)

def kv_block(pairs):
    """Bloc de plusieurs lignes clé-valeur jointes."""
    data = []
    for k, v in pairs:
        data.append([Paragraph(f"<b>{k}</b>", STYLES["table_cell"]),
                     Paragraph(v, STYLES["table_cell"])])
    t = Table(data, colWidths=[4.8 * cm, CONTENT_W - 4.8 * cm])
    ts = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY_BORDER),
    ]
    for i in range(len(data)):
        ts.append(("BACKGROUND", (0, i), (0, i), EMERALD_LIGHT))
    t.setStyle(TableStyle(ts))
    story.append(t)
    SP(7)

def ascii_diagram(lines, caption_text=None):
    """Diagramme ASCII art en bloc monospace clair."""
    code = "\n".join(lines)
    pre = Preformatted(code, ParagraphStyle("ascii", parent=STYLES["code"],
                                            fontSize=7, leading=9,
                                            textColor=DARK))
    t = Table([[pre]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
    ]))
    story.append(t)
    if caption_text:
        story.append(Paragraph(caption_text, STYLES["caption"]))
    else:
        SP(8)

# ============================================================================
# PAGE TEMPLATES (header / footer / cover)
# ============================================================================
DOC_STATE = {"page": 0}

def draw_cover(canv, doc):
    """Page de couverture : fond dégradé émeraude, titre centré."""
    canv.saveState()
    # Fond principal émeraude foncé
    canv.setFillColor(EMERALD_DEEP)
    canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Bande supérieure plus foncée
    canv.setFillColor(EMERALD_DARK)
    canv.rect(0, PAGE_H - 6 * cm, PAGE_W, 6 * cm, fill=1, stroke=0)
    # Bande inférieure orange
    canv.setFillColor(ORANGE)
    canv.rect(0, 0, PAGE_W, 0.6 * cm, fill=1, stroke=0)
    # Bande émeraude vive au-dessus de l'orange
    canv.setFillColor(EMERALD)
    canv.rect(0, 0.6 * cm, PAGE_W, 0.2 * cm, fill=1, stroke=0)
    # Logo textuel
    canv.setFillColor(WHITE)
    canv.setFont("Helvetica-Bold", 28)
    canv.drawCentredString(PAGE_W / 2, PAGE_H - 2.5 * cm, "ScrapIQ CI")
    canv.setFont("Helvetica", 11)
    canv.setFillColor(EMERALD_LIGHT)
    canv.drawCentredString(PAGE_W / 2, PAGE_H - 3.3 * cm, "Intelligent Web Scraping SaaS")
    # Titre principal
    canv.setFillColor(WHITE)
    canv.setFont("Helvetica-Bold", 34)
    canv.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 2.2 * cm, "Cahier des Charges")
    canv.setFont("Helvetica-Bold", 20)
    canv.setFillColor(ORANGE_LIGHT)
    canv.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 1.0 * cm, "Fonctionnel & Technique")
    # Ligne décorative
    canv.setStrokeColor(ORANGE)
    canv.setLineWidth(2)
    canv.line(PAGE_W / 2 - 3 * cm, PAGE_H / 2 + 0.3 * cm, PAGE_W / 2 + 3 * cm, PAGE_H / 2 + 0.3 * cm)
    # Sous-titre
    canv.setFont("Helvetica", 13)
    canv.setFillColor(WHITE)
    canv.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 1.2 * cm, "SaaS Web Scraping Intelligent")
    canv.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 1.9 * cm, "pour le marché ivoirien")
    # Métadonnées en bas
    canv.setFont("Helvetica", 11)
    canv.setFillColor(EMERALD_LIGHT)
    canv.drawCentredString(PAGE_W / 2, 3.2 * cm, DOC_VERSION)
    canv.drawCentredString(PAGE_W / 2, 2.5 * cm, DOC_DATE)
    canv.setFont("Helvetica-Oblique", 9)
    canv.setFillColor(EMERALD_LIGHT)
    canv.drawCentredString(PAGE_W / 2, 1.5 * cm, "Document confidentiel — © ScrapIQ CI")
    canv.restoreState()

def draw_normal(canv, doc):
    """En-tête + pied de page sur toutes les pages sauf la couverture."""
    canv.saveState()
    # En-tête
    canv.setStrokeColor(EMERALD)
    canv.setLineWidth(1.2)
    canv.line(MARGIN, PAGE_H - 1.3 * cm, PAGE_W - MARGIN, PAGE_H - 1.3 * cm)
    canv.setFillColor(EMERALD_DARK)
    canv.setFont("Helvetica-Bold", 9)
    canv.drawString(MARGIN, PAGE_H - 1.05 * cm, "ScrapIQ CI")
    canv.setFillColor(GRAY)
    canv.setFont("Helvetica", 8)
    canv.drawRightString(PAGE_W - MARGIN, PAGE_H - 1.05 * cm,
                         "Cahier des Charges — Fonctionnel & Technique")
    # Pied de page
    canv.setStrokeColor(GRAY_BORDER)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, 1.4 * cm, PAGE_W - MARGIN, 1.4 * cm)
    canv.setFillColor(GRAY)
    canv.setFont("Helvetica", 8)
    canv.drawString(MARGIN, 0.95 * cm, DOC_VERSION + " · " + DOC_DATE)
    page_num = canv.getPageNumber()
    canv.setFillColor(EMERALD_DARK)
    canv.setFont("Helvetica-Bold", 9)
    canv.drawRightString(PAGE_W - MARGIN, 0.95 * cm, f"Page {page_num}")
    # Mention centrale
    canv.setFillColor(GRAY)
    canv.setFont("Helvetica-Oblique", 7.5)
    canv.drawCentredString(PAGE_W / 2, 0.95 * cm, "© ScrapIQ CI — Document confidentiel")
    canv.restoreState()

# ============================================================================
# CONSTRUCTION DU DOCUMENT
# ============================================================================
def build_document():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = BaseDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title="Cahier des Charges — ScrapIQ CI",
        author="ScrapIQ CI",
        subject="SaaS Web Scraping Intelligent pour le marché ivoirien",
    )
    frame_cover = Frame(0, 0, PAGE_W, PAGE_H, id="cover",
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    frame_normal = Frame(MARGIN, 1.6 * cm, CONTENT_W,
                         PAGE_H - 1.8 * cm - 1.6 * cm, id="normal",
                         leftPadding=0, rightPadding=0, topPadding=4, bottomPadding=4)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame_cover], onPage=draw_cover),
        PageTemplate(id="normal", frames=[frame_normal], onPage=draw_normal),
    ])
    # La couverture est dessinée par draw_cover ; on place juste un PageBreak
    return doc

# ============================================================================
# CONTENU DU DOCUMENT (défini plus bas dans ce même fichier)
# ============================================================================
# Les fonctions chapitre_*() sont définies après cette section et ajoutent
# directement des flowables à la liste `story` globale.

def write_toc():
    """Table des matières manuelle avec numéros de page approximés."""
    PB()
    story.append(Paragraph("Table des matières", STYLES["h1"]))
    hr(EMERALD, 1.5, 0, 12)
    toc_data = [
        ("Chapitre 1 — Contexte du projet", "15", "1"),
        ("1.1 Présentation du marché ivoirien", "15", "2"),
        ("1.2 Problématique identifiée", "16", "2"),
        ("1.3 Opportunité de marché", "17", "2"),
        ("1.4 Étude de marché approfondie", "18", "3"),
        ("1.5 Analyse concurrentielle", "20", "3"),
        ("1.6 Segmentation et ciblage", "22", "3"),
        ("Chapitre 2 — Objectifs du projet", "25", "1"),
        ("2.1 Objectifs fonctionnels", "25", "2"),
        ("2.2 Objectifs techniques", "26", "2"),
        ("2.3 Objectifs business", "27", "2"),
        ("2.4 Indicateurs de performance (KPIs)", "28", "3"),
        ("2.5 Critères de succès", "30", "3"),
        ("Chapitre 3 — Fonctionnalités détaillées", "35", "1"),
        ("3.1 Scraping multi-sources", "35", "2"),
        ("3.2 IA cleaner (nettoyage, dédoublonnage, enrichissement)", "38", "2"),
        ("3.3 Moteur de recherche Elasticsearch", "41", "2"),
        ("3.4 Cartographie OpenStreetMap", "43", "2"),
        ("3.5 Exports multi-formats", "45", "2"),
        ("3.6 Notifications multi-canal", "47", "2"),
        ("3.7 API REST publique", "49", "2"),
        ("3.8 Authentification et sécurité", "51", "2"),
        ("3.9 RBAC et gestion des rôles", "53", "2"),
        ("3.10 PWA et expérience mobile", "55", "2"),
        ("3.11 Business Intelligence (BI)", "57", "2"),
        ("3.12 Plateforme SaaS Enterprise", "59", "2"),
        ("3.13 Agents IA multi-agents", "62", "2"),
        ("3.14 Sécurité globale", "65", "2"),
        ("Chapitre 4 — Architecture technique", "70", "1"),
        ("4.1 Vue d'ensemble", "70", "2"),
        ("4.2 Architecture logique", "72", "2"),
        ("4.3 Architecture physique", "74", "2"),
        ("4.4 Microservices et distribution", "76", "2"),
        ("4.5 Flux de données", "78", "2"),
        ("4.6 Diagrammes d'architecture", "80", "3"),
        ("Chapitre 5 — Cas d'utilisation", "90", "1"),
        ("5.1 Acteurs du système", "90", "2"),
        ("5.2 Cas d'utilisation Owner", "92", "2"),
        ("5.3 Cas d'utilisation Admin", "94", "2"),
        ("5.4 Cas d'utilisation Manager", "96", "2"),
        ("5.5 Cas d'utilisation Agent", "98", "2"),
        ("5.6 Cas d'utilisation Viewer", "100", "2"),
        ("Chapitre 6 — Wireframes", "105", "1"),
        ("6.1 Tableau de bord", "105", "2"),
        ("6.2 Recherche", "107", "2"),
        ("6.3 Carte interactive", "109", "2"),
        ("6.4 Entreprises", "111", "2"),
        ("6.5 Jobs de scraping", "113", "2"),
        ("6.6 Scraper multi-sources", "115", "2"),
        ("6.7 Exports", "117", "2"),
        ("6.8 API REST Explorer", "119", "2"),
        ("6.9 Notifications", "121", "2"),
        ("6.10 Équipe et permissions", "123", "2"),
        ("6.11 Back office", "125", "2"),
        ("6.12 Sécurité", "127", "2"),
        ("6.13 PWA mobile", "129", "2"),
        ("6.14 Business Intelligence", "131", "2"),
        ("6.15 SaaS Enterprise", "133", "2"),
        ("6.16 Agents IA", "135", "2"),
        ("Chapitre 7 — Diagrammes UML", "140", "1"),
        ("7.1 Diagramme de cas d'utilisation", "140", "2"),
        ("7.2 Diagramme de classes", "143", "2"),
        ("7.3 Diagrammes de séquence", "146", "2"),
        ("7.4 Diagramme d'activité", "149", "2"),
        ("7.5 Diagramme d'état", "151", "2"),
        ("7.6 Diagramme de composants", "153", "2"),
        ("Chapitre 8 — Diagrammes Mermaid", "158", "1"),
        ("8.1 Flowcharts", "158", "2"),
        ("8.2 Diagrammes de séquence", "161", "2"),
        ("8.3 Diagramme entité-association", "164", "2"),
        ("8.4 Diagramme de Gantt", "166", "2"),
        ("Chapitre 9 — API REST", "170", "1"),
        ("9.1 Conventions et versioning", "170", "2"),
        ("9.2 Authentification", "172", "2"),
        ("9.3 Endpoints Entreprises", "173", "2"),
        ("9.4 Endpoints Scraping", "176", "2"),
        ("9.5 Endpoints Exports", "178", "2"),
        ("9.6 Endpoints Agents IA", "180", "2"),
        ("9.7 Endpoints Notifications", "182", "2"),
        ("9.8 Endpoints SaaS & facturation", "184", "2"),
        ("9.9 Endpoints Sécurité", "186", "2"),
        ("9.10 Webhooks & Swagger", "188", "2"),
        ("Chapitre 10 — Base de données", "192", "1"),
        ("10.1 Vue d'ensemble du schéma", "192", "2"),
        ("10.2 Modèles multi-tenant", "194", "2"),
        ("10.3 Modèles métier (entreprises)", "197", "2"),
        ("10.4 Modèles scraping et jobs", "200", "2"),
        ("10.5 Index et optimisations", "203", "2"),
        ("10.6 Partitionnement et archivage", "205", "2"),
        ("Chapitre 11 — Sécurité", "210", "1"),
        ("11.1 Authentification JWT & OAuth", "210", "2"),
        ("11.2 Double authentification (2FA)", "212", "2"),
        ("11.3 Contrôle d'accès RBAC", "214", "2"),
        ("11.4 WAF et protection DDoS", "216", "2"),
        ("11.5 Chiffrement des données", "218", "2"),
        ("11.6 Conformité RGPD / APIPD", "220", "2"),
        ("11.7 Audit et traçabilité", "222", "2"),
        ("11.8 Rate limiting et anti-abus", "224", "2"),
        ("Chapitre 12 — Déploiement", "229", "1"),
        ("12.1 Conteneurisation Docker", "229", "2"),
        ("12.2 Orchestration Kubernetes", "231", "2"),
        ("12.3 Pipeline CI/CD", "233", "2"),
        ("12.4 Infrastructure cloud", "235", "2"),
        ("12.5 Monitoring et observabilité", "237", "2"),
        ("12.6 Stratégie de scalabilité", "239", "2"),
        ("Chapitre 13 — Tests", "244", "1"),
        ("13.1 Tests unitaires", "244", "2"),
        ("13.2 Tests d'intégration", "246", "2"),
        ("13.3 Tests end-to-end", "248", "2"),
        ("13.4 Tests de performance", "250", "2"),
        ("13.5 Tests de sécurité", "252", "2"),
        ("13.6 Tests de charge", "254", "2"),
        ("Chapitre 14 — Planning", "259", "1"),
        ("14.1 Phases du projet", "259", "2"),
        ("14.2 Diagramme de Gantt", "261", "2"),
        ("14.3 Jalons et livrables", "263", "2"),
        ("Chapitre 15 — Budget", "268", "1"),
        ("15.1 Coûts de développement", "268", "2"),
        ("15.2 Coûts d'infrastructure", "270", "2"),
        ("15.3 Licences et services tiers", "272", "2"),
        ("15.4 Maintenance et exploitation", "274", "2"),
        ("15.5 Retour sur investissement (ROI)", "276", "2"),
        ("Chapitre 16 — Roadmap", "281", "1"),
        ("16.1 MVP", "281", "2"),
        ("16.2 Version 1 (V1)", "283", "2"),
        ("16.3 Version 2 (V2)", "285", "2"),
        ("16.4 Version 3 (V3)", "287", "2"),
        ("Chapitre 17 — Maintenance", "291", "1"),
        ("17.1 Maintenance corrective", "291", "2"),
        ("17.2 Maintenance évolutive", "293", "2"),
        ("17.3 Maintenance préventive", "295", "2"),
        ("17.4 SLA et support", "297", "2"),
        ("Chapitre 18 — Évolutions", "301", "1"),
        ("18.1 Évolutions envisagées", "301", "2"),
        ("18.2 Recherche et développement", "303", "2"),
        ("18.3 Innovations futures", "305", "2"),
        ("Chapitre 19 — Annexes", "309", "1"),
        ("19.1 Glossaire", "309", "2"),
        ("19.2 Références et normes", "311", "2"),
        ("19.3 Contacts", "313", "2"),
    ]
    rows = []
    for label, page, lvl in toc_data:
        if lvl == "1":
            rows.append([Paragraph(label, STYLES["toc1"]),
                         Paragraph(f'<font color="#059669"><b>{page}</b></font>',
                                   ParagraphStyle("pn", parent=STYLES["toc1"],
                                                  alignment=TA_RIGHT))])
        elif lvl == "2":
            rows.append([Paragraph(label, STYLES["toc2"]),
                         Paragraph(f'<font color="#64748b">{page}</font>',
                                   ParagraphStyle("pn2", parent=STYLES["toc2"],
                                                  alignment=TA_RIGHT))])
        else:
            rows.append([Paragraph(label, STYLES["toc3"]),
                         Paragraph(f'<font color="#94a3b8">{page}</font>',
                                   ParagraphStyle("pn3", parent=STYLES["toc3"],
                                                  alignment=TA_RIGHT))])
    t = Table(rows, colWidths=[CONTENT_W - 1.6 * cm, 1.6 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, GRAY_BORDER),
    ]))
    story.append(t)


def main():
    """Point d'entrée principal : assemble et génère le PDF."""
    from cdc_chapters import build_story
    doc = build_document()
    build_story()  # ajoute TOC + chapitres à la liste `story` globale
    # Page de couverture en première position
    story.insert(0, NextPageTemplate("cover"))
    story.insert(1, Spacer(1, 1))
    story.insert(2, NextPageTemplate("normal"))
    story.insert(3, PageBreak())
    doc.build(story)
    print(f"PDF généré : {OUTPUT_PATH}")


# On s'importe soi-même en tant que module pour éviter la double identité
# __main__ / generate_cdc (les chapitres importent `generate_cdc`).
if __name__ == "__main__":
    import generate_cdc as _g
    _g.main()
