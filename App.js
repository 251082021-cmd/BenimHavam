import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Image, Alert, Modal, ScrollView, Dimensions, StatusBar } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

const getTerminatorCoordinates = () => {
  const now = new Date();
  const julianDay = (now.getTime() / 86400000) - (now.getTimezoneOffset() / 1440) + 2440587.5;
  const n = julianDay - 2451545.0;
  const delta = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(((280.460 + 0.9856474 * n) % 360) * Math.PI / 180)) * 180 / Math.PI;
  const ha = (now.getUTCHours() * 15) + (now.getUTCMinutes() / 4);
  let coords = [];
  for (let i = -180; i <= 180; i += 15) {
    const lon = i;
    const lat = Math.atan(-Math.cos((lon + ha) * Math.PI / 180) / Math.tan(delta * Math.PI / 180)) * 180 / Math.PI;
    const safeLat = Math.max(Math.min(lat, 85), -85);
    coords.push({ latitude: safeLat, longitude: lon });
  }
  const isSummer = delta > 0;
  coords.push({ latitude: isSummer ? -85 : 85, longitude: 180 }, { latitude: isSummer ? -85 : 85, longitude: -180 });
  return coords;
};

export default function App() {
  const [gosterilenSehir, setGosterilenSehir] = useState('Yükleniyor...');
  const [simdikiHava, setSimdikiHava] = useState(null);
  const [tahminler, setTahminler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [secilenGunDetay, setSecilenGunDetay] = useState([]);
  const [secilenBaslik, setSecilenBaslik] = useState("");
  const [yerelSaat, setYerelSaat] = useState('--:--');
  const [tumVeriler, setTumVeriler] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // HARİTA HAFIZASI İÇİN REGION STATE'İ
  const [mapRegion, setMapRegion] = useState({
    latitude: 39,
    longitude: 35,
    latitudeDelta: 30,
    longitudeDelta: 30
  });

 
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
  const terminator = useMemo(() => getTerminatorCoordinates(), [new Date().getHours()]);

  useEffect(() => { ilkKonumGetir(); }, []);

  const saatiHesapla = (offset) => {
    const d = new Date();
    const target = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (offset * 1000));
    setYerelSaat(target.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
  };

  const apiCek = async (lat, lon) => {
    setYukleniyor(true);
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`);
      const data = await res.json();
      if (res.ok) {
        setTumVeriler(data.list);
        setGosterilenSehir(data.city.name);
        saatiHesapla(data.city.timezone);
        setSimdikiHava(data.list[0]);
        const gunler = {};
        data.list.forEach(item => {
          const date = item.dt_txt.split(' ')[0];
          if (!gunler[date] || item.dt_txt.includes("12:00:00")) gunler[date] = item;
        });
        setTahminler(Object.values(gunler).slice(0, 6));
      }
    } catch (e) { Alert.alert("Hata", "Veri çekilemedi."); }
    finally { setYukleniyor(false); }
  };

  const ilkKonumGetir = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setMapRegion({ ...mapRegion, ...coords }); // Haritayı başlangıçta senin konumuna odakla
      apiCek(coords.latitude, coords.longitude);
    }
  };

  const detayGoster = (item) => {
    const tarih = item.dt_txt.split(' ')[0];
    const gunlukFiltre = tumVeriler.filter(v => v.dt_txt.startsWith(tarih));
    setSecilenGunDetay(gunlukFiltre);
    setSecilenBaslik(new Date(item.dt * 1000).toLocaleDateString('tr-TR', { weekday: 'long' }));
    setModalVisible(true);
  };

  const isNight = simdikiHava?.weather[0].icon.includes('n');

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={isNight ? ['#020111', '#191970'] : ['#4facfe', '#00f2fe']} style={StyleSheet.absoluteFill} />

      <Text style={styles.signature}>made by SAD</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.circleBtn} onPress={ilkKonumGetir}><Text style={{fontSize: 22}}>📍</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.circleBtn, {backgroundColor: '#FFD700'}]} onPress={() => setMapVisible(true)}><Text style={{fontSize: 22}}>🌍</Text></TouchableOpacity>
      </View>

      <View style={styles.container}>
        {yukleniyor ? <ActivityIndicator size="large" color="#fff" style={{marginTop: 100}} /> : simdikiHava && (
          <View style={{ flex: 1 }}>
            <View style={styles.hero}>
              <Text style={styles.heroCity}>{gosterilenSehir.toUpperCase()}</Text>
              <View style={styles.timeBadge}><Text style={styles.timeText}>YEREL SAAT: {yerelSaat}</Text></View>
              <Text style={styles.heroTemp}>{Math.round(simdikiHava.main.temp)}°</Text>
              <Text style={styles.heroDesc}>{simdikiHava.weather[0].description.toUpperCase()}</Text>
              
              <TouchableOpacity style={styles.detailBtn} onPress={() => detayGoster(simdikiHava)}>
                 <Text style={styles.detailBtnText}>BUGÜNÜN DETAYI 🕒</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.panel}>
              <View style={styles.handle} />
              <Text style={styles.panelTitle}>HAFTALIK TAHMİN</Text>
              <FlatList 
                data={tahminler}
                keyExtractor={item => item.dt.toString()}
                renderItem={({item}) => (
                  <TouchableOpacity style={styles.row} onPress={() => detayGoster(item)}>
                    <Text style={styles.rowDay}>{new Date(item.dt*1000).toLocaleDateString('tr-TR', {weekday:'long'})}</Text>
                    <Image style={{width:50, height:50}} source={{uri: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`}} />
                    <Text style={styles.rowTemp}>{Math.round(item.main.temp)}°</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>{secilenBaslik.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {secilenGunDetay.map((h, i) => (
                <View key={i} style={styles.hourCard}>
                  <Text style={styles.hourTime}>{h.dt_txt.split(' ')[1].slice(0,5)}</Text>
                  <Image style={{width:50, height:50}} source={{uri: `https://openweathermap.org/img/wn/${h.weather[0].icon}@2x.png` }} />
                  <Text style={styles.hourDeg}>{Math.round(h.main.temp)}°</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><Text style={{color:'black', fontWeight:'bold'}}>KAPAT</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={mapVisible} animationType="fade">
        <View style={{flex: 1, backgroundColor: '#000'}}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            region={mapRegion} // ARTIK STATİK DEĞİL, STATE'DEN GELİYOR
            onRegionChangeComplete={(region) => setMapRegion(region)} // HER HAREKETİ HAFIZAYA ALIR
            minZoomLevel={1}
            onLongPress={(e) => {
              const c = e.nativeEvent.coordinate;
              setSelectedLocation(c);
              // Tıkladığın yeri merkez yap ve hafızaya al
              setMapRegion({ ...mapRegion, latitude: c.latitude, longitude: c.longitude });
              apiCek(c.latitude, c.longitude);
              setMapVisible(false);
            }}
          >
            <Polygon coordinates={terminator} fillColor="rgba(0, 0, 30, 0.4)" strokeWidth={0} />
            {userLocation && <Marker coordinate={userLocation} pinColor="red" title="Sen" />}
            {selectedLocation && <Marker coordinate={selectedLocation} pinColor="blue" />}
          </MapView>
          <TouchableOpacity style={styles.mapClose} onPress={() => setMapVisible(false)}><Text style={{fontWeight:'bold'}}>GERİ DÖN</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  signature: { position: 'absolute', top: 55, left: 25, color: 'rgba(255,255,255,0.3)', fontSize: 18, fontStyle: 'italic', zIndex: 10 },
  actionRow: { position: 'absolute', top: 50, right: 20, flexDirection: 'row', gap: 12, zIndex: 100 },
  circleBtn: { width: 55, height: 55, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'white' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 110 },
  hero: { alignItems: 'center' },
  heroCity: { fontSize: 28, color: 'white', fontWeight: 'bold' },
  timeBadge: { backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginTop: 10 },
  timeText: { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  heroTemp: { fontSize: 130, color: 'white', fontWeight: '100', marginVertical: -20 },
  heroDesc: { fontSize: 16, color: 'white', letterSpacing: 4 },
  detailBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginTop: 15, borderWidth: 1, borderColor: 'white' },
  detailBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  panel: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', borderTopLeftRadius: 60, borderTopRightRadius: 60, padding: 35, marginHorizontal: -20, marginTop: 25 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  panelTitle: { color: '#FFD700', textAlign: 'center', fontWeight: 'bold', fontSize: 11, marginBottom: 30, letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  rowDay: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },
  rowTemp: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { backgroundColor: '#111', padding: 35, borderTopLeftRadius: 50, borderTopRightRadius: 50, width: '100%', alignItems: 'center' },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 25 },
  hourCard: { alignItems: 'center', marginHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20 },
  hourTime: { color: '#FFD700', fontWeight: 'bold' },
  hourDeg: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { marginTop: 30, backgroundColor: '#FFD700', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 25 },
  mapClose: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#FFD700', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30 }
});