const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function run() {
  const filePath = 'C:\\Users\\andre\\Downloads\\Novos vs Seminovos.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['tblSeminovos'];
  if (!sheet) {
    console.error('Sheet tblSeminovos not found in the file.');
    return;
  }

  // Convert sheet to JSON array
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Total raw rows in tblSeminovos: ${rows.length}`);

  const parsedData = [];
  let lineCount = 0;

  for (const row of rows) {
    lineCount++;
    // Get fields
    const periodo = row['PERÍODO'] ? String(row['PERÍODO']).trim() : '';
    const setor = row['SETOR'] ? String(row['SETOR']).trim() : '';
    const item = row['ITEM'] ? String(row['ITEM']).trim() : '';
    
    // Parse quantity
    const novos = parseInt(row['NOVOS'] || row['NOVOS '], 10) || 0;
    const seminovos = parseInt(row['SEMINOVOS'] || row['SEMINOVOS '], 10) || 0;

    // Parse Mes-Ano. SheetJS can parse date type or string/number serial
    const mesAnoVal = row['Mês-Ano'] || row['Mes-Ano'];
    let competencia = '';

    if (mesAnoVal instanceof Date) {
      const y = mesAnoVal.getUTCFullYear();
      const m = String(mesAnoVal.getUTCMonth() + 1).padStart(2, '0');
      competencia = `${y}-${m}-01`;
    } else if (typeof mesAnoVal === 'number') {
      // Excel serial date number
      const date = new Date(Date.UTC(1899, 11, 30) + mesAnoVal * 86400000);
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      competencia = `${y}-${m}-01`;
    } else if (mesAnoVal) {
      const str = String(mesAnoVal).trim();
      const matchDmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (matchDmy) {
        competencia = `${matchDmy[3]}-${matchDmy[2]}-01`;
      } else {
        const matchYmd = str.match(/^(\d{4})-(\d{2})/);
        if (matchYmd) {
          competencia = `${matchYmd[1]}-${matchYmd[2]}-01`;
        }
      }
    }

    if (!competencia) {
      // fallback to default if not parseable
      competencia = '2024-01-01';
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
  console.log(`Successfully parsed and saved ${parsedData.length} records to ${outputPath}`);
}

run();
