import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const EVENT_THEME = { 
  bg: '#6da7e2', 
  line: '#598dc4', 
  text: '#ffffff' 
};

export default function DraggableEvent({ item, baseTop, baseHeight, onDragStart, onDragEnd, onRemove, scrollViewRef, scrollYRef }) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: baseTop })).current;
  const [isDragging, setIsDragging] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const autoScrollTimer = useRef(null);
  const longPressTimer = useRef(null);
  const currentDy = useRef(0);
  const dragStartScrollY = useRef(0);

  const latestProps = useRef({ item, onDragStart, onDragEnd, onRemove });
  useEffect(() => {
    latestProps.current = { item, onDragStart, onDragEnd, onRemove };
  }, [item, onDragStart, onDragEnd, onRemove]);

  useEffect(() => {
    let hideTimer;
    if (showDelete) {
      hideTimer = setTimeout(() => setShowDelete(false), 3500);
    }
    return () => clearTimeout(hideTimer);
  }, [showDelete]);

  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };

  useEffect(() => {
    if (!isDragging) {
      Animated.timing(pan.y, { toValue: baseTop, duration: 150, useNativeDriver: false }).start();
    }
  }, [baseTop, isDragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, 
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      
      onPanResponderGrant: () => {
        setIsDragging(true);
        dragStartScrollY.current = scrollYRef.current;
        currentDy.current = 0;
        latestProps.current.onDragStart(); 
        pan.setOffset({ x: 0, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });

        longPressTimer.current = setTimeout(() => {
          setShowDelete(true);
        }, 1000);
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 5) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setShowDelete(false);
        }

        currentDy.current = gestureState.dy;
        const scrollComp = scrollYRef.current - dragStartScrollY.current;
        pan.setValue({ x: 0, y: currentDy.current + scrollComp });

        const moveY = gestureState.moveY;
        const topBoundary = 280;
        const bottomBoundary = height - 180;
        const scrollSpeed = 5;

        if (moveY < topBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              if (scrollYRef.current > 0) {
                scrollYRef.current = Math.max(0, scrollYRef.current - scrollSpeed);
                scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
                const newScrollComp = scrollYRef.current - dragStartScrollY.current;
                pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
              }
            }, 16);
          }
        } else if (moveY > bottomBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              scrollYRef.current += scrollSpeed;
              scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
              const newScrollComp = scrollYRef.current - dragStartScrollY.current;
              pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
            }, 16);
          }
        } else {
          stopAutoScroll();
        }
      },
      onPanResponderRelease: (_, gestureState) => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      },
      onPanResponderTerminate: () => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      }
    })
  ).current;

  const bgColor = EVENT_THEME.bg;
  const borderColor = 'transparent';
  const lineColor = EVENT_THEME.line;
  const textColor = EVENT_THEME.text;

  const isTooShort = baseHeight < 45;

  return (
    <Animated.View 
      {...panResponder.panHandlers}
      style={{ 
        position: 'absolute', top: 0, left: 64, right: 8, height: baseHeight - 4, 
        backgroundColor: bgColor, borderRadius: 8, borderWidth: 1, borderColor, 
        overflow: isTooShort ? 'visible' : 'hidden', zIndex: isDragging ? 50 : 5,
        transform: [{ translateY: pan.y }, { scale: isDragging ? 1.02 : 1 }],
        shadowColor: '#00695c', shadowOffset: { width: 0, height: isDragging ? 6 : 2 }, 
        shadowOpacity: isDragging ? 0.1 : 0, shadowRadius: isDragging ? 8 : 4, elevation: isDragging ? 8 : 0 
      }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: lineColor }} />
      <View className="flex-1 p-2 flex-row justify-between">
        <View className="flex-1 flex-col" style={{ paddingRight: isTooShort && showDelete ? 36 : 0 }}>
          <Text className="text-[14px] font-bold" style={{ color: textColor }} numberOfLines={1}>{item.title}</Text>
          {!isTooShort && (
            <View className="mt-1 flex-row items-center">
              <MaterialIcons name="event" size={12} color={textColor} style={{ marginRight: 4 }}/>
              <Text style={{ fontSize: 11, color: textColor, fontWeight: 'bold' }}>
                {new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          )}
        </View>
        {!isTooShort && showDelete && (
          <View className="justify-end pl-2">
            <TouchableOpacity 
              className="w-7 h-7 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
              onPress={() => latestProps.current.onRemove(item)}
            >
              <MaterialIcons name="delete-outline" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isTooShort && showDelete && (
        <View style={{ position: 'absolute', top: 4, right: 4, zIndex: 100 }}>
          <TouchableOpacity 
            className="mr-1 w-5 h-5 rounded-full items-center justify-center bg-[#ba1a1a] shadow-xl"
            onPress={() => latestProps.current.onRemove(item)}
          >
            <MaterialIcons name="delete-outline" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}