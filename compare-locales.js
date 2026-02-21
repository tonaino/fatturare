const fs = require('fs');

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      keys = keys.concat(getAllKeys(value, currentKey));
    } else {
      keys.push(currentKey);
    }
  }
  return keys;
}

function getValue(obj, path) {
  return path.split('.').reduce((current, key) => current[key], obj);
}

const en = JSON.parse(fs.readFileSync('renderer/locales/en/common.json', 'utf8'));
const bg = JSON.parse(fs.readFileSync('renderer/locales/bg/common.json', 'utf8'));

const enKeys = getAllKeys(en).sort();
const bgKeys = getAllKeys(bg).sort();

let output = 'Total keys in English: ' + enKeys.length + '\n';
output += 'Total keys in Bulgarian: ' + bgKeys.length + '\n\n';

output += '=== Keys in English but missing in Bulgarian ===\n';
const missingInBg = [];
enKeys.forEach(key => {
  if (!bgKeys.includes(key)) {
    const value = getValue(en, key);
    missingInBg.push({ key, value });
    output += key + ': ' + JSON.stringify(value) + '\n';
  }
});

output += '\n=== Keys in Bulgarian but missing in English ===\n';
const extraInBg = [];
bgKeys.forEach(key => {
  if (!enKeys.includes(key)) {
    const value = getValue(bg, key);
    extraInBg.push({ key, value });
    output += key + ': ' + JSON.stringify(value) + '\n';
  }
});

output += '\n=== Summary ===\n';
output += 'Missing in Bulgarian: ' + missingInBg.length + ' keys\n';
output += 'Extra in Bulgarian: ' + extraInBg.length + ' keys\n';

fs.writeFileSync('comparison-results.txt', output);
console.log('Comparison complete. Results written to comparison-results.txt');
