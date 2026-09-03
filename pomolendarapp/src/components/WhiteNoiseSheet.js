import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { WHITE_NOISE_TRACKS } from '../constants/WhiteNoiseSounds';

export default function WhiteNoiseSheet({
  visible,
  onClose,
  enabled,
  onToggleEnabled,
  selectedTrackId,
  onSelectTrack,
  volume,
  onVolumeChange,
  tracks = [] 
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [isAtTop, setIsAtTop] = useState(true);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollContainerHeight = useRef(0);
  const scrollContentHeight = useRef(0);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const bounceLoopRef = useRef(null);

  const displayTracks = tracks && tracks.length > 0 ? tracks : WHITE_NOISE_TRACKS;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const recomputeCanScrollDown = () => {
    const canScroll = scrollContentHeight.current > scrollContainerHeight.current + 4;
    setCanScrollDown(canScroll);
  };

  const shouldShowHint = enabled && isAtTop && canScrollDown;

  useEffect(() => {
    if (shouldShowHint) {
      Animated.timing(hintOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

      bounceLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ])
      );
      bounceLoopRef.current.start();
    } else {
      bounceLoopRef.current?.stop();
      Animated.timing(hintOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }

    return () => { bounceLoopRef.current?.stop(); };
  }, [shouldShowHint]);

  const bounceTranslateY = bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  return (
    <View 
      style={[StyleSheet.absoluteFillObject, { zIndex: 200, justifyContent: 'center', alignItems: 'center' }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(27, 28, 28, 0.4)', opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={{
          width: '85%',
          backgroundColor: '#fbf9f8', 
          borderRadius: 16,
          paddingVertical: 24,
          paddingHorizontal: 20,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 10 }, 
          shadowOpacity: 0.15, 
          shadowRadius: 20, 
          elevation: 10,
          maxHeight: '80%', 
        }}
      >
        <View className="items-center justify-center mb-6">
          <Text className="text-[20px] font-bold text-[#1b1c1c]">White Noise</Text>
        </View>

        <View className="flex-col gap-4">
          <TouchableOpacity
            className="flex-row items-center justify-between p-3 bg-white rounded-xl border border-[#efeded]"
            onPress={() => onToggleEnabled(!enabled)}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-[16px] font-bold text-[#1b1c1c]">Enable White Noise</Text>
            </View>
            <View className={`w-12 h-5 rounded-full justify-center px-1 ${enabled ? 'bg-[#c89d7d]' : 'bg-[#e4e2e2]'}`}>
              <View
                className="w-5 h-3 rounded-full bg-white shadow-sm"
                style={{ marginLeft: enabled ? 20 : 0 }}
              />
            </View>
          </TouchableOpacity>

          <View style={{ opacity: enabled ? 1 : 0.4, flexShrink: 1 }} pointerEvents={enabled ? 'auto' : 'none'}>
            <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-3 tracking-widest mt-2">Select Sound</Text>
            
            <View style={{ position: 'relative' }}>
              <ScrollView
                className="flex-col mb-6"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 200 }}
                scrollEventThrottle={16}
                onLayout={(e) => {
                  scrollContainerHeight.current = e.nativeEvent.layout.height;
                  recomputeCanScrollDown();
                }}
                onContentSizeChange={(w, h) => {
                  scrollContentHeight.current = h;
                  recomputeCanScrollDown();
                }}
                onScroll={(e) => {
                  const offsetY = e.nativeEvent.contentOffset.y;
                  setIsAtTop(offsetY <= 5);
                }}
              >
                {displayTracks.map(track => {
                  const isSelected = selectedTrackId === track.id;
                  return (
                    <TouchableOpacity
                      key={track.id}
                      onPress={() => onSelectTrack(track.id)}
                      className={`flex-row items-center justify-between p-2 rounded-2xl border mb-2 ${isSelected ? 'bg-[#c89d7d]/10 border-[#c89d7d]' : 'bg-white border-[#efeded]'}`}
                    >
                      <View className="flex-row items-center gap-3">
                        <Text className="text-[15px] font-medium text-[#1b1c1c]">{track.name}</Text>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={20} color="#c89d7d" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 24, 
                  height: 36,
                  opacity: hintOpacity,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 36,
                    backgroundColor: '#fbf9f8',
                    opacity: 0.001, 
                  }}
                />
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 30,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                  opacity: hintOpacity,
                  transform: [{ translateY: bounceTranslateY }],
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#c89d7d" />
                </View>
              </Animated.View>
            </View>

            <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Volume</Text>
            <View className="flex-row items-center gap-2 mb-4">
              <MaterialIcons name="volume-down" size={20} color="#8e706b" />
              <Slider
                style={{ flex: 1, height: 36 }}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={volume}
                onValueChange={onVolumeChange}
                minimumTrackTintColor="#c89d7d"
                maximumTrackTintColor="#e4e2e2"
                thumbTintColor="#c89d7d"
              />
              <MaterialIcons name="volume-up" size={20} color="#8e706b" />
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={onClose}
          className="w-full py-2 bg-[#c89d7d] rounded-3xl items-center justify-center mt-2 active:bg-[#b88c6c]"
        >
          <Text className="text-white font-bold text-[16px]">Save</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}