import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, FlatList,
  Animated, StyleSheet, Dimensions, ActivityIndicator, RefreshControl,
  ImageBackground
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';
import QuickCreateTaskPopup from '../components/QuickCreateTaskPopup';
import { rescheduleAllTaskReminders, scheduleTaskReminder } from '../services/notifications';

const { width } = Dimensions.get('window');
const MAX_VISIBLE_TAGS = 2;

export default function TaskScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const loop1Ref = useRef(null);
  const loop2Ref = useRef(null);

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const tabs = ['All', 'Tomorrow', 'This Week', 'This Month', 'Today', 'Done'];

  const fetchTasks = async () => {
    try {
      const response = await api.get('/planner/tasks/');
      setTasks(response.data);
      rescheduleAllTaskReminders(response.data);
    } catch (error) {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkTimerState = async () => {
    try {
      const state = await AsyncStorage.getItem('timer_state');
      setIsTimerRunning(state === 'running');
    } catch (e) {
      setIsTimerRunning(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
      checkTimerState();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
    checkTimerState();
  };

  useEffect(() => {
    if (isTimerRunning) {
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);

      loop1Ref.current = Animated.loop(Animated.timing(pulseAnim1, { toValue: 1, duration: 2000, useNativeDriver: true }));
      loop1Ref.current.start();

      setTimeout(() => {
        loop2Ref.current = Animated.loop(Animated.timing(pulseAnim2, { toValue: 1, duration: 2000, useNativeDriver: true }));
        loop2Ref.current.start();
      }, 1000);
    } else {
      if (loop1Ref.current) loop1Ref.current.stop();
      if (loop2Ref.current) loop2Ref.current.stop();
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);
    }

    return () => {
      if (loop1Ref.current) loop1Ref.current.stop();
      if (loop2Ref.current) loop2Ref.current.stop();
    };
  }, [isTimerRunning]);

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
      await scheduleTaskReminder({ ...task, is_completed: newStatus });
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

      if (activeTab === 'All') return true;
      if (activeTab === 'Done') return isCompleted;
      if (isCompleted) return false;

      const taskDate = task.deadline ? new Date(task.deadline) : null;

      if (!taskDate) return activeTab === 'Today';

      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      if (activeTab === 'Today') return taskDay.getTime() === today.getTime();
      if (activeTab === 'Tomorrow') return taskDay.getTime() === tomorrow.getTime();
      if (activeTab === 'This Week') return taskDay >= startOfWeek && taskDay <= endOfWeek;
      if (activeTab === 'This Month') return taskDay >= startOfMonth && taskDay <= endOfMonth;

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
      case 3: return { line: 'bg-[#C27664]', tagBg: 'bg-[#C27664]', tagText: 'text-white', label: 'High', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
      case 2: return { line: 'bg-[#A9B388]', tagBg: 'bg-[#A9B388]', tagText: 'text-white', label: 'Med', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
      case 1:
      default: return { line: 'bg-[#D1BB9E]', tagBg: 'bg-[#D1BB9E]', tagText: 'text-[#8e706b]', label: 'Low', btnBg: 'bg-[#c89d7d]', btnIcon: 'play-arrow', btnIconColor: '#ffffff', opacity: 'opacity-100' };
    }
  };

  const formatTaskTime = (dateString) => {
    if (!dateString) return 'No limit';
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return ', Today';
    if (date.toDateString() === tomorrow.toDateString()) return ', Tomorrow';

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

  const renderTaskTags = (tagsDetail) => {
    if (!tagsDetail || tagsDetail.length === 0) return null;
    const visibleTags = tagsDetail.slice(0, MAX_VISIBLE_TAGS);
    const remaining = tagsDetail.length - MAX_VISIBLE_TAGS;

    return (
      <View className="flex-row items-center">
        {visibleTags.map(tag => (
          <View key={tag.id} style={{ backgroundColor: tag.color, maxWidth: 90 }} className="px-2 py-0.5 rounded-full mr-1">
            <Text className="text-[9px] font-bold text-[#1b1c1c]" numberOfLines={1}>{tag.name}</Text>
          </View>
        ))}
        {remaining > 0 && (
          <View className="px-2 py-0.5 rounded-full bg-[#e4e2e2] mr-1">
            <Text className="text-[9px] font-bold text-[#5a413c]">+{remaining}</Text>
          </View>
        )}
      </View>
    );
  };

  const displayedTasks = filterAndSortTasks();

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover" 
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-6 h-16 mt-7 z-10">
          <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={openDrawer}>
            <MaterialIcons name="menu" size={26} color="#ce9d7d" />
          </TouchableOpacity>
          <View className="w-10" />
        </View>

        <FlatList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 12, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          data={displayedTasks}
          keyExtractor={(task) => task.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#c89d7d']} />}
          ListHeaderComponent={
            <>
              <View className="flex-row flex-wrap w-full bg-[#f5f3f3] p-1 rounded-xl mb-3 justify-between">
                {tabs.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={{ width: '31%', marginBottom: 4, marginTop: 4 }}
                    className={`py-2 rounded-3xl items-center justify-center ${activeTab === tab ? 'bg-[#ce9d7d]' : 'bg-[#ffffff] border border-[#e4e2e2]'}`}
                  >
                    <Text className={`font-bold text-[12px] ${activeTab === tab ? 'text-white' : 'text-[#5a413c]'}`}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setIsQuickCreateOpen(true)}
                className="w-full py-1.5 rounded-3xl border border-dashed border-[#c89d7d] items-center justify-center flex-row mb-3 bg-white"
              >
                <MaterialIcons name="add" size={20} color="#c89d7d" />
                <Text className="text-[14px] font-bold text-[#c89d7d] ml-1">Add Task</Text>
              </TouchableOpacity>

              {loading && <ActivityIndicator size="large" color="#c89d7d" style={{ marginTop: 50 }} />}
            </>
          }
          ListEmptyComponent={
            !loading ? (
              <View className="items-center justify-center mt-10">
                <MaterialIcons name="fact-check" size={64} color="#e4e2e2" />
                <Text className="text-[#5a413c] font-medium mt-4">No tasks in this section</Text>
              </View>
            ) : null
          }
          renderItem={({ item: task }) => {
            const styles = getPriorityStyles(task);
            return (
              <TouchableOpacity
                className={`bg-[#ffffff] rounded-xl p-2 border border-[#e4e2e2] overflow-hidden flex-row items-center mb-1 ${styles.opacity}`}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              >
                <View className={`absolute top-0 bottom-0 left-0 w-1.5 ${styles.line}`} />

                <TouchableOpacity
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ml-1 mr-1 ${task.is_completed ? 'bg-[#c89d7d] border-[#c89d7d]' : 'border-[#e4e2e2]'}`}
                  onPress={() => handleToggleTaskComplete(task)}
                >
                  {task.is_completed && <MaterialIcons name="check" size={16} color="#ffffff" />}
                </TouchableOpacity>

                <View className="flex-1 pr-2 pl-1">
                  <View className="flex-row items-center mb-1">
                    {task.scheduled_start_time && (
                      <View className={`px-2 py-0.5 rounded mr-2 ${task.is_completed ? 'bg-[#e4e2e2]' : 'bg-[#c89d7d]/20'}`}>
                        <Text className="text-[8px] font-bold uppercase tracking-wider text-[#5a413c]">Scheduled</Text>
                      </View>
                    )}

                    <View className="flex-row items-center">
                      <MaterialIcons name={task.is_completed ? "check-circle" : "calendar-today"} size={12} color="#5a413c" />
                      <Text className="text-[#5a413c] text-[10px] font-bold ml-1">
                        {task.is_completed ? 'Completed' : `${formatTaskTime(task.deadline)}${formatDateLabel(task.deadline)}`}
                      </Text>
                    </View>
                  </View>
                  <Text className={`text-[16px] font-bold mb-1.5 ${task.is_completed ? 'text-[#5a413c] line-through' : 'text-[#1b1c1c]'}`} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <View className="flex-row items-center flex-wrap gap-2">
                    <View className="flex-row items-center">
                      {renderPomodoroIcons(task.completed_pomodoros, task.estimated_pomodoros)}
                      <Text className="text-[10px] font-bold text-[#5a413c]">
                        {task.completed_pomodoros || 0}/{task.estimated_pomodoros || 1} Sessions
                      </Text>
                    </View>
                    {renderTaskTags(task.tags_detail)}
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
          }}
        />

        {isTimerRunning && (
          <>
            <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
            <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
          </>
        )}
        
        <Animated.View style={{ position: 'absolute', bottom: 72, left: width / 2, width: 2, height: 2, borderRadius: 1, backgroundColor: '#c89d7d', transform: [{ translateX: -1 }, { scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1500] }) }], zIndex: 60, pointerEvents: 'none' }} />

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

      <QuickCreateTaskPopup 
        visible={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onTaskCreated={fetchTasks}
      />
    </ImageBackground>
  );
}