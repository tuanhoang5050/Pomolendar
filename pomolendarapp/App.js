import React, { useCallback } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';

ExpoSplashScreen.preventAutoHideAsync();

const customTextProps = {
  style: { fontFamily: 'Unkempt-Regular' }
};

const TextRender = Text.render;
Text.render = function (...args) {
  const origin = TextRender.apply(this, args);
  return React.cloneElement(origin, {
    style: [customTextProps.style, origin.props.style],
  });
};

const TextInputRender = TextInput.render;
TextInput.render = function (...args) {
  const origin = TextInputRender.apply(this, args);
  return React.cloneElement(origin, {
    style: [customTextProps.style, origin.props.style],
  });
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Unkempt-Regular': require('./assets/fonts/Unkempt-Regular.ttf'),
    'Unkempt-Bold': require('./assets/fonts/Unkempt-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await ExpoSplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppNavigator />
    </View>
  );
}