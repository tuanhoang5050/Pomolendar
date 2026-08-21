import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  ImageBackground, Alert, ActivityIndicator, 
  KeyboardAvoidingView, Platform, ScrollView, Image 
} from 'react-native';
// Bổ sung thư viện icon có sẵn của Expo
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      return Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin!");
    }
    
    setIsLoading(true);
    try {
      await api.post('/accounts/users/', { 
        name: fullName, 
        email: email, 
        password: password 
      });
      
      Alert.alert("Thành công", "Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
      navigation.goBack(); 
    } catch (error) {
      Alert.alert("Lỗi", "Đăng ký thất bại. Email có thể đã tồn tại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAumnqDe5QoAhAxQuUPt5-fYlJMosa3Z05GCw4FgP_dy0dv4FggQMC7pL2-TcvVdj2P04Jpp4r3ZBBXwF7Bj4cTZy2QWvtwuxdEBVLI4wkM_-LwHhcFugMBG_YCMjOVI4B5elrU2w1XCztmrsRBD6RfY839yaRN3wTee5Cz4T0JIY6QjVMbDoBHdADEoouuYr8A2qUovS2tw9I28l_IiJi8s3iEgZhn2FleA31k4Io6JXVDFi9SNhvV' }}
      className="flex-1"
      resizeMode="cover"
    >
      <View className="absolute inset-0 bg-teal-900/20" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
          
          {/* Logo Brand */}
          <View className="mb-8 mt-8 text-center items-center">
            <Text 
              className="text-5xl font-bold tracking-tighter"
              style={{
                textShadowColor: 'rgba(0, 105, 106, 0.2)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              }}
            >
              <Text style={{ color: '#008B8C' }}>Pomo</Text>
              <Text style={{ color: '#576867' }}>lendar</Text>
            </Text>
          </View>

          {/* Form Container */}
          <View className="w-full bg-white/95 rounded-2xl p-6 shadow-lg border border-teal-100 mb-6">
            
            <View className="items-center mb-6">
              <Text className="text-2xl font-bold text-gray-800">Create Account</Text>
              <Text className="text-gray-500 mt-1">Start your productive journey today.</Text>
            </View>

            {/* Input: Full Name */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Full Name</Text>
              <View className="flex-row items-center bg-white border border-teal-500 rounded-lg px-3">
                <MaterialIcons name="person" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput 
                  className="flex-1 py-3 text-gray-900"
                  placeholder="your name"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Input: Email */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email</Text>
              <View className="flex-row items-center bg-white border border-teal-500 rounded-lg px-3">
                <MaterialIcons name="mail" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput 
                  className="flex-1 py-3 text-gray-900"
                  placeholder="youprettyexample.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Input: Password */}
            <View className="mb-6">
              <Text className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</Text>
              <View className="flex-row items-center bg-white border border-teal-500 rounded-lg px-3">
                <MaterialIcons name="lock" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput 
                  className="flex-1 py-3 text-gray-900"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity 
              className={`w-full py-3 rounded-lg flex-row justify-center items-center ${isLoading ? 'bg-teal-400' : 'bg-teal-700'}`}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text className="text-white font-bold text-base mr-2">Sign Up</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="w-full flex-row items-center my-6">
              <View className="flex-1 h-[1px] bg-teal-100" />
              <Text className="px-4 text-xs text-gray-400 uppercase tracking-wider">or continue with</Text>
              <View className="flex-1 h-[1px] bg-teal-100" />
            </View>

            {/* Alternative Options */}
            <View className="w-full space-y-3">
              {/* Google Button */}
              <TouchableOpacity className="w-full bg-gray-50 border border-teal-100 py-3 rounded-lg flex-row items-center justify-center mb-3">
                <Image 
                  source={require('../../assets/icons/google.png')}  
                  className="w-5 h-5 mr-2" 
                />
                <Text className="text-gray-800 font-bold">Google</Text>
              </TouchableOpacity>
              
              {/* Guest Mode Button */}
              <TouchableOpacity className="w-full bg-transparent border border-teal-600 py-3 rounded-lg flex-row items-center justify-center">
                <MaterialIcons name="account-circle" size={20} color="#0d9488" style={{ marginRight: 8 }} />
                <Text className="text-teal-700 font-bold">Guest Mode</Text>
              </TouchableOpacity>
            </View>

            {/* Login Link */}
            <View className="mt-6 flex-row justify-center">
              <Text className="text-gray-500">Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text className="text-teal-600 font-bold">Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}