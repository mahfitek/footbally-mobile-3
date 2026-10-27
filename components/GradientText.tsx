import { Text, TextProps } from 'react-native';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import MaskedViewImport from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

// masked-view 0.3.2 is typed as a class that RN 0.88 no longer accepts as JSX; same runtime component.
const MaskedView = MaskedViewImport as unknown as ComponentType<{ maskElement: ReactElement; children?: ReactNode }>;

interface Props extends TextProps {
  colors: [string, string, ...string[]];
}

// React Native has no native text-gradient — mask a LinearGradient with the
// text's own glyph shape (the standard RN pattern for this effect).
export default function GradientText({ colors, style, children, ...rest }: Props) {
  return (
    <MaskedView maskElement={<Text style={style} {...rest}>{children}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]} {...rest}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
