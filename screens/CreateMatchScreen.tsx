import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';
import { TURKEY_CITIES } from '../constants/turkeyCities';

const PLAYER_COUNTS = [5, 7, 11];
const MATCH_CATEGORIES = ['Eğlence', 'Rekabetçi', 'Antrenman'];

interface Props {
  navigate: (screen: string) => void;
}

function formatDateForSupabase(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForSupabase(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function CreateMatchScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [location, setLocation] = useState('');
  const [playersPerSide, setPlayersPerSide] = useState(PLAYER_COUNTS[0]);
  const [category, setCategory] = useState(MATCH_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const selectedCity = TURKEY_CITIES.find((c) => c.name === city);
  const filteredCities = TURKEY_CITIES.filter((c) =>
    c.name.toLocaleLowerCase('tr-TR').includes(citySearch.toLocaleLowerCase('tr-TR'))
  );
  const filteredDistricts = (selectedCity?.districts ?? []).filter((d) =>
    d.toLocaleLowerCase('tr-TR').includes(districtSearch.toLocaleLowerCase('tr-TR'))
  );

  const handleSelectCity = (name: string) => {
    setCity(name);
    setDistrict('');
    setCitySearch('');
    setCityModalVisible(false);
    setDistrictModalVisible(true);
  };

  const handleSelectDistrict = (name: string) => {
    setDistrict(name);
    setDistrictSearch('');
    setDistrictModalVisible(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !city.trim() || !district.trim() || !location.trim()) {
      setToast({ message: 'Lütfen tüm alanları doldurun', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: 'Oturum açmanız gerekiyor', type: 'error' });
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('matches').insert({
        title: title.trim(),
        date: formatDateForSupabase(date),
        time: formatTimeForSupabase(time),
        location: location.trim(),
        city: `${city}, ${district}`,
        required_players: playersPerSide * 2,
        type: `${playersPerSide}v${playersPerSide}`,
        category: category,
        creator_id: user.id,
        status: 'upcoming',
      });

      if (error) {
        if (__DEV__) console.log('Maç oluşturulamadı:', error);
        setToast({ message: 'Maç oluşturulamadı', type: 'error' });
        setSaving(false);
        return;
      }

      sendLocalNotification('Maç Oluşturuldu ⚽', `${title.trim()} maçı oluşturuldu.`);
      setToast({ message: 'Maç oluşturuldu', type: 'success' });
      setTimeout(() => navigate('match'), 800);
    } catch (err) {
      if (__DEV__) console.log('Maç oluşturulurken beklenmeyen hata:', err);
      setToast({ message: 'Beklenmeyen bir hata oluştu', type: 'error' });
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('match')}>
            <Text style={styles.backIcon}>←</Text>
          </HapticTouchable>
          <Text style={styles.title}>Maç Oluştur</Text>
        </View>

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MAÇ ADI</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn. U21 Amatör Lig"
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>TARİH</Text>
              <HapticTouchable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </HapticTouchable>
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>SAAT</Text>
              <HapticTouchable style={styles.input} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputValueText}>
                  {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </HapticTouchable>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              locale="tr-TR"
              minimumDate={new Date()}
              onChange={(_event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              is24Hour={true}
              onChange={(_event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) setTime(selectedTime);
              }}
            />
          )}

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>ŞEHİR</Text>
              <HapticTouchable style={styles.input} onPress={() => setCityModalVisible(true)}>
                <Text style={city ? styles.inputValueText : styles.inputPlaceholderText}>
                  {city || 'Şehir seçin'}
                </Text>
              </HapticTouchable>
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>İLÇE</Text>
              <HapticTouchable
                style={[styles.input, !city && styles.inputDisabled]}
                onPress={() => city && setDistrictModalVisible(true)}
                disabled={!city}
              >
                <Text style={district ? styles.inputValueText : styles.inputPlaceholderText}>
                  {district || 'İlçe seçin'}
                </Text>
              </HapticTouchable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>KONUM</Text>
            <TextInput
              style={styles.input}
              placeholder="Ataşehir Halı Saha"
              placeholderTextColor={theme.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>OYUNCU SAYISI (TAKIM BAŞINA)</Text>
            <View style={styles.typeRow}>
              {PLAYER_COUNTS.map((n) => (
                <HapticTouchable
                  key={n}
                  style={[styles.typePill, playersPerSide === n && styles.typePillActive]}
                  onPress={() => setPlayersPerSide(n)}
                >
                  <Text
                    style={[styles.typePillText, playersPerSide === n && styles.typePillTextActive]}
                  >
                    {n}v{n}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MAÇ TİPİ</Text>
            <View style={styles.typeRow}>
              {MATCH_CATEGORIES.map((c) => (
                <HapticTouchable
                  key={c}
                  style={[styles.typePill, category === c && styles.typePillActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.typePillText, category === c && styles.typePillTextActive]}>
                    {c}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <HapticTouchable
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitBtnText}>Maç Oluştur</Text>
            )}
          </HapticTouchable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={cityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Şehir Seçin</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor={theme.textSecondary}
              value={citySearch}
              onChangeText={setCitySearch}
            />
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => String(item.plate)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <HapticTouchable style={styles.listRow} onPress={() => handleSelectCity(item.name)}>
                  <Text style={styles.listRowPlate}>{item.plate}</Text>
                  <Text style={styles.listRowText}>{item.name}</Text>
                </HapticTouchable>
              )}
              style={styles.list}
            />
            <HapticTouchable style={styles.modalCancelBtn} onPress={() => setCityModalVisible(false)}>
              <Text style={styles.modalCancelText}>Vazgeç</Text>
            </HapticTouchable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={districtModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDistrictModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>İlçe Seçin</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="İlçe ara..."
              placeholderTextColor={theme.textSecondary}
              value={districtSearch}
              onChangeText={setDistrictSearch}
            />
            <FlatList
              data={filteredDistricts}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <HapticTouchable style={styles.listRow} onPress={() => handleSelectDistrict(item)}>
                  <Text style={styles.listRowText}>{item}</Text>
                </HapticTouchable>
              )}
              style={styles.list}
            />
            <HapticTouchable
              style={styles.modalCancelBtn}
              onPress={() => setDistrictModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Vazgeç</Text>
            </HapticTouchable>
          </View>
        </View>
      </Modal>

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
    },
    backBtn: {
      width: 44,
      height: 44,
      backgroundColor: theme.card,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.text },
    title: { fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: FontFamily.mono,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 52,
      backgroundColor: theme.card2,
      borderRadius: 16,
      paddingHorizontal: 16,
      justifyContent: 'center',
      color: theme.text,
      fontSize: 15,
      fontFamily: FontFamily.body,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputDisabled: { opacity: 0.5 },
    inputValueText: { color: theme.text, fontSize: 15, fontFamily: FontFamily.body },
    inputPlaceholderText: { color: theme.textSecondary, fontSize: 15, fontFamily: FontFamily.body },
    typeRow: { flexDirection: 'row', gap: 10 },
    typePill: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    typePillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    typePillText: { fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: theme.textMuted },
    typePillTextActive: { color: '#000' },
    submitBtn: {
      height: 56,
      backgroundColor: theme.gold,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: 16, fontFamily: FontFamily.bodySemiBold, color: '#000', letterSpacing: 1 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      height: '75%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 16 },
    searchInput: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: 14,
      paddingHorizontal: 16,
      color: theme.text,
      fontSize: 14,
      fontFamily: FontFamily.body,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    list: { flex: 1 },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    listRowPlate: {
      width: 28,
      fontSize: 13,
      fontFamily: FontFamily.monoMedium,
      color: theme.gold,
    },
    listRowText: { fontSize: 15, fontFamily: FontFamily.body, color: theme.text },
    modalCancelBtn: {
      height: 52,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    modalCancelText: { fontSize: 14, fontFamily: FontFamily.bodySemiBold, color: theme.textMuted },
  });
