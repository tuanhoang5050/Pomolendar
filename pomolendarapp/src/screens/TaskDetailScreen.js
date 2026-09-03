import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, ImageBackground, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Animated, Dimensions, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedPopup from '../components/AnimatedPopup'; 
import { scheduleTaskReminder, cancelTaskReminder } from '../services/notifications';


const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = 32;
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const TAG_COLORS = [
  '#F6B8B8', '#F8C9A9', '#F6E58D', '#B8E8C4', '#A0DAB7',
  '#A8DADC', '#AEDFF7', '#A7C7E7', '#B5B9FF', '#C7B8F5',
  '#E0B8F5', '#F5B8E0', '#F5B8C7', '#E8C9A0', '#D9C9A3',
  '#C9D6A3', '#A3D9C9', '#A3C9D9', '#C9A3D9', '#D9A3B8'
];

const WheelPicker = ({ items, selectedValue, onValueChange }) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={{ height: ITEM_HEIGHT * 3, width: 48 }}>
      <View style={{ position: 'absolute', top: ITEM_HEIGHT, left: 0, right: 0, height: ITEM_HEIGHT, backgroundColor: '#c89d7d15', borderRadius: 8 }} />
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
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#c89d7d' }}>{item}</Text>
            </Animated.View>
          );
        }}
      />
    </View>
  );
};

