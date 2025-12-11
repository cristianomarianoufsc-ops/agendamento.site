import express from "express";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

// Função auxiliar para adicionar texto formatado ao PDF
function addFormattedText(doc, text, style = {}) {
    const { size = 10, bold = false, underline = false, color = 'black', align = 'left', margin = [0, 0, 0, 0] } = style;
    
    doc.fontSize(size)
       .fillColor(color)
       .font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(text, {
           align: align,
           underline: underline,
           paragraphGap: 5,
           lineGap: 2,
           // margin: [top, right, bottom, left]
           // Não é possível definir margens por texto, mas podemos usar moveDown
       });
}

// Função para renderizar um bloco de texto (lista de inscrições) em uma posição específica
function renderInscricoesBlock(doc, title, contentLines, x, y, width) {
    doc.y = y;
    doc.x = x;

    // Título da Seção
    doc.fillColor('#004AAD')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text(title, x, doc.y, { width: width });
    doc.moveDown(0.5);

    doc.fillColor('black')
       .fontSize(10)
       .font('Helvetica');

    contentLines.forEach(line => {
        line = line.trim();
        if (line.length === 0) return;

        // Item principal da lista
        if (line.match(/^\d+\.\s*\*\*(.*?)\*\*/)) {
            const match = line.match(/^\d+\.\s*\*\*(.*?)\*\* \((.*?)\) - Nota: (.*)$/);
            if (match) {
                const [, eventoNome, local, nota] = match;
                doc.font('Helvetica-Bold').text(`\u2022 ${eventoNome} (${local}) - Nota: ${nota}`, { continued: false, width: width });
                doc.font('Helvetica'); // Volta ao normal
            }
            return;
        }
        
        // Sub-item da lista (Proponente)
        if (line.startsWith('*Proponente:')) {
            const text = line.replace(/\*/g, '').trim();
            doc.fillColor('gray').fontSize(9).text(`  ${text}`, { width: width });
            doc.fillColor('black').fontSize(10); // Volta ao normal
            doc.moveDown(0.2);
            return;
        }

        // Parágrafos simples (ex: "Nenhuma inscrição aprovada...")
        doc.text(line, { width: width });
        doc.moveDown(0.5);
    });
}

