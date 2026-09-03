import React, { useRef } from 'react';
import { View, Text, Animated } from 'react-native';

const ITEM_HEIGHT = 32;

export default function WheelPicker({ items, selectedValue, onValueChange }) {
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 48 }}>
      <View style={{ position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT, backgroundColor: '#ce9d7d15', borderRadius: 8 }} />
      <Animated.FlatList
        data={items}
        keyExtractor={(item) => item.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (index >= 0 && index < items.length) {
            onValueChange(items[index]);
          }
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={Math.max(0, items.indexOf(selectedValue))}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
          const scale = scrollY.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp' });
          const opacity = scrollY.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });

          return (
            <Animated.View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', transform: [{ scale }], opacity }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#ce9d7d' }}>{item}</Text>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}