import React, { useState, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Animated, Dimensions, StyleSheet, TouchableWithoutFeedback
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import api from '../services/api';

const { height } = Dimensions.get('window');

const ITEM_HEIGHT = 32;
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const WheelPicker = ({ items, selectedValue, onValueChange }) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 48 }}>
      <View style={{ position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT, backgroundColor: '#008b8c15', borderRadius: 8 }} />
      <Animated.FlatList
        data={items}
        keyExtractor={(item) => item.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (index >= 0 && index < items.length) {
            onValueChange(items[index]);
          }
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={Math.max(0, items.indexOf(selectedValue))}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
          const scale = scrollY.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp' });
          const opacity = scrollY.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });

          return (
            <Animated.View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', transform: [{ scale }], opacity }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#008b8c' }}>{item}</Text>
            </Animated.View>
          );
        }}
      />
    </View>
  );
};

export default function AddTaskScreen({ navigation }) {
  const [taskName, setTaskName] = useState('');
  const [priority, setPriority] = useState('Vừa');
  const [deadline, setDeadline] = useState(null);
  const [reminder, setReminder] = useState(null);
  const [pomodoroCount, setPomodoroCount] = useState(3);
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(10);
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);

  const [tempDeadlineDay, setTempDeadlineDay] = useState(new Date().getDate());
  const [tempDeadlineQuick, setTempDeadlineQuick] = useState('Hôm nay');
  
  const [tempReminderDay, setTempReminderDay] = useState(new Date().getDate());
  const [tempReminderHour, setTempReminderHour] = useState('09');
  const [tempReminderMinute, setTempReminderMinute] = useState('00');
  const [tempReminderQuick, setTempReminderQuick] = useState('');

  const datePickerAnim = useRef(new Animated.Value(height)).current;
  const reminderPickerAnim = useRef(new Animated.Value(height)).current;

  const handleGoBack = () => navigation.goBack();
  const decreasePomodoro = () => { if (pomodoroCount > 1) setPomodoroCount(pomodoroCount - 1); };
  const increasePomodoro = () => { if (pomodoroCount < 10) setPomodoroCount(pomodoroCount + 1); };

  const openDatePicker = () => { setIsDatePickerOpen(true); Animated.timing(datePickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeDatePicker = () => { Animated.timing(datePickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsDatePickerOpen(false)); };
  
  const openReminderPicker = () => { setIsReminderPickerOpen(true); Animated.timing(reminderPickerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeReminderPicker = () => { Animated.timing(reminderPickerAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsReminderPickerOpen(false)); };

  const getPriorityValue = (pString) => {
    switch(pString) {
      case 'Cao': return 3;
      case 'Vừa': return 2;
      case 'Thấp': return 1;
      default: return 2;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Chưa đặt';
    const d = new Date(dateString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const handleCreateTask = async () => {
    if (!taskName.trim()) return;
    setIsSubmitting(true);
    
    try {
      const taskData = {
        title: taskName,
        description: notes,
        note: notes,
        priority: getPriorityValue(priority),
        estimated_pomodoros: pomodoroCount,
        focus_duration: focusTime,
        short_break: breakTime,
        is_completed: false
      };

      if (deadline) taskData.deadline = deadline;
      
      let finalReminder = null;
      if (deadline && tempReminderQuick) {
         const d = new Date(deadline);
         if (tempReminderQuick === '5 min') {
            d.setMinutes(d.getMinutes() - 5);
         } else if (tempReminderQuick === '10 min') {
            d.setMinutes(d.getMinutes() - 10);
         }
         finalReminder = d.toISOString();
      }
      
      if (finalReminder) taskData.reminder = finalReminder;

      await api.post('/planner/tasks/', taskData);

      setIsSubmitting(false);
      navigation.goBack();
    } catch (error) {
      setIsSubmitting(false);
    }
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
    setDeadline(newDeadline);
    closeDatePicker();
  };

  const handleReminderQuickSelect = (type) => {
    setTempReminderQuick(type);
    if (deadline && (type === '5 min' || type === '10 min' || type === 'At time')) {
      const d = new Date(deadline);
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
    setReminder(newReminder);
    closeReminderPicker();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-row items-center justify-between mt-6 px-5 py-2 bg-[#ffffff] z-10 shadow-sm border-b border-[#f5f3f3]">
            <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center" onPress={handleGoBack}>
              <MaterialIcons name="arrow-back" size={26} color="#008b8c" />
            </TouchableOpacity>
            <Text className="text-[24px] font-bold text-[#1b1c1c]">Tạo Task Mới</Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1 px-3 pt-4 pb-32" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="mb-3">
              <Text className="text-[14px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Tên Công Việc</Text>
              <TextInput
                className="w-full bg-[#efeded] rounded-xl px-4 py-3 text-[16px] font-medium text-[#1b1c1c]"
                placeholder="Bạn muốn làm gì?"
                placeholderTextColor="#e2bfb8"
                value={taskName}
                onChangeText={setTaskName}
              />
            </View>

            <View className="mb-3">
              <Text className="text-[14px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Độ Ưu Tiên</Text>
              <View className="flex-row justify-between">
                <TouchableOpacity className={`flex-1 items-center justify-center py-2 rounded-xl mr-1.5 border ${priority === 'Cao' ? 'bg-[#008b8c] border-[#008b8c]' : 'bg-[#e4e2e2] border-[#e4e2e2] opacity-60'}`} onPress={() => setPriority('Cao')}><Text className={`text-[13px] font-bold ${priority === 'Cao' ? 'text-white' : 'text-[#5a413c]'}`}>Cao</Text></TouchableOpacity>
                <TouchableOpacity className={`flex-1 items-center justify-center py-2 rounded-xl mx-1.5 border ${priority === 'Vừa' ? 'bg-[#008b8c] border-[#008b8c]' : 'bg-[#e4e2e2] border-[#e4e2e2] opacity-60'}`} onPress={() => setPriority('Vừa')}><Text className={`text-[13px] font-bold ${priority === 'Vừa' ? 'text-white' : 'text-[#5a413c]'}`}>Vừa</Text></TouchableOpacity>
                <TouchableOpacity className={`flex-1 items-center justify-center py-2 rounded-xl mx-1.5 border ${priority === 'Thấp' ? 'bg-[#008b8c] border-[#008b8c]' : 'bg-[#e4e2e2] border-[#e4e2e2] opacity-60'}`} onPress={() => setPriority('Thấp')}><Text className={`text-[13px] font-bold ${priority === 'Thấp' ? 'text-white' : 'text-[#5a413c]'}`}>Thấp</Text></TouchableOpacity>
                <TouchableOpacity className={`flex-1 items-center justify-center py-2 rounded-xl ml-1.5 border ${priority === 'Không' ? 'bg-[#008b8c] border-[#008b8c]' : 'bg-[#e4e2e2] border-[#e4e2e2] opacity-60'}`} onPress={() => setPriority('Không')}><Text className={`text-[13px] font-bold ${priority === 'Không' ? 'text-white' : 'text-[#5a413c]'}`}>Không</Text></TouchableOpacity>
              </View>
            </View>

            <View className="flex-row justify-between mb-3">
              <View className="flex-1 pr-2">
                <Text className="text-[14px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Hạn Chót</Text>
                <TouchableOpacity className="w-full bg-[#efeded] rounded-xl px-4 py-3 flex-row justify-between items-center" onPress={openDatePicker}>
                  <Text className="text-[16px] font-medium text-[#1b1c1c]">{deadline ? formatDateTime(deadline).split(', ')[1] : 'Chưa đặt'}</Text>
                  <MaterialIcons name="calendar-today" size={20} color="#008b8c" />
                </TouchableOpacity>
              </View>
              <View className="flex-1 pl-2">
                <Text className="text-[14px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Nhắc Nhở</Text>
                <TouchableOpacity className="w-full bg-[#efeded] rounded-xl px-4 py-3 flex-row justify-between items-center" onPress={openReminderPicker}>
                  <Text className="text-[16px] font-medium text-[#1b1c1c]">{reminder ? 'Đã bật' : 'Chưa đặt'}</Text>
                  <MaterialIcons name="notifications" size={20} color="#008b8c" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-2xl p-4 shadow-sm mb-3">
              <View className="flex-row items-center mb-4">
                <MaterialIcons name="timer" size={24} color="#008b8c" />
                <Text className="text-[18px] font-bold text-[#1b1c1c] ml-2">Cài Đặt Pomodoro</Text>
              </View>

              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[16px] font-medium text-[#5a413c]">Số lượng dự kiến</Text>
                <View className="flex-row items-center bg-[#efeded] rounded-full p-1">
                  <TouchableOpacity className="w-8 h-8 rounded-full bg-[#e4e2e2] items-center justify-center" onPress={decreasePomodoro}><MaterialIcons name="remove" size={16} color="#1b1c1c" /></TouchableOpacity>
                  <Text className="w-10 text-center text-[16px] font-bold text-[#1b1c1c]">{pomodoroCount}</Text>
                  <TouchableOpacity className="w-8 h-8 rounded-full bg-[#008b8c] items-center justify-center" onPress={increasePomodoro}><MaterialIcons name="add" size={16} color="#ffffff" /></TouchableOpacity>
                </View>
              </View>

              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-[14px] font-bold text-[#5a413c] uppercase tracking-widest">Thời gian tập trung</Text>
                  <View className="bg-[#008b8c] px-3 py-1 rounded-full"><Text className="text-[14px] font-bold text-white">{focusTime}p</Text></View>
                </View>
                <Slider style={{ width: '100%', height: 30 }} minimumValue={5} maximumValue={120} step={5} value={focusTime} onValueChange={setFocusTime} minimumTrackTintColor="#008b8c" maximumTrackTintColor="#efeded" thumbTintColor="#008b8c" />
              </View>

              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-[14px] font-bold text-[#5a413c] uppercase tracking-widest">Thời gian nghỉ</Text>
                  <View className="bg-[#008b8c] px-3 py-1 rounded-full"><Text className="text-[14px] font-bold text-white">{breakTime}p</Text></View>
                </View>
                <Slider style={{ width: '100%', height: 30 }} minimumValue={1} maximumValue={30} step={1} value={breakTime} onValueChange={setBreakTime} minimumTrackTintColor="#008b8c" maximumTrackTintColor="#efeded" thumbTintColor="#008b8c" />
              </View>
            </View>

            <View className="mb-8">
              <Text className="text-[14px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Ghi Chú</Text>
              <TextInput
                className="w-full bg-[#efeded] rounded-xl px-4 py-3 text-[16px] font-medium text-[#1b1c1c]"
                placeholder="Thêm chi tiết mô tả công việc..."
                placeholderTextColor="#e2bfb8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          
          <View className="absolute bottom-0 left-0 right-0 p-5 bg-white/90">
            <TouchableOpacity 
              className="w-full bg-[#008b8c] rounded-xl py-4 flex-row justify-center items-center shadow-lg"
              onPress={handleCreateTask}
              disabled={isSubmitting || !taskName.trim()}
              style={{ opacity: (!taskName.trim() || isSubmitting) ? 0.7 : 1 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View className="flex-row items-center">
                  <MaterialIcons name="add-task" size={24} color="#ffffff" />
                  <Text className="text-[18px] font-bold text-white ml-2">Tạo Task Mới</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {(isDatePickerOpen || isReminderPickerOpen) && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents="auto">
          <TouchableWithoutFeedback onPress={() => { if (isDatePickerOpen) closeDatePicker(); if (isReminderPickerOpen) closeReminderPicker(); }}>
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
          <TouchableOpacity className="flex-1 py-3 px-4 rounded-xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempReminderDay(null); setTempReminderHour('09'); setTempReminderMinute('00'); setTempReminderQuick(''); }}>
            <Text className="text-[14px] font-bold text-[#1b1c1c]">Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-[2] py-3 px-4 rounded-xl bg-[#008b8c] items-center active:bg-[#008b8c]/90 border-t border-white/20 shadow-sm" onPress={handleSaveReminder}>
            <Text className="text-[14px] font-bold text-[#ffffff]">Lưu</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}