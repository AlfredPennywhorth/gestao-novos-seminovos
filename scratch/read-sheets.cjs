const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const files = [
  'C:\\Users\\andre\\Downloads\\Novos vs Seminovos.xlsx',
  'C:\\Users\\andre\\Downloads\\Gráfico comparativo saída de novos e seminovos de jan24 a jun26.xlsx',
  'C:\\Users\\andre\\Downloads\\Base_Gestao_2026_COM CUSTO FIXO (2) (1).xlsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    try {
      const workbook = XLSX.readFile(file);
      console.log(`File: ${file}`);
      console.log(`  Sheets: ${workbook.SheetNames.join(', ')}`);
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
}
