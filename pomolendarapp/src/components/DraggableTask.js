import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const THEMES = [
  { bg: '#C27664', line: '#a86453', text: '#ffffff' }
];

const getTheme = (id) => {
  let num = 0;
  const str = String(id || '');
  for(let i = 0; i < str.length; i++) {
    num += str.charCodeAt(i);
  }
  return THEMES[num % THEMES.length];
};

export default function DraggableTask({ item, baseTop, baseHeight, onDragStart, onDragEnd, onPlay, onRemove, scrollViewRef, scrollYRef }) {
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

  const theme = getTheme(item.task_id || item.id);
  const bgColor = item.is_completed ? '#e4e2e280' : theme.bg;
  const borderColor = item.is_completed ? '#e4e2e2' : 'transparent';
  const lineColor = item.is_completed ? '#8e706b' : theme.line;
  const textColor = item.is_completed ? '#5a413c' : theme.text;

  const isTooShort = baseHeight < 45;

  return (
    <Animated.View 
      {...(!item.is_completed ? panResponder.panHandlers : {})}
      style={{ 
        position: 'absolute', top: 0, left: 64, right: 8, height: baseHeight - 4, 
        backgroundColor: bgColor, borderRadius: 8, borderWidth: 1, borderColor, 
        overflow: isTooShort ? 'visible' : 'hidden', zIndex: isDragging ? 50 : 10,
        transform: [{ translateY: pan.y }, { scale: isDragging ? 1.02 : 1 }],
        shadowColor: '#000', shadowOffset: { width: 0, height: isDragging ? 6 : 2 }, 
        shadowOpacity: isDragging ? 0.2 : 0.1, shadowRadius: isDragging ? 8 : 4, elevation: isDragging ? 8 : 3 
      }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: lineColor }} />
      <View className="flex-1 p-2 flex-col justify-between">
        <View style={{ paddingRight: isTooShort ? 60 : 0 }}>
          <Text className={`text-[14px] font-bold ${item.is_completed ? 'line-through' : ''}`} style={{ color: textColor }} numberOfLines={1}>{item.title}</Text>
        </View>
        {!isTooShort && (
          <View className="flex-row items-center justify-between mt-1">
            <View style={{ backgroundColor: item.is_completed ? 'transparent' : 'rgba(255,255,255,0.3)' }} className="px-2 py-0.5 rounded flex-row items-center">
              <MaterialIcons name="drag-handle" size={10} color={textColor} style={{ marginRight: 2 }}/>
              <Text className="text-[10px] font-bold" style={{ color: textColor }}>{item.estimated_pomodoros} Pomo</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {showDelete && (
                <TouchableOpacity 
                  className="w-7 h-7 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
                  onPress={() => latestProps.current.onRemove(item)}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                className={`w-7 h-7 rounded-full items-center justify-center ${item.is_completed ? '' : 'shadow-sm'}`} 
                style={{ backgroundColor: item.is_completed ? 'transparent' : 'rgba(255,255,255,0.3)' }}
                disabled={item.is_completed} onPress={() => onPlay(item.task_id)}
              >
                <MaterialIcons name={item.is_completed ? "check" : "play-arrow"} size={16} color={item.is_completed ? "#8e706b" : textColor} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {isTooShort && (
        <View style={{ position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 6, zIndex: 100 }}>
          {showDelete && (
            <TouchableOpacity 
              className="w-6 h-6 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
              onPress={() => latestProps.current.onRemove(item)}
            >
              <MaterialIcons name="delete-outline" size={14} color="#ffffff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            className={`mr-1 w-6 h-6 rounded-full items-center justify-center ${item.is_completed ? '' : 'shadow-sm'}`} 
            style={{ backgroundColor: item.is_completed ? '#e4e2e2' : 'rgba(255,255,255,0.3)' }}
            disabled={item.is_completed} onPress={() => onPlay(item.task_id)}
          >
            <MaterialIcons name={item.is_completed ? "check" : "play-arrow"} size={14} color={item.is_completed ? "#8e706b" : textColor} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}