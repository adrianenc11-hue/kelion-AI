// ═══ EXPORT DOCUMENT — PDF, DOCX, XLSX, PPTX, CSV ═══
// Generates downloadable documents server-side (zero external dependencies)

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    }

    try {
        const { format, content, title, data, columns } = JSON.parse(event.body || '{}');

        if (!format || !content) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'format and content required' }) };
        }

        const fmt = format.toLowerCase();
        let result;

        switch (fmt) {
            case 'pdf':
                result = generatePDF(content, title);
                break;
            case 'docx':
                result = generateDOCX(content, title);
                break;
            case 'xlsx':
            case 'xls':
                result = generateXLSX(content, title, data, columns);
                break;
            case 'csv':
                result = generateCSV(content, data, columns);
                break;
            case 'pptx':
            case 'ppt':
                result = generatePPTX(content, title);
                break;
            case 'txt':
                result = generateTXT(content, title);
                break;
            case 'html':
                result = generateHTML(content, title);
                break;
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unsupported format: ${fmt}. Supported: pdf, docx, xlsx, csv, pptx, txt, html` }) };
        }

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                filename: result.filename,
                mime_type: result.mimeType,
                data_url: result.dataUrl,
                size_bytes: result.sizeBytes,
                format: fmt
            })
        };

    } catch (err) {
        console.error('Export error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};

// ═══ PDF Generator (HTML → PDF-like with embedded viewer) ═══
function generatePDF(content, title = 'Document') {
    // Generate a PDF using minimal PDF spec (no dependencies)
    const textLines = content.split('\n');
    const safeTitle = escapeText(title);

    // PDF 1.4 manual construction
    let pdf = '%PDF-1.4\n';

    // Catalog
    pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    // Pages
    pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

    // Page
    pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n';

    // Build content stream
    let stream = 'BT\n';
    stream += '/F2 18 Tf\n';
    stream += `50 750 Td\n`;
    stream += `(${safeTitle}) Tj\n`;
    stream += '/F1 11 Tf\n';
    stream += '0 -30 Td\n';

    // Add text lines (max ~50 lines per page for simplicity)
    const maxLines = Math.min(textLines.length, 50);
    for (let i = 0; i < maxLines; i++) {
        const line = escapeText(textLines[i].substring(0, 90));
        stream += `(${line}) Tj\n`;
        stream += '0 -14 Td\n';
    }

    if (textLines.length > 50) {
        stream += `(... [${textLines.length - 50} linii suplimentare]) Tj\n`;
    }

    stream += 'ET\n';

    // Content stream
    pdf += `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`;

    // Fonts (Helvetica - built-in PDF font)
    pdf += '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
    pdf += '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';

    // Cross-reference table
    const xrefPos = pdf.length;
    pdf += 'xref\n0 7\n';
    pdf += '0000000000 65535 f \n';
    // Simplified xref (positions approximated, valid for most viewers)
    let pos = 9; // after %PDF-1.4\n
    for (let i = 1; i <= 6; i++) {
        pdf += `${String(pos).padStart(10, '0')} 00000 n \n`;
        pos = pdf.indexOf(`${i + 1} 0 obj`, pos) || pos + 50;
    }

    pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const base64 = Buffer.from(pdf).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}.pdf`,
        mimeType: 'application/pdf',
        dataUrl: `data:application/pdf;base64,${base64}`,
        sizeBytes: Buffer.byteLength(pdf)
    };
}

// ═══ DOCX Generator (OOXML) ═══
function generateDOCX(content, title = 'Document') {
    // Generate a minimal DOCX using OOXML XML (no JSZip needed — use base64 template)
    const paragraphs = content.split('\n').map(line => {
        const escaped = escapeXML(line);
        return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    }).join('\n');

    const titlePara = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeXML(title)}</w:t></w:r></w:p>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${titlePara}
${paragraphs}
</w:body>
</w:document>`;

    // For a proper DOCX we need a ZIP with specific structure
    // Since we can't use JSZip, we'll return the XML content as a downloadable file
    // The frontend can handle the conversion or we return as rich text
    const base64 = Buffer.from(documentXml).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}.docx.xml`,
        mimeType: 'application/xml',
        dataUrl: `data:application/xml;base64,${base64}`,
        sizeBytes: Buffer.byteLength(documentXml)
    };
}

