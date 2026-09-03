import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, ImageBackground, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MIN_DISPLAY_TIME = 1800;

export default function SplashScreen({ navigation }) {
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;

  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    const pulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ])
      ).start();

    pulse(dot1, 0);
    pulse(dot2, 150);
    pulse(dot3, 300);

    const bootstrap = async () => {
      const startedAt = Date.now();

      let destination = 'Login';
      try {
        const [token, isGuest] = await Promise.all([
          AsyncStorage.getItem('access_token'),
          AsyncStorage.getItem('is_guest'),
        ]);
        if (token || isGuest === 'true') {
          destination = 'Home';
        }
      } catch (e) {
        destination = 'Login';
      }

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(MIN_DISPLAY_TIME - elapsed, 0);

      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: destination }] });
      }, remaining);
    };

    bootstrap();
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/image/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View className="flex-1 items-center justify-center px-10">
        {/* Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: '#c89d7d',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#c89d7d',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
            marginBottom: 20,
          }}
        >
          <MaterialIcons name="timer" size={48} color="#ffffff" />
        </Animated.View>

        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
            alignItems: 'center',
          }}
        >
          <Text className="text-[28px] font-bold font-sans text-[#1b1c1c] tracking-tight">
            Pomolendar
          </Text>
          <Text className="text-[14px] font-medium font-sans text-[#8e706b] mt-1 tracking-wide">
            Focus. Plan. Achieve.
          </Text>
        </Animated.View>
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 60,
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#c89d7d',
              marginHorizontal: 4,
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.8, 1.15],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
    </ImageBackground>
  );
}