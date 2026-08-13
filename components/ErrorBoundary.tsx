import { Component, ReactNode } from 'react';
import { View, Text, Image, StyleSheet, Linking } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import { DarkTheme, Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import GoldButton from './GoldButton';

interface Props {
  children: ReactNode;
  theme?: Theme;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.log(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleReport = async () => {
    const body = `Hata detayı: ${this.state.errorMessage || 'Bilinmeyen hata'}`;
    const available = await MailComposer.isAvailableAsync();
    if (available) {
      await MailComposer.composeAsync({
        recipients: ['info@getfootbally.com'],
        subject: 'Footbally Hata Bildirimi',
        body,
      });
    } else {
      Linking.openURL(
        `mailto:info@getfootbally.com?subject=${encodeURIComponent('Footbally Hata Bildirimi')}&body=${encodeURIComponent(body)}`
      );
    }
  };

  render() {
    if (this.state.hasError) {
      const theme = this.props.theme ?? DarkTheme;
      return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          <Image
            source={require('../assets/logo-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.gold }]}>Bir hata oluştu</Text>
          <GoldButton title="Yeniden Başlat" onPress={this.handleRetry} style={styles.button} />
          <GoldButton
            title="Hatayı Bildir"
            onPress={this.handleReport}
            outline
            style={styles.button}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  button: {
    width: '60%',
    marginBottom: 12,
  },
});