// Função principal de conversão de Markdown para PDF
function generatePdfFromMarkdown(markdownContent, res) {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
            Title: 'Agenda Final Consolidada',
            Author: 'Sistema de Agendamento UFSC',
        }
    });

    // Configurar o cabeçalho de resposta para PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Agenda_Final_Consolidada.pdf"');

    // Pipe o PDF para a resposta HTTP
    doc.pipe(res);

    // --- Lógica de Parsing de Markdown ---
    const lines = markdownContent.split('\n');
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    
    let mode = 'header'; // 'header', 'aprovadas', 'reprovadas', 'nao_avaliadas'
    let aprovadasLines = [];
    let reprovadasLines = [];
    let naoAvaliadasLines = [];

    // Título Principal
    addFormattedText(doc, 'Agenda Final Consolidada', { size: 18, bold: true, align: 'center' });
    doc.moveDown(0.5);

    lines.forEach(line => {
        line = line.trim();

        if (line.startsWith('# Simulação de Consolidação da Agenda Final')) {
            return;
        }

        if (line.startsWith('Gerado em:')) {
            addFormattedText(doc, line, { size: 8, color: 'gray' });
            doc.moveDown(1);
            return;
        }

        // Títulos de Seção (##)
        if (line.startsWith('##')) {
            if (inTable) {
                renderTable(doc, tableHeaders, tableRows);
                inTable = false;
                tableHeaders = [];
                tableRows = [];
            }
            
            const title = line.replace(/##\s*/, '').trim();
            
            if (title === 'Resumo da Classificação') {
                mode = 'header';
                doc.moveDown(0.5);
                addFormattedText(doc, title, { size: 14, bold: true, color: '#004AAD' });
                doc.moveDown(0.5);
            } else if (title === 'Inscrições Aprovadas') {
                mode = 'aprovadas';
            } else if (title === 'Inscrições Reprovadas') {
                mode = 'reprovadas';
            } else if (title === 'Inscrições Não Avaliadas') {
                mode = 'nao_avaliadas';
                
                // --- RENDERIZAÇÃO EM DUAS COLUNAS AQUI ---
                const margin = 50;
                const totalWidth = doc.page.width - 2 * margin;
                const columnWidth = (totalWidth / 2) - 10; // 10 é o espaço entre colunas
                const startX = margin;
                const startY = doc.y;
                
                // Coluna Esquerda: Aprovadas
                renderInscricoesBlock(doc, 'Inscrições Aprovadas', aprovadasLines, startX, startY, columnWidth);
                
                // Coluna Direita: Reprovadas
                const reprovadasX = startX + columnWidth + 20; // 10 de espaço + 10 de margem
                renderInscricoesBlock(doc, 'Inscrições Reprovadas', reprovadasLines, reprovadasX, startY, columnWidth);
                
                // Ajustar a posição Y para continuar após a coluna mais longa
                const finalY = Math.max(doc.y, doc.page.height - doc.page.margins.bottom);
                doc.y = finalY;
                doc.moveDown(1);

                // Renderiza o título "Inscrições Não Avaliadas"
                doc.moveDown(0.5);
                addFormattedText(doc, title, { size: 14, bold: true, color: '#004AAD' });
                doc.moveDown(0.5);
            }
            return;
        }

        // Coleta de Conteúdo
        if (mode === 'aprovadas') {
            aprovadasLines.push(line);
        } else if (mode === 'reprovadas') {
            reprovadasLines.push(line);
        } else if (mode === 'nao_avaliadas') {
            // A seção 'Não Avaliadas' é renderizada linha por linha, como antes
            // Listas (Não Avaliadas)
            if (line.match(/^\d+\.\s*\*\*(.*?)\*\*/)) {
                const match = line.match(/^\d+\.\s*\*\*(.*?)\*\* \((.*?)\) - Nota: (.*)$/);
                if (match) {
                    const [, eventoNome, local, nota] = match;
                    addFormattedText(doc, `\u2022 ${eventoNome} (${local}) - Nota: ${nota}`, { size: 10, bold: true });
                }
                return;
            }
            
            // Sub-item da lista
            if (line.startsWith('*Proponente:')) {
                const text = line.replace(/\*/g, '').trim();
                addFormattedText(doc, `  ${text}`, { size: 9, color: 'gray' });
                doc.moveDown(0.2);
                return;
            }

            // Parágrafos simples
            if (line.length > 0) {
                addFormattedText(doc, line, { size: 10 });
                doc.moveDown(0.5);
            }
        }

        // Tabela (apenas no modo 'header')
        if (mode === 'header' && line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
            
            if (!inTable) {
                tableHeaders = cells;
                inTable = true;
                return;
            } else if (cells.every(c => c.startsWith(':') || c.startsWith('-'))) {
                return;
            } else {
                tableRows.push(cells);
                return;
            }
        } else {
            if (inTable) {
                renderTable(doc, tableHeaders, tableRows);
                inTable = false;
                tableHeaders = [];
                tableRows = [];
            }
        }
    });

    // Finalizar o documento
    doc.end();
}
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
            Title: 'Agenda Final Consolidada',
            Author: 'Sistema de Agendamento UFSC',
        }
    });

    // Configurar o cabeçalho de resposta para PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Agenda_Final_Consolidada.pdf"');

    // Pipe o PDF para a resposta HTTP
    doc.pipe(res);

    // --- Lógica de Parsing de Markdown ---
    const lines = markdownContent.split('\n');
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    // Título Principal
    addFormattedText(doc, 'Agenda Final Consolidada', { size: 18, bold: true, align: 'center' });
    doc.moveDown(0.5);

    lines.forEach(line => {
        line = line.trim();

        if (line.startsWith('# Simulação de Consolidação da Agenda Final')) {
            // Ignorar o título gerado pelo frontend, pois já temos um
            return;
        }

        if (line.startsWith('Gerado em:')) {
            addFormattedText(doc, line, { size: 8, color: 'gray' });
            doc.moveDown(1);
            return;
        }

        // Títulos de Seção (##)
        if (line.startsWith('##')) {
            if (inTable) {
                // Renderizar tabela anterior se houver
                renderTable(doc, tableHeaders, tableRows);
                inTable = false;
                tableHeaders = [];
                tableRows = [];
            }
            const title = line.replace(/##\s*/, '').trim();
            doc.moveDown(0.5);
            addFormattedText(doc, title, { size: 14, bold: true, color: '#004AAD' }); // Cor azul UFSC
            doc.moveDown(0.5);
            return;
        }

        // Tabela
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
            
            if (!inTable) {
                // Primeira linha da tabela (Cabeçalho)
                tableHeaders = cells;
                inTable = true;
                return;
            } else if (cells.every(c => c.startsWith(':') || c.startsWith('-'))) {
                // Linha separadora (ignorar)
                return;
            } else {
                // Linha de dados
                tableRows.push(cells);
                return;
            }
        } else {
            if (inTable) {
                // Renderizar tabela anterior se a linha não for mais uma tabela
                renderTable(doc, tableHeaders, tableRows);
                inTable = false;
                tableHeaders = [];
                tableRows = [];
            }
        }

        // O código de renderização de listas e parágrafos foi movido para dentro da lógica de modo
// e para a nova função renderInscricoesBlock.
// A lógica original de parsing de Markdown será substituída pela nova lógica de coleta e renderização.
// Apenas a lógica de renderização da última tabela (se houver) é mantida.
    
    // Renderizar a última tabela se o arquivo terminar com uma
    if (inTable) {
        renderTable(doc, tableHeaders, tableRows);
    }

    // Finalizar o documento
    doc.end();
}

// Função para renderizar a tabela no PDF
function renderTable(doc, headers, rows) {
    if (rows.length === 0) return;

    const tableTop = doc.y;
    const itemHeight = 20;
    const headerHeight = 25;
    const tableWidth = 500;
    const startX = doc.x;
    const startY = doc.y;
    const columnCount = headers.length;
    const columnWidth = tableWidth / columnCount;

    // Verificar se precisa de nova página
    if (startY + headerHeight + (rows.length * itemHeight) > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }

    // Desenhar Cabeçalho
    doc.fillColor('#004AAD')
       .rect(startX, startY, tableWidth, headerHeight)
       .fill();
    
    doc.fillColor('white')
       .fontSize(10)
       .font('Helvetica-Bold');

    headers.forEach((header, i) => {
        doc.text(header, startX + (i * columnWidth), startY + 8, {
            width: columnWidth,
            align: 'center'
        });
    });

    // Desenhar Linhas
    doc.fillColor('black')
       .font('Helvetica')
       .fontSize(10);

    rows.forEach((row, rowIndex) => {
        const y = startY + headerHeight + (rowIndex * itemHeight);
        
        // Cor de fundo alternada
        if (rowIndex % 2 === 0) {
            doc.fillColor('#F0F0F0')
               .rect(startX, y, tableWidth, itemHeight)
               .fill();
        }
        
        doc.fillColor('black');
        
        row.forEach((cell, colIndex) => {
            doc.text(cell, startX + (colIndex * columnWidth), y + 6, {
                width: columnWidth,
                align: 'center'
            });
        });
        
        // Desenhar linha horizontal (separador de linha)
        doc.strokeColor('#CCCCCC')
           .lineWidth(0.5)
           .moveTo(startX, y + itemHeight)
           .lineTo(startX + tableWidth, y + itemHeight)
           .stroke();
    });

    // Mover o cursor para baixo da tabela
    doc.y = startY + headerHeight + (rows.length * itemHeight) + 10;
}

// Middleware para lidar com a requisição POST
const router = express.Router();

router.post('/generate-pdf', (req, res) => {
    const markdownContent = req.body.markdown;

    if (!markdownContent) {
        return res.status(400).send({ error: 'Conteúdo Markdown não fornecido.' });
    }

    try {
        generatePdfFromMarkdown(markdownContent, res);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).send({ error: 'Erro interno ao gerar o PDF.' });
    }
});

export default router;
