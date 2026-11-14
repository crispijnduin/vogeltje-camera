import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Haptics from 'expo-haptics';

type Mode = 'handmatig' | 'automatisch';

// Tijd (ms) tussen start vogelgeluid en foto. Instelbaar in de app.
const DELAYS = [300, 600, 1000, 1500];
// Aftellen (s) in automatische modus.
const COUNTDOWNS = [3, 5, 10];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const player = useAudioPlayer(require('./assets/vogel.wav'));

  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<Mode>('handmatig');
  const [delay, setDelay] = useState(600);
  const [countdownSec, setCountdownSec] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastUri, setLastUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    // Geluid ook afspelen als de telefoon op stil staat (iOS).
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  };

  const birdAndShoot = async () => {
    if (!cameraRef.current) return;
    await player.seekTo(0);
    player.play();
    await sleep(delay);
    const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLastUri(photo.uri);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (perm.granted) {
        await MediaLibrary.saveToLibraryAsync(photo.uri);
        flash('Foto bewaard in je galerij');
      } else {
        flash('Geen toestemming voor de galerij — foto niet bewaard');
      }
    } catch (e) {
      flash('Bewaren mislukt');
    }
  };

  const onPress = async () => {
    if (busy) {
      // Tweede tik tijdens aftellen = annuleren
      cancelRef.current = true;
      return;
    }
    setBusy(true);
    cancelRef.current = false;
    try {
      if (mode === 'automatisch') {
        for (let s = countdownSec; s > 0; s--) {
          if (cancelRef.current) return;
          setCountdown(s);
          await sleep(1000);
        }
        setCountdown(null);
        if (cancelRef.current) return;
      }
      await birdAndShoot();
    } catch (e) {
      flash('Er ging iets mis bij het maken van de foto');
    } finally {
      setCountdown(null);
      setBusy(false);
    }
  };

  if (!camPerm) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!camPerm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>🐦 Vogeltje</Text>
        <Text style={styles.text}>
          Voor deze app is toegang tot de camera nodig.
        </Text>
        <Pressable style={styles.permButton} onPress={requestCamPerm}>
          <Text style={styles.permButtonText}>Camera toestaan</Text>
        </Pressable>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setReady(true)}
      />

      {/* Bovenbalk: modus */}
      <View style={styles.topBar}>
        <Segment
          options={['handmatig', 'automatisch']}
          labels={['Handmatig', 'Automatisch']}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          disabled={busy}
        />
      </View>

      {countdown !== null && (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      )}

      {message && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}

      {/* Onderpaneel: instellingen + knoppen */}
      <View style={styles.bottom}>
        <Text style={styles.label}>Foto na vogelgeluid</Text>
        <Segment
          options={DELAYS.map(String)}
          labels={DELAYS.map((d) => `${(d / 1000).toFixed(1).replace('.', ',')} s`)}
          value={String(delay)}
          onChange={(v) => setDelay(Number(v))}
          disabled={busy}
        />
        {mode === 'automatisch' && (
          <>
            <Text style={styles.label}>Aftellen</Text>
            <Segment
              options={COUNTDOWNS.map(String)}
              labels={COUNTDOWNS.map((c) => `${c} s`)}
              value={String(countdownSec)}
              onChange={(v) => setCountdownSec(Number(v))}
              disabled={busy}
            />
          </>
        )}

        <View style={styles.row}>
          <View style={styles.side}>
            {lastUri && <Image source={{ uri: lastUri }} style={styles.thumb} />}
          </View>

          <Pressable
            onPress={onPress}
            disabled={!ready}
            style={({ pressed }) => [
              styles.shutter,
              (pressed || busy) && styles.shutterActive,
              !ready && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.shutterIcon}>{busy && mode === 'automatisch' ? '✕' : '🐦'}</Text>
          </Pressable>

          <View style={styles.side}>
            <Pressable
              style={styles.flip}
              disabled={busy}
              onPress={() => {
                setReady(false);
                setFacing((f) => (f === 'back' ? 'front' : 'back'));
              }}
            >
              <Text style={styles.flipText}>⟲</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

function Segment(props: {
  options: string[];
  labels: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.segment}>
      {props.options.map((o, i) => {
        const active = o === props.value;
        return (
          <Pressable
            key={o}
            disabled={props.disabled}
            onPress={() => props.onChange(o)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {props.labels[i]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 16 },
  text: { color: '#ddd', fontSize: 17, textAlign: 'center', marginBottom: 24 },
  permButton: {
    backgroundColor: '#FFC83D',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  permButtonText: { color: '#111', fontSize: 17, fontWeight: '700' },
  topBar: { position: 'absolute', top: 56, left: 16, right: 16 },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  label: { color: '#eee', fontSize: 13, marginBottom: 6, marginTop: 6 },
  row: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  shutter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFC83D',
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterActive: { backgroundColor: '#F59E0B', transform: [{ scale: 0.95 }] },
  shutterIcon: { fontSize: 36 },
  thumb: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  flip: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: { color: '#fff', fontSize: 28 },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  segItemActive: { backgroundColor: '#fff' },
  segText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  segTextActive: { color: '#111' },
  countdownWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    color: '#fff',
    fontSize: 140,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 12,
  },
  toast: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: '#fff', fontSize: 15 },
});
