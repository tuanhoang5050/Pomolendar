import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, KeyboardAvoidingView, Animated, Dimensions, StyleSheet, TouchableWithoutFeedback, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import WheelPicker from '../components/WheelPicker';

const { width, height } = Dimensions.get('window');
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

export default function TaskDetailScreen({ navigation, route }) {
  const taskId = route.params?.taskId;

  const [loading, setLoading] = useState(true);
  const [taskData, setTaskData] = useState(null);
  
  const [notes, setNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [pomoCount, setPomoCount] = useState(4);
  const [pomoDuration, setPomoDuration] = useState(25);
  const [repeatOption, setRepeatOption] = useState('none');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [isPomoPickerOpen, setIsPomoPickerOpen] = useState(false);
  const [isRepeatPickerOpen, setIsRepeatPickerOpen] = useState(false);
  const [isPriorityPickerOpen, setIsPriorityPickerOpen] = useState(false);

  const [tempDeadlineDay, setTempDeadlineDay] = useState(new Date().getDate());
  const [tempDeadlineQuick, setTempDeadlineQuick] = useState('');
  
  const [tempReminderDay, setTempReminderDay] = useState(new Date().getDate());
  const [tempReminderHour, setTempReminderHour] = useState('09');
  const [tempReminderMinute, setTempReminderMinute] = useState('00');
  const [tempReminderQuick, setTempReminderQuick] = useState('');

  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const datePickerAnim = useRef(new Animated.Value(height)).current;
  const reminderPickerAnim = useRef(new Animated.Value(height)).current;
  const pomoPickerAnim = useRef(new Animated.Value(height)).current;
  const repeatPickerAnim = useRef(new Animated.Value(height)).current;
  const priorityPickerAnim = useRef(new Animated.Value(height)).current;

  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchTaskDetail();
    Animated.loop(Animated.timing(pulseAnim1, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
    setTimeout(() => {
      Animated.loop(Animated.timing(pulseAnim2, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
    }, 1000);
  }, [taskId]);

  const fetchTaskDetail = async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get(`/planner/tasks/${taskId}/`);
      applyData(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết công việc.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const applyData = (data) => {
    setTaskData(data);
    setIsCompleted(data.is_completed);
    setNotes(data.description || data.note || '');
    setPomoCount(data.estimated_pomodoros || 1);
    setPomoDuration(data.focus_duration || 25);
    
    if (data.deadline) {
      setTempDeadlineDay(new Date(data.deadline).getDate());
    }
    if (data.reminder) {
      const d = new Date(data.reminder);
      setTempReminderDay(d.getDate());
      setTempReminderHour(d.getHours().toString().padStart(2, '0'));
      setTempReminderMinute(d.getMinutes().toString().padStart(2, '0'));
    }
  };

  const updateTask = async (updates) => {
    if (!taskId) return;
    try {
      const response = await api.patch(`/planner/tasks/${taskId}/`, updates);
      
      if (updates.is_completed && response.data.gamification) {
        const gami = response.data.gamification;
        let msg = `⭐ Điểm nhận được: +${gami.points_earned}`;
        if (gami.leveled_up) {
           msg += `\n\n🎉 Bạn đã nhận thêm 1 cuốn sách mới vào tủ sách!`;
        }
        Alert.alert("Hoàn thành công việc!", msg);
      }

      fetchTaskDetail();
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể cập nhật công việc.');
    }
  };

  const handleDeleteTask = async () => {
    Alert.alert(
      "Xóa Task",
      "Bạn có chắc chắn muốn xóa công việc này không?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/planner/tasks/${taskId}/`);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Lỗi", "Không thể xóa công việc.");
            }
          }
        }
      ]
    );
  };

  const handleToggleComplete = () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    updateTask({ is_completed: newVal });
  };

  const handleNotesChange = (text) => {
    setNotes(text);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (taskId) api.patch(`/planner/tasks/${taskId}/`, { description: text, note: text }).catch(() => {});
    }, 500);
  };

  const handleGoBack = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (taskData && notes !== (taskData.description || taskData.note || '')) {
      api.patch(`/planner/tasks/${taskId}/`, { description: notes, note: notes }).catch(() => {});
    }
    navigation.goBack();
  };

  const savePomodoroSettings = () => {
    updateTask({ estimated_pomodoros: pomoCount, focus_duration: pomoDuration });
    closePomoPicker();
  };

  const handleSaveDeadline = () => {
    let newDeadline = null;
    if (tempDeadlineQuick !== 'Xóa hạn' && tempDeadlineDay) {
      const d = new Date();
      if (tempDeadlineQuick === 'Trong 7 ngày') d.setDate(new Date().getDate() + 7);
      else if (tempDeadlineQuick === 'Ngày mai') d.setDate(new Date().getDate() + 1);
      else if (tempDeadlineQuick === 'Hôm nay') d.setDate(new Date().getDate());
      else d.setDate(tempDeadlineDay);
      newDeadline = d.toISOString();
    }
    updateTask({ deadline: newDeadline });
    closeDatePicker();
  };

  const handleReminderQuickSelect = (type) => {
    setTempReminderQuick(type);
    if (taskData?.deadline && (type === '5 min' || type === '10 min' || type === 'At time')) {
      const d = new Date(taskData.deadline);
      if (type === '5 min') d.setMinutes(d.getMinutes() - 5);
      if (type === '10 min') d.setMinutes(d.getMinutes() - 10);
      setTempReminderDay(d.getDate());
      setTempReminderHour(d.getHours().toString().padStart(2, '0'));
      setTempReminderMinute(d.getMinutes().toString().padStart(2, '0'));
    }
  };

  const handleSaveReminder = () => {
    let newReminder = null;
    if (tempReminderDay) {
       const d = new Date();
       d.setDate(tempReminderDay);
       d.setHours(parseInt(tempReminderHour || 0));
       d.setMinutes(parseInt(tempReminderMinute || 0));
       d.setSeconds(0);
       newReminder = d.toISOString();
    }
    updateTask({ reminder: newReminder });
    closeReminderPicker();
  };

  const handleSavePriority = (newPriority) => {
    updateTask({ priority: newPriority });
    closePriorityPicker();
  };

  const openDatePicker = () => { setIsDatePickerOpen(true); Animated.timing(datePickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeDatePicker = () => { Animated.timing(datePickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsDatePickerOpen(false)); };
  
  const openReminderPicker = () => { setIsReminderPickerOpen(true); Animated.timing(reminderPickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeReminderPicker = () => { Animated.timing(reminderPickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsReminderPickerOpen(false)); };
  
  const openPomoPicker = () => { setIsPomoPickerOpen(true); Animated.timing(pomoPickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closePomoPicker = () => { Animated.timing(pomoPickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsPomoPickerOpen(false)); };
  
  const openRepeatPicker = () => { setIsRepeatPickerOpen(true); Animated.timing(repeatPickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeRepeatPicker = () => { Animated.timing(repeatPickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsRepeatPickerOpen(false)); };

  const openPriorityPicker = () => { setIsPriorityPickerOpen(true); Animated.timing(priorityPickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closePriorityPicker = () => { Animated.timing(priorityPickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsPriorityPickerOpen(false)); };

  const handleStartTimer = async () => {
    if (taskId) {
      try { await AsyncStorage.setItem('current_task_id', taskId.toString()); } catch (e) {}
    }
    fadeAnim.setValue(1);
    Animated.timing(expandAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    setTimeout(() => {
      navigation.navigate('Home');
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        expandAnim.setValue(0);
        fadeAnim.setValue(1);
      });
    }, 400);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Chưa đặt';
    const d = new Date(dateString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getPriorityStyle = (p) => {
    if (isCompleted) return { bg: 'bg-[#e4e2e2]', text: 'text-[#5a413c]', label: 'Completed' };
    switch (p) {
      case 3: return { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', label: 'High Priority' };
      case 2: return { bg: 'bg-[#00a7a8]', text: 'text-[#003535]', label: 'Medium Priority' };
      case 1: return { bg: 'bg-[#7cf8dd]', text: 'text-[#007261]', label: 'Low Priority' };
      default: return { bg: 'bg-[#00a7a8]', text: 'text-[#003535]', label: 'Priority' };
    }
  };

  const getRepeatIconBg = (id) => repeatOption === id ? 'bg-[#008b8c]/20' : 'bg-[#e4e2e2]';
  const getRepeatIconColor = (id) => repeatOption === id ? '#008b8c' : '#5a413c';

  if (loading || !taskData) {
    return (
      <SafeAreaView className="flex-1 bg-[#fbf9f8] justify-center items-center">
        <ActivityIndicator size="large" color="#008b8c" />
      </SafeAreaView>
    );
  }

  const pStyle = getPriorityStyle(taskData.priority);

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-row items-center justify-between px-5 h-16 mt-6 bg-[#fbf9f8] z-10">
            <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleGoBack}>
              <MaterialIcons name="chevron-left" size={32} color="#008b8c" />
            </TouchableOpacity>
            <View className="flex-row gap-1">
              <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleStartTimer} disabled={isCompleted}>
                <MaterialIcons name="play-arrow" size={26} color={isCompleted ? "#e2bfb8" : "#008b8c"} />
              </TouchableOpacity>
              <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleDeleteTask}>
                <MaterialIcons name="delete" size={22} color="#008b8c" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="px-5 mt-4 mb-8">
              <View className="flex-row items-center gap-3 mb-4">
                <TouchableOpacity 
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isCompleted ? 'bg-[#008b8c] border-[#008b8c]' : 'border-[#008b8c]'}`}
                  onPress={handleToggleComplete}
                >
                  {isCompleted && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`${pStyle.bg} px-2 py-1 rounded`}
                  onPress={openPriorityPicker}
                  disabled={isCompleted}
                >
                  <Text className={`${pStyle.text} text-[10px] font-bold uppercase tracking-widest`}>{pStyle.label}</Text>
                </TouchableOpacity>
              </View>
              <Text className={`text-[28px] font-bold ${isCompleted ? 'text-[#8e706b] line-through' : 'text-[#1b1c1c]'}`}>
                {taskData.title}
              </Text>
            </View>

            <View className="px-3 gap-2">
              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={openPomoPicker}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#008b8c]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="timer" size={20} color="#008b8c" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Pomodoros</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  {[...Array(Math.min(taskData.completed_pomodoros || 0, 4))].map((_, i) => (
                    <MaterialIcons key={`c-${i}`} name="timer" size={18} color="#008b8c" />
                  ))}
                  {[...Array(Math.min(Math.max((taskData.estimated_pomodoros || 1) - (taskData.completed_pomodoros || 0), 0), 4 - Math.min(taskData.completed_pomodoros || 0, 4)))].map((_, i) => (
                    <MaterialIcons key={`u-${i}`} name="timer" size={18} color="#e2bfb8" />
                  ))}
                  {(taskData.estimated_pomodoros || 1) > 4 && (
                    <Text className="text-[14px] font-bold text-[#008b8c]">+{taskData.estimated_pomodoros - 4}</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={openDatePicker}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#008b8c]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="calendar-today" size={20} color="#008b8c" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Due Date</Text>
                </View>
                <Text className="text-[14px] font-bold text-[#1b1c1c]">{taskData.deadline ? formatDateTime(taskData.deadline).split(', ')[1] : 'Chưa đặt'}</Text>
              </TouchableOpacity>

              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={openReminderPicker}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#008b8c]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="notifications" size={20} color="#008b8c" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Reminder</Text>
                </View>
                <Text className="text-[14px] text-[#5a413c]">{taskData.reminder ? formatDateTime(taskData.reminder) : 'Chưa đặt'}</Text>
              </TouchableOpacity>

              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={openRepeatPicker}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#008b8c]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="repeat" size={20} color="#008b8c" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Repeat</Text>
                </View>
                <Text className="text-[14px] text-[#5a413c]">Không</Text>
              </TouchableOpacity>
            </View>

            <View className="px-3 mt-3 mb-32">
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <MaterialIcons name="notes" size={20} color="#008b8c" />
                <Text className="text-[14px] font-bold text-[#5a413c]">Ghi chú & Mô tả</Text>
              </View>
              <View className="w-full bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] min-h-[120px]">
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#008b8c]" />
                <TextInput
                  className="flex-1 p-4 text-[16px] text-[#1b1c1c]"
                  placeholder="Thêm ghi chú hoặc chi tiết mô tả..."
                  placeholderTextColor="#5a413c80"
                  multiline
                  textAlignVertical="top"
                  value={notes}
                  onChangeText={handleNotesChange}
                />
              </View>
            </View>
          </ScrollView>

          {!isCompleted && (
            <>
              <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#008b8c', transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
              <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#008b8c', transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
            </>
          )}

          <Animated.View style={{ position: 'absolute', bottom: 72, left: width / 2, width: 2, height: 2, borderRadius: 1, backgroundColor: '#008B8C', transform: [{ translateX: -1 }, { scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1500] }) }], opacity: fadeAnim, zIndex: 60, pointerEvents: 'none' }} />

          <TouchableOpacity 
            className={`absolute bottom-10 left-1/2 w-16 h-16 rounded-full items-center justify-center shadow-lg z-50 border border-white/30 ${isCompleted ? 'bg-[#e4e2e2]' : 'bg-[#008b8c]'}`}
            style={{ elevation: 8, transform: [{ translateX: -32 }] }}
            onPress={handleStartTimer}
            activeOpacity={0.9}
            disabled={isCompleted}
          >
            <MaterialIcons name={isCompleted ? "check" : "play-arrow"} size={32} color={isCompleted ? "#5a413c" : "#ffffff"} />
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {(isDatePickerOpen || isReminderPickerOpen || isPomoPickerOpen || isRepeatPickerOpen || isPriorityPickerOpen) && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents="auto">
          <TouchableWithoutFeedback onPress={() => {
            if (isDatePickerOpen) closeDatePicker();
            if (isReminderPickerOpen) closeReminderPicker();
            if (isPomoPickerOpen) savePomodoroSettings();
            if (isRepeatPickerOpen) closeRepeatPicker();
            if (isPriorityPickerOpen) closePriorityPicker();
          }}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(27, 28, 28, 0.4)' }]} />
          </TouchableWithoutFeedback>
        </View>
      )}

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: datePickerAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
        <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
          <Text className="text-[24px] font-bold text-[#1b1c1c]">Chọn ngày hạn</Text>
          <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeDatePicker}><MaterialIcons name="close" size={20} color="#008b8c" /></TouchableOpacity>
        </View>
        <View className="px-6 py-6 flex-col gap-6">
          <View className="flex-row flex-wrap justify-between gap-y-2 mb-1">
            <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Hôm nay' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Hôm nay'); setTempDeadlineDay(new Date().getDate()); }}>
              <MaterialIcons name="today" size={20} color={tempDeadlineQuick === 'Hôm nay' ? '#ffffff' : '#008b8c'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Hôm nay' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Hôm nay</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Ngày mai' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Ngày mai'); const t = new Date(); t.setDate(t.getDate() + 1); setTempDeadlineDay(t.getDate()); }}>
              <MaterialIcons name="event" size={20} color={tempDeadlineQuick === 'Ngày mai' ? '#ffffff' : '#008b8c'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Ngày mai' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Ngày mai</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Trong 7 ngày' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Trong 7 ngày'); const t = new Date(); t.setDate(t.getDate() + 7); setTempDeadlineDay(t.getDate()); }}>
              <MaterialIcons name="date-range" size={20} color={tempDeadlineQuick === 'Trong 7 ngày' ? '#ffffff' : '#008b8c'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Trong 7 ngày' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trong 7 ngày</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Xóa hạn' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Xóa hạn'); setTempDeadlineDay(null); }}>
              <MaterialIcons name="calendar-today" size={20} color={tempDeadlineQuick === 'Xóa hạn' ? '#ffffff' : '#008b8c'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Xóa hạn' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Xóa hạn</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-col gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-[#008b8c] uppercase tracking-wider">Tháng hiện tại</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#008b8c" /></TouchableOpacity>
                <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#008b8c" /></TouchableOpacity>
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between px-2">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, i) => (<View key={i} className="w-[13%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
              <View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" />
              {[...Array(31)].map((_, i) => {
                const day = i + 1; const isSelected = day === tempDeadlineDay;
                return (
                  <View key={day} className="w-[13%] items-center mb-2">
                    <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#008b8c] shadow-md' : 'active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineDay(day); setTempDeadlineQuick(''); }}>
                      <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        <View className="px-6 py-4 border-t border-[#e4e2e2]/50 flex-row gap-2 mb-5 bg-[#ffffff]">
          <TouchableOpacity className="flex-1 py-3 px-4 rounded-xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempDeadlineDay(null); setTempDeadlineQuick('Xóa hạn'); handleSaveDeadline(); }}>
            <Text className="text-[14px] font-bold text-[#1b1c1c]">Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-[2] py-3 px-4 rounded-xl bg-[#008b8c] items-center active:bg-[#008b8c]/90 border-t border-white/20 shadow-sm" onPress={handleSaveDeadline}>
            <Text className="text-[14px] font-bold text-[#ffffff]">Lưu</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: reminderPickerAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
        <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
          <Text className="text-[24px] font-bold text-[#1b1c1c]">Chọn nhắc nhở</Text>
          <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeReminderPicker}><MaterialIcons name="close" size={20} color="#008b8c" /></TouchableOpacity>
        </View>
        <View className="px-6 py-4 flex-col gap-6">
          <View className="flex-row flex-wrap justify-between gap-y-2 mb-1">
            <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === 'At time' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('At time')}>
              <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === 'At time' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Tại thời điểm</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === '5 min' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('5 min')}>
              <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === '5 min' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trước 5 phút</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === '10 min' ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('10 min')}>
              <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === '10 min' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trước 10 phút</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-[14px] font-bold text-[#008b8c] uppercase tracking-wider">Thời gian</Text>
            <View className="flex-row items-center gap-1">
              <WheelPicker items={HOURS} selectedValue={tempReminderHour} onValueChange={setTempReminderHour} />
              <Text className="text-[20px] font-bold text-[#1b1c1c] pb-1">:</Text>
              <WheelPicker items={MINUTES} selectedValue={tempReminderMinute} onValueChange={setTempReminderMinute} />
            </View>
          </View>

          <View className="flex-col gap-2">
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-[14px] font-bold text-[#008b8c] uppercase tracking-wider">Tháng hiện tại</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#008b8c" /></TouchableOpacity>
                <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#008b8c" /></TouchableOpacity>
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between px-2">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, i) => (<View key={i} className="w-[13%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
              <View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" />
              {[...Array(31)].map((_, i) => {
                const day = i + 1; const isSelected = day === tempReminderDay;
                return (
                  <View key={day} className="w-[13%] items-center mb-2">
                    <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#008b8c] shadow-md' : 'active:bg-[#eae8e7]'}`} onPress={() => { setTempReminderDay(day); setTempReminderQuick(''); }}>
                      <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        <View className="px-6 py-4 border-t border-[#e4e2e2]/50 flex-row gap-2 mb-5 bg-[#ffffff]">
          <TouchableOpacity className="flex-1 py-3 px-4 rounded-xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempReminderDay(null); setTempReminderHour('09'); setTempReminderMinute('00'); setTempReminderQuick(''); handleSaveReminder(); }}>
            <Text className="text-[14px] font-bold text-[#1b1c1c]">Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-[2] py-3 px-4 rounded-xl bg-[#008b8c] items-center active:bg-[#008b8c]/90 border-t border-white/20 shadow-sm" onPress={handleSaveReminder}>
            <Text className="text-[14px] font-bold text-[#ffffff]">Lưu</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: pomoPickerAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
        <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50 mb-4">
          <Text className="text-[24px] font-bold text-[#1b1c1c]">Thiết lập Pomodoro</Text>
          <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={savePomodoroSettings}><MaterialIcons name="close" size={20} color="#008b8c" /></TouchableOpacity>
        </View>
        <View className="px-6 py-2 flex-col gap-8">
          <View className="flex-col gap-4">
            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-[18px] font-bold text-[#1b1c1c]">Số lượng Pomodoro</Text>
                <Text className="text-[16px] font-medium text-[#5a413c] mt-1">Mục tiêu cho phiên này</Text>
              </View>
              <View className="w-12 h-12 rounded-xl bg-[#008b8c] items-center justify-center shadow-sm border-t border-white/50"><Text className="text-[24px] font-bold text-[#ffffff]">{pomoCount}</Text></View>
            </View>
            <View className="pt-1 pb-2">
              <Slider style={{ width: '100%', height: 40 }} minimumValue={1} maximumValue={10} step={1} value={pomoCount} onValueChange={setPomoCount} minimumTrackTintColor="#008b8c" maximumTrackTintColor="#e4e2e2" thumbTintColor="#008b8c" />
              <View className="flex-row justify-between px-1"><Text className="text-[14px] font-bold text-[#8e706b]">1</Text><Text className="text-[14px] font-bold text-[#8e706b]">10</Text></View>
            </View>
          </View>
          <View className="flex-col gap-4">
            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-[18px] font-bold text-[#1b1c1c]">Thời gian Pomodoro</Text>
                <Text className="text-[16px] font-medium text-[#5a413c] mt-1">Phút cho mỗi phiên</Text>
              </View>
              <View className="w-12 h-12 rounded-xl bg-[#008b8c] items-center justify-center shadow-sm border-t border-white/50"><Text className="text-[24px] font-bold text-[#ffffff]">{pomoDuration}</Text></View>
            </View>
            <View className="pt-1 pb-2">
              <Slider style={{ width: '100%', height: 40 }} minimumValue={5} maximumValue={60} step={1} value={pomoDuration} onValueChange={setPomoDuration} minimumTrackTintColor="#008b8c" maximumTrackTintColor="#e4e2e2" thumbTintColor="#008b8c" />
              <View className="flex-row justify-between px-1"><Text className="text-[14px] font-bold text-[#8e706b]">5</Text><Text className="text-[14px] font-bold text-[#8e706b]">60</Text></View>
            </View>
          </View>
        </View>
        <View className="px-6 mt-6 mb-8 flex-row gap-4">
          <TouchableOpacity className="flex-1 py-4 rounded-2xl bg-[#eae8e7] items-center justify-center active:scale-[0.98]" onPress={closePomoPicker}><Text className="text-[18px] font-medium text-[#5a413c]">Hủy</Text></TouchableOpacity>
          <TouchableOpacity className="flex-1 py-4 rounded-2xl bg-[#008b8c] items-center justify-center active:scale-[0.98] active:bg-[#005f5f] border-t border-white/20 shadow-md" onPress={savePomodoroSettings}><Text className="text-[18px] font-bold text-[#ffffff]">Xong</Text></TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: repeatPickerAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
        <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
          <Text className="text-[24px] font-bold text-[#1b1c1c]">Lặp lại</Text>
          <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeRepeatPicker}><MaterialIcons name="close" size={20} color="#008b8c" /></TouchableOpacity>
        </View>
        <ScrollView className="px-6 py-4 mb-6">
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => setRepeatOption('none')}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center ${getRepeatIconBg('none')}`}><MaterialIcons name="block" size={22} color={getRepeatIconColor('none')} /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">None</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${repeatOption === 'none' ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{repeatOption === 'none' && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => setRepeatOption('daily')}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center ${getRepeatIconBg('daily')}`}><MaterialIcons name="calendar-today" size={22} color={getRepeatIconColor('daily')} /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Daily</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${repeatOption === 'daily' ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{repeatOption === 'daily' && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => setRepeatOption('weekly')}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center ${getRepeatIconBg('weekly')}`}><MaterialIcons name="date-range" size={22} color={getRepeatIconColor('weekly')} /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Weekly</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${repeatOption === 'weekly' ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{repeatOption === 'weekly' && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => setRepeatOption('monthly')}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center ${getRepeatIconBg('monthly')}`}><MaterialIcons name="calendar-month" size={22} color={getRepeatIconColor('monthly')} /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Monthly</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${repeatOption === 'monthly' ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{repeatOption === 'monthly' && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-8" onPress={() => setRepeatOption('custom')}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center ${getRepeatIconBg('custom')}`}><MaterialIcons name="settings-suggest" size={22} color={getRepeatIconColor('custom')} /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Custom</Text></View>
            <MaterialIcons name="chevron-right" size={24} color="#008b8c" />
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: priorityPickerAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
        <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
          <Text className="text-[24px] font-bold text-[#1b1c1c]">Chọn độ ưu tiên</Text>
          <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closePriorityPicker}><MaterialIcons name="close" size={20} color="#008b8c" /></TouchableOpacity>
        </View>
        <ScrollView className="px-2 py-2 mb-6">
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => handleSavePriority(3)}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#ffdad6]`}><MaterialIcons name="priority-high" size={22} color="#93000a" /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Cao</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 3 ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{taskData?.priority === 3 && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => handleSavePriority(2)}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#00a7a8]`}><MaterialIcons name="drag-handle" size={22} color="#003535" /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Vừa</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 2 ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{taskData?.priority === 2 && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-4 rounded-xl active:bg-[#f5f3f3] mb-8" onPress={() => handleSavePriority(1)}>
            <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#7cf8dd]`}><MaterialIcons name="arrow-downward" size={22} color="#007261" /></View><Text className="text-[18px] font-medium text-[#1b1c1c]">Thấp</Text></View>
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 1 ? 'border-[#008b8c]' : 'border-[#8e706b]'}`}>{taskData?.priority === 1 && <View className="w-2.5 h-2.5 rounded-full bg-[#008b8c]" />}</View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}