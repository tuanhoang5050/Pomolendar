import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, Dimensions, ImageBackground, 
  Animated, StyleSheet, TouchableWithoutFeedback, ScrollView, Alert, AppState, NativeModules, Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { Audio } from 'expo-av';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';
import WhiteNoiseSheet from '../components/WhiteNoiseSheet';
import ConfettiCannon from 'react-native-confetti-cannon';
import { WHITE_NOISE_TRACKS } from '../constants/WhiteNoiseSounds';

import TimerModals from '../components/TimerModals';
import DeepFocusModals from '../components/DeepFocusModals';
import { ANIMATION_ASSETS, SOUND_ASSETS } from '../constants/Assets';
import AnimatedPopup from '../components/AnimatedPopup'; 
import CircularTimer from '../components/CircularTimer'; 


import * as whiteNoisePlayer from '../services/whiteNoisePlayer';

const { DeepFocus } = NativeModules;
const { width, height } = Dimensions.get('window');
const MAX_VISIBLE_TAGS = 2; 

const MAX_MINUTES = 90;
const MIN_MINUTES = 15;

export default function HomeScreen({ navigation }) {
  const [totalTime, setTotalTime] = useState(25 * 60); 
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [endTime, setEndTime] = useState(null);
  const [timerState, setTimerState] = useState('idle'); 
  const [phase, setPhase] = useState('focus');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWhiteNoiseOpen, setIsWhiteNoiseOpen] = useState(false);
  const [whiteNoiseEnabled, setWhiteNoiseEnabled] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(WHITE_NOISE_TRACKS[0].id);
  const [whiteNoiseVolume, setWhiteNoiseVolume] = useState(0.6);
  
  const [isTasksPopupOpen, setIsTasksPopupOpen] = useState(false);
  const [popupView, setPopupView] = useState('tasks');
  const [selectedFilter, setSelectedFilter] = useState('Today');
  const [tasks, setTasks] = useState([]);
  
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('Work');

  const [isDeepFocusEnabled, setIsDeepFocusEnabled] = useState(false);
  const [showDeepFocusPrompt, setShowDeepFocusPrompt] = useState(false);
  const [showAllowListModal, setShowAllowListModal] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);
  const [allowedAppPackages, setAllowedAppPackages] = useState([]);

  const [storeItems, setStoreItems] = useState([]);
  const [isAnimPopupOpen, setIsAnimPopupOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [completionModal, setCompletionModal] = useState({
    visible: false, minutes: 0, taskTitle: null, estimated: 0, completed: 0, points: 0, leveledUp: false, isGuest: false
  });
  const [breakDoneModal, setBreakDoneModal] = useState(false);

  const splitAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  const tasksPopupAnim = useRef(new Animated.Value(-1000)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  const confettiRefLeft = useRef(null);
  const confettiRefCenter = useRef(null);
  const confettiRefRight = useRef(null);

  const playBubbleSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/pop.mp3') 
      );
      await sound.playAsync();
      setTimeout(() => { sound.unloadAsync(); }, 2000);
    } catch (e) {}
  };

  const showTooltip = () => {
    playBubbleSound();
    Animated.spring(tooltipAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(tooltipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 4500);
  };

  useEffect(() => {
    const loadDeepFocusState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('deep_focus_enabled');
        const savedApps = await AsyncStorage.getItem('deep_focus_allowed_apps');
        if (savedState === 'true') {
          setIsDeepFocusEnabled(true);
          const parsedApps = savedApps ? JSON.parse(savedApps) : [];
          setAllowedAppPackages(parsedApps);
          if (DeepFocus) DeepFocus.startDeepFocus(parsedApps);
          setTimeout(() => { showTooltip(); }, 600);
        }
      } catch (e) {}
    };
    loadDeepFocusState();
  }, []);

  useEffect(() => {
    let pingInterval;

    const sendFocusStatus = async () => {
      try {
        await api.post('/teams/focus-status/', {
          is_focusing: timerState === 'running' && phase === 'focus',
          task_title: selectedTaskTitle,
        });
      } catch (e) {}
    };

    if (timerState === 'running' && phase === 'focus') {
      sendFocusStatus(); 
      pingInterval = setInterval(sendFocusStatus, 30000); 
    } else {
      sendFocusStatus(); 
    }

    return () => clearInterval(pingInterval);
  }, [timerState, phase]);

  const startDeepFocusMode = async () => {
    setIsDeepFocusEnabled(true);
    setShowAllowListModal(false);
    await AsyncStorage.setItem('deep_focus_enabled', 'true');
    await AsyncStorage.setItem('deep_focus_allowed_apps', JSON.stringify(allowedAppPackages));
    if (DeepFocus) DeepFocus.startDeepFocus(allowedAppPackages); 
    showTooltip();
  };

  const stopDeepFocusMode = async () => {
    setIsDeepFocusEnabled(false);
    await AsyncStorage.setItem('deep_focus_enabled', 'false');
    if (DeepFocus) DeepFocus.stopDeepFocus(); 
  };

  const fetchTasks = async () => {
    const guest = await AsyncStorage.getItem('is_guest');
    if (guest === 'true') {
      setTasks([]);
      setSelectedTask(null);
      setSelectedTaskTitle('Work');
      return;
    }

    try {
      const response = await api.get('/planner/tasks/');
      const fetchedTasks = response.data;
      setTasks(fetchedTasks);

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

  const fetchStoreDataForHome = async () => {
    try {
      const response = await api.get('/gamification/store/');
      setStoreItems(response.data.items);
    } catch (e) {}
  };

  
  const initializedRef = useRef(false);

  const getTrackFile = (trackId) => {
    let trackFile = WHITE_NOISE_TRACKS.find(t => t.id === trackId)?.file;
    if (!trackFile && SOUND_ASSETS && SOUND_ASSETS[trackId]) {
      trackFile = SOUND_ASSETS[trackId];
    }
    if (!trackFile) trackFile = WHITE_NOISE_TRACKS[0].file;
    return trackFile;
  };

  useFocusEffect(
    useCallback(() => { 
      fetchTasks(); 
      fetchStoreDataForHome(); 
    }, [])
  );

 
  useEffect(() => {
    let isMounted = true;
    initializedRef.current = false;

    const init = async () => {
      await whiteNoisePlayer.configureAudioMode();

      let wnEnabled, wnTrackId, wnVolume, tState, tEndTime, tTotal, tLeft, tPhase;
      try {
        [wnEnabled, wnTrackId, wnVolume, tState, tEndTime, tTotal, tLeft, tPhase] = await Promise.all([
          AsyncStorage.getItem('whitenoise_enabled'),
          AsyncStorage.getItem('whitenoise_track_id'),
          AsyncStorage.getItem('whitenoise_volume'),
          AsyncStorage.getItem('timer_state'),
          AsyncStorage.getItem('timer_end_time'),
          AsyncStorage.getItem('timer_total_time'),
          AsyncStorage.getItem('timer_time_left'),
          AsyncStorage.getItem('timer_phase'),
        ]);
      } catch (e) { return; }

      if (!isMounted) return;

      const enabled = wnEnabled === 'true';
      const volume = wnVolume !== null ? parseFloat(wnVolume) : whiteNoiseVolume;
      const trackId = wnTrackId || selectedTrackId;

      setWhiteNoiseEnabled(enabled);
      if (wnTrackId) setSelectedTrackId(wnTrackId);
      if (wnVolume !== null) setWhiteNoiseVolume(volume);

      setPhase(tPhase === 'break' ? 'break' : 'focus');
      if (tTotal) setTotalTime(parseInt(tTotal, 10));

      let isRunning = false;
      if (tState === 'running' && tEndTime) {
        setEndTime(parseInt(tEndTime, 10));
        setTimerState('running');
        setIsFocusMode(true);
        isRunning = true;
      } else if (tState === 'paused' && tLeft) {
        setTimeLeft(parseInt(tLeft, 10));
        setTimerState('paused');
        setIsFocusMode(false);
      } else if (tLeft) {
        setTimeLeft(parseInt(tLeft, 10));
        setTimerState('idle');
        setIsFocusMode(false);
      }

      if (enabled) {
        const trackFile = getTrackFile(trackId);
        await whiteNoisePlayer.loadTrack(trackFile, trackId, volume);
        if (!isMounted) return;
        if (isRunning) {
          await whiteNoisePlayer.play();
        }
      } else {
        await whiteNoisePlayer.unload();
      }

      initializedRef.current = true;
    };

    init();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') { init(); }
    });
    return () => { isMounted = false; subscription.remove(); };
  }, []);

  
  useEffect(() => {
    if (!initializedRef.current) return;

    let isCancelled = false;
    const sync = async () => {
      if (!whiteNoiseEnabled) {
        await whiteNoisePlayer.unload();
        return;
      }
      const trackFile = getTrackFile(selectedTrackId);
      await whiteNoisePlayer.loadTrack(trackFile, selectedTrackId, whiteNoiseVolume);
      if (isCancelled) return;
      if (timerState === 'running') {
        await whiteNoisePlayer.play();
      }
    };
    sync();

    return () => { isCancelled = true; };
  }, [selectedTrackId, whiteNoiseEnabled]);

  const handleToggleWhiteNoise = async (val) => {
    setWhiteNoiseEnabled(val);
    await AsyncStorage.setItem('whitenoise_enabled', val.toString());
  };

  const handleSelectTrack = async (trackId) => {
    setSelectedTrackId(trackId);
    await AsyncStorage.setItem('whitenoise_track_id', trackId);
  };

  const handleVolumeChange = async (val) => {
    setWhiteNoiseVolume(val);
    await whiteNoisePlayer.setVolume(val);
    await AsyncStorage.setItem('whitenoise_volume', val.toString());
  };

  const handlePomodoroComplete = async () => {
    if (isDeepFocusEnabled) { stopDeepFocusMode(); }

    const guest = await AsyncStorage.getItem('is_guest');
    const durationMinutes = Math.floor(totalTime / 60);

    if (guest !== 'true') {
      try {
        const taskId = await AsyncStorage.getItem('current_task_id');
        let response;
        if (taskId) {
          response = await api.post(`/planner/tasks/${taskId}/complete-pomodoro/`, { duration_minutes: durationMinutes });
        } else {
          response = await api.post('/planner/freestyle-pomodoro/', { duration_minutes: durationMinutes });
        }

        const gami = response.data?.gamification;
        const completedCount = taskId ? (response.data?.completed_pomodoros ?? ((selectedTask?.completed_pomodoros || 0) + 1)) : 0;

        setCompletionModal({
          visible: true, minutes: durationMinutes, taskTitle: taskId ? (selectedTask?.title || null) : null,
          estimated: taskId ? (selectedTask?.estimated_pomodoros || 0) : 0,
          completed: completedCount, points: gami?.points_earned || 0,
          leveledUp: gami?.leveled_up || false, isGuest: false
        });
        fetchTasks();
      } catch (error) {
        Alert.alert("Error", "An error occurred while saving the Pomodoro session.");
      }
    } else {
      setCompletionModal({ visible: true, minutes: durationMinutes, taskTitle: null, estimated: 0, completed: 0, points: 0, leveledUp: false, isGuest: true });
    }

    const breakMinutes = selectedTask?.short_break || 5;
    const breakSeconds = breakMinutes * 60;
    const newEndTime = Date.now() + breakSeconds * 1000;

    setPhase('break');
    setTimeLeft(breakSeconds);
    setTimerState('running');
    setIsFocusMode(true);
    setEndTime(newEndTime);

    await AsyncStorage.setItem('timer_phase', 'break');
    await AsyncStorage.setItem('timer_state', 'running');
    await AsyncStorage.setItem('timer_end_time', newEndTime.toString());

    if (whiteNoiseEnabled) await whiteNoisePlayer.play();
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
          if (phase === 'focus') {
            setEndTime(null);
            AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_time_left']).then(() => { handlePomodoroComplete(); });
          } else {
            setTimerState('idle'); setIsFocusMode(false); setEndTime(null); setPhase('focus'); setTimeLeft(totalTime);
            AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_time_left', 'timer_phase']).then(() => { setBreakDoneModal(true); });
            whiteNoisePlayer.pause();
          }
        }
      };
      checkTime();
      interval = setInterval(checkTime, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState, endTime, phase]);

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
    Animated.spring(splitAnim, { toValue: timerState === 'paused' ? 1 : 0, useNativeDriver: true, tension: 50, friction: 7 }).start();
  }, [timerState]);

  useEffect(() => {
    Animated.timing(focusAnim, { toValue: isFocusMode ? 1 : 0, duration: 500, useNativeDriver: true }).start();
  }, [isFocusMode]);

  useEffect(() => {
    if (completionModal.visible) {
      const timer = setTimeout(() => {
        confettiRefLeft.current?.start();
        confettiRefCenter.current?.start();
        confettiRefRight.current?.start();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [completionModal.visible]);
  
  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const startTimer = async () => {
    const newEndTime = Date.now() + timeLeft * 1000;
    setTimerState('running'); setIsFocusMode(true); setEndTime(newEndTime); setPhase('focus');
    await AsyncStorage.setItem('timer_state', 'running');
    await AsyncStorage.setItem('timer_end_time', newEndTime.toString());
    await AsyncStorage.setItem('timer_total_time', totalTime.toString());
    await AsyncStorage.setItem('timer_phase', 'focus');

    if (whiteNoiseEnabled) await whiteNoisePlayer.play();
  };
  
  const pauseTimer = async () => {
    setTimerState('paused'); setIsFocusMode(false); setEndTime(null);
    await AsyncStorage.setItem('timer_state', 'paused');
    await AsyncStorage.setItem('timer_time_left', timeLeft.toString());

    await whiteNoisePlayer.pause();
  };
  
  const stopTimer = async () => {
    setTimerState('idle'); setIsFocusMode(false); setEndTime(null); setPhase('focus'); setTimeLeft(totalTime);
    await AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_time_left', 'timer_phase']);
    if (isDeepFocusEnabled) stopDeepFocusMode();

    await whiteNoisePlayer.pause();
  };

  const toggleFocusMode = () => { if (timerState === 'running') setIsFocusMode(!isFocusMode); };

  const openTasksPopup = () => {
    setPopupView('tasks'); setIsTasksPopupOpen(true);
    Animated.timing(tasksPopupAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeTasksPopup = () => {
    Animated.timing(tasksPopupAnim, { toValue: -1000, duration: 300, useNativeDriver: true }).start(() => {
      setIsTasksPopupOpen(false); setPopupView('tasks');
    });
  };

  const handleCircularProgressChange = (newProgress) => {
    let mins = Math.round(newProgress * MAX_MINUTES);
    if (mins < MIN_MINUTES) mins = MIN_MINUTES;
    if (mins > MAX_MINUTES) mins = MAX_MINUTES;

    const newTime = mins * 60;
    setTotalTime(newTime);
    setTimeLeft(newTime);
  };

  const handleCircularProgressComplete = async () => {
    await AsyncStorage.setItem('timer_total_time', totalTime.toString());
    await AsyncStorage.setItem('timer_time_left', totalTime.toString());
  };

  const handleSelectTask = async (task) => {
    try {
      await AsyncStorage.setItem('current_task_id', task.id.toString());
      setSelectedTask(task); setSelectedTaskTitle(task.title);
      const newTime = task.focus_duration * 60;
      setTotalTime(newTime); setTimeLeft(newTime); setTimerState('idle'); setEndTime(null); setIsFocusMode(false); setPhase('focus');
      await AsyncStorage.setItem('timer_total_time', newTime.toString());
      await AsyncStorage.setItem('timer_time_left', newTime.toString());
      await AsyncStorage.multiRemove(['timer_state', 'timer_end_time', 'timer_phase']);
      await whiteNoisePlayer.pause();
    } catch (e) {}
    closeTasksPopup();
  };

  const getPriorityStyles = (task) => {
    if (task.is_completed) return { line: 'bg-[#e2bfb8]', opacity: 'opacity-60' };
    const priority = task.priority || 1;
    switch (priority) {
      case 3: return { line: 'bg-[#C27664]', opacity: 'opacity-100' };
      case 2: return { line: 'bg-[#A9B388]', opacity: 'opacity-100' };
      case 1: default: return { line: 'bg-[#D1BB9E]', opacity: 'opacity-100' };
    }
  };

  const formatTaskTime = (dateString) => {
    if (!dateString) return 'No limit';
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatTaskDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return ', Today';
    if (date.toDateString() === tomorrow.toDateString()) return ', Tomorrow';
    return `, ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const renderTaskPomodoroIcons = (completed, target) => {
    const icons = [];
    const maxDisplay = 4;
    const total = Math.max(target || 0, 1);
    const completedSafe = Math.max(completed || 0, 0);

    for (let i = 0; i < Math.min(total, maxDisplay); i++) {
      icons.push( <MaterialIcons key={i} name="timer" size={16} color={i < completedSafe ? "#ce9d7d" : "#e4e2e2"} style={{ marginRight: 2 }} /> );
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
        {remaining > 0 && ( <View className="px-2 py-0.5 rounded-full bg-[#e4e2e2] mr-1"><Text className="text-[9px] font-bold text-[#5a413c]">+{remaining}</Text></View> )}
      </View>
    );
  };

  const getFilteredTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay() || 7; 
    if (day !== 1) startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(endOfWeek.getDate() + 6);

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
      icons.push( <MaterialIcons key={i} name="timer" size={18} color={i < comp ? "#c89d7d" : "#e4e2e2"} style={{ marginHorizontal: 4 }} /> );
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
        Alert.alert("Error", "Native Module DeepFocus not linked. Please rebuild the app.");
        return;
      }
      const hasOverlay = await DeepFocus.hasOverlayPermission();
      if (!hasOverlay) {
        Alert.alert("Permission", "Please grant 'Display over other apps' permission for Pomolendar so the warning screen can work.");
        DeepFocus.requestOverlayPermission();
        return;
      }
      const hasUsage = await DeepFocus.hasUsageStatsPermission();
      if (!hasUsage) {
        Alert.alert("Permission", "Please grant 'Usage Data Access' permission for Pomolendar so the system can monitor open apps.");
        DeepFocus.requestUsageStatsPermission();
        return;
      }
      const apps = await DeepFocus.getInstalledApps();
      const filteredApps = apps.filter( app => app.packageName !== 'com.pomolendar.pomolendarapp' && app.packageName !== 'host.exp.exponent' && !app.appName.toLowerCase().includes('pomolendar') );
      setInstalledApps(filteredApps);
      setShowDeepFocusPrompt(false);
      setShowAllowListModal(true); 
    } catch (error) { console.log("Deep Focus Setup Error:", error); }
  };

  const toggleAllowApp = (pkg) => {
    setAllowedAppPackages(prev => prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg] );
  };

  const ownedAnimations = storeItems.filter(i => i.category === 'animation' && i.is_owned);

  const handleEquipAnimation = async (itemId) => {
    try {
      await api.post('/gamification/store/equip/', { item_id: itemId });
      fetchStoreDataForHome(); 
    } catch (e) {}
  };

  const handleUnequipAnimation = async (itemId) => {
    try {
      await api.post('/gamification/store/equip/', { item_id: itemId, action: 'unequip' });
      fetchStoreDataForHome(); 
    } catch (e) {}
  };

  const equippedAnimItem = ownedAnimations.find(i => i.is_equipped);
  const defaultLottie = require('../../assets/lottiefile/reading.json'); 
  
  let activeLottieSource = defaultLottie;
  if (equippedAnimItem && ANIMATION_ASSETS && ANIMATION_ASSETS[equippedAnimItem.file_identifier]) {
    activeLottieSource = ANIMATION_ASSETS[equippedAnimItem.file_identifier].lottie || defaultLottie;
  } else if (ANIMATION_ASSETS && ANIMATION_ASSETS['reading']) {
    activeLottieSource = ANIMATION_ASSETS['reading'].lottie || defaultLottie;
  }

  const openAnimPopup = () => {
    const equippedIndex = ownedAnimations.findIndex(a => a.is_equipped);
    setPreviewIndex(equippedIndex >= 0 ? equippedIndex : 0);
    setIsAnimPopupOpen(true);
  };

  const ownedSounds = storeItems.filter(i => i.category === 'sound' && i.is_owned);
  const customTracks = ownedSounds.map(item => ({
    id: item.file_identifier,
    name: item.name,
    icon: 'music-note'
  }));
  const combinedTracks = [...WHITE_NOISE_TRACKS, ...customTracks];

  const currentMinutes = (timerState === 'idle' ? totalTime : timeLeft) / 60;
  const circularProgress = currentMinutes / MAX_MINUTES;

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover" 
    >
      
      <TouchableWithoutFeedback onPress={toggleFocusMode}>
        <View style={{ flex: 1 }}>
          <SafeAreaView className="flex-1"> 
            
            <Animated.View 
              className="absolute top-0 bottom-0 left-0 right-0 items-center justify-center z-20"
              style={{ opacity: lottieOpacity, transform: [{ translateY: 50 }] }}
              pointerEvents="none"
            >
              <LottieView 
                source={activeLottieSource}
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
              <View className="items-center justify-center w-full px-12 relative">
                
                <Animated.View 
                  style={{
                    position: 'absolute', width: 80, height: 80, borderRadius: 40, 
                    backgroundColor: '#fbf9f8', transform: [{ scale: bgScale }]
                  }} 
                />

                <CircularTimer 
                  progress={circularProgress}
                  onUpdate={handleCircularProgressChange}
                  onComplete={handleCircularProgressComplete}
                  disabled={timerState !== 'idle'}
                  radius={140}
                  strokeWidth={8}
                  circleOpacity={uiOpacity}
                >
                  <Text className="text-[14px] font-bold font-sans text-[#c89d7d] mb-1 tracking-widest uppercase" style={{ textShadowColor: 'rgba(255,255,255,0.8)', textShadowRadius: 8 }}>
                    {phase === 'break' ? 'Break' : 'Focus'}
                  </Text>

                  <Text 
                    className="font-bold font-sans text-[#3b3433] tracking-tighter" 
                    style={{ fontSize: 76, lineHeight: 86, textShadowColor: 'rgba(255,255,255,0.7)', textShadowRadius: 10 }}
                  >
                    {formatTime()}
                  </Text>
                </CircularTimer>

                <Animated.View 
                  style={{ marginTop: 24, opacity: sliderOpacity, alignItems: 'center' }}
                  pointerEvents={timerState === 'idle' ? 'auto' : 'none'}
                >
                  {renderTimerIcons()}

                  <TouchableOpacity 
                    className="bg-white px-6 py-1.5 rounded-full border border-gray-100 flex-row items-center justify-center w-48"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
                    activeOpacity={0.7} onPress={openTasksPopup}
                  >
                    <View className="w-5 h-6 border-2 border-[#5c8a8a] rounded-md items-center relative">
                      <View className="w-[2px] h-2 bg-[#5c8a8a] rounded-full" style={{ marginTop: 2 }} />
                      <View className="absolute -top-[5px] w-[2px] h-[3px] bg-[#5c8a8a]" />
                    </View>
                    <Text className="text-[#3b3433] font-medium font-sans text-[16px] ml-3" numberOfLines={1}>
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
                <TouchableOpacity className="px-7 py-2 bg-[#c89d7d] rounded-full items-center justify-center flex-row shadow-lg" onPress={startTimer}>
                  <Text className="text-white font-bold font-sans ml-1 text-sm">Continue</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View 
                style={{ position: 'absolute', opacity: sideOpacity, transform: [{ translateX: rightTranslate }] }}
                pointerEvents={timerState === 'paused' ? 'auto' : 'none'}
              >
                <TouchableOpacity className="px-7 py-2 bg-[#e4e2e2] rounded-full items-center justify-center flex-row shadow-lg" onPress={stopTimer}>
                  <Text className="text-white font-bold font-sans ml-1 text-sm">Stop</Text>
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
                  <Text className="text-white font-bold font-sans text-[19px]">
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
              <View className="relative items-center justify-center">
                <Animated.View 
                  style={{
                    position: 'absolute', bottom: 65, opacity: tooltipAnim,
                    transform: [ { translateY: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }, { scale: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) } ],
                    width: 140, backgroundColor: '#c89d7d', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5
                  }}
                  pointerEvents="none"
                >
                  <Text className="text-white font-sans text-[12px] font-bold text-center leading-4">Deep Focus is ON</Text>
                  <View style={{ position: 'absolute', bottom: -5, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#c89d7d' }} />
                </Animated.View>
                
                <TouchableOpacity 
                  className={`items-center justify-center w-14 h-14 rounded-3xl ${isDeepFocusEnabled ? 'bg-[#c89d7d]' : ''}`}
                  onPress={() => isDeepFocusEnabled ? stopDeepFocusMode() : setShowDeepFocusPrompt(true)}
                >
                  <MaterialIcons name="light" size={32} color={isDeepFocusEnabled ? "#ffffff" : "#a9a9a9"} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity className="items-center justify-center p-4" onPress={openAnimPopup}>
                <MaterialIcons name="animation" size={28} color="#a9a9a9" />
              </TouchableOpacity>

              <TouchableOpacity className="items-center justify-center p-4" onPress={() => setIsWhiteNoiseOpen(true)}>
                <MaterialIcons name="graphic-eq" size={28} color={whiteNoiseEnabled ? "#c89d7d" : "#a9a9a9"} />
              </TouchableOpacity>
            </Animated.View>

          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>

      {isTasksPopupOpen && (
        <TouchableOpacity activeOpacity={1} onPress={closeTasksPopup} style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }]} />
      )}
      <Animated.View 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 101, transform: [{ translateY: tasksPopupAnim }] }}
        pointerEvents={isTasksPopupOpen ? 'auto' : 'none'}
      >
        <SafeAreaView>
          {popupView === 'tasks' ? (
            <View className="bg-[#ffffff] mx-3 mt-16 rounded-[12px] shadow-[0_8px_30px_rgba(0,139,140,0.06)] border border-[#e4e2e2] overflow-hidden flex-col">
              <ScrollView className="max-h-[70vh]" contentContainerStyle={{ padding: 24, gap: 16 }}>
                <TouchableOpacity className="flex-row items-center justify-center gap-1 py-1 rounded-lg" activeOpacity={0.7} onPress={() => setPopupView('filter')} >
                  <Text className="text-[18px] font-bold font-sans text-[#6a6563] tracking-tight">{selectedFilter === 'Tasks' ? 'All Tasks' : selectedFilter}</Text>
                  <MaterialIcons name="expand-more" size={25} color="#6a6563" />
                </TouchableOpacity>

                <View className="flex-col gap-2 mt-2">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => {
                      const styles = getPriorityStyles(task);
                      const isSelected = selectedTask && selectedTask.id === task.id;
                      
                      return (
                        <TouchableOpacity
                          key={task.id}
                          className={`bg-[#ffffff] rounded-xl p-2 border ${isSelected ? 'border-[#c89d7d]/50' : 'border-[#e4e2e2]'} overflow-hidden flex-row items-center ${styles.opacity}`}
                          activeOpacity={0.7} onPress={() => handleSelectTask(task)}
                        >
                          <View className={`absolute top-0 bottom-0 left-0 w-1.5 ${styles.line}`} />
                          <View className="flex-1 pr-2 pl-2 ">
                            <View className="flex-row items-center mb-1">
                              {task.scheduled_start_time && (
                                <View className={`px-2 py-0.5 rounded mr-2 ${task.is_completed ? 'bg-[#e4e2e2]' : 'bg-[#c89d7d]/20'}`}>
                                  <Text className="text-[8px] font-bold font-sans uppercase tracking-wider text-[#5a413c]">Scheduled</Text>
                                </View>
                              )}
                              <View className="flex-row items-center">
                                <MaterialIcons name={task.is_completed ? "check-circle" : "calendar-today"} size={12} color="#5a413c" />
                                <Text className="text-[#5a413c] font-sans text-[10px] font-bold ml-1">
                                  {task.is_completed ? 'Completed' : `${formatTaskTime(task.deadline)}${formatTaskDateLabel(task.deadline)}`}
                                </Text>
                              </View>
                            </View>
                            <Text className={`text-[16px] font-bold font-sans mb-1.5 ${task.is_completed ? 'text-[#5a413c] line-through' : 'text-[#1b1c1c]'}`} numberOfLines={1}>
                              {task.title}
                            </Text>
                            <View className="flex-row items-center flex-wrap gap-2">
                              <View className="flex-row items-center">
                                {renderTaskPomodoroIcons(task.completed_pomodoros, task.estimated_pomodoros)}
                                <Text className="text-[10px] font-bold font-sans text-[#5a413c]">
                                  {task.completed_pomodoros || 0}/{task.estimated_pomodoros || 1} Sessions
                                </Text>
                              </View>
                              {renderTaskTags(task.tags_detail)}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View className="items-center justify-center py-10">
                      <Text className="text-[#5a413c] font-sans font-medium text-[16px]">No tasks available</Text>
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
                <TouchableOpacity onPress={() => setPopupView('tasks')} className="w-10 h-10 items-center justify-center active:bg-[#eae8e7]">
                  <MaterialIcons name="arrow-back" size={24} color="#5a413c" />
                </TouchableOpacity>
                <Text className="text-[20px] font-bold font-sans text-[#6a6563] flex-1 text-center pr-10">Select Project</Text>
              </View>

              <ScrollView className="max-h-[60vh] flex-col">
                {filterOptions.map(option => {
                  const isActive = selectedFilter === option.label;
                  return (
                    <TouchableOpacity 
                      key={option.label} activeOpacity={0.7}
                      onPress={() => { setSelectedFilter(option.label); setPopupView('tasks'); }}
                      className={`p-2 flex-row items-center gap-2 p-2 transition-colors ${isActive ? 'pt-0.5 mt-0.5 bg-[#f2ede9]/50' : 'bg-transparent border border-transparent rounded-xl active:bg-[#f5f3f3]'}`}
                    >
                      <View className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-[#ce9d7d] shadow-sm' : ''}`}>
                        <MaterialIcons name={option.icon} size={22} color={isActive ? '#ffffff' : '#5a413c'} />
                      </View>
                      <Text className={`flex-1 text-[16px] font-medium font-sans ${isActive ? 'text-[#6a6563]' : 'text-[#1b1c1c]'}`}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>

      <DeepFocusModals 
        showDeepFocusPrompt={showDeepFocusPrompt} setShowDeepFocusPrompt={setShowDeepFocusPrompt}
        handleSetupDeepFocus={handleSetupDeepFocus} showAllowListModal={showAllowListModal}
        setShowAllowListModal={setShowAllowListModal} installedApps={installedApps}
        allowedAppPackages={allowedAppPackages} toggleAllowApp={toggleAllowApp} startDeepFocusMode={startDeepFocusMode}
      />

      {completionModal.visible && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 9999 }]}>
          <ConfettiCannon ref={confettiRefLeft} count={80} origin={{ x: width * 0.15, y: -20 }} autoStart={false} fadeOut={true} fallSpeed={2800} explosionSpeed={300} />
          <ConfettiCannon ref={confettiRefCenter} count={100} origin={{ x: width * 0.5, y: -20 }} autoStart={false} fadeOut={true} fallSpeed={3000} explosionSpeed={300} />
          <ConfettiCannon ref={confettiRefRight} count={80} origin={{ x: width * 0.85, y: -20 }} autoStart={false} fadeOut={true} fallSpeed={2800} explosionSpeed={300} />
        </View>
      )}

      <TimerModals 
        completionModal={completionModal} setCompletionModal={setCompletionModal}
        breakDoneModal={breakDoneModal} setBreakDoneModal={setBreakDoneModal}
      />

      <WhiteNoiseSheet
        visible={isWhiteNoiseOpen} onClose={() => setIsWhiteNoiseOpen(false)}
        enabled={whiteNoiseEnabled} onToggleEnabled={handleToggleWhiteNoise}
        selectedTrackId={selectedTrackId} onSelectTrack={handleSelectTrack}
        volume={whiteNoiseVolume} onVolumeChange={handleVolumeChange}
        tracks={combinedTracks}
      />

      <AnimatedPopup visible={isAnimPopupOpen} onClose={() => setIsAnimPopupOpen(false)}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' }}>
          
          {ownedAnimations.length > 0 ? (
            <>
              <Text className="text-[20px] font-bold text-[#1b1c1c] mb-6 text-center">
                {ownedAnimations[previewIndex]?.name}
              </Text>
              
              <View className="flex-row items-center justify-between w-full mb-8">
                <TouchableOpacity 
                  onPress={() => setPreviewIndex((prev) => (prev - 1 + ownedAnimations.length) % ownedAnimations.length)} 
                  className="p-1 active:bg-[#f5f3f3] rounded-full"
                >
                  <MaterialIcons name="keyboard-arrow-left" size={36} color="#c89d7d" />
                </TouchableOpacity>
                
                <View className="w-36 h-36 bg-[#fbf9f8] rounded-2xl items-center justify-center border border-[#e4e2e2] shadow-sm">
                  <LottieView 
                    source={ANIMATION_ASSETS[ownedAnimations[previewIndex]?.file_identifier]?.lottie || defaultLottie}
                    autoPlay 
                    loop 
                    style={{ width: '85%', height: '85%' }} 
                  />
                </View>
                
                <TouchableOpacity 
                  onPress={() => setPreviewIndex((prev) => (prev + 1) % ownedAnimations.length)} 
                  className="p-1 active:bg-[#f5f3f3] rounded-full"
                >
                  <MaterialIcons name="keyboard-arrow-right" size={36} color="#c89d7d" />
                </TouchableOpacity>
              </View>

              <View className="flex-row w-full gap-3">
                <TouchableOpacity onPress={() => setIsAnimPopupOpen(false)} className="flex-1 py-1.5 rounded-3xl border border-[#e2bfb8] items-center">
                  <Text className="text-[#1b1c1c] font-bold">Cancel</Text>
                </TouchableOpacity>
                
                {ownedAnimations[previewIndex]?.is_equipped ? (
                  <TouchableOpacity 
                    onPress={() => {
                      handleUnequipAnimation(ownedAnimations[previewIndex].id);
                      setIsAnimPopupOpen(false);
                    }} 
                    className="flex-1 py-1.5 rounded-3xl bg-[#f5f3f3] border border-[#e4e2e2] items-center justify-center shadow-sm"
                  >
                    <Text className="text-[#5a413c] font-bold">Unselect</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    onPress={() => {
                      handleEquipAnimation(ownedAnimations[previewIndex].id);
                      setIsAnimPopupOpen(false);
                    }} 
                    className="flex-1 py-1.5 rounded-3xl bg-[#c89d7d] items-center justify-center shadow-sm"
                  >
                    <Text className="text-white font-bold">Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <View className="w-16 h-16 rounded-full bg-[#f5f3f3] items-center justify-center mb-4">
                <MaterialIcons name="storefront" size={32} color="#c89d7d" />
              </View>
              <Text className="text-[20px] font-bold text-[#1b1c1c] mb-2 text-center">No Themes Unlocked</Text>
              <Text className="text-[14px] text-[#5a413c] text-center mb-6">Visit the Store to unlock new focus animations!</Text>
              <TouchableOpacity onPress={() => setIsAnimPopupOpen(false)} className="w-full py-2 rounded-3xl bg-[#c89d7d] items-center justify-center shadow-sm">
                <Text className="text-white font-bold">Close</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </AnimatedPopup>

      <CustomDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} navigation={navigation} currentScreen="Home" />
    </ImageBackground>
  );
}