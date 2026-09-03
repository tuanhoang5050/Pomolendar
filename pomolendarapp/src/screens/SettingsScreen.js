import React, { useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator,
  Modal, StyleSheet, TextInput, Image, ImageBackground, Platform, KeyboardAvoidingView, Alert 
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import CustomDrawer from '../components/CustomDrawer';
import api from '../services/api';

export default function SettingsScreen({ navigation }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  
  const [profile, setProfile] = useState({
    name: 'User',
    email: 'user@pomolendar.com',
    avatar: null 
  });

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [tempAvatar, setTempAvatar] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          if (token) {
            setIsGuest(false);
            const response = await api.get('/accounts/users/profile/');
            setProfile({
              name: response.data.name || 'User',
              email: response.data.email,
              avatar: response.data.avatar
            });
          } else {
            setIsGuest(true);
          }
        } catch (error) {
          setIsGuest(true);
        }
      };
      fetchProfile();
    }, [])
  );

  const handleOpenEditProfile = () => {
    setEditName(profile.name);
    setTempAvatar(profile.avatar);
    setIsEditProfileOpen(true);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission", "We need access to your photo library to change the avatar.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setTempAvatar(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('name', editName);

      if (tempAvatar && tempAvatar !== profile.avatar) {
        const filename = tempAvatar.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('avatar', {
          uri: Platform.OS === 'ios' ? tempAvatar.replace('file://', '') : tempAvatar,
          name: filename,
          type: type,
        });
      }

      const response = await api.patch('/accounts/users/profile/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile(prev => ({ 
        ...prev, 
        name: response.data.name,
        avatar: response.data.avatar 
      }));
      setIsEditProfileOpen(false);
      Alert.alert("Success", "Profile updated.");
    } catch (error) {
      Alert.alert("Error", "Could not update profile, please try again later.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    Alert.alert("Error", "Please fill in all fields.");
    return;
  }
  if (newPassword !== confirmPassword) {
    Alert.alert("Error", "New passwords do not match.");
    return;
  }
 
  setIsChangingPassword(true);
  try {
    await api.post('/accounts/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
 
    setIsChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert("Success", "Password updated.");
  } catch (error) {
    const msg = error.response?.data?.error || 'Could not update password, please try again.';
    Alert.alert("Error", Array.isArray(msg) ? msg.join('\n') : msg);
  } finally {
    setIsChangingPassword(false);
  }
};

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            try {
               await GoogleSignin.signOut();
            } catch (e) {}
            
            await AsyncStorage.multiRemove([
              'access_token', 'refresh_token', 'current_task_id', 'is_guest',
              'timer_state', 'timer_end_time', 'timer_total_time', 'timer_time_left', 'timer_phase'
            ]);
            setIsGuest(true);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  };

  const MenuItem = ({ iconFamily = 'Feather', icon, title, value, color, valueColor, onPress, isLast, isDanger }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : Feather;
    const contentColor = isDanger ? '#ba1a1a' : (color || '#3d3b38');
    const iconColor = isDanger ? '#ba1a1a' : (color || '#a09b95');
    const valColor = valueColor || '#a09b95';

    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={onPress}
        className={`flex-row items-center justify-between py-4 ${isLast ? '' : 'border-b border-[#f5f3f3]'}`}
      >
        <View className="flex-row items-center gap-4">
          <IconComponent name={icon} size={20} color={iconColor} />
          <Text style={{ color: contentColor, fontSize: 16, fontWeight: '500' }}>
            {title}
          </Text>
        </View>
        {value ? (
          <Text style={{ color: valColor, fontSize: 12, textAlign: 'right', lineHeight: 18, fontWeight: '500' }}>
            {value}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover"
    >      
      <View className="bg-white rounded-b-[12px] z-10" style={styles.headerShadow}>
        <SafeAreaView>
          <View className="flex-row items-center px-4 h-12 mt-7">
            <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={() => setIsDrawerOpen(true)}>
              <MaterialIcons name="menu" size={28} color="#ce9d7d" />
            </TouchableOpacity>
          </View>
          <Text className="text-[32px] font-bold text-[#3d3b38] px-5 pb-5 mt-1">Settings</Text>
        </SafeAreaView>
      </View>

      <ScrollView 
        className="flex-1 pt-6" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text className="text-[14px] font-bold text-[#8e706b] mb-3 ml-1">Account</Text>
        <View className="bg-white rounded-[12px] px-5 mb-6 shadow-sm border border-[#e4e2e2]/40">
          <MenuItem 
            icon="user" 
            title={isGuest ? "Log in" : profile.name} 
            value={isGuest ? "" : profile.email} 
            valueColor="#c89d7d" 
            onPress={() => isGuest ? navigation.navigate('Login') : handleOpenEditProfile()} 
          />
          <MenuItem 
            icon="cloud" 
            title="Sync" 
            value={isGuest ? "" : `2026/08/24\n10:38:48`} 
            onPress={() => isGuest ? Alert.alert("Sync", "Please log in to sync your data.") : Alert.alert("Sync", "Data is synced to the Cloud.")} 
          />
          <MenuItem 
            icon="award" 
            title="Pro version" 
            color="#c89d7d" 
            isLast 
            onPress={() => {}} 
          />
        </View>

        <Text className="text-[14px] font-bold text-[#8e706b] mb-3 ml-1">Settings</Text>
        <View className="bg-white rounded-[20px] px-5 mb-6 shadow-sm border border-[#e4e2e2]/40">
          <MenuItem icon="layout" title="Theme" onPress={() => {}} />
          <MenuItem iconFamily="MaterialIcons" icon="font-download" title="Language" onPress={() => {}} />
          <MenuItem icon="share-2" title="Improve focus" isLast onPress={() => {}} />
        </View>

        <Text className="text-[14px] font-bold text-[#8e706b] mb-3 ml-1">About us</Text>
        <View className={`bg-white rounded-[20px] px-5 shadow-sm border border-[#e4e2e2]/40 ${isGuest ? 'mb-12' : 'mb-6'}`}>
          <MenuItem icon="help-circle" title="FAQ" onPress={() => {}} />
          <MenuItem icon="lock" title="Privacy policy" onPress={() => {}} />
          <MenuItem icon="heart" title="Like us" onPress={() => {}} />
          <MenuItem icon="star" title="Rate us" onPress={() => {}} />
          <MenuItem icon="message-circle" title="Community" onPress={() => {}} />
          <MenuItem 
            icon="arrow-up-circle" title="Send log" value={`V1.8.2\n607201514`} isLast 
            onPress={() => setIsAboutOpen(true)} 
          />
        </View>

        {!isGuest && (
          <View className="bg-white rounded-[20px] px-5 mb-12 shadow-sm border border-[#e4e2e2]/40">
            <MenuItem 
              icon="log-out" 
              title="Log out" 
              isDanger 
              isLast 
              onPress={handleLogout} 
            />
          </View>
        )}

      </ScrollView>

      <CustomDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        navigation={navigation} 
        currentScreen="Settings" 
      />

      <Modal visible={isEditProfileOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="w-11/12">
            <View className="bg-white rounded-[24px] p-6">
              <Text className="text-[18px] font-bold text-[#1b1c1c] mb-6 text-center">Account Profile</Text>
              
              <TouchableOpacity className="items-center mb-6" onPress={handlePickImage} activeOpacity={0.7}>
                <View className="w-20 h-20 bg-[#f5f3f3] rounded-full items-center justify-center overflow-hidden border-2 border-[#e4e2e2]">
                  {tempAvatar ? (
                    <Image source={{ uri: tempAvatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Feather name="camera" size={24} color="#a09b95" />
                  )}
                </View>
                <Text className="text-[13px] font-medium text-[#c89d7d] mt-2">Change picture</Text>
              </TouchableOpacity>

              <Text className="text-[13px] font-bold text-[#8e706b] mb-1 ml-1">Display Name</Text>
              <TextInput 
                className="bg-[#f5f3f3] rounded-xl px-4 py-3 text-[16px] text-[#1b1c1c] font-medium mb-4"
                value={editName}
                onChangeText={setEditName}
              />

              <TouchableOpacity 
                className="flex-row items-center justify-between bg-[#f5f3f3] rounded-xl px-4 py-3 mb-6"
                onPress={() => {
                  setIsEditProfileOpen(false);
                  setTimeout(() => setIsChangePasswordOpen(true), 300);
                }}
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="lock" size={18} color="#5a413c" />
                  <Text className="text-[15px] font-medium text-[#1b1c1c]">Change password</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#a09b95" />
              </TouchableOpacity>

              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => setIsEditProfileOpen(false)} className="flex-1 py-1.5 rounded-3xl border border-[#e4e2e2] items-center">
                  <Text className="text-[16px] font-bold text-[#8e706b]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSaveProfile} 
                  disabled={isSavingProfile}
                  className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"
                  style={{ opacity: isSavingProfile ? 0.7 : 1 }}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-[16px] font-bold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isChangePasswordOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="w-11/12">
            <View className="bg-white rounded-[24px] p-6">
              <Text className="text-[18px] font-bold text-[#1b1c1c] mb-6 text-center">Change Password</Text>
              
              <TextInput 
                className="bg-[#f5f3f3] rounded-xl px-4 py-3 text-[15px] text-[#1b1c1c] mb-4"
                placeholder="Current password"
                placeholderTextColor="#a09b95"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput 
                className="bg-[#f5f3f3] rounded-xl px-4 py-3 text-[15px] text-[#1b1c1c] mb-4"
                placeholder="New password"
                placeholderTextColor="#a09b95"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput 
                className="bg-[#f5f3f3] rounded-xl px-4 py-3 text-[15px] text-[#1b1c1c] mb-6"
                placeholder="Confirm new password"
                placeholderTextColor="#a09b95"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => setIsChangePasswordOpen(false)} className="flex-1 py-1.5 rounded-3xl border border-[#e4e2e2] items-center">
                  <Text className="text-[16px] font-bold text-[#8e706b]">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleSavePassword} 
                  disabled={isChangingPassword}
                  className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"
                  style={{ opacity: isChangingPassword ? 0.7 : 1 }}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-[16px] font-bold text-white">Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isAboutOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View className="bg-white w-11/12 rounded-[24px] p-6 items-center">
            <View className="w-20 h-20 bg-[#ce9d7d] rounded-2xl items-center justify-center shadow-sm mb-4">
              <Feather name="target" size={36} color="#ffffff" />
            </View>
            <Text className="text-[22px] font-bold text-[#1b1c1c] mb-1">Pomolendar</Text>
            <Text className="text-[14px] font-medium text-[#8e706b] mb-4">Version 1.8.2</Text>
            
            <Text className="text-[15px] text-[#5a413c] text-center leading-6 mb-6">
              An effective time and task management app that combines the Pomodoro method with a Gamification system to keep you motivated.
            </Text>

            <TouchableOpacity onPress={() => setIsAboutOpen(false)} className="w-full bg-[#f5f3f3] py-3.5 rounded-xl items-center">
              <Text className="text-[16px] font-bold text-[#1b1c1c]">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ImageBackground>
    
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 4,
  }
});