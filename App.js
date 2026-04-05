import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Image, Alert, Modal, ScrollView, Dimensions, StatusBar, Animated, Easing } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

// API Anahtarı Çekme (Hem yerel hem build uyumlu)
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

// --- ANİMASYON BİLEŞENLERİ (Güneş, Ay, Yağış) ---
const SunWithRays = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 3000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.celestialContainer}>
      <Animated.View style={[styles.sunRays, { transform: [{ rotate: spin }, { scale: scaleAnim }] }]} />
      <View style={styles.sun} />
    </View>
  );
};

const MoonWithStars = () => {
  const glowAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1.25, duration: 4000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.celestialContainer}>
      <Animated.View style={[styles.moonGlow, { transform: [{ scale: glowAnim }] }]} />
      <View style={styles.moon} />
      <View style={[styles.star, { top: -45, left: -30 }]} />
      <View style={[styles.star, { top: 35, left: -60, opacity: 0.5 }]} />
      <View style={[styles.star, { top: -20, left: 55 }]} />
      <View style={[styles.star, { top: 50, left: 40, opacity: 0.7 }]} />
    </View>
  );
};

const WeatherParticles = ({ type }) => {
  const particles = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    startX: Math.random() * width,
    delay: Math.random() * 2000,
    duration: type === 'Snow' ? 6000 : 1200
  })), [type]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {particles.map(p => <Particle key={p.id} {...p} type={type} />)}
    </View>
  );
};

const Particle = ({ delay, startX, duration, type }) => {
  const anim = useRef(new Animated.Value(-50)).current;
  useEffect(() => {
    const startFall = () => {
      anim.setValue(-50);
      Animated.timing(anim, { toValue: height, duration, delay, easing: Easing.linear, useNativeDriver: true }).start(() => startFall());
    };
    startFall();
  }, []);
  return <Animated.View style={[type === 'Snow' ? styles.snowFlake : styles.rainDrop, { left: startX, transform: [{ translateY: anim }] }]} />;
};

