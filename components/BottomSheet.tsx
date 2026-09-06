import { ReactNode, useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Theme, CARD_RADIUS } from '../constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function BottomSheet({ visible, onClose, theme, children, contentStyle }: Props) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 280 });
    } else {
      Keyboard.dismiss();
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 280 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
          </Pressable>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.kav}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }, sheetStyle, contentStyle]}
            >
              <GestureDetector gesture={pan}>
                <View style={styles.handleZone}>
                  <View style={[styles.handle, { backgroundColor: theme.border }]} />
                </View>
              </GestureDetector>
              {children}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    overflow: 'hidden',
  },
  handleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
