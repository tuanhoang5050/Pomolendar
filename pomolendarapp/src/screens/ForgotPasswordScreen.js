import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ImageBackground, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/accounts/password-reset/request/', { email: email.trim().toLowerCase() });
      navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
    } catch (error) {
      const msg = error.response?.data?.error || 'Unable to send verification code, please try again.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/image/background.png')}
      className="flex-1"
      resizeMode="cover"
    >
      <View className="absolute inset-0 bg-[#fbf9f8]/40" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center justify-center px-6 py-10">

            <View className="items-center mb-8">
              <Text className="text-[20px] font-bold text-[#1b1c1c]">Forgot Password?</Text>
              <Text className="text-[13px] text-[#8e706b] mt-1 text-center px-6">
                Enter your email address and we'll send you a verification code to reset your password.
              </Text>
            </View>

            <View
              className="w-full max-w-md bg-white/95 rounded-[18px] p-6 border border-[#efeded]"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 }}
            >
              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Email</Text>
              <View className="flex-row items-center bg-[#efeded] rounded-xl px-4 mb-6">
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

              <TouchableOpacity
                className="w-full py-2 rounded-3xl items-center shadow-sm"
                style={{ backgroundColor: isLoading ? '#dcb99a' : '#c89d7d' }}
                onPress={handleRequestOtp}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-[16px]">Send Verification Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity className="mt-5 items-center" onPress={() => navigation.goBack()}>
                <Text className="text-[13px] text-[#c89d7d] font-bold">Back to Login</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}