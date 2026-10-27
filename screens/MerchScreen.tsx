import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import HapticTouchable from '../components/HapticTouchable';
import EmptyState from '../components/EmptyState';

type IoniconName = keyof typeof Ionicons.glyphMap;

type MerchVariant = { id: string; size: string; color: string; sku: string; stock: number };

// Web ile aynı backend'deki merch_products / merch_variants tabloları (bkz. web
// migration 20261026_merch_core.sql). Fiyatlar kuruş (TL) ve FP olarak saklanır.
type MerchProduct = {
  id: string;
  name: string;
  description: string;
  category: 'forma' | 'antrenman' | 'aksesuar' | 'ekipman';
  price_try_kurus: number;
  price_fp: number;
  merch_variants: MerchVariant[];
};

const CATEGORY_ICON: Record<MerchProduct['category'], IoniconName> = {
  forma: 'shirt-outline',
  antrenman: 'fitness-outline',
  aksesuar: 'ribbon-outline',
  ekipman: 'football-outline',
};

const formatTry = (kurus: number) =>
  `₺${(kurus / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;

const totalStock = (product: MerchProduct) =>
  product.merch_variants.reduce((sum, v) => sum + v.stock, 0);

const unique = (values: string[]) => Array.from(new Set(values));

interface Props {
  onBack: () => void;
}

// Salt okunur Merch kataloğu. Satın alma (sepet/checkout) bu sürümde kapalıdır:
// canlıda merch çekirdek tabloları ve FP checkout'u henüz etkin değil. Katalogda
// hiç aktif ürün yoksa sahte ürün gösterilmez.
export default function MerchScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<MerchProduct[]>([]);
  const [selected, setSelected] = useState<MerchProduct | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('merch_products')
      .select('id, name, description, category, price_try_kurus, price_fp, merch_variants(id, size, color, sku, stock)')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) {
      if (__DEV__) console.log('Merch kataloğu yüklenemedi:', error);
      setProducts([]);
    } else {
      setProducts((data ?? []) as unknown as MerchProduct[]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t('merch_title')} onBack={onBack} styles={styles} />
        <ActivityIndicator color={theme.gold} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (selected) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t('merch_title')} onBack={() => setSelected(null)} styles={styles} />
        <ProductDetail product={selected} styles={styles} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={t('merch_title')} onBack={onBack} styles={styles} />
      {products.length === 0 ? (
        <EmptyState
          icon="shirt-outline"
          title={t('merch_emptyTitle')}
          subtitle={t('merch_emptyBody')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {products.map((product) => {
            const inStock = totalStock(product) > 0;
            return (
              <HapticTouchable key={product.id} style={styles.card} onPress={() => setSelected(product)}>
                <View style={styles.cardImage}>
                  <Ionicons name={CATEGORY_ICON[product.category]} size={44} color={theme.gold} />
                </View>
                <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
                <Text style={styles.cardPrice}>{formatTry(product.price_try_kurus)}</Text>
                <Text style={[styles.stockText, !inStock && styles.stockTextOut]}>
                  {inStock ? t('merch_inStock') : t('merch_outOfStock')}
                </Text>
              </HapticTouchable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Header({ title, onBack, styles }: { title: string; onBack: () => void; styles: ReturnType<typeof createStyles> }) {
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <HapticTouchable style={styles.backBtn} onPress={onBack}>
        <Ionicons name="chevron-back" size={17} color={theme.text} />
      </HapticTouchable>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
    </View>
  );
}

function ProductDetail({ product, styles }: { product: MerchProduct; styles: ReturnType<typeof createStyles> }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const sizes = unique(product.merch_variants.map((v) => v.size));
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const colors = unique(product.merch_variants.filter((v) => v.size === size).map((v) => v.color));
  const [color, setColor] = useState<string | null>(colors[0] ?? null);

  const variant = product.merch_variants.find((v) => v.size === size && v.color === color) ?? null;
  const inStock = (variant?.stock ?? 0) > 0;

  const pickSize = (next: string) => {
    setSize(next);
    const firstColor = product.merch_variants.find((v) => v.size === next)?.color ?? null;
    setColor(firstColor);
  };

  return (
    <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
      <View style={styles.detailImage}>
        <Ionicons name={CATEGORY_ICON[product.category]} size={72} color={theme.gold} />
      </View>
      <Text style={styles.detailName}>{product.name}</Text>
      <Text style={styles.detailPrice}>
        {formatTry(product.price_try_kurus)}
        <Text style={styles.detailFp}>{`  ·  ${product.price_fp} FP`}</Text>
      </Text>
      {product.description ? <Text style={styles.detailDesc}>{product.description}</Text> : null}

      {sizes.length > 0 && (
        <>
          <Text style={styles.optionLabel}>{t('merch_selectSize')}</Text>
          <View style={styles.optionRow}>
            {sizes.map((s) => (
              <HapticTouchable
                key={s}
                style={[styles.optionChip, size === s && styles.optionChipActive]}
                onPress={() => pickSize(s)}
              >
                <Text style={[styles.optionText, size === s && styles.optionTextActive]}>{s}</Text>
              </HapticTouchable>
            ))}
          </View>
        </>
      )}

      {colors.length > 0 && (
        <>
          <Text style={styles.optionLabel}>{t('merch_selectColor')}</Text>
          <View style={styles.optionRow}>
            {colors.map((c) => (
              <HapticTouchable
                key={c}
                style={[styles.optionChip, color === c && styles.optionChipActive]}
                onPress={() => setColor(c)}
              >
                <Text style={[styles.optionText, color === c && styles.optionTextActive]}>{c}</Text>
              </HapticTouchable>
            ))}
          </View>
        </>
      )}

      <View style={styles.stockBadge}>
        <Ionicons
          name={inStock ? 'checkmark-circle-outline' : 'close-circle-outline'}
          size={15}
          color={inStock ? theme.success : theme.error}
        />
        <Text style={[styles.stockBadgeText, { color: inStock ? theme.success : theme.error }]}>
          {inStock ? t('merch_inStock') : t('merch_outOfStock')}
        </Text>
      </View>

      <View style={styles.buyDisabled}>
        <Text style={styles.buyDisabledText}>{t('merch_comingSoon')}</Text>
      </View>
      <Text style={styles.note}>{t('merch_checkoutNote')}</Text>
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontFamily: FontFamily.display, fontSize: 24, color: theme.text, letterSpacing: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 24, paddingBottom: 100 },
    card: {
      width: '47%',
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      gap: 6,
    },
    cardImage: {
      height: 110,
      borderRadius: CARD_RADIUS - 4,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    cardName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, minHeight: 36 },
    cardPrice: { fontFamily: FontFamily.monoMedium, fontSize: 14, color: theme.goldDark },
    stockText: { fontFamily: FontFamily.body, fontSize: 12, color: theme.success },
    stockTextOut: { color: theme.error },
    detail: { paddingHorizontal: 24, paddingBottom: 120, gap: 10 },
    detailImage: {
      height: 220,
      borderRadius: CARD_RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailName: { fontFamily: FontFamily.display, fontSize: 26, color: theme.text, marginTop: 8 },
    detailPrice: { fontFamily: FontFamily.monoMedium, fontSize: 18, color: theme.goldDark },
    detailFp: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted },
    detailDesc: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textMuted, lineHeight: 20 },
    optionLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textMuted, letterSpacing: 0.5, marginTop: 8 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: CARD_RADIUS - 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    optionChipActive: { borderColor: theme.gold, backgroundColor: theme.purpleLight },
    optionText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    optionTextActive: { color: theme.goldDark },
    stockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    stockBadgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13 },
    buyDisabled: {
      marginTop: 14,
      backgroundColor: theme.border,
      borderRadius: CARD_RADIUS - 4,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buyDisabledText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.textMuted },
    note: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, textAlign: 'center' },
  });
