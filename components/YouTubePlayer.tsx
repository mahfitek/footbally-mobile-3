import { useCallback, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import YoutubeIframe, { PLAYER_STATES } from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { CARD_RADIUS, Paper } from '../constants/theme';

interface Props {
  videoId: string;
  startSeconds?: number;
  height?: number;
}

// Renders a poster (YouTube's own thumbnail) with a play button first, and
// only mounts the actual iframe WebView once the user taps it. Doing this
// lazily matters here specifically because posts render inside a scrolling
// FlatList — mounting a WebView per visible match-video post up front would
// be needlessly heavy. Once active, playback is handled entirely inside
// YouTube's own iframe controls (never redirects out to the YouTube app).
export default function YouTubePlayer({ videoId, startSeconds = 0, height = 210 }: Props) {
  const { theme } = useTheme();
  const [activated, setActivated] = useState(false);

  const onChangeState = useCallback((_state: PLAYER_STATES) => {}, []);

  if (!activated) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.thumbWrap, { height }]}
        onPress={() => setActivated(true)}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.dim} />
        <View style={[styles.playBtn, { backgroundColor: theme.gold }]}>
          <Ionicons name="play" size={26} color={Paper.ink} style={{ marginLeft: 3 }} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <YoutubeIframe
        height={height}
        videoId={videoId}
        play
        initialPlayerParams={{ start: startSeconds }}
        onChangeState={onChangeState}
        webViewProps={{ allowsInlineMediaPlayback: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbWrap: {
    width: '100%',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