const getTerminatorCoordinates = () => {
  const now = new Date();
  const julianDay = (now.getTime() / 86400000) - (now.getTimezoneOffset() / 1440) + 2440587.5;
  const n = julianDay - 2451545.0;
  const delta = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(((280.460 + 0.9856474 * n) % 360) * Math.PI / 180)) * 180 / Math.PI;
  const ha = (now.getUTCHours() * 15) + (now.getUTCMinutes() / 4);
  let coords = [];
  for (let i = -180; i <= 180; i += 15) {
    const lat = Math.atan(-Math.cos((i + ha) * Math.PI / 180) / Math.tan(delta * Math.PI / 180)) * 180 / Math.PI;
    coords.push({ latitude: Math.max(Math.min(lat, 85), -85), longitude: i });
  }
  return [...coords, { latitude: delta > 0 ? -85 : 85, longitude: 180 }, { latitude: delta > 0 ? -85 : 85, longitude: -180 }];
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
  const [mapRegion, setMapRegion] = useState({ latitude: 39, longitude: 35, latitudeDelta: 30, longitudeDelta: 30 });

  const terminator = useMemo(() => getTerminatorCoordinates(), []);

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
          const d = item.dt_txt.split(' ')[0];
          if (!gunler[d] || item.dt_txt.includes("12:00:00")) gunler[d] = item;
        });
        setTahminler(Object.values(gunler).slice(0, 6));
      }
    } catch (e) { Alert.alert("Hata", "Veri alınamadı. API anahtarını kontrol edin."); }
    finally { setYukleniyor(false); }
  };

  const ilkKonumGetir = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      setMapRegion(p => ({ ...p, ...coords }));
      apiCek(coords.latitude, coords.longitude);
    }
  };

  const detayGoster = (item) => {
    const tarih = item.dt_txt.split(' ')[0];
    setSecilenGunDetay(tumVeriler.filter(v => v.dt_txt.startsWith(tarih)));
    setSecilenBaslik(new Date(item.dt * 1000).toLocaleDateString('tr-TR', { weekday: 'long' }));
    setModalVisible(true);
  };

  const isNight = simdikiHava?.weather[0].icon.includes('n');
  const weatherMain = simdikiHava?.weather[0].main;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={isNight ? ['#020111', '#191970'] : ['#4facfe', '#00f2fe']} style={StyleSheet.absoluteFill} />

      {simdikiHava && (
        <>
          {isNight ? <MoonWithStars /> : <SunWithRays />}
          {weatherMain === 'Rain' && <WeatherParticles type="Rain" />}
          {weatherMain === 'Snow' && <WeatherParticles type="Snow" />}
        </>
      )}

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
                 <Text style={styles.detailBtnText}>ANALİZİ GÖR 🕒</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.panel}>
              <View style={styles.handle} />
              <FlatList 
                data={tahminler}
                renderItem={({item}) => (
                  <TouchableOpacity style={styles.row} onPress={() => detayGoster(item)}>
                    <Text style={styles.rowDay}>{new Date(item.dt*1000).toLocaleDateString('tr-TR', {weekday:'long'})}</Text>
                    <Image style={{width:50, height:50}} source={{uri: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`}} />
                    <Text style={styles.rowTemp}>{Math.round(item.main.temp)}°</Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{secilenBaslik.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{secilenGunDetay.map((h, i) => (
                <View key={i} style={styles.hourCard}>
                  <Text style={styles.hourTime}>{h.dt_txt.split(' ')[1].slice(0,5)}</Text>
                  <Image style={{width:45, height:45}} source={{uri: `https://openweathermap.org/img/wn/${h.weather[0].icon}.png` }} />
                  <Text style={styles.hourDeg}>{Math.round(h.main.temp)}°</Text>
                </View>
            ))}</ScrollView>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><Text style={{fontWeight:'bold'}}>KAPAT</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={mapVisible} animationType="fade">
        <View style={{flex: 1, backgroundColor: '#000'}}>
          <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} region={mapRegion} onRegionChangeComplete={setMapRegion} minZoomLevel={1}
            onLongPress={(e) => {
              const c = e.nativeEvent.coordinate;
              setSelectedLocation(c); setMapRegion(p => ({ ...p, ...c }));
              apiCek(c.latitude, c.longitude); setMapVisible(false);
            }}>
            <Polygon coordinates={terminator} fillColor="rgba(0, 0, 30, 0.4)" strokeWidth={0} />
            {userLocation && <Marker coordinate={userLocation} pinColor="red" />}
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
  timeText: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },
  heroTemp: { fontSize: 130, color: 'white', fontWeight: '100', marginVertical: -20 },
  heroDesc: { fontSize: 16, color: 'white', letterSpacing: 4 },
  detailBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginTop: 15, borderWidth: 1, borderColor: 'white' },
  detailBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  panel: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', borderTopLeftRadius: 60, borderTopRightRadius: 60, padding: 35, marginHorizontal: -20, marginTop: 25 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  rowDay: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },
  rowTemp: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  celestialContainer: { position: 'absolute', top: 165, right: -15, alignItems: 'center', justifyContent: 'center' },
  sun: { width: 85, height: 85, backgroundColor: '#FFD700', borderRadius: 43, zIndex: 2 },
  sunRays: { position: 'absolute', width: 140, height: 140, backgroundColor: 'rgba(255, 215, 0, 0.15)', borderRadius: 70, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', zIndex: 1 },
  moon: { width: 75, height: 75, backgroundColor: '#fdfce1', borderRadius: 38, zIndex: 2 },
  moonGlow: { position: 'absolute', width: 125, height: 125, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 63, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', zIndex: 1 },
  star: { position: 'absolute', width: 3, height: 3, backgroundColor: 'white', borderRadius: 2 },
  rainDrop: { position: 'absolute', width: 1.5, height: 20, backgroundColor: 'rgba(255,255,255,0.4)' },
  snowFlake: { position: 'absolute', width: 6, height: 6, backgroundColor: 'white', borderRadius: 3 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { backgroundColor: '#111', padding: 35, borderTopLeftRadius: 50, borderTopRightRadius: 50, alignItems: 'center' },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  hourCard: { alignItems: 'center', marginHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20 },
  hourTime: { color: '#FFD700', fontSize: 12 },
  hourDeg: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { marginTop: 25, backgroundColor: '#FFD700', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 20 },
  mapClose: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#FFD700', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30 }
});