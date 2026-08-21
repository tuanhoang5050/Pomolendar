import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, Dimensions, 
  Animated, StyleSheet, TouchableWithoutFeedback, ScrollView, Alert, AppState, NativeModules, FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import Slider from '@react-native-community/slider';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

const { DeepFocus } = NativeModules;
const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [totalTime, setTotalTime] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [endTime, setEndTime] = useState(null);
  const [timerState, setTimerState] = useState('idle'); 
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [isTasksPopupOpen, setIsTasksPopupOpen] = useState(false);
  const [popupView, setPopupView] = useState('tasks');
  const [selectedFilter, setSelectedFilter] = useState('Today');
  const [tasks, setTasks] = useState([]);
  
  // State lưu thông tin Task đang được chọn
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('Work');

  // --- STATE DÀNH CHO DEEP FOCUS ---
  const [isDeepFocusEnabled, setIsDeepFocusEnabled] = useState(false);
  const [showDeepFocusPrompt, setShowDeepFocusPrompt] = useState(false);
  const [showAllowListModal, setShowAllowListModal] = useState(false);
  
  const [installedApps, setInstalledApps] = useState([]);
  const [allowedAppPackages, setAllowedAppPackages] = useState([]);

  const splitAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  const tasksPopupAnim = useRef(new Animated.Value(-1000)).current;

  const fetchTasks = async () => {
    try {
      const response = await api.get('/planner/tasks/');
      const fetchedTasks = response.data;
      setTasks(fetchedTasks);

      // Cập nhật lại Task đang chọn (nếu có)
      const taskId = await AsyncStorage.getItem('current_task_id');
      if (taskId) {
        const currentTask = fetchedTasks.find(t => t.id.toString() === taskId);
        if (currentTask) {
          setSelectedTask(currentTask);
          setSelectedTaskTitle(currentTask.title);
        } else {
          setSelectedTask(null);
          setSelectedTaskTitle('Work');
        }
      } else {
        setSelectedTask(null);
        setSelectedTaskTitle('Work');
      }
    } catch (error) {
      setTasks([]);
    }
  };

  const syncTimer = useCallback(async () => {
    try {
      const savedState = await AsyncStorage.getItem('timer_state');
      const savedEndTime = await AsyncStorage.getItem('timer_end_time');
      const savedTotalTime = await AsyncStorage.getItem('timer_total_time');
      const savedTimeLeft = await AsyncStorage.getItem('timer_time_left');
      
      if (savedTotalTime) setTotalTime(parseInt(savedTotalTime, 10));

      if (savedState === 'running' && savedEndTime) {
        setEndTime(parseInt(savedEndTime, 10));
        setTimerState('running');
        setIsFocusMode(true);
      } else if (savedState === 'paused' && savedTimeLeft) {
        setTimeLeft(parseInt(savedTimeLeft, 10));
        setTimerState('paused');
        setIsFocusMode(false);
      } else if (savedTimeLeft) {
        setTimeLeft(parseInt(savedTimeLeft, 10));
        setTimerState('idle');
        setIsFocusMode(false);
      }
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
      syncTimer();
    }, [syncTimer])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        syncTimer();
      }
    });
    return () => subscription.remove();
  }, [syncTimer]);

  const handlePomodoroComplete = async () => {
    if (isDeepFocusEnabled) {
      stopDeepFocusMode();
    }

    try {
      const taskId = await AsyncStorage.getItem('current_task_id');
      const durationMinutes = Math.floor(totalTime / 60);
      let response;

      if (taskId) {
        response = await api.post(`/planner/tasks/${taskId}/complete-pomodoro/`, {
          duration_minutes: durationMinutes
        });
      } else {
        response = await api.post('/planner/freestyle-pomodoro/', {
          duration_minutes: durationMinutes
        });
      }

      const gami = response.data?.gamification;
      if (gami) {
        let msg = `⭐ Điểm nhận được: +${gami.points_earned}`;
        if (gami.leveled_up) {
          msg += `\n\n🎉 Tuyệt vời! Bạn đã nhận thêm 1 cuốn sách mới vào tủ sách.`;
        }
        Alert.alert("Hoàn thành Pomodoro!", msg);
      } else {
        Alert.alert("Hoàn thành!", "Phiên tập trung của bạn đã được lưu lại.");
      }
      
      fetchTasks();
    } catch (error) {
      Alert.alert("Lỗi", "Đã xảy ra sự cố khi lưu phiên Pomodoro.");
    } finally {
      setTimeLeft(totalTime);
      setTimerState('idle');
      await AsyncStorage.setItem('timer_time_left', totalTime.toString());
    }
  };

  useEffect(() => {
    let interval;
    if (timerState === 'running' && endTime) {
      const checkTime = () => {
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        if (remaining >= 0) {
          setTimeLeft(remaining);
        } else {
          clearInterval(interval);
          setTimeLeft(0);
          setTimerState('idle');
          setIsFocusMode(false);
          setEndTime(null);
          AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_time_left']).then(() => {
            handlePomodoroComplete();
          });
        }
      };
      checkTime();
      interval = setInterval(checkTime, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState, endTime]);

  useEffect(() => {
    if (DeepFocus && isDeepFocusEnabled) {
      if (timerState === 'running' && endTime) {
        DeepFocus.setTimerState('running', endTime);
      } else {
        DeepFocus.setTimerState(timerState, timeLeft);
      }
    }
  }, [timerState, endTime, timeLeft, isDeepFocusEnabled]);

  useEffect(() => {
    Animated.spring(splitAnim, {
      toValue: timerState === 'paused' ? 1 : 0,
      useNativeDriver: true,
      tension: 50, 
      friction: 7, 
    }).start();
  }, [timerState]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocusMode ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [isFocusMode]);

  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const startTimer = async () => {
    const newEndTime = Date.now() + timeLeft * 1000;
    setTimerState('running');
    setIsFocusMode(true);
    setEndTime(newEndTime);
    await AsyncStorage.setItem('timer_state', 'running');
    await AsyncStorage.setItem('timer_end_time', newEndTime.toString());
    await AsyncStorage.setItem('timer_total_time', totalTime.toString());
  };
  
  const pauseTimer = async () => {
    setTimerState('paused');
    setIsFocusMode(false);
    setEndTime(null);
    await AsyncStorage.setItem('timer_state', 'paused');
    await AsyncStorage.setItem('timer_time_left', timeLeft.toString());
  };
  
  const stopTimer = async () => {
    setTimerState('idle');
    setIsFocusMode(false);
    setEndTime(null);
    setTimeLeft(totalTime);
    await AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_time_left']);
    
    if (isDeepFocusEnabled) {
      stopDeepFocusMode();
    }
  };

  const toggleFocusMode = () => {
    if (timerState === 'running') {
      setIsFocusMode(!isFocusMode);
    }
  };

  const openTasksPopup = () => {
    setPopupView('tasks');
    setIsTasksPopupOpen(true);
    Animated.timing(tasksPopupAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeTasksPopup = () => {
    Animated.timing(tasksPopupAnim, {
      toValue: -1000,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsTasksPopupOpen(false);
      setPopupView('tasks');
    });
  };

  const handleSliderChange = async (val) => {
    const newTime = val * 60;
    setTotalTime(newTime);
    setTimeLeft(newTime);
    await AsyncStorage.setItem('timer_total_time', newTime.toString());
    await AsyncStorage.setItem('timer_time_left', newTime.toString());
  };

  const handleSelectTask = async (task) => {
    try {
      await AsyncStorage.setItem('current_task_id', task.id.toString());
      setSelectedTask(task);
      setSelectedTaskTitle(task.title);
      
      const newTime = task.focus_duration * 60;
      setTotalTime(newTime);
      setTimeLeft(newTime);
      setTimerState('idle');
      setEndTime(null);
      setIsFocusMode(false);
      
      await AsyncStorage.setItem('timer_total_time', newTime.toString());
      await AsyncStorage.setItem('timer_time_left', newTime.toString());
      await AsyncStorage.multiRemove(['timer_state', 'timer_end_time']);
    } catch (e) {}
    closeTasksPopup();
  };

  const getFilteredTasks = () => {
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

    return tasks.filter(task => {
      if (task.is_completed) return false;
      if (selectedFilter === 'Tasks') return true;

      const taskDate = task.deadline ? new Date(task.deadline) : null;
      if (!taskDate) return selectedFilter === 'Today';

      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      if (selectedFilter === 'Today') return taskDay.getTime() === today.getTime();
      if (selectedFilter === 'Tomorrow') return taskDay.getTime() === tomorrow.getTime();
      if (selectedFilter === 'This Week') return taskDay >= startOfWeek && taskDay <= endOfWeek;
      if (selectedFilter === 'This Month') return taskDay >= startOfMonth && taskDay <= endOfMonth;
      
      return true;
    });
  };

  const filteredTasks = getFilteredTasks();

  const renderTimerIcons = () => {
    const est = selectedTask ? Math.max(selectedTask.estimated_pomodoros || 1, 1) : 4;
    const comp = selectedTask ? Math.max(selectedTask.completed_pomodoros || 0, 0) : 0;
    const maxDisplay = 7; 
    const icons = [];
    
    for (let i = 0; i < Math.min(est, maxDisplay); i++) {
      icons.push(
        <MaterialIcons 
          key={i} 
          name="timer" 
          size={18} 
          color={i < comp ? "#c89d7d" : "#e4e2e2"} 
          style={{ marginHorizontal: 4 }}
        />
      );
    }
    
    return (
      <View className="flex-row items-center justify-center mb-6 mt-2">
        {icons}
        {est > maxDisplay && <Text className="text-[12px] font-bold text-[#8e706b] ml-1">+{est - maxDisplay}</Text>}
      </View>
    );
  };

  const centerOpacity = splitAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const sideOpacity = splitAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] });
  const leftTranslate = splitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -90] });
  const rightTranslate = splitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] });

  const uiOpacity = focusAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const headerTranslateY = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -100] });
  const bottomTranslateY = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const timerTranslateY = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const sliderOpacity = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const bgScale = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 15] });
  const lottieOpacity = focusAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  const filterOptions = [
    { label: 'Today', icon: 'today' },
    { label: 'Tomorrow', icon: 'event' },
    { label: 'This Week', icon: 'date-range' },
    { label: 'This Month', icon: 'calendar-today' },
    { label: 'Tasks', icon: 'checklist' }
  ];

  const handleSetupDeepFocus = async () => {
    try {
      if (!DeepFocus) {
        Alert.alert("Lỗi", "Chưa liên kết được Native Module DeepFocus. Vui lòng build lại app.");
        return;
      }

      const hasOverlay = await DeepFocus.hasOverlayPermission();
      if (!hasOverlay) {
        Alert.alert("Cấp quyền", "Vui lòng cấp quyền 'Hiển thị trên ứng dụng khác' cho Pomolendar để màn hình cảnh báo có thể hoạt động.");
        DeepFocus.requestOverlayPermission();
        return;
      }
      
      const hasUsage = await DeepFocus.hasUsageStatsPermission();
      if (!hasUsage) {
        Alert.alert("Cấp quyền", "Vui lòng tìm và cấp quyền 'Truy cập dữ liệu sử dụng' cho Pomolendar để hệ thống giám sát được các app đang mở.");
        DeepFocus.requestUsageStatsPermission();
        return;
      }

      const apps = await DeepFocus.getInstalledApps();
      setInstalledApps(apps);
      setShowDeepFocusPrompt(false);
      setShowAllowListModal(true); 
    } catch (error) {
      console.log("Lỗi Setup Deep Focus:", error);
    }
  };

  const toggleAllowApp = (pkg) => {
    setAllowedAppPackages(prev => 
      prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]
    );
  };

  const startDeepFocusMode = () => {
    setIsDeepFocusEnabled(true);
    setShowAllowListModal(false);
    if (DeepFocus) DeepFocus.startDeepFocus(allowedAppPackages); 
  };

  const stopDeepFocusMode = () => {
    setIsDeepFocusEnabled(false);
    if (DeepFocus) DeepFocus.stopDeepFocus(); 
  };

  const sliderPercentage = ((Math.floor(totalTime / 60) - 15) / 75) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      
      <TouchableWithoutFeedback onPress={toggleFocusMode}>
        <View style={{ flex: 1 }}>
          <SafeAreaView className="flex-1"> 
            
            <Animated.View 
              className="absolute top-0 bottom-0 left-0 right-0 items-center justify-center z-20"
              style={{ opacity: lottieOpacity, transform: [{ translateY: 50 }] }}
              pointerEvents="none"
            >
              <LottieView 
                source={require('../../assets/lottiefile/reading.json')}
                autoPlay 
                loop 
                style={{ width: 280, height: 280 }} 
              />
            </Animated.View>

            <Animated.View 
              className="flex-row items-center justify-between px-6 h-16 mt-7 z-10"
              style={{ opacity: uiOpacity, transform: [{ translateY: headerTranslateY }] }}
              pointerEvents={isFocusMode ? 'none' : 'auto'}
            >
              <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={() => setIsDrawerOpen(true)}>
                <MaterialIcons name="menu" size={26} color="#ce9d7d" />
              </TouchableOpacity>
              <View style={{ width: 40 }} />
            </Animated.View>

            <Animated.View 
              className="flex-1 items-center justify-center pt-4 pb-32 z-10"
              style={{ transform: [{ translateY: timerTranslateY }] }}
            >
              <View className="items-center justify-center w-full px-12">
                
                <Animated.View 
                  style={{
                    position: 'absolute', width: 80, height: 80, borderRadius: 40, 
                    backgroundColor: '#fbf9f8', transform: [{ scale: bgScale }]
                  }} 
                />

                <Text 
                  className="font-bold text-[#3b3433] tracking-tighter" 
                  style={{ fontSize: 92, lineHeight: 106 }}
                >
                  {formatTime()}
                </Text>
                
                <Animated.View 
                  style={{ width: '100%', marginTop: 20, height: 40, justifyContent: 'center', position: 'relative', opacity: sliderOpacity }}
                  pointerEvents={timerState === 'idle' ? 'auto' : 'none'}
                >
                  <View style={{ position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#7a6e6b', borderRadius: 2 }} />

                  <View style={{
                    position: 'absolute',
                    left: 0,
                    width: `${sliderPercentage}%`,
                    height: 4,
                    backgroundColor: '#c89d7d',
                    borderRadius: 2
                  }} />

                  <View style={{
                    position: 'absolute',
                    left: `${sliderPercentage}%`,
                    transform: [{ translateX: -6 }],
                    width: 12,
                    height: 18,
                    backgroundColor: '#ffffff',
                    borderWidth: 2,
                    borderColor: '#c89d7d',
                    borderRadius: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 2
                  }} />

                  <Slider
                    style={{ width: '100%', height: 40, position: 'absolute', zIndex: 10 }}
                    minimumValue={15}
                    maximumValue={90}
                    step={1}
                    value={Math.floor(totalTime / 60)}
                    onValueChange={handleSliderChange}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor="transparent"
                  />
                </Animated.View>

                {/* BỘ ICON VÀ NÚT CHỌN TASK */}
                <Animated.View 
                  style={{ marginTop: 30, opacity: sliderOpacity, alignItems: 'center' }}
                  pointerEvents={timerState === 'idle' ? 'auto' : 'none'}
                >
                  
                  {renderTimerIcons()}

                  <TouchableOpacity 
                    className="bg-white px-6 py-1.5 rounded-full border border-gray-100 flex-row items-center justify-center w-48"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
                    activeOpacity={0.7}
                    onPress={openTasksPopup}
                  >
                    <View className="w-5 h-6 border-2 border-[#5c8a8a] rounded-md items-center relative">
                      <View className="w-[2px] h-2 bg-[#5c8a8a] rounded-full" style={{ marginTop: 2 }} />
                      <View className="absolute -top-[5px] w-[2px] h-[3px] bg-[#5c8a8a]" />
                    </View>
                    <Text className="text-[#3b3433] font-medium text-[16px] ml-3" numberOfLines={1}>
                      {selectedTaskTitle}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

              </View>
            </Animated.View>

            <Animated.View 
              className="absolute bottom-32 w-full items-center justify-center z-40"
              style={{ opacity: uiOpacity, transform: [{ translateY: bottomTranslateY }] }}
              pointerEvents={isFocusMode ? 'none' : 'box-none'}
            >
              
              <Animated.View 
                style={{ position: 'absolute', opacity: sideOpacity, transform: [{ translateX: leftTranslate }] }}
                pointerEvents={timerState === 'paused' ? 'auto' : 'none'}
              >
                <TouchableOpacity 
                  className="px-7 py-2 bg-[#c89d7d] rounded-full items-center justify-center flex-row shadow-lg"
                  onPress={startTimer}
                >
                  <Text className="text-white font-bold ml-1 text-sm">Continue</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View 
                style={{ position: 'absolute', opacity: sideOpacity, transform: [{ translateX: rightTranslate }] }}
                pointerEvents={timerState === 'paused' ? 'auto' : 'none'}
              >
                <TouchableOpacity 
                  className="px-7 py-2 bg-[#e4e2e2] rounded-full items-center justify-center flex-row shadow-lg"
                  onPress={stopTimer}
                >
                  <Text className="text-white font-bold ml-1 text-sm">Stop</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View 
                style={{ opacity: centerOpacity, position: 'relative', alignItems: 'center', justifyContent: 'center' }}
                pointerEvents={timerState !== 'paused' ? 'auto' : 'none'}
              >
                <TouchableOpacity 
                  className="w-[240px] py-1.5 rounded-2xl items-center justify-center flex-row shadow-xl"
                  style={{ backgroundColor: timerState === 'running' ? '#e4e2e2' : '#c89d7d', zIndex: 1 }}
                  onPress={timerState === 'running' ? pauseTimer : startTimer}
                >
                  <Text className="text-white font-bold text-[19px]">
                    {timerState === 'running' ? 'Pause' : 'Start'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

            </Animated.View>

            <Animated.View 
              className="absolute bottom-0 w-full h-20 bg-white border-t border-[#e2bfb8]/30 rounded-t-[30px] flex-row justify-around items-center px-2 pb-2 shadow-lg z-30"
              style={{ opacity: uiOpacity, transform: [{ translateY: bottomTranslateY }] }}
              pointerEvents={isFocusMode ? 'none' : 'auto'}
            >
              <TouchableOpacity 
                className={`items-center justify-center w-14 h-14 rounded-2xl ${isDeepFocusEnabled ? 'bg-[#c89d7d]' : ''}`}
                onPress={() => isDeepFocusEnabled ? stopDeepFocusMode() : setShowDeepFocusPrompt(true)}
              >
                <MaterialIcons name="center-focus-strong" size={28} color={isDeepFocusEnabled ? "#ffffff" : "#a9a9a9"} />
              </TouchableOpacity>
              <TouchableOpacity className="items-center justify-center p-4">
                <MaterialIcons name="calendar-today" size={28} color="#a9a9a9" />
              </TouchableOpacity>
              <TouchableOpacity className="items-center justify-center p-4">
                <MaterialIcons name="graphic-eq" size={28} color="#a9a9a9" />
              </TouchableOpacity>
            </Animated.View>

          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>

      {isTasksPopupOpen && (
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={closeTasksPopup}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }]}
        />
      )}

      <Animated.View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 101,
          transform: [{ translateY: tasksPopupAnim }]
        }}
        pointerEvents={isTasksPopupOpen ? 'auto' : 'none'}
      >
        <SafeAreaView>
          {popupView === 'tasks' ? (
            <View className="bg-[#ffffff] mx-3 mt-16 rounded-[12px] shadow-[0_8px_30px_rgba(0,139,140,0.06)] border border-[#e4e2e2] overflow-hidden flex-col">
              <ScrollView className="max-h-[70vh]" contentContainerStyle={{ padding: 24, gap: 16 }}>
                
                <TouchableOpacity 
                  className="flex-row items-center justify-center gap-1 py-1 rounded-lg"
                  activeOpacity={0.7}
                  onPress={() => setPopupView('filter')}
                >
                  <Text className="text-[18px] font-bold text-[#008B8C] tracking-tight">{selectedFilter === 'Tasks' ? 'All Tasks' : selectedFilter}</Text>
                  <MaterialIcons name="expand-more" size={25} color="#008B8C" />
                </TouchableOpacity>

                <View className="flex-col gap-1 mt-1">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                      <TouchableOpacity 
                        key={task.id} 
                        className="flex-row items-center justify-between p-2 bg-[#fbf9f8] rounded-sm" 
                        activeOpacity={0.7}
                        onPress={() => handleSelectTask(task)}
                      >
                        <View className="flex-col gap-1 flex-1 pr-4">
                          <Text className="text-[16px] font-medium text-[#1b1c1c]" numberOfLines={1}>{task.title}</Text>
                          <View className="flex-row gap-1 items-center">
                            <MaterialIcons name="timer" size={14} color="#008B8C" />
                            <Text className="text-[12px] font-bold text-[#008b8c]">
                              {task.completed_pomodoros}/{task.estimated_pomodoros}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleSelectTask(task)} className="p-2">
                          <MaterialIcons name="play-arrow" size={28} color="#008B8C" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View className="items-center justify-center py-10">
                      <Text className="text-[#5a413c] font-medium text-[16px]">Không có công việc nào</Text>
                    </View>
                  )}
                </View>

              </ScrollView>
              
              <View className="w-full items-center pb-4 pt-2 bg-[#ffffff]">
                <TouchableOpacity onPress={closeTasksPopup} className="w-12 h-1.5 bg-[#dae5e4] rounded-full" />
              </View>
            </View>
          ) : (
            <View className="bg-[#ffffff] mx-2 mt-16 rounded-[12px] shadow-[0_8px_30px_rgba(0,139,140,0.06)] border border-[#e4e2e2] overflow-hidden flex-col p-6">
              
              <View className="flex-row items-center justify-between w-full mb-6">
                <TouchableOpacity 
                  onPress={() => setPopupView('tasks')} 
                  className="w-10 h-10 items-center justify-center rounded-full bg-[#f5f3f3] active:bg-[#eae8e7]"
                >
                  <MaterialIcons name="arrow-back" size={24} color="#5a413c" />
                </TouchableOpacity>
                <Text className="text-[20px] font-bold text-[#1b1c1c] flex-1 text-center pr-10">Select Project</Text>
              </View>

              <ScrollView className="max-h-[60vh] flex-col">
                {filterOptions.map(option => {
                  const isActive = selectedFilter === option.label;
                  return (
                    <TouchableOpacity 
                      key={option.label}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedFilter(option.label);
                        setPopupView('tasks');
                      }}
                      className={`p-2 flex-row items-center gap-2 p-2 transition-colors ${isActive ? 'pt-0.5 mt-0.5 bg-[#008b8c]/10' : 'bg-transparent border border-transparent rounded-xl active:bg-[#f5f3f3]'}`}
                    >
                      <View className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-[#008b8c] shadow-sm' : 'bg-[#f5f3f3]'}`}>
                        <MaterialIcons name={option.icon} size={22} color={isActive ? '#ffffff' : '#5a413c'} />
                      </View>
                      <Text className={`flex-1 text-[16px] font-medium ${isActive ? 'text-[#008b8c]' : 'text-[#1b1c1c]'}`}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>

      {showDeepFocusPrompt && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 300, justifyContent: 'center', alignItems: 'center' }]}>
          <View className="bg-[#fbf9f8] w-[80%] rounded-xl p-3 items-center shadow-2xl">
            <MaterialIcons name="center-focus-strong" size={44} color="#008b8c" className="mb-4" />
            <Text className="text-[#1b1c1c] font-bold text-[22px] mb-2 text-center">Bật Deep Focus?</Text>
            <Text className="text-[#5a413c] text-center mb-6 leading-5 px-2">
              Khi bạn rời khỏi app, bạn sẽ bị chặn và đưa ngược trở lại.{"\n"}
            </Text>
            
            <View className="flex-row w-full justify-between gap-4 py-2">
              <TouchableOpacity onPress={() => setShowDeepFocusPrompt(false)} className="flex-1 py-2 items-center justify-center rounded-xl bg-[#e4e2e2] active:opacity-80">
                <Text className="text-[#5a413c] font-bold text-[12px]">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetupDeepFocus} className="flex-1 py-2 items-center rounded-xl bg-[#008b8c] active:opacity-80 shadow-md">
                <Text className="text-white font-bold text-[12px]">Tiếp tục</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* POP-UP 2: BẢNG CHỌN ALLOW LIST */}
      {showAllowListModal && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 400, justifyContent: 'flex-end' }]}>
          <View className="bg-[#fbf9f8] rounded-t-xl h-[80%] p-6 pb-10">
            <Text className="text-[20px] font-bold text-[#1b1c1c] mb-2">Allow List</Text>
            <Text className="text-[14px] text-[#5a413c] mb-4">Các ứng dụng được đánh dấu sẽ KHÔNG bị chặn trong lúc bạn đang Deep Focus.</Text>
            
            <FlatList
              data={installedApps}
              keyExtractor={item => item.packageName}
              renderItem={({ item }) => {
                const isAllowed = allowedAppPackages.includes(item.packageName);
                return (
                  <TouchableOpacity 
                    onPress={() => toggleAllowApp(item.packageName)}
                    className="flex-row items-center justify-between py-3 border-b border-[#e4e2e2]"
                  >
                    <Text className="text-[16px] text-[#1b1c1c] flex-1 mr-4" numberOfLines={1}>{item.appName}</Text>
                    <MaterialIcons 
                      name={isAllowed ? "check-box" : "check-box-outline-blank"} 
                      size={24} color={isAllowed ? "#008B8C" : "#e4e2e2"} 
                    />
                  </TouchableOpacity>
                )
              }}
            />

            <View className="flex-row gap-2 mt-2 mb-2">
              <TouchableOpacity onPress={() => setShowAllowListModal(false)} className="flex-1 py-2 items-center rounded-xl bg-[#e4e2e2]">
                <Text className="text-[#5a413c] font-bold text-[14px]">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startDeepFocusMode} className="flex-1 py-2 items-center rounded-xl bg-[#008B8C]">
                <Text className="text-white font-bold text-[14px]">Bắt đầu Deep Focus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <CustomDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        navigation={navigation} 
        currentScreen="Home" 
      />

    </View>
  );
}