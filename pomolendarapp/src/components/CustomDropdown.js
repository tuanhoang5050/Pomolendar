import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CustomDropdown({ label, options, selectedValue, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const selectedOption = options.find(opt => opt.val === selectedValue);

  const openDropdown = () => {
    setIsOpen(true);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  };

  const closeDropdown = () => {
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setIsOpen(false);
    });
  };

  return (
    <View className="mb-4" style={{ zIndex: isOpen ? 999 : 1, elevation: isOpen ? 20 : 0 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[14px] font-bold text-[#5a413c] flex-1 pr-2">{label}</Text>
        <TouchableOpacity 
          className="flex-row justify-between items-center bg-[#f5f3f3] border border-[#e4e2e2] rounded-xl px-3 py-2.5 flex-[1.4]"
          onPress={isOpen ? closeDropdown : openDropdown}
          activeOpacity={0.7}
        >
          <Text className="text-[13px] font-medium text-[#1b1c1c]" numberOfLines={1}>{selectedOption?.label}</Text>
          <MaterialIcons name={isOpen ? "expand-less" : "expand-more"} size={18} color="#a09b95" />
        </TouchableOpacity>
      </View>

      {isOpen && (
        <>
          <Pressable
            onPress={closeDropdown}
            style={{
              position: 'absolute',
              top: -1000, bottom: -1000, left: -1000, right: -1000,
              zIndex: 998,
            }}
          />

          <Animated.View
            style={{
              position: 'absolute',
              top: 46,
              right: 0,
              width: '68%',
              backgroundColor: '#ffffff',
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 999,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 10,
              opacity: anim,
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
              ],
            }}
          >
            {options.map((opt, index) => (
              <TouchableOpacity
                key={opt.val}
                className={`px-4 py-3 ${index < options.length - 1 ? 'border-b border-[#f5f3f3]' : ''} ${selectedValue === opt.val ? 'bg-[#c89d7d]/10' : ''}`}
                onPress={() => { onSelect(opt.val); closeDropdown(); }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <Text className={`text-[13px] ${selectedValue === opt.val ? 'font-bold text-[#c89d7d]' : 'text-[#5a413c]'}`} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  {selectedValue === opt.val && <MaterialIcons name="check" size={16} color="#c89d7d" />}
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
}