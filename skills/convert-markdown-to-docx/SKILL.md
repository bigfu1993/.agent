---
name: convert-markdown-to-docx
description: Use when the user asks to convert a Markdown (.md) file into a Word document (.doc/.docx), or wants Markdown content delivered as a Word-compatible file for editing or sharing. Covers format disambiguation (doc vs docx), tool selection (pandoc primary, LibreOffice for legacy .doc), handling of headings/tables/code blocks/images/Mermaid diagrams/Chinese fonts, and post-conversion verification.
---

# Markdown 转 Word 文档

## 适用场景

用户要求把 `.md` 文件转成 Word 可编辑文档时使用。目标格式几乎总是 `.docx`(现代 Office Open XML);只有用户明确要求兼容旧版 Word(2007 之前)或旧系统只认 `.doc` 时,才走 `.doc` 分支。不要因为用户嘴上说"doc"就默认等于旧版二进制格式——先按下面的确认步骤澄清。

## 前置确认(不能跳过)

动手转换前,向用户确认:

1. **源文件**:具体路径,是单文件还是批量目录。
2. **目标格式**:`.docx`(默认推荐)还是必须 `.doc`。用户只说"doc"时,说明二者区别后请其确认,不要自行猜测。
3. **样式要求**:是否需要套用公司/项目模板(字体、标题样式、页眉页脚),还是用 pandoc 默认样式即可。
4. **特殊元素**:源 md 是否包含 Mermaid 图、代码块语法高亮、复杂表格(合并单元格)、脚注、目录(TOC)——这些在转换中处理方式不同,提前确认哪些必须保留。

用户已经明确给出以上信息时直接执行,不用逐条重新发问。

## 环境探测与工具选择

按优先级探测本机工具,不假设任何工具已安装:

```
which pandoc
which soffice || which libreoffice
```

- **`.docx` 目标,pandoc 可用**:首选路径,`pandoc input.md -o output.docx [--reference-doc=template.docx] [--toc]`。
- **`.doc` 目标**:pandoc 不直接输出旧版二进制 `.doc`,必须先转 `.docx`,再用 LibreOffice 二次转换:`soffice --headless --convert-to doc output.docx`。
- **pandoc/LibreOffice 都不可用**:不要静默改用简陋替代方案。说明当前环境缺少转换工具,列出安装方式(macOS:`brew install pandoc`;`.doc` 分支额外需要 `brew install --cask libreoffice`),经用户确认后再安装——安装软件是系统变更,按安全规则需要先确认。用户不同意安装时,退到 Python(`python-docx`)或 Node(`docx` 包)等等价方案编写转换脚本,同样需要确认对应运行时和依赖已就绪。

## 转换流程

1. 确认工具链后执行转换命令,先在临时/scratchpad 路径生成产物,确认无误后再落到用户指定位置。
2. 中文内容默认字体在无 `--reference-doc` 时可能不含中文字形导致显示异常;中文场景需要准备一个只含样式、无正文的 `.docx` 模板作为 `--reference-doc`,或转换后检查字体设置。
3. **Mermaid / 图表**:pandoc 不会渲染 Mermaid 代码块,需要先用 `mmdc`(mermaid-cli)或等价工具把图渲染成 PNG/SVG,替换 md 中的代码块为图片引用,再执行转换。
4. **代码块**:pandoc 默认只保留等宽字体,不带语法高亮色彩;需要高亮时使用 `--highlight-style` 参数,并确认目标 Word 版本能正常显示。
5. **表格**:pandoc 支持标准 Markdown 表格,但不支持单元格合并;源文档有合并单元格需求时,转换后需人工检查并调整,不能假设自动还原。
6. **图片路径**:确保 md 中的图片引用是可访问的本地路径,远程图片链接需要先下载到本地再转换。

## 验证(转换完不算完成)

- 重新打开产物,核对:标题层级是否与源文件对应、表格列数一致、图片数量匹配、代码块和 Mermaid 图是否都已正确呈现。
- 检查中文是否乱码或被替换为方框(字体缺失的典型症状)。
- 内容量大时不要只抽查开头,按章节抽样核对结尾和中间部分,防止转换过程中途截断。
- 检查产物文件大小是否合理,异常小可能意味着转换半途失败。

## 常见失败模式

| 失败模式 | 修正方式 |
| --- | --- |
| 把"doc"直接等同旧版二进制格式动手转 | 先确认 doc/docx,大多数场景用户实际要 docx |
| pandoc 缺失时静默降级成纯文本粘贴 | 明确说明工具缺失,列出安装方式,经确认后再装或换等价方案 |
| Mermaid/代码块直接丢给 pandoc | 图表先渲染成图片,代码块确认高亮需求 |
| 转换完不打开产物检查直接交付 | 逐项核对标题层级、表格、图片数量、中文字体 |
| 中文正文用默认模板转换 | 检查字体是否含中文字形,必要时用 reference-doc 指定字体 |
| 合并单元格表格转换后不检查 | 明确告知 pandoc 不支持单元格合并,转换后人工核对 |

## 交付说明

最终回复说明:实际使用的转换路径(pandoc/LibreOffice 或替代方案)、产物路径、是否套用了模板、已验证的项目(标题层级/表格/图片/中文字体)、未验证或已知有损的部分(如合并单元格、Mermaid 渲染效果),不用"已转换完成"代替具体核对结果。