export default function TaskDetailScreen({ navigation, route }) {
  const taskId = route.params?.taskId;

  const [loading, setLoading] = useState(true);
  const [taskData, setTaskData] = useState(null);
  
  const [notes, setNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [pomoCount, setPomoCount] = useState(4);
  const [pomoDuration, setPomoDuration] = useState(25);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [isPomoPickerOpen, setIsPomoPickerOpen] = useState(false);
  const [isPriorityPickerOpen, setIsPriorityPickerOpen] = useState(false);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);

  const [allTags, setAllTags] = useState([]);
  const [taskTags, setTaskTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isSavingTag, setIsSavingTag] = useState(false);

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
      Alert.alert('Error', 'Could not load task details.');
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
    setTaskTags(data.tags_detail || []);
    
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
      await scheduleTaskReminder(response.data);

      if (updates.is_completed && response.data.gamification) {
        const gami = response.data.gamification;
        let msg = `⭐ Points earned: +${gami.points_earned}`;
        if (gami.leveled_up) {
           msg += `\n\n🎉 You've added a new book to your bookshelf!`;
        }
        Alert.alert("Task Completed!", msg);
      }

      fetchTaskDetail();
    } catch (e) {
      Alert.alert('Error', 'Could not update task.');
    }
  };

  const handleDeleteTask = async () => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/planner/tasks/${taskId}/`);
              await cancelTaskReminder(taskId);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "Could not delete task.");
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
    setIsPomoPickerOpen(false);
  };

  const handleSaveDeadline = () => {
    let newDeadline = null;
    if (tempDeadlineQuick !== 'Remove' && tempDeadlineDay) {
      const d = new Date();
      if (tempDeadlineQuick === 'In 7 days') d.setDate(new Date().getDate() + 7);
      else if (tempDeadlineQuick === 'Tomorrow') d.setDate(new Date().getDate() + 1);
      else if (tempDeadlineQuick === 'Today') d.setDate(new Date().getDate());
      else d.setDate(tempDeadlineDay);
      newDeadline = d.toISOString();
    }
    updateTask({ deadline: newDeadline });
    setIsDatePickerOpen(false);
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
    setIsReminderPickerOpen(false);
  };

  const handleSavePriority = (newPriority) => {
    updateTask({ priority: newPriority });
    setIsPriorityPickerOpen(false);
  };

  const fetchAllTags = async () => {
    try {
      const response = await api.get('/planner/tags/');
      setAllTags(response.data);
    } catch (e) {}
  };

  const openTagPicker = () => {
    fetchAllTags();
    setIsTagPickerOpen(true);
  };

  const openCreateTag = () => {
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    setIsCreateTagOpen(true);
  };

  const toggleTagOnTask = async (tag) => {
    const isSelected = taskTags.some(t => t.id === tag.id);
    const newTagIds = isSelected
      ? taskTags.filter(t => t.id !== tag.id).map(t => t.id)
      : [...taskTags.map(t => t.id), tag.id];

    try {
      const response = await api.patch(`/planner/tasks/${taskId}/`, { tags: newTagIds });
      setTaskTags(response.data.tags_detail || []);
      setTaskData(prev => ({ ...prev, tags_detail: response.data.tags_detail || [] }));
    } catch (e) {
      Alert.alert('Error', 'Could not update tags.');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsSavingTag(true);
    try {
      const tagRes = await api.post('/planner/tags/', { name: newTagName.trim(), color: newTagColor });
      const newTag = tagRes.data;
      setAllTags(prev => [...prev, newTag]);

      const newTagIds = [...taskTags.map(t => t.id), newTag.id];
      const taskRes = await api.patch(`/planner/tasks/${taskId}/`, { tags: newTagIds });
      setTaskTags(taskRes.data.tags_detail || []);
      setTaskData(prev => ({ ...prev, tags_detail: taskRes.data.tags_detail || [] }));

      setIsCreateTagOpen(false);
    } catch (e) {
      Alert.alert('Error', 'Could not create new tag. The tag name may already exist.');
    } finally {
      setIsSavingTag(false);
    }
  };

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
    if (!dateString) return 'Not set';
    const d = new Date(dateString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getPriorityStyle = (p) => {
    if (isCompleted) return { bg: 'bg-[#e4e2e2]', text: 'text-[#5a413c]', label: 'Completed' };
    switch (p) {
      case 3: return { bg: 'bg-[#C27664]', text: 'text-[#ffffff]', label: 'High Priority' };
      case 2: return { bg: 'bg-[#A9B388]', text: 'text-[#ffffff]', label: 'Medium Priority' };
      case 1: return { bg: 'bg-[#D1BB9E]', text: 'text-[#ffffff]', label: 'Low Priority' };
      default: return { bg: 'bg-[#f3dcc0]', text: 'text-[#8a5a19]', label: 'Priority' };
    }
  };

  if (loading || !taskData) {
    return (
      <SafeAreaView className="flex-1 bg-[#fbf9f8] justify-center items-center">
        <ActivityIndicator size="large" color="#c89d7d" />
      </SafeAreaView>
    );
  }

  const pStyle = getPriorityStyle(taskData.priority);

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover" 
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-row items-center justify-between px-5 h-16 mt-6 z-10">
            <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleGoBack}>
              <MaterialIcons name="chevron-left" size={32} color="#c89d7d" />
            </TouchableOpacity>
            <View className="flex-row gap-1">
              <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleStartTimer} disabled={isCompleted}>
                <MaterialIcons name="play-arrow" size={26} color={isCompleted ? "#e2bfb8" : "#c89d7d"} />
              </TouchableOpacity>
              <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center active:bg-[#e4e2e2]/50" onPress={handleDeleteTask}>
                <MaterialIcons name="delete" size={22} color="#c89d7d" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="px-5 mt-4 mb-8">
              <View className="flex-row items-center gap-3 mb-4">
                <TouchableOpacity 
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isCompleted ? 'bg-[#c89d7d] border-[#c89d7d]' : 'border-[#c89d7d]'}`}
                  onPress={handleToggleComplete}
                >
                  {isCompleted && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`${pStyle.bg} px-2 py-1 rounded`}
                  onPress={() => setIsPriorityPickerOpen(true)}
                  disabled={isCompleted}
                >
                  <Text className={`${pStyle.text} text-[10px] font-bold uppercase tracking-widest`}>{pStyle.label}</Text>
                </TouchableOpacity>
              </View>
              <Text className={`text-[28px] font-bold ${isCompleted ? 'text-[#8e706b] line-through' : 'text-[#1b1c1c]'}`}>
                {taskData.title}
              </Text>

              <View className="flex-row flex-wrap items-center gap-2 mt-4">
                {taskTags.map(tag => (
                  <TouchableOpacity key={tag.id} onPress={openTagPicker} style={{ backgroundColor: tag.color }} className="px-3 py-1.5 rounded-full">
                    <Text className="text-[12px] font-bold text-[#1b1c1c]">{tag.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity 
                  className="flex-row items-center px-2 py-1.5 rounded-full border border-[#c89d7d]" 
                  onPress={openTagPicker}
                  style={{ borderStyle: 'dashed' }}
                >
                  <MaterialIcons name="add" size={16} color="#c89d7d" />
                  <Text className="text-[12px] font-bold text-[#c89d7d]">Tags</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="px-3 gap-2">
              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={() => setIsPomoPickerOpen(true)}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#8C7A6B]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="timer" size={20} color="#c89d7d" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Pomodoros</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  {[...Array(Math.min(taskData.completed_pomodoros || 0, 4))].map((_, i) => (
                    <MaterialIcons key={`c-${i}`} name="timer" size={18} color="#c89d7d" />
                  ))}
                  {[...Array(Math.min(Math.max((taskData.estimated_pomodoros || 1) - (taskData.completed_pomodoros || 0), 0), 4 - Math.min(taskData.completed_pomodoros || 0, 4)))].map((_, i) => (
                    <MaterialIcons key={`u-${i}`} name="timer" size={18} color="#e2bfb8" />
                  ))}
                  {(taskData.estimated_pomodoros || 1) > 4 && (
                    <Text className="text-[14px] font-bold text-[#c89d7d]">+{taskData.estimated_pomodoros - 4}</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={() => setIsDatePickerOpen(true)}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#7A9D96]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="calendar-today" size={20} color="#c89d7d" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Due Date</Text>
                </View>
                <Text className="text-[14px] font-bold text-[#1b1c1c]">{taskData.deadline ? formatDateTime(taskData.deadline).split(', ')[1] : 'Not set'}</Text>
              </TouchableOpacity>

              <TouchableOpacity className="flex-row items-center justify-between p-4 bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] active:bg-[#efeded]" onPress={() => setIsReminderPickerOpen(true)}>
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#c89d7d]" />
                <View className="flex-row items-center gap-4">
                  <MaterialIcons name="notifications" size={20} color="#c89d7d" />
                  <Text className="text-[16px] font-medium text-[#5a413c]">Reminder</Text>
                </View>
                <Text className="text-[14px] text-[#5a413c]">{taskData.reminder ? formatDateTime(taskData.reminder) : 'Not set'}</Text>
              </TouchableOpacity>
            </View>

            <View className="px-3 mt-3 mb-32">
              <View className="flex-row items-center gap-2 mb-3 px-1">
                <MaterialIcons name="notes" size={20} color="#A37081" />
                <Text className="text-[14px] font-bold text-[#5a413c]">Notes & Description</Text>
              </View>
              <View className="w-full bg-[#ffffff] rounded-xl overflow-hidden border border-[#efeded] min-h-[120px]">
                <View className="absolute left-0 top-0 bottom-0 w-1 bg-[#E29F81]" />
                <TextInput
                  className="flex-1 p-4 text-[16px] text-[#1b1c1c]"
                  placeholder="Add notes or detailed description..."
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
              <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
              <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
            </>
          )}

          <Animated.View style={{ position: 'absolute', bottom: 72, left: width / 2, width: 2, height: 2, borderRadius: 1, backgroundColor: '#c89d7d', transform: [{ translateX: -1 }, { scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1500] }) }], opacity: fadeAnim, zIndex: 60, pointerEvents: 'none' }} />

          <TouchableOpacity 
            className={`absolute bottom-10 left-1/2 w-16 h-16 rounded-full items-center justify-center shadow-lg z-50 border border-white/30 ${isCompleted ? 'bg-[#e4e2e2]' : 'bg-[#c89d7d]'}`}
            style={{ elevation: 8, transform: [{ translateX: -32 }] }}
            onPress={handleStartTimer}
            activeOpacity={0.9}
            disabled={isCompleted}
          >
            <MaterialIcons name={isCompleted ? "check" : "play-arrow"} size={32} color={isCompleted ? "#5a413c" : "#ffffff"} />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>

      
      <AnimatedPopup visible={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Select due date</Text>
          </View>
          <View className="px-5 py-5 flex-col gap-6">
            <View className="flex-row flex-wrap justify-between gap-y-2 mb-1">
              <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Today' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Today'); setTempDeadlineDay(new Date().getDate()); }}>
                <MaterialIcons name="today" size={20} color={tempDeadlineQuick === 'Today' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Today' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Tomorrow' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Tomorrow'); const t = new Date(); t.setDate(t.getDate() + 1); setTempDeadlineDay(t.getDate()); }}>
                <MaterialIcons name="event" size={20} color={tempDeadlineQuick === 'Tomorrow' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Tomorrow' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'In 7 days' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('In 7 days'); const t = new Date(); t.setDate(t.getDate() + 7); setTempDeadlineDay(t.getDate()); }}>
                <MaterialIcons name="date-range" size={20} color={tempDeadlineQuick === 'In 7 days' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'In 7 days' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>In 7 days</Text>
              </TouchableOpacity>
              <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Remove' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Remove'); setTempDeadlineDay(null); }}>
                <MaterialIcons name="calendar-today" size={20} color={tempDeadlineQuick === 'Remove' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Remove' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Current Month</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                  <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                </View>
              </View>
              <View className="flex-row flex-wrap justify-between px-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (<View key={i} className="w-[13%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
                <View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" />
                {[...Array(31)].map((_, i) => {
                  const day = i + 1; const isSelected = day === tempDeadlineDay;
                  return (
                    <View key={day} className="w-[13%] items-center mb-2">
                      <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : 'active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineDay(day); setTempDeadlineQuick(''); }}>
                        <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
          <View className="px-5 py-4 border-t border-[#e4e2e2]/50 flex-row gap-3 bg-[#ffffff]">
            <TouchableOpacity className="flex-1 py-1.5 px-4 rounded-3xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempDeadlineDay(null); setTempDeadlineQuick('Remove'); handleSaveDeadline(); }}>
              <Text className="text-[14px] font-bold text-[#1b1c1c]">Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-[2] py-1.5 px-4 rounded-3xl bg-[#c89d7d] items-center active:bg-[#c89d7d]/90 shadow-sm" onPress={handleSaveDeadline}>
              <Text className="text-[14px] font-bold text-[#ffffff]">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={isReminderPickerOpen} onClose={() => setIsReminderPickerOpen(false)}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Select reminder</Text>
          </View>
          <View className="px-5 py-5 flex-col gap-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Time</Text>
              <View className="flex-row items-center gap-1">
                <WheelPicker items={HOURS} selectedValue={tempReminderHour} onValueChange={setTempReminderHour} />
                <Text className="text-[20px] font-bold text-[#1b1c1c] pb-1">:</Text>
                <WheelPicker items={MINUTES} selectedValue={tempReminderMinute} onValueChange={setTempReminderMinute} />
              </View>
            </View>

            <View className="flex-col gap-2">
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Current Month</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                  <TouchableOpacity className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                </View>
              </View>
              <View className="flex-row flex-wrap justify-between px-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (<View key={i} className="w-[13%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
                <View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" /><View className="w-[13%] h-10 mb-2" />
                {[...Array(31)].map((_, i) => {
                  const day = i + 1; const isSelected = day === tempReminderDay;
                  return (
                    <View key={day} className="w-[13%] items-center mb-2">
                      <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : 'active:bg-[#eae8e7]'}`} onPress={() => { setTempReminderDay(day); setTempReminderQuick(''); }}>
                        <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
          <View className="px-5 py-4 border-t border-[#e4e2e2]/50 flex-row gap-3 bg-[#ffffff]">
            <TouchableOpacity className="flex-1 py-1.5 px-4 rounded-3xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempReminderDay(null); setTempReminderHour('09'); setTempReminderMinute('00'); setTempReminderQuick(''); handleSaveReminder(); }}>
              <Text className="text-[14px] font-bold text-[#1b1c1c]">Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-[2] py-1.5 px-4 rounded-3xl bg-[#c89d7d] items-center active:bg-[#c89d7d]/90 shadow-sm" onPress={handleSaveReminder}>
              <Text className="text-[14px] font-bold text-[#ffffff]">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={isPomoPickerOpen} onClose={() => setIsPomoPickerOpen(false)}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50 mb-2">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Pomodoro Settings</Text>
          </View>
          <View className="px-5 py-4 flex-col gap-6">
            <View className="flex-col gap-3">
              <View className="flex-row justify-between items-end">
                <Text className="text-[16px] font-bold text-[#1b1c1c]">Pomodoro Count</Text>
                <View className="w-10 h-10 rounded-2xl bg-[#c89d7d] items-center justify-center shadow-sm"><Text className="text-[20px] font-bold text-[#ffffff]">{pomoCount}</Text></View>
              </View>
              <View className="pt-1">
                <Slider style={{ width: '100%', height: 40 }} minimumValue={1} maximumValue={10} step={1} value={pomoCount} onValueChange={setPomoCount} minimumTrackTintColor="#c89d7d" maximumTrackTintColor="#e4e2e2" thumbTintColor="#c89d7d" />
                <View className="flex-row justify-between px-1"><Text className="text-[12px] font-bold text-[#8e706b]">1</Text><Text className="text-[12px] font-bold text-[#8e706b]">10</Text></View>
              </View>
            </View>
            <View className="flex-col gap-3">
              <View className="flex-row justify-between items-end">
                <Text className="text-[16px] font-bold text-[#1b1c1c]">Pomodoro Duration</Text>
                <View className="w-10 h-10 rounded-2xl bg-[#c89d7d] items-center justify-center shadow-sm"><Text className="text-[20px] font-bold text-[#ffffff]">{pomoDuration}</Text></View>
              </View>
              <View className="pt-1">
                <Slider style={{ width: '100%', height: 40 }} minimumValue={5} maximumValue={60} step={1} value={pomoDuration} onValueChange={setPomoDuration} minimumTrackTintColor="#c89d7d" maximumTrackTintColor="#e4e2e2" thumbTintColor="#c89d7d" />
                <View className="flex-row justify-between px-1"><Text className="text-[12px] font-bold text-[#8e706b]">5</Text><Text className="text-[12px] font-bold text-[#8e706b]">60</Text></View>
              </View>
            </View>
          </View>
          <View className="px-5 py-4 mt-2 flex-row gap-3 bg-[#ffffff] border-t border-[#e4e2e2]/50">
                        <TouchableOpacity className="flex-1 py-1.5 px-4 rounded-3xl border border-[#e2bfb8] items-center active:bg-[#f5f3f3]" onPress={() => { setTempReminderDay(null); setTempReminderHour('09'); setTempReminderMinute('00'); setTempReminderQuick(''); handleSaveReminder(); }}>
              <Text className="text-[14px] font-bold text-[#1b1c1c]">Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-[2] py-1.5 rounded-3xl bg-[#c89d7d] items-center justify-center active:scale-[0.98] shadow-md" onPress={savePomodoroSettings}><Text className="text-[14px] font-bold text-[#ffffff]">Done</Text></TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={isPriorityPickerOpen} onClose={() => setIsPriorityPickerOpen(false)}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Select priority</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={() => setIsPriorityPickerOpen(false)}>
              <MaterialIcons name="close" size={20} color="#c89d7d" />
            </TouchableOpacity>
          </View>
          <View className="px-4 py-4 mb-2">
            <TouchableOpacity className="flex-row items-center justify-between p-3 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => handleSavePriority(3)}>
              <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#ffdad6]`}><MaterialIcons name="flag" size={22} color="#ce675d" /></View><Text className="text-[16px] font-medium text-[#1b1c1c]">High</Text></View>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 3 ? 'border-[#c89d7d]' : 'border-[#8e706b]'}`}>{taskData?.priority === 3 && <View className="w-2.5 h-2.5 rounded-full bg-[#c89d7d]" />}</View>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center justify-between p-3 rounded-xl active:bg-[#f5f3f3] mb-2" onPress={() => handleSavePriority(2)}>
              <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#f3dcc0]`}><MaterialIcons name="flag" size={22} color="#A9B388" /></View><Text className="text-[16px] font-medium text-[#1b1c1c]">Medium</Text></View>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 2 ? 'border-[#c89d7d]' : 'border-[#8e706b]'}`}>{taskData?.priority === 2 && <View className="w-2.5 h-2.5 rounded-full bg-[#c89d7d]" />}</View>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center justify-between p-3 rounded-xl active:bg-[#f5f3f3]" onPress={() => handleSavePriority(1)}>
              <View className="flex-row items-center gap-4"><View className={`w-10 h-10 rounded-full items-center justify-center bg-[#e8dfcf]`}><MaterialIcons name="flag" size={22} color="#D1BB9E" /></View><Text className="text-[16px] font-medium text-[#1b1c1c]">Low</Text></View>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${taskData?.priority === 1 ? 'border-[#c89d7d]' : 'border-[#8e706b]'}`}>{taskData?.priority === 1 && <View className="w-2.5 h-2.5 rounded-full bg-[#c89d7d]" />}</View>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={isTagPickerOpen} onClose={() => setIsTagPickerOpen(false)}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Tags</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={() => setIsTagPickerOpen(false)}>
              <MaterialIcons name="close" size={20} color="#c89d7d" />
            </TouchableOpacity>
          </View>
          <ScrollView className="px-4 py-4" style={{ maxHeight: height * 0.4 }}>
            {allTags.length > 0 ? (
              allTags.map(tag => {
                const isSelected = taskTags.some(t => t.id === tag.id);
                return (
                  <TouchableOpacity key={tag.id} className="flex-row items-center justify-between p-3 rounded-xl active:bg-[#f5f3f3] mb-1" onPress={() => toggleTagOnTask(tag)}>
                    <View className="flex-row items-center gap-3 flex-1">
                      <View style={{ backgroundColor: tag.color }} className="w-6 h-6 rounded-full" />
                      <Text className="text-[15px] font-medium text-[#1b1c1c]" numberOfLines={1}>{tag.name}</Text>
                    </View>
                    {isSelected && <MaterialIcons name="check-circle" size={22} color="#c89d7d" />}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View className="items-center justify-center py-8">
                <Text className="text-[14px] text-[#8e706b] font-medium">No tags yet</Text>
              </View>
            )}
          </ScrollView>
          <View className="px-5 py-4 border-t border-[#e4e2e2]/50 bg-[#ffffff]">
            <TouchableOpacity className="flex-row items-center justify-center py-1.5 rounded-3xl border border-[#c89d7d] border-dashed" onPress={() => { setIsTagPickerOpen(false); openCreateTag(); }}>
              <MaterialIcons name="add" size={18} color="#c89d7d" />
              <Text className="text-[15px] font-bold text-[#c89d7d] ml-1">Create tag</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={isCreateTagOpen} onClose={() => setIsCreateTagOpen(false)}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[20px] font-bold text-[#1b1c1c]">Create New Tag</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={() => setIsCreateTagOpen(false)}>
              <MaterialIcons name="close" size={20} color="#c89d7d" />
            </TouchableOpacity>
          </View>
          <View className="px-5 py-5 flex-col gap-5">
            <View>
              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Tag Name</Text>
              <TextInput
                className="w-full bg-[#efeded] rounded-xl px-4 py-3 text-[16px] font-medium text-[#1b1c1c]"
                placeholder="e.g., Work, Study..."
                placeholderTextColor="#8e706b80"
                value={newTagName}
                onChangeText={setNewTagName}
                maxLength={50}
              />
            </View>

            <View>
              <Text className="text-[12px] font-bold text-[#5a413c] uppercase mb-2 tracking-widest">Choose Color</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {TAG_COLORS.map(color => {
                  const isSelected = newTagColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewTagColor(color)}
                      style={{ backgroundColor: color, width: 34, height: 34, borderRadius: 17 }}
                      className={`items-center justify-center ${isSelected ? 'border-2 border-[#1b1c1c]' : ''}`}
                    >
                      {isSelected && <MaterialIcons name="check" size={18} color="#1b1c1c" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-[12px] font-bold text-[#5a413c] uppercase tracking-widest">Preview:</Text>
              <View style={{ backgroundColor: newTagColor }} className="px-3 py-1.5 rounded-full">
                <Text className="text-[12px] font-bold text-[#1b1c1c]">{newTagName.trim() || 'Tag Name'}</Text>
              </View>
            </View>
          </View>
          <View className="px-5 py-4 border-t border-[#e4e2e2]/50 flex-row gap-3 bg-[#ffffff]">
            <TouchableOpacity className="flex-1 py-1.5 rounded-3xl border border-[#e2bfb8] items-center" onPress={() => setIsCreateTagOpen(false)}>
              <Text className="text-[14px] font-bold text-[#1b1c1c]">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-[2] py-1.5 rounded-3xl items-center flex-row justify-center shadow-sm ${newTagName.trim() ? 'bg-[#c89d7d]' : 'bg-[#e4e2e2]'}`} 
              onPress={handleCreateTag}
              disabled={!newTagName.trim() || isSavingTag}
            >
              {isSavingTag ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className={`text-[15px] font-bold ${newTagName.trim() ? 'text-[#ffffff]' : 'text-[#8e706b]'}`}>Save tag</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

    </ImageBackground>
  );
}