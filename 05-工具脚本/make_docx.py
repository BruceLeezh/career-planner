# -*- coding: utf-8 -*-
"""从作品说明 .md 生成格式化 .docx（黑体标题/宋体正文/1.5倍行距/首行缩进2字符），并重新打开验证。"""
import json
import re
import sys
import os
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(os.environ.get("USERPROFILE", os.path.expanduser("~"))) / "Desktop/职引/04-提交材料"
MD = BASE / "高级-职引-【队长姓名+学工号】.md"
OUT = BASE / "高级-职引-【队长姓名+学工号】.docx"

HEI, SONG = "SimHei", "SimSun"


def set_run_font(run, name, size_pt, bold=False):
    run.font.name = name
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), name)


def first_line_indent(p, chars=2, font_pt=12):
    ppr = p._p.get_or_add_pPr()
    ind = ppr.find(qn("w:ind"))
    if ind is None:
        ind = OxmlElement("w:ind")
        ppr.append(ind)
    ind.set(qn("w:firstLine"), str(int(font_pt * 20 * chars)))
    ind.set(qn("w:firstLineChars"), str(chars * 100))


def add_para(doc, segments, font=SONG, size=12, bold=False, align=None,
             indent=True, space_before=None, space_after=None):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing = 1.5
    if align is not None:
        p.alignment = align
    if indent:
        first_line_indent(p, font_pt=size)
    if space_before is not None:
        pf.space_before = Pt(space_before)
    if space_after is not None:
        pf.space_after = Pt(space_after)
    for text, seg_bold in segments:
        r = p.add_run(text)
        set_run_font(r, font, size, bold=bold or seg_bold)
    return p


def add_table(doc, rows):
    data = []
    for line in rows:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        data.append(cells)
    ncols = max(len(r) for r in data)
    table = doc.add_table(rows=len(data), cols=ncols)
    table.style = "Table Grid"
    for ri, row in enumerate(data):
        for ci in range(ncols):
            text = row[ci] if ci < len(row) else ""
            cell = table.cell(ri, ci)
            p = cell.paragraphs[0]
            p.paragraph_format.line_spacing = 1.5
            header = ri == 0
            r = p.add_run(text)
            set_run_font(r, HEI if header else SONG, 12, bold=header)
    return table


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)

    lines = MD.read_text(encoding="utf-8").splitlines()
    table_buf = []
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("|"):
            table_buf.append(line)
            continue
        if table_buf:
            add_table(doc, table_buf)
            table_buf = []
        if not line.strip():
            continue
        if line.startswith("# "):
            add_para(doc, [(line[2:], False)], font=HEI, size=18, bold=True,
                     align=WD_ALIGN_PARAGRAPH.CENTER, indent=False, space_after=12)
        elif line.startswith("## "):
            add_para(doc, [(line[3:], False)], font=HEI, size=16, bold=True,
                     indent=False, space_before=12, space_after=6)
        elif line.startswith("### "):
            add_para(doc, [(line[4:], False)], font=HEI, size=14, bold=True,
                     indent=False, space_before=6, space_after=3)
        else:
            m = re.match(r"^\*\*(.+?)\*\*：(.*)$", line)
            if m:  # 封面字段：居中，标签加粗
                add_para(doc, [(m.group(1) + "：", True), (m.group(2), False)],
                         align=WD_ALIGN_PARAGRAPH.CENTER, indent=False)
            else:
                add_para(doc, [(line, False)])
    if table_buf:
        add_table(doc, table_buf)
    doc.save(str(OUT))


def east_asia_of(run):
    rpr = run._element.rPr
    if rpr is None:
        return None
    rfonts = rpr.find(qn("w:rFonts"))
    return None if rfonts is None else rfonts.get(qn("w:eastAsia"))


def verify():
    d = Document(str(OUT))
    paras = list(d.paragraphs)
    texts = [p.text for p in paras]
    table_cells = []
    for t in d.tables:
        for row in t.rows:
            for cell in row.cells:
                table_cells.append(cell.text)
    all_text = "\n".join(texts + table_cells)

    required = [
        "作品名称：职引", "参赛赛道：高级", "作者：【团队全部成员姓名-待填】",
        "学院：【待填】", "指导老师：【如无可不填】",
        "一、背景分析", "1.1 应用场景", "1.2 需求价值", "1.3 受益对象与影响范围",
        "二、功能说明", "2.1 技术实现", "2.2 核心功能", "2.3 数据源与知识库",
        "三、创新点", "3.1 场景创新", "3.2 技术创新",
        "四、使用指南", "4.1 访问方式", "4.2 操作步骤", "4.3 注意事项与已知限制",
        "【技能广场访问链接-待填】",
    ]
    missing = [s for s in required if s not in all_text]

    heading_pat = re.compile(r"^(职引（Career Compass）作品说明|[一二三四]、|\d+\.\d+ )")
    font_issues, spacing_issues, indent_issues = [], [], []
    for p in paras:
        text = p.text.strip()
        if not text:
            continue
        is_heading = bool(heading_pat.match(text))
        want = HEI if is_heading else SONG
        for r in p.runs:
            if r.text.strip():
                ea = east_asia_of(r)
                if ea != want:
                    font_issues.append({"text": text[:20], "got": ea, "want": want})
                break
        if p.paragraph_format.line_spacing != 1.5:
            spacing_issues.append(text[:20])
        if not is_heading and p.alignment != WD_ALIGN_PARAGRAPH.CENTER:
            ind = p._p.find(qn("w:pPr") ) if False else None
            ppr = p._p.get_or_add_pPr()
            indel = ppr.find(qn("w:ind"))
            if indel is None or indel.get(qn("w:firstLineChars")) != "200":
                indent_issues.append(text[:20])

    for t in d.tables:
        for ri, row in enumerate(t.rows):
            for cell in row.cells:
                for r in cell.paragraphs[0].runs:
                    if r.text.strip():
                        want = HEI if ri == 0 else SONG
                        if east_asia_of(r) != want:
                            font_issues.append({"table_row": ri, "got": east_asia_of(r), "want": want})
                        break

    banned = ["52 题", "52 道", "智谱", "glm-4-flash"]
    found_banned = [b for b in banned if b in all_text]

    n_chars = len(all_text.replace("\n", "").replace(" ", ""))
    n_cn = sum(1 for ch in all_text if "\u4e00" <= ch <= "\u9fff")
    result = {
        "docx": str(OUT),
        "md": str(MD),
        "exists": OUT.exists(),
        "size_bytes": OUT.stat().st_size if OUT.exists() else 0,
        "paragraph_count": len(paras),
        "table_count": len(d.tables),
        "missing_sections_or_fields": missing,
        "font_issues": font_issues,
        "spacing_issues": spacing_issues,
        "indent_issues": indent_issues,
        "found_banned_terms": found_banned,
        "total_chars_no_space": n_chars,
        "chinese_chars": n_cn,
        "md_chars_no_space": len(MD.read_text(encoding="utf-8").replace("\n", "").replace(" ", "")),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    ok = (result["exists"] and len(paras) > 0 and not missing
          and not font_issues and not spacing_issues and not indent_issues
          and not found_banned)
    print("VERIFY:", "PASS" if ok else "FAIL")


if __name__ == "__main__":
    build()
    verify()
