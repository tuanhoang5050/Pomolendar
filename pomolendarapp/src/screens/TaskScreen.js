import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, 
  Animated, StyleSheet, Dimensions, ActivityIndicator, RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

const { width } = Dimensions.get('window');

export default function TaskScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  
  const tabs = ['Tất cả', 'Ngày mai', 'Tuần này', 'Tháng này', 'Hôm nay', 'Đã xong'];

  const fetchTasks = async () => {
    try {
      const response = await api.get('/planner/tasks/');
      setTasks(response.data);
    } catch (error) {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  useEffect(() => {
    Animated.loop(Animated.timing(pulseAnim1, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
    setTimeout(() => {
      Animated.loop(Animated.timing(pulseAnim2, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
    }, 1000);
  }, []);

  const openDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleStartTimer = async (task = null) => {
    if (task) {
      try { await AsyncStorage.setItem('current_task_id', task.id.toString()); } catch (e) {}
    }
    Animated.timing(expandAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => { expandAnim.setValue(0); });
    setTimeout(() => { navigation.navigate('Home'); }, 200);
  };

  const handleToggleTaskComplete = async (task) => {
    const newStatus = !task.is_completed;
    
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t.id === task.id ? { ...t, is_completed: newStatus } : t
      )
    );

    try {
      await api.patch(`/planner/tasks/${task.id}/`, { is_completed: newStatus });
    } catch (error) {
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id ? { ...t, is_completed: task.is_completed } : t
        )
      );
    }
  };

  const filterAndSortTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay() || 7; 
    if (day !== 1) startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const filteredTasks = tasks.filter(task => {
      const isCompleted = task.is_completed;
      
      if (activeTab === 'Tất cả') return true;
      if (activeTab === 'Đã xong') return isCompleted;
      if (isCompleted) return false;

      const taskDate = task.deadline ? new Date(task.deadline) : null;
      
      if (!taskDate) return activeTab === 'Hôm nay';

      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      if (activeTab === 'Hôm nay') return taskDay.getTime() === today.getTime();
      if (activeTab === 'Ngày mai') return taskDay.getTime() === tomorrow.getTime();
      if (activeTab === 'Tuần này') return taskDay >= startOfWeek && taskDay <= endOfWeek;
      if (activeTab === 'Tháng này') return taskDay >= startOfMonth && taskDay <= endOfMonth;
      
      return true;
    });

    return filteredTasks.sort((a, b) => {
      if (a.is_completed === b.is_completed) return 0;
      return a.is_completed ? 1 : -1;
    });
  };

  const getPriorityStyles = (task) => {
    if (task.is_completed) {
      return { line: 'bg-[#e2bfb8]', tagBg: 'bg-[#e4e2e2]', tagText: 'text-[#5a413c]', label: 'Completed', btnBg: 'bg-[#e4e2e2]', btnIcon: 'check', btnIconColor: '#5a413c', opacity: 'opacity-60' };
    }
    const priority = task.priority || 1;
    switch (priority) {
      case 3: return { line: 'bg-[#008b8c]', tagBg: 'bg-[#ffdad6]', tagText: 'text-[#93000a]', label: 'High', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
      case 2: return { line: 'bg-[#006a6a]', tagBg: 'bg-[#00a7a8]', tagText: 'text-[#003535]', label: 'Med', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
      case 1:
      default: return { line: 'bg-[#006b5b]', tagBg: 'bg-[#7cf8dd]', tagText: 'text-[#007261]', label: 'Low', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Không giới hạn';
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return ', Hôm nay';
    if (date.toDateString() === tomorrow.toDateString()) return ', Ngày mai';
    
    return `, ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const renderPomodoroIcons = (completed, target) => {
    const icons = [];
    const maxDisplay = 4;
    const total = Math.max(target || 0, 1);
    const completedSafe = Math.max(completed || 0, 0);
    
    for (let i = 0; i < Math.min(total, maxDisplay); i++) {
      icons.push(
        <MaterialIcons 
          key={i} 
          name="timer" 
          size={16} 
          color={i < completedSafe ? "#ce9d7d" : "#e4e2e2"} 
          style={{ marginRight: 2 }}
        />
      );
    }
    
    return (
      <View className="flex-row items-center mr-2">
        {icons}
        {total > maxDisplay && <Text className="text-[12px] font-bold text-[#5a413c] ml-1">+{total - maxDisplay}</Text>}
      </View>
    );
  };

  const displayedTasks = filterAndSortTasks();

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-6 h-16 mt-7 z-10">
          <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={openDrawer}>
            <MaterialIcons name="menu" size={26} color="#ce9d7d" />
          </TouchableOpacity>
          <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={() => navigation.navigate('AddTask')}>
            <MaterialIcons name="add" size={26} color="#ce9d7d" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: 120 }} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008b8c']} />}
        >
          <View className="px-3 py-2">
            <View className="flex-row flex-wrap w-full bg-[#f5f3f3] p-1 rounded-xl mb-6 justify-between">
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{ width: '31%', marginBottom: 4, marginTop: 4 }}
                  className={`py-3 rounded-lg items-center justify-center ${activeTab === tab ? 'bg-[#ce9d7d]' : 'bg-[#ffffff] border border-[#e4e2e2]'}`}
                >
                  <Text className={`font-bold text-[12px] ${activeTab === tab ? 'text-white' : 'text-[#5a413c]'}`}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-col gap-1">
              {loading ? (
                <ActivityIndicator size="large" color="#008b8c" style={{ marginTop: 50 }} />
              ) : displayedTasks.length > 0 ? (
                displayedTasks.map(task => {
                  const styles = getPriorityStyles(task);
                  return (
                    <TouchableOpacity 
                      key={task.id}
                      className={`bg-[#ffffff] rounded-xl p-2 border border-[#e4e2e2] overflow-hidden flex-row items-center ${styles.opacity}`}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                    >
                      <View className={`absolute top-0 bottom-0 left-0 w-1.5 ${styles.line}`} />
                      
                      <TouchableOpacity 
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ml-1 mr-1 ${task.is_completed ? 'bg-[#008b8c] border-[#008b8c]' : 'border-[#e4e2e2]'}`}
                        onPress={() => handleToggleTaskComplete(task)}
                      >
                        {task.is_completed && <MaterialIcons name="check" size={16} color="#ffffff" />}
                      </TouchableOpacity>

                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center mb-1">
                          <View className={`${styles.tagBg} px-2 py-0.5 rounded mr-2`}>
                            <Text className={`${styles.tagText} text-[8px] font-bold uppercase tracking-wider`}>{styles.label}</Text>
                          </View>

                          {task.scheduled_start_time && (
                            <View className={`px-2 py-0.5 rounded mr-2 ${task.is_completed ? 'bg-[#e4e2e2]' : 'bg-[#dae5e4]'}`}>
                              <Text className={`text-[8px] font-bold uppercase tracking-wider ${task.is_completed ? 'text-[#5a413c]' : 'text-[#008b8c]'}`}>Scheduled</Text>
                            </View>
                          )}

                          <View className="flex-row items-center">
                            <MaterialIcons name={task.is_completed ? "check-circle" : "calendar-today"} size={12} color="#5a413c" />
                            <Text className="text-[#5a413c] text-[10px] font-bold ml-1">
                              {task.is_completed ? 'Đã hoàn thành' : `${formatTime(task.deadline)}${formatDateLabel(task.deadline)}`}
                            </Text>
                          </View>
                        </View>
                        <Text className={`text-[16px] font-bold mb-2 ${task.is_completed ? 'text-[#5a413c] line-through' : 'text-[#1b1c1c]'}`} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <View className="flex-row items-center">
                          {renderPomodoroIcons(task.completed_pomodoros, task.estimated_pomodoros)}
                          <Text className="text-[10px] font-bold text-[#c]">
                            {task.completed_pomodoros || 0}/{task.estimated_pomodoros || 1} Phiên
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        className={`w-8 h-8 rounded-full ${styles.btnBg} items-center justify-center ${task.is_completed ? 'opacity-70' : 'shadow-lg'}`}
                        onPress={() => task.is_completed ? null : handleStartTimer(task)}
                        disabled={task.is_completed}
                      >
                        <MaterialIcons name={styles.btnIcon} size={28} color={styles.btnIconColor} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="items-center justify-center mt-10">
                  <MaterialIcons name="fact-check" size={64} color="#e4e2e2" />
                  <Text className="text-[#5a413c] font-medium mt-4">Không có task nào trong mục này</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#008b8c', transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
        <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#008b8c', transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
        <Animated.View style={{ position: 'absolute', bottom: 72, left: width / 2, width: 2, height: 2, borderRadius: 1, backgroundColor: '#008B8C', transform: [{ translateX: -1 }, { scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1500] }) }], zIndex: 60, pointerEvents: 'none' }} />

        <TouchableOpacity 
          className="absolute bottom-10 left-1/2 w-16 h-16 bg-[#c89d7d] rounded-full items-center justify-center shadow-lg z-50 border border-white/30"
          style={{ elevation: 8, transform: [{ translateX: -32 }] }}
          onPress={() => handleStartTimer(null)}
          activeOpacity={0.9}
        >
          <MaterialIcons name="play-arrow" size={32} color="#ffffff" />
        </TouchableOpacity>
      </SafeAreaView>

      <CustomDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        navigation={navigation} 
        currentScreen="Tasks" 
      />
    </View>
  );
}