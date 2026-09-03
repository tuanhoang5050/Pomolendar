import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ImageBackground, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordScreen({ navigation, route }) {
  const email = route.params?.email || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleResetPassword = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/accounts/password-reset/confirm/', {
        email,
        code: code.trim(),
        new_password: newPassword,
      });
      Alert.alert('Success', 'Your password has been reset. Please log in again.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      const msg = error.response?.data?.error || 'Unable to reset password, please try again.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setIsResending(true);
    try {
      await api.post('/accounts/password-reset/request/', { email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      const msg = error.response?.data?.error || 'Unable to resend code, please try again later.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setIsResending(false);
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
              <Text className="text-[20px] font-bold text-[#1b1c1c]">Enter Verification Code</Text>
              <Text className="text-[13px] text-[#8e706b] mt-1 text-center px-6">
                A 6-digit code has been sent to{'\n'}
                <Text className="font-bold text-[#5a413c]">{email}</Text>
              </Text>
            </View>

            <View
              className="w-full max-w-md bg-white/95 rounded-[18px] p-6 border border-[#efeded]"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 }}
            >
              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Verification Code</Text>
              <View className="flex-row items-center bg-[#efeded] rounded-xl px-4 mb-4">
                <MaterialIcons name="pin" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                <TextInput
                  className="flex-1 py-3.5 text-[15px] font-bold text-[#1b1c1c] tracking-widest"
                  placeholder="000000"
                  placeholderTextColor="#a09b95"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">New Password</Text>
              <View className="flex-row items-center bg-[#efeded] rounded-xl px-4 mb-4">
                <MaterialIcons name="lock-outline" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                <TextInput
                  className="flex-1 py-3.5 text-[15px] font-medium text-[#1b1c1c]"
                  placeholder="••••••••"
                  placeholderTextColor="#a09b95"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color="#a09b95" />
                </TouchableOpacity>
              </View>

              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Confirm Password</Text>
              <View className="flex-row items-center bg-[#efeded] rounded-xl px-4 mb-6">
                <MaterialIcons name="lock-outline" size={18} color="#c89d7d" style={{ marginRight: 8 }} />
                <TextInput
                  className="flex-1 py-3.5 text-[15px] font-medium text-[#1b1c1c]"
                  placeholder="••••••••"
                  placeholderTextColor="#a09b95"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                className="w-full py-2 rounded-3xl items-center shadow-sm"
                style={{ backgroundColor: isLoading ? '#dcb99a' : '#c89d7d' }}
                onPress={handleResetPassword}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-[16px]">Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-5 items-center"
                onPress={handleResendOtp}
                disabled={cooldown > 0 || isResending}
              >
                {isResending ? (
                  <ActivityIndicator color="#c89d7d" size="small" />
                ) : (
                  <Text className={`text-[13px] font-bold ${cooldown > 0 ? 'text-[#a09b95]' : 'text-[#c89d7d]'}`}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}