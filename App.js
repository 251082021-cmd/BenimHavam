import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Image, Alert, Modal, ScrollView, Dimensions, StatusBar, Animated, Easing, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview'; 

const { width, height } = Dimensions.get('window');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

const SunWithRays = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 3000, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
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
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1.25, duration: 4000, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
    ])).start();
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
  const particles = useMemo(() => Array.from({ length: 25 }).map((_, i) => ({
    id: i, startX: Math.random() * width, delay: Math.random() * 2000, duration: type === 'Snow' ? 6000 : 1200
  })), [type]);
  return <View style={StyleSheet.absoluteFillObject}>{particles.map(p => <Particle key={p.id} {...p} type={type} />)}</View>;
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

export default function App() {
  const [gosterilenSehir, setGosterilenSehir] = useState('Yükleniyor...');
  const [simdikiHava, setSimdikiHava] = useState(null);
  const [tahminler, setTahminler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [secilenGunDetay, setSecilenGunDetay] = useState([]);
  const [secilenBaslik, setSecilenBaslik] = useState("");
  const [yerelSaat, setYerelSaat] = useState('--:--');
  const [tumVeriler, setTumVeriler] = useState([]);
  const [sehirOffset, setSehirOffset] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState({ latitude: 41.2797, longitude: 36.3361 });

  useEffect(() => { 
    ilkKonumGetir(); 
  }, []);

  const saatiHesaplaVeGetir = (offset) => {
    const d = new Date();
    const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
    const targetTime = new Date(utcMs + (offset * 1000));
    setYerelSaat(targetTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    return targetTime;
  };

  const veriyiIsle = (data) => {
    setTumVeriler(data.list);
    setGosterilenSehir(data.city.name);
    const offset = data.city.timezone;
    setSehirOffset(offset);
    
    saatiHesaplaVeGetir(offset);
    setSimdikiHava(data.list[0]);
    
    let gunlukHarita = {};
    data.list.forEach(item => {
      const yerelItemZamani = new Date((item.dt + offset) * 1000);
      const tarihKey = yerelItemZamani.toISOString().split('T')[0];
      
      if (!gunlukHarita[tarihKey]) {
        gunlukHarita[tarihKey] = item;
      } else if (item.dt_txt.includes("12:00:00")) {
        gunlukHarita[tarihKey] = item;
      }
    });

    setTahminler(Object.values(gunlukHarita).slice(0, 6));
  };

  const apiCek = async (lat, lon) => {
    setYukleniyor(true);
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`);
      const data = await res.json();
      if (res.ok) {
        veriyiIsle(data);
      }
    } catch (e) { Alert.alert("Hata", "Veri alınamadı."); }
    finally { setYukleniyor(false); }
  };

  const sehirAra = async () => {
    if (!searchText.trim()) return;
    setYukleniyor(true);
    setSearchModalVisible(false);
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${searchText.trim()}&appid=${API_KEY}&units=metric&lang=tr`);
      const data = await res.json();
      if (res.ok) {
        veriyiIsle(data);
        const coords = { latitude: data.city.coord.lat, longitude: data.city.coord.lon };
        setSelectedLocation(coords);
        setMapRegion(coords);
      } else {
        Alert.alert("Bulunamadı", "Şehir bulunamadı, lütfen geçerli bir ad girin.");
      }
    } catch (e) { Alert.alert("Hata", "Bağlantı sorunu yaşandı."); }
    finally { setYukleniyor(false); setSearchText(''); }
  };

  const ilkKonumGetir = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low, timeout: 5000 });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        setMapRegion(coords);
        apiCek(coords.latitude, coords.longitude);
      } catch (err) { apiCek(41.2797, 36.3361); }
    } else { apiCek(41.2797, 36.3361); }
  };

  const detayGoster = (item) => {
    let secilenTarihStr;
    let yerelItemZamani;

    if (item.dt === simdikiHava?.dt) {
      const simdiSehirZamani = new Date((Date.now() + (new Date().getTimezoneOffset() * 60000) + (sehirOffset * 1000)));
      secilenTarihStr = simdiSehirZamani.toISOString().split('T')[0];
      yerelItemZamani = simdiSehirZamani;
    } else {
      yerelItemZamani = new Date((item.dt + sehirOffset) * 1000);
      secilenTarihStr = yerelItemZamani.toISOString().split('T')[0];
    }
    
    // O güne ait tüm saatlik verileri al
    let filtrelenmisDetaylar = tumVeriler.filter(v => {
      const vZaman = new Date((v.dt + sehirOffset) * 1000);
      return vZaman.toISOString().split('T')[0] === secilenTarihStr;
    });

    // Eğer o güne ait filtrelenen liste boş kalırsa (saat çok ilerlediyse), günün son 3-4 verisini emniyet olarak göster
    if (filtrelenmisDetaylar.length === 0) {
      const tumGunVerileri = tumVeriler.filter(v => {
        const vZaman = new Date((v.dt + sehirOffset) * 1000);
        return vZaman.toISOString().split('T')[0] === secilenTarihStr;
      });
      if (tumGunVerileri.length > 0) {
        filtrelenmisDetaylar = tumGunVerileri;
      } else {
        // Hiç bulamazsa tıklanan öğeyi koy
        filtrelenmisDetaylar = [item];
      }
    }

    // 21:00 tahmini bittikten sonra sonraki günün 00:00 verisini ekle ve rozet koy
    const sonEleman = filtrelenmisDetaylar[filtrelenmisDetaylar.length - 1];
    if (sonEleman) {
      const sonIndex = tumVeriler.findIndex(v => v.dt === sonEleman.dt);
      const sonrakiVeri = tumVeriler[sonIndex + 1];
      if (sonrakiVeri) {
        const sonrakiZaman = new Date((sonrakiVeri.dt + sehirOffset) * 1000);
        const sonrakiSaatStr = sonrakiZaman.toISOString().split('T')[1].slice(0,5);
        if (sonrakiSaatStr === "00:00") {
          sonrakiVeri.isNextDayHeader = true;
          sonrakiVeri.nextDayName = sonrakiZaman.toLocaleDateString('tr-TR', { weekday: 'long' });
          filtrelenmisDetaylar.push(sonrakiVeri);
        }
      }
    }

    setSecilenGunDetay(filtrelenmisDetaylar);
    setSecilenBaslik(yerelItemZamani.toLocaleDateString('tr-TR', { weekday: 'long' }));
    setModalVisible(true);
  };

  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) {
        const coordinate = { latitude: data.lat, longitude: data.lng };
        setSelectedLocation(coordinate);
        setMapRegion(coordinate);
        apiCek(coordinate.latitude, coordinate.longitude);
        setMapVisible(false);
      }
    } catch (e) {}
  };

  const isNight = simdikiHava?.weather[0].icon.includes('n');
  const weatherMain = simdikiHava?.weather[0].main;

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html { padding: 0; margin: 0; width: 100%; height: 100%; background: #111; }
        #map { width: 100%; height: 100%; }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${mapRegion.latitude}, ${mapRegion.longitude}], 8);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map);

        ${userLocation ? `
        var userIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          iconSize: [25, 41], iconAnchor: [12, 41]
        });
        L.marker([${userLocation.latitude},${userLocation.longitude}], {icon: userIcon}).addTo(map);
        ` : ''}

        ${selectedLocation ? `
        var selectedIcon = L.divIcon({
          html: '<div style="font-size:30px; margin-top:-15px; margin-left:-15px;">📍</div>',
          className: 'custom-div-icon',
          iconSize: [30, 30]
        });
        L.marker([${selectedLocation.latitude},${selectedLocation.longitude}], {icon: selectedIcon}).addTo(map);
        ` : ''}

        map.on('click', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
        });
      </script>
    </body>
    </html>
  `;

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
        <TouchableOpacity style={[styles.circleBtn, {backgroundColor: 'rgba(255,255,255,0.2)'}]} onPress={() => setSearchModalVisible(true)}><Text style={{fontSize: 22}}>🔍</Text></TouchableOpacity>
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
              <FlatList data={tahminler} renderItem={({item}) => {
                const yerelItemZamani = new Date((item.dt + sehirOffset) * 1000);
                const gunAdi = yerelItemZamani.toLocaleDateString('tr-TR', { weekday: 'long' });

                return (
                  <TouchableOpacity style={styles.row} onPress={() => detayGoster(item)}>
                    <Text style={styles.rowDay}>{gunAdi}</Text>
                    <Image style={{width:50, height:50}} source={{uri: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`}} />
                    <Text style={styles.rowTemp}>{Math.round(item.main.temp)}°</Text>
                  </TouchableOpacity>
                );
              }} showsVerticalScrollIndicator={false} />
            </View>
          </View>
        )}
      </View>

      {/* Tahmin Analizi Modalı */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}><View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{secilenBaslik.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{secilenGunDetay.map((h, i) => {
                const saatZamani = new Date((h.dt + sehirOffset) * 1000);
                const saatStr = saatZamani.toISOString().split('T')[1].slice(0,5);

                return (
                  <View key={i} style={styles.hourCard}>
                    {h.isNextDayHeader && (
                      <View style={styles.nextDayBadge}>
                        <Text style={styles.nextDayText}>👉 {h.nextDayName} Başlıyor</Text>
                      </View>
                    )}
                    <Text style={styles.hourTime}>{saatStr}</Text>
                    <Image style={{width:45, height:45}} source={{uri: `https://openweathermap.org/img/wn/${h.weather[0].icon}.png` }} />
                    <Text style={styles.hourDeg}>{Math.round(h.main.temp)}°</Text>
                  </View>
                );
            })}</ScrollView>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}><Text style={{fontWeight:'bold'}}>KAPAT</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Şehir Arama Modalı */}
      <Modal visible={searchModalVisible} transparent animationType="fade">
        <View style={styles.centeredModalBg}>
          <View style={styles.searchModalContent}>
            <Text style={styles.modalTitle}>ŞEHİR ARA</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir adı girin (Örn: New York)"
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              onSubmitEditing={sehirAra}
            />
            <View style={styles.searchBtns}>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={[styles.closeBtn, {backgroundColor: '#333', marginTop: 0, flex: 1}]}>
                <Text style={{fontWeight:'bold', color: 'white', textAlign: 'center'}}>İPTAL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={sehirAra} style={[styles.closeBtn, {marginTop: 0, flex: 1}]}>
                <Text style={{fontWeight:'bold', textAlign: 'center'}}>ARA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Harita Modalı */}
      <Modal visible={mapVisible} animationType="fade">
        <View style={styles.mapModalContainer}>
          <WebView 
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={styles.webViewMap}
            onMessage={handleMapMessage}
            javaScriptEnabled={true} 
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
          />
          <View style={styles.mapTooltip}>
            <Text style={styles.mapTooltipText}>bilgilerini görmek istediğiniz yere dokunun</Text>
          </View>
          <TouchableOpacity style={styles.mapClose} onPress={() => setMapVisible(false)}>
            <Text style={{fontWeight:'bold', color: '#000'}}>GERİ DÖN</Text>
          </TouchableOpacity>
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
  centeredModalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { backgroundColor: '#111', padding: 35, borderTopLeftRadius: 50, borderTopRightRadius: 50, alignItems: 'center' },
  searchModalContent: { backgroundColor: '#111', padding: 30, borderRadius: 30, alignItems: 'center', width: '85%' },
  searchInput: { backgroundColor: '#222', color: 'white', width: '100%', padding: 15, borderRadius: 15, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  searchBtns: { flexDirection: 'row', gap: 15, marginTop: 25, width: '100%' },
  modalTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  hourCard: { alignItems: 'center', marginHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20, position: 'relative', minWidth: 70 },
  hourTime: { color: '#FFD700', fontSize: 12 },
  hourDeg: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  nextDayBadge: { position: 'absolute', top: -16, left: -10, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, zIndex: 10, width: 110, alignItems: 'center' },
  nextDayText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  closeBtn: { marginTop: 25, backgroundColor: '#FFD700', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 20 },
  mapModalContainer: { flex: 1, backgroundColor: '#111' },
  webViewMap: { flex: 1, backgroundColor: '#111' },
  mapClose: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#FFD700', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30, zIndex: 20 },
  mapTooltip: { position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 15, zIndex: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', alignItems: 'center' },
  mapTooltipText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  markerEmoji: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 2, elevation: 5 }
});