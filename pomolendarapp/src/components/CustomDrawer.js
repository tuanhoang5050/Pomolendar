import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions, TouchableWithoutFeedback, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from '../services/api';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.55;

export default function CustomDrawer({ isOpen, onClose, navigation, currentScreen }) {
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [userData, setUserData] = useState({
    username: 'User',
    email: 'user@pomolendar.com',
    avatarUrl: null,
    isGuest: false
  });

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: isOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();

    if (isOpen) {
      fetchUserProfile();
    }
  }, [isOpen]);

  const fetchUserProfile = async () => {
    try {
      const guest = await AsyncStorage.getItem('is_guest');
      if (guest === 'true') {
        setUserData({
          username: 'Guest',
          email: 'Login to sync',
          avatarUrl: null,
          isGuest: true
        });
        return;
      }

      const response = await api.get('/accounts/users/profile/');
      const { name, email, avatar } = response.data;

      setUserData({
        username: name || 'User',
        email: email || '',
        avatarUrl: avatar || null,
        isGuest: false
      });
    } catch (error) {
      console.log('Error fetching user profile:', error);
    }
  };

  const handleNavigate = async (screen) => {
    if (screen !== 'Home' && screen !== 'Settings') {
      const guest = await AsyncStorage.getItem('is_guest');
      if (guest === 'true') {
        onClose();
        Alert.alert("Login Required", "Please login or register to use this feature.");
        return;
      }
    }
    onClose();
    setTimeout(() => {
      navigation.navigate(screen);
    }, 250);
  };

  const handleLogout = async () => {
     try {
      await GoogleSignin.signOut();
    } catch (e) {}

    await AsyncStorage.multiRemove([
      'access_token', 'refresh_token', 'current_task_id', 'is_guest',
      'timer_state', 'timer_end_time', 'timer_total_time', 'timer_time_left', 'timer_phase'
    ]);
    onClose();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
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
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '36%',
          backgroundColor: '#ffffff', zIndex: 101, transform: [{ translateX: drawerAnim }],
          paddingTop: 60, paddingHorizontal: 20, shadowColor: "#000",
          shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
        }}
      >
        <TouchableOpacity 
          className="items-center mb-8" 
          activeOpacity={0.7} 
          onPress={() => handleNavigate('Settings')}
        >
          {userData.avatarUrl ? (
            <Image 
              source={{ uri: userData.avatarUrl }} 
              className="w-20 h-20 rounded-full mb-3"
              style={{ borderWidth: 2, borderColor: '#ce9d7d' }}
            />
          ) : (
            <View className="w-20 h-20 bg-[#ce9d7d] rounded-full items-center justify-center mb-3">
              <MaterialIcons name="person" size={40} color="#ffffff" />
            </View>
          )}

          <Text className="text-[16px] font-bold text-[#1b1c1c] text-center" numberOfLines={1}>
            {userData.username}
          </Text>
          <Text className="text-[12px] text-[#8e706b] text-center mt-0.5" numberOfLines={1}>
            {userData.email}
          </Text>
        </TouchableOpacity>

        <View className="h-[1px] bg-[#e4e2e2] w-full mb-6" />

        <View className="flex-1 space-y-2">
          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Home' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Home')}
          >
            <MaterialIcons name="timer" size={22} color={currentScreen === 'Home' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Home' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Focus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Tasks' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Tasks')}
          >
            <MaterialIcons name="checklist" size={22} color={currentScreen === 'Tasks' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Tasks' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Bookshelf' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Bookshelf')}
          >
            <MaterialIcons name="auto-stories" size={22} color={currentScreen === 'Bookshelf' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Bookshelf' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Bookshelf</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Calendar' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Calendar')}
          >
            <MaterialIcons name="calendar-today" size={22} color={currentScreen === 'Calendar' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Calendar' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Statistics' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Statistics')}
          >
            <MaterialIcons name="leaderboard" size={22} color={currentScreen === 'Statistics' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Statistics' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Statistics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Groups' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Groups')}
          >
            <MaterialIcons name="groups" size={22} color={currentScreen === 'Groups' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Groups' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Store' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Store')}
          >
            <MaterialIcons name="store" size={22} color={currentScreen === 'Store' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Store' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Store</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center px-3 py-2.5 rounded-xl ${currentScreen === 'Settings' ? 'bg-[#ce9d7d]' : ''}`}
            onPress={() => handleNavigate('Settings')}
          >
            <MaterialIcons name="settings" size={22} color={currentScreen === 'Settings' ? '#ffffff' : '#5a413c'} />
            <Text className={`ml-4 font-semibold text-[15px] ${currentScreen === 'Settings' ? 'text-[#ffffff]' : 'text-[#5a413c]'}`}>Settings</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="flex-row items-center px-3 py-4 mb-8 border-t border-[#e4e2e2]" onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color="#ba1a1a" />
          <Text className="ml-3 font-bold text-[15px] text-[#ba1a1a]">Log out</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}