import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('rize_2026.json', 'utf8'));

let janSum = 0;
let febSum = 0;

data.daily.time.forEach((date, i) => {
    const rainfall = data.daily.precipitation_sum[i];
    if (rainfall !== null) {
        if (date.startsWith('2026-01')) janSum += rainfall;
        if (date.startsWith('2026-02')) febSum += rainfall;
    }
});

console.log('Archive API 2026 Jan:', janSum.toFixed(2));
console.log('Archive API 2026 Feb:', febSum.toFixed(2));
