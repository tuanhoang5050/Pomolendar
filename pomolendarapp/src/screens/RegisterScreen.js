import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  ImageBackground, Alert, ActivityIndicator, 
  KeyboardAvoidingView, Platform, ScrollView, Image 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '5610029454-epi05uomijsi8lcorgm3tprjuh8vq9rv.apps.googleusercontent.com',
    });
  }, []);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      return Alert.alert("Error", "Please enter all information!");
    }

    setIsLoading(true);
    try {
      await api.post('/accounts/users/', { 
        name: fullName, 
        email: email, 
        password: password 
      });

      Alert.alert("Success", "Account registered successfully! Please log in.");
      navigation.goBack(); 
    } catch (error) {
      Alert.alert("Error", "Registration failed. Email might already exist or password is too weak.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();

      try {
        await GoogleSignin.signOut();
      } catch (e) {}

      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        Alert.alert("Error", "Could not get login info from Google.");
        return;
      }

      const response = await api.post('/accounts/login/google/', { id_token: idToken });

      await AsyncStorage.removeItem('is_guest');
      await AsyncStorage.setItem('access_token', response.data.access);
      await AsyncStorage.setItem('refresh_token', response.data.refresh);

      navigation.replace('Home');
    } catch (error) {
      console.log('Detailed error:', error);

      if (error.code === 'SIGN_IN_CANCELLED') {
      } else {
        Alert.alert('Login error', `Error code: ${error.code} \nDetails: ${error.message}`);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuestMode = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    await AsyncStorage.setItem('is_guest', 'true');
    navigation.replace('Home');
  };

  return (
    <ImageBackground
      source={require('../../assets/image/background.png')}
      className="flex-1"
      resizeMode="cover"
    >
      <View className="absolute inset-0 bg-[#fbf9f8]/40" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center justify-center px-6 py-10">

            <View className="items-center mb-8">
              <View
                className="w-20 h-20 rounded-[28px] bg-[#c89d7d] items-center justify-center mb-4"
                style={{ shadowColor: '#c89d7d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }}
              >
                <MaterialIcons name="auto-stories" size={38} color="#ffffff" />
              </View>
            </View>

            <View
              className="w-full max-w-md bg-white/95 rounded-[28px] p-6 border border-[#efeded] mb-6"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 }}
            >
              
              <View className="mb-4">
                <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Full Name</Text>
                <View className="flex-row items-center bg-[#efeded] rounded-xl px-4">
                  <MaterialIcons name="person-outline" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                  <TextInput
                    className="flex-1 py-3.5 text-[15px] font-medium text-[#1b1c1c]"
                    placeholder="Your Name"
                    placeholderTextColor="#a09b95"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Email</Text>
                <View className="flex-row items-center bg-[#efeded] rounded-xl px-4">
                  <MaterialIcons name="mail-outline" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                  <TextInput
                    className="flex-1 py-3.5 text-[15px] font-medium text-[#1b1c1c]"
                    placeholder="you@example.com"
                    placeholderTextColor="#a09b95"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View className="mb-2">
                <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Password</Text>
                <View className="flex-row items-center bg-[#efeded] rounded-xl px-4">
                  <MaterialIcons name="lock-outline" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                  <TextInput
                    className="flex-1 py-3.5 text-[15px] font-medium text-[#1b1c1c]"
                    placeholder="••••••••"
                    placeholderTextColor="#a09b95"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                    <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={18} color="#a09b95" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                className="w-full py-2 rounded-3xl items-center mt-6 shadow-sm"
                style={{ backgroundColor: isLoading ? '#dcb99a' : '#c89d7d' }}
                onPress={handleRegister}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-[16px]">Sign Up</Text>
                )}
              </TouchableOpacity>

              <View className="w-full flex-row items-center my-6">
                <View className="flex-1 h-[1px] bg-[#e4e2e2]" />
                <Text className="px-3 text-[11px] font-bold text-[#a09b95] uppercase tracking-wider">Or</Text>
                <View className="flex-1 h-[1px] bg-[#e4e2e2]" />
              </View>

              <TouchableOpacity
                className="w-full bg-white border border-[#e4e2e2] py-2 rounded-3xl flex-row items-center justify-center mb-3 active:bg-[#f5f3f3]"
                onPress={handleGoogleRegister}
                disabled={isGoogleLoading}
                activeOpacity={0.85}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#c89d7d" />
                ) : (
                  <>
                    <Image
                      source={require('../../assets/icons/google.png')}
                      className="w-5 h-5 mr-2"
                    />
                    <Text className="text-[#1b1c1c] font-bold text-[15px]">Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full py-2 rounded-3xl flex-row border border-[#c89d7d]/40 items-center justify-center bg-[#c89d7d]/5 active:bg-[#c89d7d]/10"
                onPress={handleGuestMode}
                activeOpacity={0.85}
              >
                <MaterialIcons name="account-circle" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                <Text className="text-[#8e6a4f] font-bold text-[15px]">Continue as Guest</Text>
              </TouchableOpacity>

              <View className="mt-6 flex-row justify-center">
                <Text className="text-[13px] text-[#8e706b]">Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text className="text-[13px] text-[#c89d7d] font-bold">Log In</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}