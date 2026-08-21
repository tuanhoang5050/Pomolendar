import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.55;

export default function CustomDrawer({ isOpen, onClose, navigation, currentScreen }) {
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: isOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const handleNavigate = (screen) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(screen);
    }, 250);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      'access_token', 'refresh_token', 'current_task_id',
      'timer_state', 'timer_end_time', 'timer_total_time', 'timer_time_left'
    ]);
    onClose();
    navigation.replace('Login');
  };

  return (
    <>
      {isOpen && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents="auto">
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          </TouchableWithoutFeedback>
        </View>
      )}
      <Animated.View
        onStartShouldSetResponder={() => true}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%',
          backgroundColor: '#ffffff', zIndex: 101, transform: [{ translateX: drawerAnim }],
          paddingTop: 60, paddingHorizontal: 20, shadowColor: "#000",
          shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
        }}
      >
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-[#ce9d7d] rounded-full items-center justify-center mb-3">
            <MaterialIcons name="person" size={40} color="#ffffff" />
          </View>
          <Text className="text-lg font-bold text-gray-900">Người dùng</Text>
          <Text className="text-xs text-gray-500">user@pomolendar.com</Text>
        </View>

        <View className="h-[1px] bg-[#e4e2e2] w-full mb-6" />

        <View className="flex-1 space-y-2">
          <TouchableOpacity
            className={`flex-row items-center px-2 py-2 rounded-xl ${currentScreen === 'Home' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Home')}
          >
            <MaterialIcons name="timer" size={22} color={currentScreen === 'Home' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold ${currentScreen === 'Home' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Focus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-2 py-2 rounded-xl ${currentScreen === 'Tasks' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Tasks')}
          >
            <MaterialIcons name="checklist" size={22} color={currentScreen === 'Tasks' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold ${currentScreen === 'Tasks' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Task</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-2 py-2 rounded-xl ${currentScreen === 'Bookshelf' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Bookshelf')}
          >
            <MaterialIcons name="auto-stories" size={22} color={currentScreen === 'Bookshelf' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold ${currentScreen === 'Bookshelf' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Tủ sách</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-2 py-2 rounded-xl ${currentScreen === 'Calendar' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Calendar')}
          >
            <MaterialIcons name="calendar-today" size={22} color={currentScreen === 'Calendar' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold ${currentScreen === 'Calendar' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-2 py-2 rounded-xl ${currentScreen === 'Statistics' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Statistics')}
          >
            <MaterialIcons name="leaderboard" size={22} color={currentScreen === 'Statistics' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold ${currentScreen === 'Statistics' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Thống kê</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center px-2 py-2 rounded-xl">
            <MaterialIcons name="settings" size={22} color="#5a413c" />
            <Text className="ml-4 font-semibold text-[#5a413c]">Cài đặt</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="flex-row items-center px-2 py-2 mb-8 border-t border-[#e4e2e2]" onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#ba1a1a" />
          <Text className="ml-2 font-bold text-[#ba1a1a]">Đăng xuất</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}