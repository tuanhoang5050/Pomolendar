// src/components/AnimatedPopup.js
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Animated } from 'react-native';

export default function AnimatedPopup({ visible, onClose, children, zIndex = 500 }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(27, 28, 28, 0.55)', opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={{
          width: '100%',
          alignItems: 'center',
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        }}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </View>
  );
}