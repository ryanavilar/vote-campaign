const XLSX = require('xlsx');
const wb = XLSX.readFile('/Users/ryanavilar/Downloads/Daftar Dukungan Aditya Syarief-IKASTARA KITA (Responses).xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

// Show all column keys from first row
console.log('COLUMNS:', Object.keys(data[0]));
console.log('---');

// Extract harapan data
const results = data.map(row => {
  const keys = Object.keys(row);
  const harapanKey = keys.find(k => k.toLowerCase().includes('harapan'));
  const angkatanKey = keys.find(k => k.toLowerCase().includes('angkatan'));
  const namaKey = keys.find(k => k.toLowerCase().includes('nama'));
  const emailKey = keys.find(k => k.toLowerCase().includes('email'));
  return {
    email: (row[emailKey] || '').toString().trim().toLowerCase(),
    nama: (row[namaKey] || '').toString().trim(),
    angkatan: (row[angkatanKey] || '').toString().replace(/[^0-9]/g, ''),
    harapan: harapanKey ? (row[harapanKey] || '').toString().trim() : ''
  };
}).filter(r => r.harapan && r.harapan !== '-' && r.harapan.length > 1);

console.log(JSON.stringify(results, null, 2));
console.log('Total with harapan:', results.length);
