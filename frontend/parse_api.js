Promise.all([
  fetch('https://api.open-meteo.com/v1/forecast?latitude=41.0201&longitude=40.5234&past_days=92&daily=precipitation_sum,temperature_2m_mean&timezone=auto').then(res => res.json()),
  fetch('https://archive-api.open-meteo.com/v1/archive?latitude=41.0201&longitude=40.5234&start_date=2026-01-01&end_date=2026-03-15&daily=precipitation_sum,temperature_2m_mean&timezone=auto').then(res => res.json())
]).then(([forecast, archive]) => {
  const calc = (data, name) => {
    let jan = 0, feb = 0, mar = 0;
    if(data.daily && data.daily.time) {
      data.daily.time.forEach((date, i) => {
          const r = data.daily.precipitation_sum[i];
          if (r !== null) {
              if (date.startsWith('2026-01')) jan += r;
              if (date.startsWith('2026-02')) feb += r;
              if (date.startsWith('2026-03')) mar += r;
          }
      });
    }
    console.log(`${name} -> Jan: ${jan.toFixed(2)}, Feb: ${feb.toFixed(2)}, Mar: ${mar.toFixed(2)}`);
  };
  calc(forecast, 'Forecast API');
  calc(archive, 'Archive API');
});