// ═══ XLSX Generator (XML Spreadsheet) ═══  
function generateXLSX(content, title = 'Sheet', data, columns) {
    let rows = [];

    if (data && Array.isArray(data)) {
        // Structured data: [{label: "A", value: 100}, ...]
        if (columns && Array.isArray(columns)) {
            rows.push(columns);
        } else if (data.length > 0) {
            rows.push(Object.keys(data[0]));
        }
        data.forEach(row => {
            if (typeof row === 'object') {
                rows.push(Object.values(row));
            } else {
                rows.push([row]);
            }
        });
    } else {
        // Plain text: split by lines and tabs/commas
        content.split('\n').forEach(line => {
            const cells = line.includes('\t') ? line.split('\t') : line.split(',');
            rows.push(cells.map(c => c.trim()));
        });
    }

    // Generate XML Spreadsheet 2003 format (opens in Excel directly)
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${escapeXML(title)}">
<Table>`;

    rows.forEach((row, ri) => {
        xml += '<Row>';
        row.forEach(cell => {
            const val = String(cell);
            const isNum = !isNaN(val) && val.trim() !== '';
            if (isNum) {
                xml += `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
            } else {
                xml += `<Cell><Data ss:Type="String">${escapeXML(val)}</Data></Cell>`;
            }
        });
        xml += '</Row>\n';
    });

    xml += '</Table>\n</Worksheet>\n</Workbook>';

    const base64 = Buffer.from(xml).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}.xls`,
        mimeType: 'application/vnd.ms-excel',
        dataUrl: `data:application/vnd.ms-excel;base64,${base64}`,
        sizeBytes: Buffer.byteLength(xml)
    };
}

// ═══ CSV Generator ═══
function generateCSV(content, data, columns) {
    let csv = '';

    if (data && Array.isArray(data)) {
        if (columns) {
            csv += columns.join(',') + '\n';
        } else if (data.length > 0 && typeof data[0] === 'object') {
            csv += Object.keys(data[0]).join(',') + '\n';
        }
        data.forEach(row => {
            if (typeof row === 'object') {
                csv += Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
            } else {
                csv += `"${String(row).replace(/"/g, '""')}"\n`;
            }
        });
    } else {
        csv = content;
    }

    const base64 = Buffer.from(csv).toString('base64');
    return {
        filename: 'export.csv',
        mimeType: 'text/csv',
        dataUrl: `data:text/csv;base64,${base64}`,
        sizeBytes: Buffer.byteLength(csv)
    };
}

// ═══ PPTX Generator (simplified) ═══
function generatePPTX(content, title = 'Presentation') {
    const slides = content.split('\n\n').filter(s => s.trim());

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${escapeXML(title)}</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:0;background:#1a1a2e}
.slide{width:960px;height:540px;margin:20px auto;background:linear-gradient(135deg,#667eea,#764ba2);
color:white;padding:60px;box-sizing:border-box;border-radius:12px;page-break-after:always}
.slide h1{font-size:36px;margin-bottom:20px}
.slide p{font-size:20px;line-height:1.6}
.slide:first-child h1{font-size:48px;text-align:center;margin-top:150px}
</style></head><body>`;

    // Title slide
    html += `<div class="slide"><h1>${escapeXML(title)}</h1></div>`;

    // Content slides
    slides.forEach((slide, i) => {
        const lines = slide.split('\n');
        const heading = lines[0];
        const body = lines.slice(1).join('<br>');
        html += `<div class="slide"><h1>${escapeXML(heading)}</h1><p>${escapeXML(body)}</p></div>`;
    });

    html += '</body></html>';

    const base64 = Buffer.from(html).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}_presentation.html`,
        mimeType: 'text/html',
        dataUrl: `data:text/html;base64,${base64}`,
        sizeBytes: Buffer.byteLength(html)
    };
}

// ═══ TXT Generator ═══
function generateTXT(content, title = 'Document') {
    const txt = `${title}\n${'='.repeat(title.length)}\n\n${content}`;
    const base64 = Buffer.from(txt).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}.txt`,
        mimeType: 'text/plain',
        dataUrl: `data:text/plain;base64,${base64}`,
        sizeBytes: Buffer.byteLength(txt)
    };
}

// ═══ HTML Generator ═══
function generateHTML(content, title = 'Document') {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${escapeXML(title)}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#333}
h1{color:#2d3748;border-bottom:2px solid #667eea;padding-bottom:10px}
</style></head><body>
<h1>${escapeXML(title)}</h1>
${content.split('\n').map(l => `<p>${escapeXML(l)}</p>`).join('\n')}
</body></html>`;

    const base64 = Buffer.from(html).toString('base64');
    return {
        filename: `${sanitizeFilename(title)}.html`,
        mimeType: 'text/html',
        dataUrl: `data:text/html;base64,${base64}`,
        sizeBytes: Buffer.byteLength(html)
    };
}

// ═══ Utility functions ═══
function escapeXML(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitizeFilename(name) {
    return String(name || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}
