import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Animated, Dimensions, 
  StyleSheet, TextInput, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import WheelPicker from './WheelPicker';
import api from '../services/api';

const { height } = Dimensions.get('window');

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const DURATION_OPTIONS = Array.from({ length: 24 }, (_, i) => ((i + 1) * 5).toString().padStart(2, '0'));

const TAG_COLOR_PRESETS = [
  '#F6B8B8', '#F8C9A9', '#F6E58D', '#B8E8C4', '#A0DAB7',
  '#A8DADC', '#AEDFF7', '#A7C7E7', '#B5B9FF', '#C7B8F5',
  '#E0B8F5', '#F5B8E0', '#F5B8C7', '#E8C9A0', '#D9C9A3',
  '#C9D6A3', '#A3D9C9', '#A3C9D9', '#C9A3D9', '#D9A3B8'
];

export default function QuickCreateTaskPopup({ 
  visible, 
  onClose, 
  onTaskCreated, 
  initialStartTime = null 
}) {
  const slideAnim = React.useRef(new Animated.Value(height)).current;
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPomo, setNewTaskPomo] = useState(1);
  const [newTaskDuration, setNewTaskDuration] = useState('25');
  const [showCustomPomo, setShowCustomPomo] = useState(false);
  const [activeSubPopup, setActiveSubPopup] = useState(null);
  const [quickPriority, setQuickPriority] = useState(4);

  const [tempDeadlineDate, setTempDeadlineDate] = useState(new Date());
  const [tempDeadlineQuick, setTempDeadlineQuick] = useState('Today');
  const [deadlineViewDate, setDeadlineViewDate] = useState(new Date());
  const [finalDeadline, setFinalDeadline] = useState(null);

  const [tempReminderDate, setTempReminderDate] = useState(new Date());
  const [reminderViewDate, setReminderViewDate] = useState(new Date());
  const [tempReminderHour, setTempReminderHour] = useState('09');
  const [tempReminderMinute, setTempReminderMinute] = useState('00');
  const [tempReminderQuick, setTempReminderQuick] = useState('');
  const [finalReminder, setFinalReminder] = useState(null);

  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[0]);

  useEffect(() => {
    if (visible) {
      if (initialStartTime) {
        setTempDeadlineDate(new Date(initialStartTime));
        setDeadlineViewDate(new Date(initialStartTime));
        setTempReminderDate(new Date(initialStartTime));
        setReminderViewDate(new Date(initialStartTime));
        setTempReminderHour(initialStartTime.getHours().toString().padStart(2, '0'));
        setTempReminderMinute(initialStartTime.getMinutes().toString().padStart(2, '0'));
      } else {
        setTempDeadlineDate(new Date());
        setDeadlineViewDate(new Date());
        setTempReminderDate(new Date());
        setReminderViewDate(new Date());
      }
      fetchAvailableTags();
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => {
        resetStates();
      });
    }
  }, [visible]);

  const resetStates = () => {
    setNewTaskTitle('');
    setNewTaskPomo(1);
    setNewTaskDuration('25');
    setShowCustomPomo(false);
    setActiveSubPopup(null);
    setQuickPriority(4);
    setFinalDeadline(null);
    setFinalReminder(null);
    setSelectedTagIds([]);
    setIsCreatingTag(false);
    setNewTagName('');
    setTempDeadlineQuick('Today');
    setTempReminderQuick('');
  };

  const fetchAvailableTags = async () => {
    setLoadingTags(true);
    try {
      const res = await api.get('/planner/tags/');
      setAvailableTags(res.data || []);
    } catch (e) {
      setAvailableTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await api.post('/planner/tags/', { name: newTagName.trim(), color: newTagColor });
      setAvailableTags(prev => [...prev, res.data]);
      setSelectedTagIds(prev => [...prev, res.data.id]);
      setNewTagName('');
      setNewTagColor(TAG_COLOR_PRESETS[0]);
      setIsCreatingTag(false);
    } catch (e) {}
  };

  const toggleTagSelection = (tagId) => {
    setSelectedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };

  const handleQuickCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    let taskData = {
      title: newTaskTitle,
      estimated_pomodoros: newTaskPomo,
      focus_duration: parseInt(newTaskDuration, 10),
      short_break: 5,
      priority: quickPriority === 4 ? 2 : quickPriority,
      is_completed: false,
      tags: selectedTagIds
    };

    if (finalDeadline) taskData.deadline = finalDeadline;
    if (finalReminder) taskData.reminder = finalReminder;

    if (initialStartTime) {
      taskData.scheduled_start_time = initialStartTime.toISOString();
      const durationMinutes = newTaskPomo * parseInt(newTaskDuration, 10); 
      taskData.scheduled_end_time = new Date(initialStartTime.getTime() + durationMinutes * 60000).toISOString();
    }

    try {
      await api.post('/planner/tasks/', taskData);
      onTaskCreated(); 
      onClose();
    } catch (e) {
      Alert.alert("Error", "Could not create task");
    }
  };

  const handleSaveDeadline = () => {
    setFinalDeadline(tempDeadlineQuick !== 'Remove' && tempDeadlineDate ? tempDeadlineDate.toISOString() : null);
    setActiveSubPopup(null);
  };

  const handleReminderQuickSelect = (type) => {
    setTempReminderQuick(type);
    if (finalDeadline && (type === '5 min' || type === '10 min' || type === 'At time')) {
      const d = new Date(finalDeadline);
      if (type === '5 min') d.setMinutes(d.getMinutes() - 5);
      if (type === '10 min') d.setMinutes(d.getMinutes() - 10);
      setReminderViewDate(new Date(d));
      setTempReminderDate(new Date(d));
      setTempReminderHour(d.getHours().toString().padStart(2, '0'));
      setTempReminderMinute(d.getMinutes().toString().padStart(2, '0'));
    }
  };

  const handleSaveReminder = () => {
    if (tempReminderDate) {
      const d = new Date(tempReminderDate);
      d.setHours(parseInt(tempReminderHour || 0));
      d.setMinutes(parseInt(tempReminderMinute || 0));
      d.setSeconds(0);

      if (d < new Date()) {
        Alert.alert("Error", "Cannot set a reminder for a past time.");
        return;
      }
      if (finalDeadline && d > new Date(finalDeadline)) {
        Alert.alert("Error", "Reminder cannot be later than the due date.");
        return;
      }
      setFinalReminder(d.toISOString());
    } else {
      setFinalReminder(null);
    }
    setActiveSubPopup(null);
  };

  const dYear = deadlineViewDate.getFullYear();
  const dMonth = deadlineViewDate.getMonth();
  const dDaysInMonth = new Date(dYear, dMonth + 1, 0).getDate();
  const dAdjustedFirstDay = (new Date(dYear, dMonth, 1).getDay() || 7) - 1;

  const rYear = reminderViewDate.getFullYear();
  const rMonth = reminderViewDate.getMonth();
  const rDaysInMonth = new Date(rYear, rMonth + 1, 0).getDate();
  const rAdjustedFirstDay = (new Date(rYear, rMonth, 1).getDay() || 7) - 1;

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 }]} />
      <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, minHeight: 220, zIndex: 101, transform: [{ translateY: slideAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15, maxHeight: height * 0.85 }}>
        <View className="w-full items-center pt-3 pb-2"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>

        <View className="px-3 pt-2 pb-6 flex-col">
          {activeSubPopup === null ? (
            <>
              <TextInput
                className="w-full text-[18px] text-[#1b1c1c] font-medium mb-3"
                placeholder="What do you want to do?"
                placeholderTextColor="#8e706b"
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
              />

              <View className="flex-row items-center border-t border-b border-[#f5f3f3] py-3">
                {!showCustomPomo ? (
                  <View className="flex-row items-center gap-2 flex-1">
                    {[1, 2, 3, 4, 5].map(num => (
                      <TouchableOpacity key={num} onPress={() => setNewTaskPomo(num)} className="px-1 py-1">
                        <MaterialIcons name="timer" size={28} color={newTaskPomo >= num ? "#c89d7d" : "#e4e2e2"} />
                      </TouchableOpacity>
                    ))}
                    <View className="flex-1 flex-row items-center justify-end">
                      <WheelPicker items={DURATION_OPTIONS} selectedValue={newTaskDuration} onValueChange={setNewTaskDuration} />
                      <Text className="text-[12px] font-bold text-[#5a413c] mx-1">min</Text>
                      <TouchableOpacity onPress={() => setShowCustomPomo(true)} className="p-1"><MaterialIcons name="keyboard-arrow-right" size={24} color="#ce896b" /></TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center flex-1">
                    <TouchableOpacity onPress={() => setShowCustomPomo(false)} className="p-1 mr-2"><MaterialIcons name="keyboard-arrow-left" size={24} color="#ce896b" /></TouchableOpacity>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 flex-row">
                      {[...Array(20)].map((_, i) => (
                        <TouchableOpacity
                          key={i} onPress={() => setNewTaskPomo(i + 1)}
                          className={`w-10 h-10 items-center justify-center rounded-full mx-1 ${newTaskPomo === i + 1 ? 'bg-[#c89d7d]' : 'bg-[#f5f3f3]'}`}
                        >
                          <Text className={`text-[16px] font-bold ${newTaskPomo === i + 1 ? 'text-white' : 'text-[#1b1c1c]'}`}>{i + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between mt-4">
                <View className="flex-row gap-4">
                  <TouchableOpacity onPress={() => setActiveSubPopup('calendar')} className="p-2.5">
                     <MaterialIcons name="event" size={28} color={finalDeadline ? '#5c8a8a' : '#5c8a8a'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveSubPopup('priority')} className="p-2.5">
                     <MaterialIcons name="flag" size={28} color={quickPriority === 3 ? '#ba1a1a' : quickPriority === 2 ? '#ff8c00' : quickPriority === 1 ? '#c89d7d' : '#6da7e2'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveSubPopup('reminder')} className="p-2.5">
                     <MaterialIcons name="notifications-none" size={28} color={finalReminder ? '#C27664' : '#C27664'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveSubPopup('tags')} className="p-2.5">
                     <MaterialIcons name="local-offer" size={28} color={selectedTagIds.length > 0 ? '#a5b56c' : '#a5b56c'} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  className={`w-12 h-12 rounded-full items-center justify-center ${newTaskTitle.trim() ? 'bg-[#c89d7d]' : 'bg-[#e4e2e2]'}`}
                  onPress={handleQuickCreateTask} disabled={!newTaskTitle.trim()}
                >
                   <MaterialIcons name="arrow-upward" size={26} color={newTaskTitle.trim() ? '#ffffff' : '#8e706b'} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View className="flex-col pb-2">
              
              {activeSubPopup === 'calendar' && (
                <View className="flex-col">
                  <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Due Date</Text>
                  
                  <View className="flex-row flex-wrap justify-between gap-y-2 mb-4">
                    <TouchableOpacity className={`flex-row items-center gap-1 px-4 py-2 rounded-3xl w-[48%] ${tempDeadlineQuick === 'Today' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30'}`} onPress={() => { setTempDeadlineQuick('Today'); setTempDeadlineDate(new Date()); setDeadlineViewDate(new Date()); }}>
                      <MaterialIcons name="today" size={20} color={tempDeadlineQuick === 'Today' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Today' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className={`flex-row items-center gap-1 px-4 py-2 rounded-3xl w-[48%] ${tempDeadlineQuick === 'Tomorrow' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30'}`} onPress={() => { setTempDeadlineQuick('Tomorrow'); const t = new Date(); t.setDate(t.getDate() + 1); setTempDeadlineDate(t); setDeadlineViewDate(t); }}>
                      <MaterialIcons name="event" size={20} color={tempDeadlineQuick === 'Tomorrow' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Tomorrow' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className={`flex-row items-center gap-1 px-4 py-2 rounded-3xl w-[48%] ${tempDeadlineQuick === 'In 7 days' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30'}`} onPress={() => { setTempDeadlineQuick('In 7 days'); const t = new Date(); t.setDate(t.getDate() + 7); setTempDeadlineDate(t); setDeadlineViewDate(t); }}>
                      <MaterialIcons name="date-range" size={20} color={tempDeadlineQuick === 'In 7 days' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'In 7 days' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>In 7 days</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className={`flex-row items-center gap-1 px-4 py-2 rounded-3xl w-[48%] ${tempDeadlineQuick === 'Remove' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30'}`} onPress={() => { setTempDeadlineQuick('Remove'); setTempDeadlineDate(null); setFinalDeadline(null); }}>
                      <MaterialIcons name="calendar-today" size={20} color={tempDeadlineQuick === 'Remove' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Remove' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Remove</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-col gap-2 mb-6">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Month {dMonth + 1}, {dYear}</Text>
                      <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => setDeadlineViewDate(new Date(dYear, dMonth - 1, 1))} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => setDeadlineViewDate(new Date(dYear, dMonth + 1, 1))} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap px-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (<View key={i} className="w-[14.28%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
                      {Array(dAdjustedFirstDay).fill(null).map((_, i) => <View key={`de-${i}`} className="w-[14.28%] h-10 mb-2" />)}
                      {Array.from({ length: dDaysInMonth }, (_, i) => i + 1).map(day => {
                        const isSelected = tempDeadlineDate && tempDeadlineDate.getDate() === day && tempDeadlineDate.getMonth() === dMonth && tempDeadlineDate.getFullYear() === dYear;
                        return (
                          <View key={day} className="w-[14.28%] items-center mb-2">
                            <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : ''}`} onPress={() => { setTempDeadlineDate(new Date(dYear, dMonth, day)); setTempDeadlineQuick(''); }}>
                              <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 border border-[#e2bfb8] py-1.5 rounded-3xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveDeadline} className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Done</Text></TouchableOpacity>
                  </View>
                </View>
              )}

              {activeSubPopup === 'priority' && (
                <>
                  <Text className="text-[18px] font-bold text-[#1b1c1c] mb-6">Priority Level</Text>
                  <View className="flex-row justify-between mb-8">
                    {[
                      { val: 3, label: 'High', color: '#ba1a1a' },
                      { val: 2, label: 'Med', color: '#ff8c00' },
                      { val: 1, label: 'Low', color: '#c89d7d' },
                      { val: 4, label: 'None', color: '#5a413c' }
                    ].map(p => (
                      <TouchableOpacity 
                        key={p.val} onPress={() => setQuickPriority(p.val)} 
                        className={`w-[23%] aspect-square items-center justify-center rounded-2xl border ${quickPriority === p.val ? 'border-[#c89d7d] bg-[#c89d7d]/10' : 'border-[#e4e2e2] bg-[#ffffff]'}`}
                      >
                        <MaterialIcons name="flag" size={32} color={p.color} />
                        <Text className="text-[12px] font-bold mt-1" style={{ color: p.color }}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 border border-[#e2bfb8] py-1.5 rounded-3xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Done</Text></TouchableOpacity>
                  </View>
                </>
              )}

              {activeSubPopup === 'reminder' && (
                <View className="flex-col">
                  <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Reminder Settings</Text>
                  <View className="flex-row items-center justify-between mb-4">
                      <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Time</Text>
                      <View className="flex-row items-center gap-1">
                      <WheelPicker items={HOURS} selectedValue={tempReminderHour} onValueChange={setTempReminderHour} />
                      <Text className="text-[20px] font-bold text-[#1b1c1c] pb-1">:</Text>
                      <WheelPicker items={MINUTES} selectedValue={tempReminderMinute} onValueChange={setTempReminderMinute} />
                      </View>
                  </View>

                  <View className="flex-col gap-2 mb-6">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Month {rMonth + 1}, {rYear}</Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity onPress={() => setReminderViewDate(new Date(rYear, rMonth - 1, 1))} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setReminderViewDate(new Date(rYear, rMonth + 1, 1))} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap px-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (<View key={i} className="w-[14.28%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
                      {Array(rAdjustedFirstDay).fill(null).map((_, i) => <View key={`re-${i}`} className="w-[14.28%] h-10 mb-2" />)}
                      {Array.from({ length: rDaysInMonth }, (_, i) => i + 1).map(day => {
                          const cellDate = new Date(rYear, rMonth, day);
                          const isSelected = tempReminderDate && tempReminderDate.getDate() === day && tempReminderDate.getMonth() === rMonth && tempReminderDate.getFullYear() === rYear;
                          
                          const now = new Date();
                          now.setHours(0,0,0,0);
                          const isPast = cellDate < now;
                          let isAfterDeadline = false;
                          if (finalDeadline) {
                             const fd = new Date(finalDeadline);
                             fd.setHours(0,0,0,0);
                             isAfterDeadline = cellDate > fd;
                          }
                          const isDisabled = isPast || isAfterDeadline;

                          return (
                          <View key={day} className="w-[14.28%] items-center mb-2">
                              <TouchableOpacity 
                                disabled={isDisabled}
                                className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : isDisabled ? 'opacity-30' : ''}`} 
                                onPress={() => { setTempReminderDate(new Date(rYear, rMonth, day)); setTempReminderQuick(''); }}
                              >
                                <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                              </TouchableOpacity>
                          </View>
                          );
                      })}
                      </View>
                  </View>

                  <View className="flex-row gap-3">
                       <TouchableOpacity onPress={() => { setTempReminderDate(new Date()); setFinalReminder(null); setActiveSubPopup(null); }} className="flex-1 border border-[#e2bfb8] py-1.5 rounded-3xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Cancel</Text></TouchableOpacity>
                       <TouchableOpacity onPress={handleSaveReminder} className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Save</Text></TouchableOpacity>
                  </View>
                </View>
              )}

              {activeSubPopup === 'tags' && (
                <View className="flex-col">
                  {!isCreatingTag ? (
                    <>
                      <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Select Tags</Text>
                      {loadingTags ? (
                        <ActivityIndicator size="small" color="#c89d7d" style={{ marginVertical: 20 }} />
                      ) : (
                        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                          <View className="flex-col mb-4">
                            {availableTags.length > 0 ? (
                              availableTags.map(tag => {
                                const isSelected = selectedTagIds.includes(tag.id);
                                return (
                                  <TouchableOpacity
                                    key={tag.id}
                                    onPress={() => toggleTagSelection(tag.id)}
                                    className="flex-row items-center justify-between p-3 rounded-xl active:bg-[#f5f3f3] mb-1"
                                  >
                                    <View className="flex-row items-center gap-3 flex-1">
                                      <View style={{ backgroundColor: tag.color }} className="w-6 h-6 rounded-full" />
                                      <Text className="text-[16px] font-medium text-[#1b1c1c]" numberOfLines={1}>{tag.name}</Text>
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
                          </View>
                        </ScrollView>
                      )}
                      
                      <View className="pt-4 border-t border-[#e4e2e2]/50 mt-2 flex-row gap-3 mb-3">
                        <TouchableOpacity onPress={() => setIsCreatingTag(true)} className="flex-1 py-1.5 rounded-3xl border border-[#c89d7d] border-dashed items-center flex-row justify-center">
                          <MaterialIcons name="add" size={18} color="#c89d7d" />
                          <Text className="text-[15px] font-bold text-[#c89d7d] ml-1">Create New</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm justify-center">
                          <Text className="text-white font-bold text-[16px]">Done</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Create New Tag</Text>
                      <View className="flex-col gap-5">
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
                          <View className="flex-row flex-wrap gap-3">
                            {TAG_COLOR_PRESETS.map(color => {
                              const isSelected = newTagColor === color;
                              return (
                                <TouchableOpacity
                                  key={color}
                                  onPress={() => setNewTagColor(color)}
                                  style={{ backgroundColor: color, width: 36, height: 36, borderRadius: 18 }}
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

                      <View className="pt-4 gap-2 border-t border-[#e4e2e2]/50 mt-6 flex-row">
                        <TouchableOpacity onPress={() => setIsCreatingTag(false)} className="flex-1 py-2 rounded-3xl border border-[#e2bfb8] items-center">
                          <Text className="text-[14px] font-bold text-[#1b1c1c]">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          className={`flex-[2] py-2 rounded-3xl items-center flex-row justify-center ${newTagName.trim() ? 'bg-[#c89d7d]' : 'bg-[#e4e2e2]'}`} 
                          onPress={handleCreateTag}
                          disabled={!newTagName.trim()}
                        >
                          <Text className={`text-[15px] font-bold ${newTagName.trim() ? 'text-[#ffffff]' : 'text-[#8e706b]'}`}>Save tag</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}