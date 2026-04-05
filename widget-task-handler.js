import React from 'react';
import { FlexWidget, TextWidget, ImageWidget } from 'react-native-android-widget';
const API_KEY = "46c187bdf387b2bfb973a321212d26f3";

export async function widgetTaskHandler(props) {
  let temp = '--'; let sehir = 'Istanbul'; let icon = '01d';
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${sehir}&appid=${API_KEY}&units=metric&lang=tr`);
    const data = await res.json();
    if (data.main) { temp = Math.round(data.main.temp) + '°'; sehir = data.name; icon = data.weather[0].icon; }
  } catch (e) {}

  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#4682B4', borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={sehir} style={{ fontSize: 18, color: 'white', fontWeight: 'bold' }} />
        <TextWidget text={temp} style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }} />
      </FlexWidget>
      <ImageWidget url={`https://openweathermap.org/img/wn/${icon}@2x.png`} style={{ width: 60, height: 60 }} />
    </FlexWidget>
  );
}