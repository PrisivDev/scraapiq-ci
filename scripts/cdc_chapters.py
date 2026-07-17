# -*- coding: utf-8 -*-
"""
Contenu des 19 chapitres du cahier des charges ScrapIQ CI.
Les helpers (P, h2, table, code_block, ...) sont importés depuis generate_cdc
et écrivent dans la liste `story` globale de ce dernier module.
"""

from generate_cdc import (  # noqa: F401
    story, P, SP, PB, hr, chapter_title, h2, h3, h4, intro, bullets,
    table, make_table, caption, code_block, info_box, two_col, kv_block,
    ascii_diagram, write_toc, STYLES, CONTENT_W,
    EMERALD, EMERALD_DARK, EMERALD_DEEP, EMERALD_LIGHT, EMERALD_BG,
    ORANGE, ORANGE_DARK, ORANGE_LIGHT, ORANGE_BG,
    DARK, DARK_SOFT, GRAY, GRAY_LIGHT, GRAY_BG, GRAY_BORDER,
    WHITE, SC, Paragraph, ParagraphStyle, Table, TableStyle, Spacer,
    PageBreak, Preformatted, HRFlowable, cm, ListFlowable, ListItem,
    TA_CENTER, TA_LEFT, TA_JUSTIFY, HexColor,
)


def build_story():
    """Point d'entrée : construit TOC + les 19 chapitres dans `story`."""
    write_toc()
    chapter1()
    from cdc_extensions import extend_ch1; extend_ch1()
    chapter2()
    from cdc_extensions import extend_ch2; extend_ch2()
    chapter3()
    from cdc_extensions import extend_ch3; extend_ch3()
    chapter4()
    from cdc_extensions import extend_ch4; extend_ch4()
    chapter5()
    from cdc_extensions import extend_ch5; extend_ch5()
    chapter6()
    from cdc_extensions import extend_ch6; extend_ch6()
    chapter7()
    from cdc_extensions import extend_ch7; extend_ch7()
    chapter8()
    from cdc_extensions import extend_ch8; extend_ch8()
    chapter9()
    from cdc_extensions import extend_ch9; extend_ch9()
    chapter10()
    from cdc_extensions import extend_ch10; extend_ch10()
    chapter11()
    from cdc_extensions import extend_ch11; extend_ch11()
    chapter12()
    from cdc_extensions import extend_ch12; extend_ch12()
    chapter13()
    from cdc_extensions import extend_ch13; extend_ch13()
    chapter14()
    from cdc_extensions import extend_ch14; extend_ch14()
    chapter15()
    from cdc_extensions import extend_ch15; extend_ch15()
    chapter16()
    chapter17()
    chapter18()
    chapter19()
    from cdc_extensions2 import extend_more; extend_more()


# Les chapitres sont définis dans les fichiers cdc_chX.py importés ci-dessous.
from cdc_ch1 import chapter1   # noqa: E402,F401
from cdc_ch2 import chapter2   # noqa: E402,F401
from cdc_ch3 import chapter3   # noqa: E402,F401
from cdc_ch4 import chapter4   # noqa: E402,F401
from cdc_ch5 import chapter5   # noqa: E402,F401
from cdc_ch6 import chapter6   # noqa: E402,F401
from cdc_ch7 import chapter7   # noqa: E402,F401
from cdc_ch8 import chapter8   # noqa: E402,F401
from cdc_ch9 import chapter9   # noqa: E402,F401
from cdc_ch10 import chapter10  # noqa: E402,F401
from cdc_ch11 import chapter11  # noqa: E402,F401
from cdc_ch12 import chapter12  # noqa: E402,F401
from cdc_ch13 import chapter13  # noqa: E402,F401
from cdc_ch14 import chapter14  # noqa: E402,F401
from cdc_ch15 import chapter15  # noqa: E402,F401
from cdc_ch16_19_extended import chapter16, chapter17, chapter18, chapter19  # noqa: E402,F401
