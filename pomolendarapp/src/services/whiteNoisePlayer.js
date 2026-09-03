import { Audio } from 'expo-av';

let soundInstance = null;
let currentTrackId = null;
let audioModeConfigured = false;

export async function configureAudioMode() {
  if (audioModeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
    audioModeConfigured = true;
  } catch (e) {}
}


export async function loadTrack(trackFile, trackId, volume = 0.6) {
  if (soundInstance && currentTrackId === trackId) {
    await setVolume(volume);
    return soundInstance;
  }

  await unload();

  try {
    const { sound } = await Audio.Sound.createAsync(trackFile, {
      isLooping: true,
      volume,
    });
    soundInstance = sound;
    currentTrackId = trackId;
    return sound;
  } catch (e) {
    soundInstance = null;
    currentTrackId = null;
    return null;
  }
}

export async function play() {
  try {
    if (!soundInstance) return;
    const status = await soundInstance.getStatusAsync();
    if (status.isLoaded) {
      await soundInstance.playAsync();
    }
  } catch (e) {}
}

export async function pause() {
  try {
    if (!soundInstance) return;
    const status = await soundInstance.getStatusAsync();
    if (status.isLoaded) {
      await soundInstance.pauseAsync();
    }
  } catch (e) {}
}

export async function setVolume(vol) {
  try {
    if (!soundInstance) return;
    const status = await soundInstance.getStatusAsync();
    if (status.isLoaded) {
      await soundInstance.setVolumeAsync(vol);
    }
  } catch (e) {}
}

export async function unload() {
  try {
    if (soundInstance) {
      const status = await soundInstance.getStatusAsync();
      if (status.isLoaded) {
        await soundInstance.unloadAsync();
      }
    }
  } catch (e) {}
  soundInstance = null;
  currentTrackId = null;
}

export function isPlayingTrack(trackId) {
  return currentTrackId === trackId && !!soundInstance;
}