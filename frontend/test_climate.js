import fetch from "node-fetch";

async function test() {
    const geoRes = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=Antalya&count=1&language=tr&format=json");
    const geoData = await geoRes.json();
    const { latitude, longitude } = geoData.results[0];

    const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=2025-01-01&end_date=2025-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`);
    const data = await response.json();
    console.log(Object.keys(data));
    console.log(data.daily.time.length);
}
test();
