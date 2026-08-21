import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  ImageBackground, Alert, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Image 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Lỗi", "Vui lòng nhập đủ thông tin!");
    
    setIsLoading(true);
    try {
      const response = await api.post('/accounts/login/', { email, password });
      await AsyncStorage.setItem('access_token', response.data.access);
      await AsyncStorage.setItem('refresh_token', response.data.refresh);
      
      navigation.replace('Home');
    } catch (error) {
      Alert.alert("Lỗi", "Sai email hoặc mật khẩu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDV4nr13lrKe5PY76yqR3eQ-kvyePx0_1bPEPezne7TOR1AD0zPWkMr7eaGMh2QNemX1SCQoFq3u9ObF3kG5PZi50Urx8WY7XJLc9mOHZXCCuzvAsIBpZVkoSUsCpYzkxhXxHGvKxi45p7wYfemofQt-M-UmXO3CVcpLfxS_o7DpIY1q5SIWvT8N4KOCQHLFa2EkIGLYqaj8vnxowv0JFKm4AXOLP1C2kL3MBCXz7RscBKmeEoH34AN' }}
      className="flex-1 justify-center p-4"
      resizeMode="cover"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center items-center"
      >
        <View className="w-full max-w-md bg-white/95 rounded-2xl shadow-lg border border-teal-100 p-6 md:p-8 items-center">
          
          <View className="items-center mb-8">
            <Text 
              className="text-5xl font-bold tracking-tighter mb-2"
              style={{
                textShadowColor: 'rgba(0, 105, 106, 0.1)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              }}
            >
              <Text style={{ color: '#008B8C' }}>Pomo</Text>
              <Text style={{ color: '#576867' }}>lendar</Text>
            </Text>
          </View>

          <View className="w-full space-y-4 mb-6">
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-600 mb-1">Email</Text>
              <TextInput 
                className="w-full bg-white border border-teal-500 rounded-lg px-4 py-3 text-gray-900"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-6">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs font-bold text-gray-600">Password</Text>
                <TouchableOpacity>
                  <Text className="text-xs text-teal-700 font-bold">Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput 
                className="w-full bg-white border border-teal-500 rounded-lg px-4 py-3 text-gray-900"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              className={`w-full py-3 rounded-lg items-center ${isLoading ? 'bg-teal-400' : 'bg-teal-700'}`}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">Login</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="w-full flex-row items-center mb-6">
            <View className="flex-1 h-[1px] bg-teal-100" />
            <Text className="px-3 text-xs text-gray-500 uppercase">Or continue with</Text>
            <View className="flex-1 h-[1px] bg-teal-100" />
          </View>

          <View className="w-full">
            <TouchableOpacity className="w-full bg-white border border-teal-100 py-3 rounded-lg flex-row items-center justify-center mb-3">
              <Image 
                source={require('../../assets/icons/google.png')} 
                className="w-5 h-5 mr-2" 
              />
              <Text className="text-gray-900 font-bold">Google</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="w-full bg-teal-20 py-3 rounded-lg flex-row border border-teal-700 items-center justify-center">
              <MaterialIcons name="account-circle" size={20} color="#0d9488" style={{ marginRight: 8 }} />
              <Text className="text-teal-800 font-bold">Guest Mode</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-8 flex-row">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-teal-700 font-bold">Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}