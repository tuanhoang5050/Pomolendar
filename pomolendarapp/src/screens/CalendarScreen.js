import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, Animated, Dimensions, Easing,
  TouchableWithoutFeedback, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
  UIManager, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';
import QuickCreateTaskPopup from '../components/QuickCreateTaskPopup';
import AutoSchedulePopup from '../components/AutoSchedulePopup';
import DraggableTask from '../components/DraggableTask';
import DraggableEvent from '../components/DraggableEvent';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 80;
const START_HOUR = 0; 
const RIGHT_DRAWER_WIDTH = width * 0.65;
const LEFT_DRAWER_WIDTH = width * 0.55; 
const SNAP_MINUTES = 5;
const WEEK_ROW_HEIGHT = 36; // Hằng số cho chiều cao 1 tuần (32px + 4px margin)

const ITEM_HEIGHT = 32;
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (index >= 0 && index < items.length) onValueChange(items[index]);
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

const filterOptions = [
  { label: 'Today', icon: 'today' },
  { label: 'Tomorrow', icon: 'event' },
  { label: 'This Week', icon: 'date-range' },
  { label: 'This Month', icon: 'calendar-today' },
  { label: 'Tasks', icon: 'checklist' }
];

export default function CalendarScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledItems, setScheduledItems] = useState([]);
  const [sidebarTasks, setSidebarTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const calendarHeightAnim = useRef(new Animated.Value(40)).current;
  const arrowRotationAnim = useRef(new Animated.Value(0)).current;
  const contentOpacityAnim = useRef(new Animated.Value(1)).current;

  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const scrollViewRef = useRef(null);
  const scrollYRef = useRef(0);

  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false); 
  const [selectedFilter, setSelectedFilter] = useState('Tasks');
  
  const [contextMenu, setContextMenu] = useState({ visible: false, top: 0, time: null });
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDuration, setNewEventDuration] = useState(60); 

  const rightDrawerAnim = useRef(new Animated.Value(RIGHT_DRAWER_WIDTH)).current;
  const leftDrawerAnim = useRef(new Animated.Value(-LEFT_DRAWER_WIDTH)).current; 
  const filterMenuAnim = useRef(new Animated.Value(RIGHT_DRAWER_WIDTH)).current;
  const createEventAnim = useRef(new Animated.Value(height)).current;

  const checkOverlap = (start, end, excludeId = null) => {
    return scheduledItems.some(existing => {
      const existingId = existing.task_id || existing.event_id || existing.id;
      if (excludeId && String(existingId) === String(excludeId)) return false;

      const existingStart = new Date(existing.start_time).getTime();
      const existingEnd = new Date(existing.end_time).getTime();
      
      return start.getTime() < existingEnd && end.getTime() > existingStart;
    });
  };

  const fetchCalendarData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      let events = [];
      let tasksData = [];

      try {
        const calendarRes = await api.get(`/planner/calendar/daily/?date=${dateStr}`);
        events = calendarRes.data.events || [];
      } catch (e) {}

      try {
        const tasksRes = await api.get('/planner/tasks/');
        tasksData = tasksRes.data || [];
      } catch (e) {}

      setScheduledItems(events);
      setSidebarTasks(tasksData);
    } finally { 
      if (showLoading) setIsLoading(false); 
    }
  };

  useFocusEffect(useCallback(() => { fetchCalendarData(true); }, [selectedDate]));

  const handleScroll = (e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; };
  const handlePrevMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const calculateTop = (startTimeIso) => {
    if (!startTimeIso) return 0;
    const date = new Date(startTimeIso);
    return Math.max(date.getHours() - START_HOUR, 0) * HOUR_HEIGHT + (date.getMinutes() / 60) * HOUR_HEIGHT;
  };

  const calculateHeight = (startTimeIso, endTimeIso) => {
    if (!startTimeIso || !endTimeIso) return HOUR_HEIGHT;
    const diffHours = (new Date(endTimeIso) - new Date(startTimeIso)) / (1000 * 60 * 60);
    return Math.max(diffHours * HOUR_HEIGHT, 40);
  };

  const handleTimelineLongPress = (e) => {
    const { locationY } = e.nativeEvent;
    const totalMinutes = (locationY / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
    const hour = Math.floor(snappedMinutes / 60) + START_HOUR;
    const minute = snappedMinutes % 60;

    const newTime = new Date(selectedDate);
    newTime.setHours(hour, minute, 0, 0);

    setContextMenu({ visible: true, top: locationY, time: newTime });
  };

  const confirmAutoSchedule = async (scheduleOpts) => {
    setIsScheduling(true);
    try {
      await api.post('/planner/tasks/generate-schedule/', scheduleOpts);
      setIsAutoScheduleOpen(false);
      fetchCalendarData(true);
    } catch (e) {
      Alert.alert("Error", "An error occurred during automatic scheduling.");
    } finally {
      setIsScheduling(false);
    }
  };

  const openCreateTaskPopup = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setIsCreateTaskOpen(true);
  };

  const openCreateEventPopup = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setIsCreateEventOpen(true);
    Animated.timing(createEventAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeCreateEventPopup = () => {
    Animated.timing(createEventAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => {
      setIsCreateEventOpen(false);
      setNewEventTitle('');
      setNewEventDuration(60);
    });
  };

  const handleQuickCreateEvent = async () => {
    if (!newEventTitle.trim()) return;
    const startTime = contextMenu.time;
    const endTime = new Date(startTime.getTime() + newEventDuration * 60000);

    if (checkOverlap(startTime, endTime)) {
        Alert.alert("Schedule Conflict", "This time slot is already occupied by another task or event.");
        return;
    }

    try {
      await api.post('/planner/fixed-events/', {
        title: newEventTitle,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      });
      closeCreateEventPopup();
      fetchCalendarData(false); 
    } catch (e) {
      closeCreateEventPopup();
      fetchCalendarData(false); 
    }
  };

  const handleDragEnd = async (item, newY) => {
    setScrollEnabled(true);
    let clampedY = Math.max(0, newY);
    
    const totalMinutes = (clampedY / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const newHour = Math.floor(snappedMinutes / 60) + START_HOUR;
    const newMinute = snappedMinutes % 60;

    if (newHour < START_HOUR || newHour >= 24) return fetchCalendarData(false);

    const oldDuration = new Date(item.end_time).getTime() - new Date(item.start_time).getTime();
    const newStartTime = new Date(selectedDate);
    newStartTime.setHours(newHour, newMinute, 0, 0);

    if (newStartTime.getTime() === new Date(item.start_time).getTime()) {
      return; 
    }

    const newEndTime = new Date(newStartTime.getTime() + oldDuration);
    const targetId = item.task_id || item.event_id || item.id;

    if (checkOverlap(newStartTime, newEndTime, targetId)) {
        return fetchCalendarData(false);
    }

    setScheduledItems(prev => prev.map(i => {
      const currentId = i.task_id || i.event_id || i.id;
      if (String(currentId) === String(targetId)) {
        return { ...i, start_time: newStartTime.toISOString(), end_time: newEndTime.toISOString() };
      }
      return i;
    }));

    try {
      if (item.type === 'fixed_event') {
        const cleanEventId = String(targetId).replace('fixed_', '');
        await api.put(`/planner/fixed-events/${cleanEventId}/`, {
          ...item, 
          title: item.title,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString()
        });
      } else {
        await api.patch(`/planner/tasks/${targetId}/`, {
          scheduled_start_time: newStartTime.toISOString(),
          scheduled_end_time: newEndTime.toISOString()
        });
      }
      fetchCalendarData(false);
    } catch (e) { 
      fetchCalendarData(false); 
    }
  };

  const handleRemoveFromCalendar = async (item) => {
    Alert.alert(
      "Remove from calendar",
      item.type === 'fixed_event' ? "Are you sure you want to delete this event?" : "Unschedule this task?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            const targetId = item.task_id || item.event_id || item.id;
            setScheduledItems(prev => prev.filter(i => {
              const currentId = i.task_id || i.event_id || i.id;
              return String(currentId) !== String(targetId);
            }));

            try {
              if (item.type === 'fixed_event') {
                const cleanEventId = String(targetId).replace('fixed_', '');
                await api.delete(`/planner/fixed-events/${cleanEventId}/`);
              } else {
                await api.patch(`/planner/tasks/${targetId}/`, {
                  scheduled_start_time: null,
                  scheduled_end_time: null
                });
              }
              fetchCalendarData(false);
            } catch (e) {
              fetchCalendarData(false);
            }
          }
        }
      ]
    );
  };

  const handleAddTaskToCalendar = async (task) => {
    closeRightDrawer();
    const newStartTime = new Date(selectedDate);
    newStartTime.setHours(8, 0, 0, 0); 
    const durationMinutes = (task.estimated_pomodoros || 1) * 30;
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60000);

    const targetId = task.task_id || task.id;

    if (checkOverlap(newStartTime, newEndTime)) {
        Alert.alert("Schedule Conflict", "Not enough empty space at 08:00 AM for this task.");
        return;
    }

    try {
      await api.patch(`/planner/tasks/${targetId}/`, {
        scheduled_start_time: newStartTime.toISOString(),
        scheduled_end_time: newEndTime.toISOString()
      });
      fetchCalendarData(false); 
    } catch (e) {}
  };

  const handlePlayTask = async (taskId) => {
    await AsyncStorage.setItem('current_task_id', taskId.toString());
    navigation.navigate('Home');
  };

  const openLeftDrawer = () => { setIsLeftDrawerOpen(true); Animated.timing(leftDrawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(); };
  const closeLeftDrawer = () => { Animated.timing(leftDrawerAnim, { toValue: -LEFT_DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start(() => setIsLeftDrawerOpen(false)); };
  
  const openRightDrawer = () => { setIsRightDrawerOpen(true); Animated.timing(rightDrawerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeRightDrawer = () => { Animated.timing(rightDrawerAnim, { toValue: RIGHT_DRAWER_WIDTH, duration: 300, useNativeDriver: true }).start(() => { setIsRightDrawerOpen(false); filterMenuAnim.setValue(RIGHT_DRAWER_WIDTH); }); };
  const openFilterMenu = () => { Animated.timing(filterMenuAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); };
  const closeFilterMenu = () => { Animated.timing(filterMenuAnim, { toValue: RIGHT_DRAWER_WIDTH, duration: 300, useNativeDriver: true }).start(); };
  const handleSelectFilter = (label) => { setSelectedFilter(label); closeFilterMenu(); };

  const getFilteredSidebarTasks = () => {
    return sidebarTasks.filter(task => {
      if (task.is_completed || task.scheduled_start_time) return false; 
      if (selectedFilter === 'Tasks') return true;
      const taskDay = task.deadline ? new Date(new Date(task.deadline).setHours(0,0,0,0)) : null;
      if (!taskDay) return selectedFilter === 'Today';
      const today = new Date(new Date().setHours(0,0,0,0));
      if (selectedFilter === 'Today') return taskDay.getTime() === today.getTime();
      return true; 
    });
  };

  const getMonthGridRows = useCallback(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    return Math.ceil((daysInMonth + adjustedFirstDay) / 7);
  }, [selectedDate]);

  useEffect(() => {
    if (isCalendarExpanded) {
      calendarHeightAnim.setValue(getMonthGridRows() * WEEK_ROW_HEIGHT);
    }
  }, [selectedDate, isCalendarExpanded, getMonthGridRows]);

    const toggleCalendarExpansion = () => {
    const expanding = !isCalendarExpanded;
    const targetHeight = expanding ? getMonthGridRows() * WEEK_ROW_HEIGHT : 40;
    Animated.timing(calendarHeightAnim, {
      toValue: targetHeight,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, 
    }).start();

    Animated.timing(arrowRotationAnim, {
      toValue: expanding ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

   
    Animated.timing(contentOpacityAnim, {
      toValue: 0,
      duration: 130,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setIsCalendarExpanded(expanding);
      Animated.timing(contentOpacityAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  };

  const arrowRotation = arrowRotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  const getPriorityStyles = (task) => {
    if (task.is_completed) return { line: 'bg-[#e2bfb8]', opacity: 'opacity-60' };
    return { line: 'bg-[#C27664]', opacity: 'opacity-100' };
  };

  const renderCalendarDays = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const currentDay = selectedDate.getDate();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

    const selectedDateObj = new Date(year, month, currentDay);
    const dayOfWeek = selectedDateObj.getDay();
    const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayObj = new Date(year, month, currentDay - distToMonday);
    
    const currentWeekDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(mondayObj);
        d.setDate(d.getDate() + i);
        if(d.getMonth() === month) return d.getDate();
        return null;
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
      <View className="w-full relative pb-4"> 
        <View className="flex-row items-center justify-between mb-3 -ml-1 pr-1">
          <TouchableOpacity className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg">
            <Text className="text-[16px] font-bold text-[#1b1c1c]">{monthNames[month]} {year}</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={handlePrevMonth} className="w-8 h-8 rounded-full bg-[#efeded] items-center justify-center active:bg-[#e4e2e2]"><MaterialIcons name="chevron-left" size={22} color="#1b1c1c" /></TouchableOpacity>
            <TouchableOpacity onPress={handleNextMonth} className="w-8 h-8 rounded-full bg-[#efeded] items-center justify-center active:bg-[#e4e2e2]"><MaterialIcons name="chevron-right" size={22} color="#1b1c1c" /></TouchableOpacity>
          </View>
        </View>

        <View className="flex-row px-1 mb-2">
          {daysOfWeek.map((d, index) => (
            <View key={d} className="w-[14.28%] items-center"><Text className={`text-[12px] font-bold ${index === 6 ? 'opacity-50' : ''} ${index === 2 ? 'text-[#c89d7d]' : 'text-[#5a413c] opacity-70'}`}>{d}</Text></View>
          ))}
        </View>

        <Animated.View style={{ height: calendarHeightAnim, overflow: 'hidden', width: '100%' }}>
            
            <Animated.View 
                className="flex-row flex-wrap px-1 relative w-full" 
                style={{ opacity: contentOpacityAnim }}
            >
                {isCalendarExpanded ? (
                    <>
                        {Array(adjustedFirstDay).fill(null).map((_, i) => <View key={`b-${i}`} className="w-[14.28%] h-8 mb-1" />)}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                            const isSelectedDate = d === selectedDate.getDate();
                            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
                            return (
                            <View key={d} className="w-[14.28%] items-center mb-1">
                                <TouchableOpacity onPress={() => setSelectedDate(new Date(year, month, d))} className={`w-8 h-8 items-center justify-center rounded-full ${isSelectedDate ? 'bg-[#c89d7d] shadow-md' : 'active:bg-[#efeded]'}`}>
                                <Text className={`text-[14px] ${isSelectedDate ? 'text-white font-bold' : isToday ? 'text-[#c89d7d] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{d}</Text>
                                </TouchableOpacity>
                            </View>
                            );
                        })}
                    </>
                ) : (
                    currentWeekDays.map((d, index) => {
                        if (d === null) return <View key={`cw-b-${index}`} className="w-[14.28%] h-8 mb-1" />;
                        const isSelectedDate = d === selectedDate.getDate();
                        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
                        return (
                             <View key={`cw-${d}`} className="w-[14.28%] items-center mb-1">
                                <TouchableOpacity onPress={() => setSelectedDate(new Date(year, month, d))} className={`w-8 h-8 items-center justify-center rounded-full ${isSelectedDate ? 'bg-[#c89d7d] shadow-md' : 'active:bg-[#efeded]'}`}>
                                    <Text className={`text-[14px] ${isSelectedDate ? 'text-white font-bold' : isToday ? 'text-[#c89d7d] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{d}</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    })
                )}
            </Animated.View>
            
        </Animated.View>
        
        <View className="absolute bottom-[-5px] left-0 right-0 items-center justify-center pointer-events-box-none">
            <TouchableOpacity onPress={toggleCalendarExpansion} className="py-1 px-4">
                <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
                  <MaterialIcons name="keyboard-arrow-down" size={28} color="#ce896b" />
                </Animated.View>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTimeline = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i + START_HOUR);

    return (
      <View className="flex-1 bg-[#ffffff] rounded-t-3xl border-t border-[#e4e2e2] shadow-sm overflow-hidden mx-0 relative" style={{ marginTop: isCalendarExpanded ? -10 : 5 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#c89d7d" className="mt-10" />
        ) : (
          <ScrollView 
            ref={scrollViewRef} onScroll={handleScroll} scrollEventThrottle={16} scrollEnabled={scrollEnabled} 
            showsVerticalScrollIndicator={false} contentContainerStyle={{ position: 'relative', paddingBottom: 100, paddingTop: 10 }}
            contentOffset={{ x: 0, y: 7 * HOUR_HEIGHT }} 
          >
            <TouchableWithoutFeedback onLongPress={handleTimelineLongPress} delayLongPress={400}>
              <View style={{ minHeight: hours.length * HOUR_HEIGHT }}>
                {hours.map(hour => (
                  <View key={hour} pointerEvents="none" style={{ height: HOUR_HEIGHT, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f5f3f3' }}>
                    <View className="w-14 items-end pr-2 pt-1"><Text className="text-[12px] font-bold text-[#5a413c] opacity-70">{hour.toString().padStart(2, '0')}:00</Text></View>
                    <View className="flex-1 border-l border-[#e4e2e2]" />
                  </View>
                ))}

                {contextMenu.visible && (
                  <>
                    <TouchableOpacity activeOpacity={1} onPress={() => setContextMenu({ ...contextMenu, visible: false })} style={[StyleSheet.absoluteFill, { zIndex: 99 }]}><View /></TouchableOpacity>
                    <View style={{ position: 'absolute', top: contextMenu.top, left: 70, backgroundColor: '#fff', borderRadius: 12, padding: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 100, width: 170 }}>
                      <TouchableOpacity className="flex-row items-center gap-2 px-3 py-3 border-b border-[#f5f3f3] active:bg-[#f5f3f3] rounded-t-lg" onPress={openCreateTaskPopup}><MaterialIcons name="check-circle-outline" size={18} color="#c89d7d" /><Text className="text-[14px] font-medium text-[#1b1c1c]">New Task</Text></TouchableOpacity>
                      <TouchableOpacity className="flex-row items-center gap-2 px-3 py-3 active:bg-[#f5f3f3] rounded-b-lg" onPress={openCreateEventPopup}><MaterialIcons name="event" size={18} color="#6bbda7" /><Text className="text-[14px] font-medium text-[#1b1c1c]">New Event</Text></TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>

            {scheduledItems.map(item => {
              const top = calculateTop(item.start_time);
              const eventHeight = calculateHeight(item.start_time, item.end_time);
              const mapKey = item.task_id || item.event_id || item.id; 

              if (item.type === 'fixed_event') {
                return (
                  <DraggableEvent 
                    key={`event-${mapKey}`} item={item} baseTop={top} baseHeight={eventHeight}
                    onDragStart={() => setScrollEnabled(false)}
                    onDragEnd={handleDragEnd}
                    onRemove={handleRemoveFromCalendar}
                    scrollViewRef={scrollViewRef} scrollYRef={scrollYRef}
                  />
                );
              }

              if (item.type === 'task') {
                return (
                  <DraggableTask 
                    key={`task-${mapKey}`} item={item} baseTop={top} baseHeight={eventHeight}
                    onDragStart={() => setScrollEnabled(false)}
                    onDragEnd={handleDragEnd} onPlay={handlePlayTask}
                    onRemove={handleRemoveFromCalendar}
                    scrollViewRef={scrollViewRef} scrollYRef={scrollYRef}
                  />
                );
              }
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between px-5 py-12 bg-[#fbf9f8] z-20 sticky top-0">
            <TouchableOpacity onPress={openLeftDrawer}><MaterialIcons name="menu" size={26} color="#c89d7d" /></TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setIsAutoScheduleOpen(true)} 
              className="flex-row items-center justify-center bg-[#c89d7d] px-5 py-1 mt-2 rounded-full border border-[#c89d7d]/20 shadow-sm"
              activeOpacity={0.8}
            >
              <Text className="text-[14px] font-bold text-[#ffffff] tracking-wide">Auto-Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openRightDrawer}><MaterialIcons name="add" size={26} color="#c89d7d" /></TouchableOpacity>
          </View>

          <View className="px-5 mt-2 z-10 bg-[#fbf9f8] pb-1">{renderCalendarDays()}</View>
          {renderTimeline()}

          <View className="absolute bottom-6 left-1/2" style={{ transform: [{ translateX: -32 }], zIndex: 80 }}>
            <TouchableOpacity 
              className="w-16 h-16 bg-[#c89d7d] rounded-full items-center justify-center shadow-lg"
              style={{ elevation: 8, shadowColor: '#c89d7d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 12 }}
              activeOpacity={0.8} onPress={() => navigation.navigate('Home')}
            >
              <MaterialIcons name="play-arrow" size={36} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <CustomDrawer 
          isOpen={isLeftDrawerOpen} 
          onClose={() => setIsLeftDrawerOpen(false)} 
          navigation={navigation} 
          currentScreen="Calendar" 
        />

        {isRightDrawerOpen && (
          <TouchableOpacity activeOpacity={1} onPress={closeRightDrawer} style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 }]}>
             <View />
          </TouchableOpacity>
        )}
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: RIGHT_DRAWER_WIDTH, backgroundColor: '#fbf9f8', zIndex: 100, transform: [{ translateX: rightDrawerAnim }] }}>
          <SafeAreaView style={{ flex: 1 }}>
            <TouchableOpacity className="px-4 py-3 mt-6 border-b border-[#e4e2e2]/50" onPress={openFilterMenu}><Text className="text-[20px] font-bold text-[#c89d7d]">{selectedFilter}</Text></TouchableOpacity>
            <ScrollView className="flex-1 px-4 pt-2">
              <Text className="text-[12px] font-bold text-[#5a413c] mb-3 opacity-70">TAP TO ADD TO CALENDAR</Text>
              {getFilteredSidebarTasks().length > 0 ? (
                getFilteredSidebarTasks().map(task => (
                  <TouchableOpacity key={task.id} onPress={() => handleAddTaskToCalendar(task)} className="bg-[#ffffff] rounded-xl p-3 border border-[#e4e2e2] shadow-sm mb-3">
                    <Text className="text-[14px] font-bold text-[#1b1c1c] mb-2">{task.title}</Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] font-bold text-[#c89d7d]">{task.estimated_pomodoros} Pomo</Text>
                      <MaterialIcons name="add-circle-outline" size={20} color="#c89d7d" />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-[14px] text-center text-[#8e706b] mt-10">No pending tasks to schedule</Text>
              )}
            </ScrollView>
          </SafeAreaView>

          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', zIndex: 110, transform: [{ translateX: filterMenuAnim }] }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View className="flex-row items-center px-2 py-2 mt-6 border-b border-[#e4e2e2]/50 mb-4">
                <TouchableOpacity onPress={closeFilterMenu} className="w-10 h-10 items-center justify-center rounded-full"><MaterialIcons name="arrow-back" size={24} color="#5a413c" /></TouchableOpacity>
                <Text className="text-[18px] font-bold text-[#1b1c1c] ml-1">Filter</Text>
              </View>
              <ScrollView className="px-4 flex-col">
                {filterOptions.map(option => {
                  const isActive = selectedFilter === option.label;
                  return (
                    <TouchableOpacity 
                      key={option.label} onPress={() => handleSelectFilter(option.label)}
                      className={`w-full flex-row items-center p-3 mb-2 rounded-xl ${isActive ? 'bg-[#c89d7d]/10 border border-[#c89d7d]/20' : ''}`}
                    >
                      <View className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive ? 'bg-[#c89d7d]' : 'bg-[#f5f3f3]'}`}><MaterialIcons name={option.icon} size={20} color={isActive ? '#ffffff' : '#5a413c'} /></View>
                      <Text className={`flex-1 text-[15px] px-2 font-medium ${isActive ? 'text-[#c89d7d]' : 'text-[#1b1c1c]'}`}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </Animated.View>

        {isCreateEventOpen && (
          <TouchableOpacity activeOpacity={1} onPress={closeCreateEventPopup} style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 }]}>
             <View />
          </TouchableOpacity>
        )}
        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, minHeight: 220, zIndex: 101, transform: [{ translateY: createEventAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 }}>
          <View className="w-full items-center pt-3 pb-2"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
          
          <View className="px-5 pt-3 pb-5 flex-col">
            <View className="flex-row items-center justify-between border-b border-[#f5f3f3] pb-3 mb-4">
              <Text className="text-[20px] font-bold text-[#1b1c1c]">New Event</Text>
              <View className="bg-[#6da7e2]/10 px-3 py-1 rounded-full">
                <Text className="text-[12px] font-bold text-[#6da7e2]">
                  {contextMenu.time ? `${String(contextMenu.time.getHours()).padStart(2,'0')}:${String(contextMenu.time.getMinutes()).padStart(2,'0')} - ${String(new Date(contextMenu.time.getTime() + newEventDuration * 60000).getHours()).padStart(2,'0')}:${String(new Date(contextMenu.time.getTime() + newEventDuration * 60000).getMinutes()).padStart(2,'0')}` : ''}
                </Text>
              </View>
            </View>

            <View>
              <Text className="text-[12px] font-bold text-[#5a413c] mb-2 uppercase tracking-wider">Event Name</Text>
              <TextInput 
                className="w-full bg-[#f5f3f3] rounded-xl px-4 py-3 text-[16px] text-[#1b1c1c]" 
                placeholder="What's happening?" 
                placeholderTextColor="#e2bfb8" 
                value={newEventTitle} 
                onChangeText={setNewEventTitle} 
              />
            </View>

            <View className="flex-row items-center justify-between bg-[#fbf9f8] p-3 rounded-xl border border-[#e4e2e2] mt-4">
              <Text className="text-[14px] font-medium text-[#5a413c]">Duration (minutes)</Text>
              <View className="flex-row items-center bg-[#ffffff] rounded-full p-1 border border-[#e4e2e2]">
                <TouchableOpacity className="w-8 h-8 rounded-full bg-[#f5f3f3] items-center justify-center active:bg-[#e4e2e2]" onPress={() => setNewEventDuration(p => Math.max(15, p - 15))}><MaterialIcons name="remove" size={16} color="#1b1c1c" /></TouchableOpacity>
                <Text className="w-12 text-center text-[16px] font-bold text-[#6da7e2]">{newEventDuration}</Text>
                <TouchableOpacity className="w-8 h-8 rounded-full bg-[#6da7e2] items-center justify-center active:bg-[#6da7e2]" onPress={() => setNewEventDuration(p => Math.min(240, p + 15))}><MaterialIcons name="add" size={16} color="#ffffff" /></TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              className={`w-full rounded-3xl py-1.5 flex-row justify-center items-center mt-6 ${newEventTitle.trim() ? 'bg-[#6da7e2]' : 'bg-[#e4e2e2]'}`} 
              onPress={handleQuickCreateEvent} 
              disabled={!newEventTitle.trim()}
            >
              <Text className={`text-[16px] font-bold ${newEventTitle.trim() ? 'text-white' : 'text-[#8e706b]'}`}>Save Event</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <QuickCreateTaskPopup 
          visible={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskCreated={() => fetchCalendarData(false)}
          initialStartTime={contextMenu.time}
        />

        <AutoSchedulePopup 
          visible={isAutoScheduleOpen}
          onClose={() => !isScheduling && setIsAutoScheduleOpen(false)}
          onConfirm={confirmAutoSchedule}
          isScheduling={isScheduling}
        />

      </KeyboardAvoidingView>
    </View>
  );
}