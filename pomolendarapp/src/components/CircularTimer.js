import React, { useRef, useEffect } from 'react';
import { View, PanResponder, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export default function CircularTimer({
  progress,
  onUpdate,
  onComplete,
  disabled,
  children,
  radius = 140,
  strokeWidth = 8,
  activeColor = '#c89d7d',
  inactiveColor = '#e4e2e2',
  circleOpacity = 1 
}) {
  const thumbRadius = strokeWidth * 1.2; 
  const padding = thumbRadius + 5; 
  const size = (radius + padding) * 2; 
  
  const cx = size / 2;
  const cy = size / 2;
  const r = radius;
  const circumference = 2 * Math.PI * r;

  
  const latestProps = useRef({ disabled, onUpdate, onComplete });
  useEffect(() => {
    latestProps.current = { disabled, onUpdate, onComplete };
  }, [disabled, onUpdate, onComplete]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latestProps.current.disabled,
      onMoveShouldSetPanResponder: () => !latestProps.current.disabled,
      onPanResponderGrant: () => {},
      onPanResponderMove: (evt, gestureState) => {
        if (latestProps.current.disabled) return;
        const { locationX, locationY } = evt.nativeEvent;
        const x = locationX - cx;
        const y = locationY - cy;

        let angle = Math.atan2(y, x) + Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;

        const newProgress = angle / (2 * Math.PI);
        latestProps.current.onUpdate(newProgress);
      },
      onPanResponderRelease: () => {
        if (latestProps.current.onComplete && !latestProps.current.disabled) {
          latestProps.current.onComplete();
        }
      }
    })
  ).current;

  const strokeDashoffset = circumference - progress * circumference;
  const angle = progress * 2 * Math.PI;
  const thumbX = cx + r * Math.sin(angle);
  const thumbY = cy - r * Math.cos(angle);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      
      <AnimatedSvg width={size} height={size} style={{ position: 'absolute', opacity: circleOpacity }}>
        <Circle cx={cx} cy={cy} r={r} stroke={inactiveColor} strokeWidth={strokeWidth} fill="none" />
        
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={activeColor} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          />
        </G>

        {!disabled && (
          <Circle
            cx={thumbX} cy={thumbY} r={thumbRadius} fill="#ffffff"
            stroke={activeColor} strokeWidth={2.5}
          />
        )}
      </AnimatedSvg>

      <View style={StyleSheet.absoluteFill} {...(disabled ? {} : panResponder.panHandlers)} />

      <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}