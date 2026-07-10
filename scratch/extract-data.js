const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\andre\\.gemini\\antigravity\\brain\\849a56ff-d789-4d2e-b067-9f13768346dc\\.system_generated\\logs\\transcript_full.jsonl';

function run() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found:', logPath);
    return;
  }

  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  let lastUserInput = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT') {
        lastUserInput = obj.content;
        break;
      }
    } catch (e) {
      // ignore parse errors for incomplete lines
    }
  }

  if (!lastUserInput) {
    console.error('Last user input not found in logs.');
    return;
  }

  // Find the start of the table
  const linesOfInput = lastUserInput.split('\n');
  const tableLines = [];
  let foundHeader = false;

  for (const line of linesOfInput) {
    const trimmed = line.trim();
    if (trimmed.startsWith('PERÍODO') && trimmed.includes('SETOR') && trimmed.includes('Mês-Ano')) {
      foundHeader = true;
      continue;
    }
    if (foundHeader) {
      if (trimmed === '' || trimmed.startsWith('<truncated') || trimmed.startsWith('NOTE:')) {
        continue;
      }
      tableLines.push(trimmed);
    }
  }

  console.log(`Found ${tableLines.length} data rows to parse.`);

  const parsedData = [];
  for (const line of tableLines) {
    const parts = line.split('\t');
    if (parts.length < 6) continue;
    
    const periodo = parts[0].trim();
    const setor = parts[1].trim();
    const item = parts[2].trim();
    const novos = parseInt(parts[3].trim(), 10) || 0;
    const seminovos = parseInt(parts[4].trim(), 10) || 0;
    
    // Parse Mes-Ano date: "01/01/2024" -> "2024-01-01"
    const mesAnoRaw = parts[5].trim();
    let competencia = '2024-01-01';
    const matchDmy = mesAnoRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (matchDmy) {
      competencia = `${matchDmy[3]}-${matchDmy[2]}-01`; // always first day of month
    } else {
      const matchYmd = mesAnoRaw.match(/^(\d{4})-(\d{2})/);
      if (matchYmd) {
        competencia = `${matchYmd[1]}-${matchYmd[2]}-01`;
      }
    }

    parsedData.push({
      periodo,
      setor,
      item,
      novos,
      seminovos,
      competencia
    });
  }

  const outputPath = path.join(__dirname, '..', 'src', 'services', 'seed-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(parsedData, null, 2), 'utf8');
  console.log('Saved seed data to:', outputPath);
}

run();
