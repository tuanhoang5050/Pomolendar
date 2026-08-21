import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, Animated, Dimensions, 
  TouchableWithoutFeedback, StyleSheet, ActivityIndicator, PanResponder, TextInput, KeyboardAvoidingView, Platform,
  LayoutAnimation, UIManager, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const HOUR_HEIGHT = 80;
const START_HOUR = 0; 
const RIGHT_DRAWER_WIDTH = width * 0.65;
const LEFT_DRAWER_WIDTH = width * 0.55; 
const SNAP_MINUTES = 5;

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

const DraggableTask = ({ item, baseTop, baseHeight, onDragStart, onDragEnd, onPlay, onRemove, scrollViewRef, scrollYRef }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: baseTop })).current;
  const [isDragging, setIsDragging] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const autoScrollTimer = useRef(null);
  const longPressTimer = useRef(null);
  const currentDy = useRef(0);
  const dragStartScrollY = useRef(0);

  const latestProps = useRef({ item, onDragStart, onDragEnd, onRemove });
  useEffect(() => {
    latestProps.current = { item, onDragStart, onDragEnd, onRemove };
  }, [item, onDragStart, onDragEnd, onRemove]);

  useEffect(() => {
    let hideTimer;
    if (showDelete) {
      hideTimer = setTimeout(() => setShowDelete(false), 3500);
    }
    return () => clearTimeout(hideTimer);
  }, [showDelete]);

  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };

  useEffect(() => {
    if (!isDragging) {
      Animated.timing(pan.y, { toValue: baseTop, duration: 150, useNativeDriver: false }).start();
    }
  }, [baseTop, isDragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, 
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      
      onPanResponderGrant: () => {
        setIsDragging(true);
        dragStartScrollY.current = scrollYRef.current;
        currentDy.current = 0;
        latestProps.current.onDragStart(); 
        pan.setOffset({ x: 0, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });

        longPressTimer.current = setTimeout(() => {
          setShowDelete(true);
        }, 1000);
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 5) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setShowDelete(false);
        }

        currentDy.current = gestureState.dy;
        const scrollComp = scrollYRef.current - dragStartScrollY.current;
        pan.setValue({ x: 0, y: currentDy.current + scrollComp });

        const moveY = gestureState.moveY;
        const topBoundary = 280;
        const bottomBoundary = height - 180;
        const scrollSpeed = 5;

        if (moveY < topBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              if (scrollYRef.current > 0) {
                scrollYRef.current = Math.max(0, scrollYRef.current - scrollSpeed);
                scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
                const newScrollComp = scrollYRef.current - dragStartScrollY.current;
                pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
              }
            }, 16);
          }
        } else if (moveY > bottomBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              scrollYRef.current += scrollSpeed;
              scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
              const newScrollComp = scrollYRef.current - dragStartScrollY.current;
              pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
            }, 16);
          }
        } else {
          stopAutoScroll();
        }
      },
      onPanResponderRelease: (_, gestureState) => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      },
      onPanResponderTerminate: () => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      }
    })
  ).current;

  const bgColor = item.is_completed ? '#e4e2e280' : '#c89d7d';
  const borderColor = item.is_completed ? '#e4e2e2' : 'transparent';
  const lineColor = item.is_completed ? '#8e706b' : '#a67d60';
  const textColor = item.is_completed ? '#5a413c' : '#ffffff';

  const isTooShort = baseHeight < 45;

  return (
    <Animated.View 
      {...(!item.is_completed ? panResponder.panHandlers : {})}
      style={{ 
        position: 'absolute', top: 0, left: 64, right: 8, height: baseHeight - 4, 
        backgroundColor: bgColor, borderRadius: 8, borderWidth: 1, borderColor, 
        overflow: isTooShort ? 'visible' : 'hidden', zIndex: isDragging ? 50 : 10,
        transform: [{ translateY: pan.y }, { scale: isDragging ? 1.02 : 1 }],
        shadowColor: '#000', shadowOffset: { width: 0, height: isDragging ? 6 : 2 }, 
        shadowOpacity: isDragging ? 0.2 : 0.1, shadowRadius: isDragging ? 8 : 4, elevation: isDragging ? 8 : 3 
      }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: lineColor }} />
      <View className="flex-1 p-2 flex-col justify-between">
        <View style={{ paddingRight: isTooShort ? 60 : 0 }}>
          <Text className={`text-[14px] font-bold ${item.is_completed ? 'line-through' : ''}`} style={{ color: textColor }} numberOfLines={1}>{item.title}</Text>
        </View>
        {!isTooShort && (
          <View className="flex-row items-center justify-between mt-1">
            <View className="bg-[#ffffff40] px-2 py-0.5 rounded flex-row items-center">
              <MaterialIcons name="drag-handle" size={10} color={textColor} style={{ marginRight: 2 }}/>
              <Text className="text-[10px] font-bold" style={{ color: textColor }}>{item.estimated_pomodoros} Pomo</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {showDelete && (
                <TouchableOpacity 
                  className="w-7 h-7 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
                  onPress={() => latestProps.current.onRemove(item)}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#ffffff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                className={`w-7 h-7 rounded-full items-center justify-center ${item.is_completed ? 'bg-transparent' : 'bg-[#a67d60] shadow-sm'}`} 
                disabled={item.is_completed} onPress={() => onPlay(item.task_id)}
              >
                <MaterialIcons name={item.is_completed ? "check" : "play-arrow"} size={16} color={item.is_completed ? "#8e706b" : "#ffffff"} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {isTooShort && (
        <View style={{ position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 6, zIndex: 100 }}>
          {showDelete && (
            <TouchableOpacity 
              className="w-6 h-6 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
              onPress={() => latestProps.current.onRemove(item)}
            >
              <MaterialIcons name="delete-outline" size={14} color="#ffffff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            className={`mr-1 w-6 h-6 rounded-full items-center justify-center ${item.is_completed ? 'bg-[#e4e2e2]' : 'bg-[#a67d60] shadow-sm'}`} 
            disabled={item.is_completed} onPress={() => onPlay(item.task_id)}
          >
            <MaterialIcons name={item.is_completed ? "check" : "play-arrow"} size={14} color={item.is_completed ? "#8e706b" : "#ffffff"} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const DraggableEvent = ({ item, baseTop, baseHeight, onDragStart, onDragEnd, onRemove, scrollViewRef, scrollYRef }) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: baseTop })).current;
  const [isDragging, setIsDragging] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const autoScrollTimer = useRef(null);
  const longPressTimer = useRef(null);
  const currentDy = useRef(0);
  const dragStartScrollY = useRef(0);

  const latestProps = useRef({ item, onDragStart, onDragEnd, onRemove });
  useEffect(() => {
    latestProps.current = { item, onDragStart, onDragEnd, onRemove };
  }, [item, onDragStart, onDragEnd, onRemove]);

  useEffect(() => {
    let hideTimer;
    if (showDelete) {
      hideTimer = setTimeout(() => setShowDelete(false), 3500);
    }
    return () => clearTimeout(hideTimer);
  }, [showDelete]);

  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };

  useEffect(() => {
    if (!isDragging) {
      Animated.timing(pan.y, { toValue: baseTop, duration: 150, useNativeDriver: false }).start();
    }
  }, [baseTop, isDragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true, 
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      
      onPanResponderGrant: () => {
        setIsDragging(true);
        dragStartScrollY.current = scrollYRef.current;
        currentDy.current = 0;
        latestProps.current.onDragStart(); 
        pan.setOffset({ x: 0, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });

        longPressTimer.current = setTimeout(() => {
          setShowDelete(true);
        }, 1000);
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 5) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setShowDelete(false);
        }

        currentDy.current = gestureState.dy;
        const scrollComp = scrollYRef.current - dragStartScrollY.current;
        pan.setValue({ x: 0, y: currentDy.current + scrollComp });

        const moveY = gestureState.moveY;
        const topBoundary = 280;
        const bottomBoundary = height - 180;
        const scrollSpeed = 5;

        if (moveY < topBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              if (scrollYRef.current > 0) {
                scrollYRef.current = Math.max(0, scrollYRef.current - scrollSpeed);
                scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
                const newScrollComp = scrollYRef.current - dragStartScrollY.current;
                pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
              }
            }, 16);
          }
        } else if (moveY > bottomBoundary) {
          if (!autoScrollTimer.current) {
            autoScrollTimer.current = setInterval(() => {
              scrollYRef.current += scrollSpeed;
              scrollViewRef.current?.scrollTo({ y: scrollYRef.current, animated: false });
              const newScrollComp = scrollYRef.current - dragStartScrollY.current;
              pan.setValue({ x: 0, y: currentDy.current + newScrollComp });
            }, 16);
          }
        } else {
          stopAutoScroll();
        }
      },
      onPanResponderRelease: (_, gestureState) => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      },
      onPanResponderTerminate: () => { 
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        stopAutoScroll(); 
        pan.flattenOffset(); 
        setIsDragging(false); 
        latestProps.current.onDragEnd(latestProps.current.item, pan.y._value); 
      }
    })
  ).current;

  const bgColor = '#e0f2f1';
  const borderColor = '#b2dfdb';
  const lineColor = '#00695c';
  const textColor = '#00695c';

  const isTooShort = baseHeight < 45;

  return (
    <Animated.View 
      {...panResponder.panHandlers}
      style={{ 
        position: 'absolute', top: 0, left: 64, right: 8, height: baseHeight - 4, 
        backgroundColor: bgColor, borderRadius: 8, borderWidth: 1, borderColor, 
        overflow: isTooShort ? 'visible' : 'hidden', zIndex: isDragging ? 50 : 5,
        transform: [{ translateY: pan.y }, { scale: isDragging ? 1.02 : 1 }],
        shadowColor: '#00695c', shadowOffset: { width: 0, height: isDragging ? 6 : 2 }, 
        shadowOpacity: isDragging ? 0.1 : 0, shadowRadius: isDragging ? 8 : 4, elevation: isDragging ? 8 : 0 
      }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: lineColor }} />
      <View className="flex-1 p-2 flex-row justify-between">
        <View className="flex-1 flex-col" style={{ paddingRight: isTooShort && showDelete ? 36 : 0 }}>
          <Text className="text-[14px] font-bold" style={{ color: textColor }} numberOfLines={1}>{item.title}</Text>
          {!isTooShort && (
            <View className="mt-1 flex-row items-center">
              <MaterialIcons name="event" size={12} color={textColor} style={{ marginRight: 4 }}/>
              <Text style={{ fontSize: 11, color: textColor, fontWeight: 'bold' }}>
                {new Date(item.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(item.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          )}
        </View>
        {!isTooShort && showDelete && (
          <View className="justify-end pl-2">
            <TouchableOpacity 
              className="w-7 h-7 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
              onPress={() => latestProps.current.onRemove(item)}
            >
              <MaterialIcons name="delete-outline" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isTooShort && showDelete && (
        <View style={{ position: 'absolute', top: 4, right: 4, zIndex: 100 }}>
          <TouchableOpacity 
            className="mr-1 w-5 h-5 rounded-full items-center justify-center bg-[#ba1a1a] shadow-sm"
            onPress={() => latestProps.current.onRemove(item)}
          >
            <MaterialIcons name="delete-outline" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

export default function CalendarScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledItems, setScheduledItems] = useState([]);
  const [sidebarTasks, setSidebarTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const scrollViewRef = useRef(null);
  const scrollYRef = useRef(0);

  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false); 
  const [selectedFilter, setSelectedFilter] = useState('Tasks');
  
  const [contextMenu, setContextMenu] = useState({ visible: false, top: 0, time: null });
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPomo, setNewTaskPomo] = useState(1);
  const [showCustomPomo, setShowCustomPomo] = useState(false);
  const [activeSubPopup, setActiveSubPopup] = useState(null); 
  const [quickPriority, setQuickPriority] = useState(4); 
  
  const [tempDeadlineDate, setTempDeadlineDate] = useState(new Date());
  const [tempDeadlineQuick, setTempDeadlineQuick] = useState('Hôm nay');
  const [deadlineViewDate, setDeadlineViewDate] = useState(new Date());
  const [finalDeadline, setFinalDeadline] = useState(null);

  const [tempReminderDate, setTempReminderDate] = useState(new Date());
  const [reminderViewDate, setReminderViewDate] = useState(new Date());
  const [tempReminderHour, setTempReminderHour] = useState('09');
  const [tempReminderMinute, setTempReminderMinute] = useState('00');
  const [tempReminderQuick, setTempReminderQuick] = useState('');
  const [finalReminder, setFinalReminder] = useState(null);

  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDuration, setNewEventDuration] = useState(60); 

  const rightDrawerAnim = useRef(new Animated.Value(RIGHT_DRAWER_WIDTH)).current;
  const leftDrawerAnim = useRef(new Animated.Value(-LEFT_DRAWER_WIDTH)).current; 
  const filterMenuAnim = useRef(new Animated.Value(RIGHT_DRAWER_WIDTH)).current;
  const createTaskAnim = useRef(new Animated.Value(height)).current;
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
      } catch (e) {
      }

      try {
        const tasksRes = await api.get('/planner/tasks/');
        tasksData = tasksRes.data || [];
      } catch (e) {
      }

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

  const handleAutoSchedule = () => {
    Alert.alert(
      "Xếp lịch tự động",
      "Hệ thống sẽ tự động phân bổ các công việc chưa có lịch vào các khoảng thời gian trống trong 7 ngày tới. Bạn có muốn tiếp tục?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xác nhận", 
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.post('/planner/tasks/generate-schedule/');
              fetchCalendarData(true);
            } catch (e) {
              Alert.alert("Lỗi", "Đã xảy ra sự cố khi xếp lịch tự động.");
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const openCreateTaskPopup = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setIsCreateTaskOpen(true);
    if(contextMenu.time) {
        setTempDeadlineDate(new Date(contextMenu.time));
        setDeadlineViewDate(new Date(contextMenu.time));
        setTempReminderDate(new Date(contextMenu.time));
        setReminderViewDate(new Date(contextMenu.time));
        setTempReminderHour(contextMenu.time.getHours().toString().padStart(2, '0'));
        setTempReminderMinute(contextMenu.time.getMinutes().toString().padStart(2, '0'));
    } else {
        setTempDeadlineDate(new Date());
        setDeadlineViewDate(new Date());
        setTempReminderDate(new Date());
        setReminderViewDate(new Date());
    }
    Animated.timing(createTaskAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeCreateTaskPopup = () => {
    Animated.timing(createTaskAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => {
      setIsCreateTaskOpen(false);
      setNewTaskTitle('');
      setNewTaskPomo(1);
      setShowCustomPomo(false);
      setActiveSubPopup(null);
      setQuickPriority(4);
      setFinalDeadline(null);
      setFinalReminder(null);
      setTempDeadlineDate(new Date());
      setDeadlineViewDate(new Date());
      setTempReminderDate(new Date());
      setReminderViewDate(new Date());
    });
  };

  const handleQuickCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    const startTime = contextMenu.time;
    const durationMinutes = newTaskPomo * 30; 
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    if (checkOverlap(startTime, endTime)) {
        Alert.alert("Trùng lịch", "Khoảng thời gian này đã có công việc hoặc sự kiện khác.");
        return;
    }

    try {
      const taskData = {
        title: newTaskTitle, 
        estimated_pomodoros: newTaskPomo,
        scheduled_start_time: startTime.toISOString(), 
        scheduled_end_time: endTime.toISOString(),
        priority: quickPriority === 4 ? 2 : quickPriority, 
        focus_duration: 25, 
        short_break: 5, 
        is_completed: false
      };
      if(finalDeadline) taskData.deadline = finalDeadline;
      if(finalReminder) taskData.reminder = finalReminder;
      
      await api.post('/planner/tasks/', taskData);
      closeCreateTaskPopup();
      fetchCalendarData(false); 
    } catch (e) {
    }
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
        Alert.alert("Trùng lịch", "Khoảng thời gian này đã có công việc hoặc sự kiện khác.");
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
      "Xóa khỏi lịch",
      item.type === 'fixed_event' ? "Bạn có chắc muốn xóa sự kiện này?" : "Hủy gán lịch cho công việc này?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
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
        Alert.alert("Trùng lịch", "Không có đủ không gian trống lúc 08:00 sáng cho công việc này.");
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
  const navigateToTasks = () => { closeLeftDrawer(); setTimeout(() => { navigation.navigate('Tasks'); }, 250); };
  const navigateToCalendar = () => { closeLeftDrawer(); }; 
  const navigateToBookshelf = () => { closeLeftDrawer(); setTimeout(() => { navigation.navigate('Bookshelf'); }, 250); };
  const navigateToHome = () => { closeLeftDrawer(); setTimeout(() => { navigation.navigate('Home'); }, 250); };
  const handleLogout = async () => { await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'current_task_id', 'timer_state', 'timer_end_time', 'timer_total_time', 'timer_time_left']); navigation.replace('Login'); };

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

  const toggleCalendarExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCalendarExpanded(!isCalendarExpanded);
  };

  const handlePrevDeadlineMonth = () => setDeadlineViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextDeadlineMonth = () => setDeadlineViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const handlePrevReminderMonth = () => setReminderViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextReminderMonth = () => setReminderViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const handleSaveDeadline = () => {
    let newDeadline = null;
    if (tempDeadlineQuick !== 'Xóa hạn' && tempDeadlineDate) {
      newDeadline = tempDeadlineDate.toISOString();
    }
    setFinalDeadline(newDeadline);
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

       const now = new Date();
       if (d < now) {
          Alert.alert("Lỗi", "Không thể đặt nhắc nhở cho thời gian trong quá khứ.");
          return;
       }
       if (finalDeadline && d > new Date(finalDeadline)) {
          Alert.alert("Lỗi", "Nhắc nhở không được vượt quá hạn chót.");
          return;
       }
       setFinalReminder(d.toISOString());
    } else {
       setFinalReminder(null);
    }
    setActiveSubPopup(null);
  };

  const renderCalendarDays = () => {
    const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
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

    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
      <View className="w-full relative pb-4"> 
        <View className="flex-row items-center justify-between mb-3 -ml-1 pr-1">
          <TouchableOpacity className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg">
            <Text className="text-[16px] font-bold text-[#1b1c1c]">{monthNames[month]}, {year}</Text>
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

        <View className="flex-row flex-wrap px-1 overflow-hidden relative" style={{ height: isCalendarExpanded ? undefined : 40 }}>
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
        </View>
        
        <View className="absolute bottom-[-5px] left-0 right-0 items-center justify-center pointer-events-box-none">
            <TouchableOpacity onPress={toggleCalendarExpansion} className="py-1 px-4">
                <MaterialIcons name={isCalendarExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={28} color="#8e706b" />
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
                      <TouchableOpacity className="flex-row items-center gap-2 px-3 py-3 border-b border-[#f5f3f3] active:bg-[#f5f3f3] rounded-t-lg" onPress={openCreateTaskPopup}><MaterialIcons name="check-circle-outline" size={18} color="#c89d7d" /><Text className="text-[14px] font-medium text-[#1b1c1c]">Tạo Task mới</Text></TouchableOpacity>
                      <TouchableOpacity className="flex-row items-center gap-2 px-3 py-3 active:bg-[#f5f3f3] rounded-b-lg" onPress={openCreateEventPopup}><MaterialIcons name="event" size={18} color="#ba1a1a" /><Text className="text-[14px] font-medium text-[#1b1c1c]">Tạo Sự kiện</Text></TouchableOpacity>
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

  const dYear = deadlineViewDate.getFullYear();
  const dMonth = deadlineViewDate.getMonth();
  const dDaysInMonth = new Date(dYear, dMonth + 1, 0).getDate();
  const dFirstDayIndex = new Date(dYear, dMonth, 1).getDay();
  const dAdjustedFirstDay = dFirstDayIndex === 0 ? 6 : dFirstDayIndex - 1;

  const rYear = reminderViewDate.getFullYear();
  const rMonth = reminderViewDate.getMonth();
  const rDaysInMonth = new Date(rYear, rMonth + 1, 0).getDate();
  const rFirstDayIndex = new Date(rYear, rMonth, 1).getDay();
  const rAdjustedFirstDay = rFirstDayIndex === 0 ? 6 : rFirstDayIndex - 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between px-5 py-12 bg-[#fbf9f8] z-20 sticky top-0">
            <TouchableOpacity onPress={openLeftDrawer}><MaterialIcons name="menu" size={26} color="#1b1c1c" /></TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleAutoSchedule} 
              className="flex-row items-center justify-center bg-[#c89d7d] px-8 py-1 rounded-full border border-[#c89d7d]/20"
              activeOpacity={0.7}
            >
              <Text className="text-[14px] font-bold text-[#ffffff] ml-1">Xếp lịch</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openRightDrawer}><MaterialIcons name="add" size={26} color="#1b1c1c" /></TouchableOpacity>
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
              <Text className="text-[12px] font-bold text-[#5a413c] mb-3 opacity-70">CHẠM ĐỂ THÊM VÀO LỊCH</Text>
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
                <Text className="text-[14px] text-center text-[#8e706b] mt-10">Không có công việc nào chờ xếp lịch</Text>
              )}
            </ScrollView>
          </SafeAreaView>

          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', zIndex: 110, transform: [{ translateX: filterMenuAnim }] }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View className="flex-row items-center px-2 py-2 mt-6 border-b border-[#e4e2e2]/50 mb-4">
                <TouchableOpacity onPress={closeFilterMenu} className="w-10 h-10 items-center justify-center rounded-full"><MaterialIcons name="arrow-back" size={24} color="#5a413c" /></TouchableOpacity>
                <Text className="text-[18px] font-bold text-[#1b1c1c] ml-1">Bộ lọc</Text>
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

        {isCreateTaskOpen && (
          <TouchableOpacity activeOpacity={1} onPress={closeCreateTaskPopup} style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 }]}>
             <View />
          </TouchableOpacity>
        )}
        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, minHeight: 220, zIndex: 101, transform: [{ translateY: createTaskAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 }}>
          <View className="w-full items-center pt-3 pb-2"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
          
          <View className="px-5 pt-3 pb-5 flex-col">
            {activeSubPopup === null ? (
              <>
                <TextInput 
                  className="w-full text-[18px] text-[#1b1c1c] font-medium mb-3" 
                  placeholder="Bạn định làm gì?" 
                  placeholderTextColor="#e2bfb8" 
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
                      <View className="flex-1 items-end">
                         <TouchableOpacity onPress={() => setShowCustomPomo(true)} className="bg-[#f5f3f3] rounded-full p-1"><MaterialIcons name="arrow-forward" size={24} color="#5a413c" /></TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row items-center flex-1">
                      <TouchableOpacity onPress={() => setShowCustomPomo(false)} className="bg-[#f5f3f3] rounded-full p-1 mr-2"><MaterialIcons name="arrow-back" size={24} color="#5a413c" /></TouchableOpacity>
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
                    <TouchableOpacity onPress={() => setActiveSubPopup('calendar')} className="p-2.5 bg-[#f5f3f3] rounded-full">
                       <MaterialIcons name="event" size={22} color={finalDeadline ? '#c89d7d' : '#5a413c'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveSubPopup('priority')} className="p-2.5 bg-[#f5f3f3] rounded-full">
                       <MaterialIcons name="flag" size={22} color={quickPriority === 1 ? '#ba1a1a' : quickPriority === 2 ? '#ff8c00' : quickPriority === 3 ? '#c89d7d' : '#5a413c'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveSubPopup('reminder')} className="p-2.5 bg-[#f5f3f3] rounded-full">
                       <MaterialIcons name="notifications-none" size={22} color={finalReminder ? '#c89d7d' : '#5a413c'} />
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
                    <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Hạn Chót</Text>
                    
                    <View className="flex-row flex-wrap justify-between gap-y-2 mb-4">
                      <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Hôm nay' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Hôm nay'); setTempDeadlineDate(new Date()); setDeadlineViewDate(new Date()); }}>
                        <MaterialIcons name="today" size={20} color={tempDeadlineQuick === 'Hôm nay' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Hôm nay' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Hôm nay</Text>
                      </TouchableOpacity>
                      <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Ngày mai' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Ngày mai'); const t = new Date(); t.setDate(t.getDate() + 1); setTempDeadlineDate(t); setDeadlineViewDate(t); }}>
                        <MaterialIcons name="event" size={20} color={tempDeadlineQuick === 'Ngày mai' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Ngày mai' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Ngày mai</Text>
                      </TouchableOpacity>
                      <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Trong 7 ngày' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Trong 7 ngày'); const t = new Date(); t.setDate(t.getDate() + 7); setTempDeadlineDate(t); setDeadlineViewDate(t); }}>
                        <MaterialIcons name="date-range" size={20} color={tempDeadlineQuick === 'Trong 7 ngày' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Trong 7 ngày' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trong 7 ngày</Text>
                      </TouchableOpacity>
                      <TouchableOpacity className={`flex-row items-center gap-2 px-3 py-2 rounded-xl w-[48%] ${tempDeadlineQuick === 'Xóa hạn' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineQuick('Xóa hạn'); setTempDeadlineDate(null); setFinalDeadline(null); }}>
                        <MaterialIcons name="calendar-today" size={20} color={tempDeadlineQuick === 'Xóa hạn' ? '#ffffff' : '#c89d7d'} /><Text className={`text-[14px] font-bold ${tempDeadlineQuick === 'Xóa hạn' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Xóa hạn</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="flex-col gap-2 mb-6">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Tháng {dMonth + 1}, {dYear}</Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity onPress={handlePrevDeadlineMonth} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                          <TouchableOpacity onPress={handleNextDeadlineMonth} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap px-1">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (<View key={i} className="w-[14.28%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
                        {Array(dAdjustedFirstDay).fill(null).map((_, i) => <View key={`de-${i}`} className="w-[14.28%] h-10 mb-2" />)}
                        {Array.from({ length: dDaysInMonth }, (_, i) => i + 1).map(day => {
                          const isSelected = tempDeadlineDate && tempDeadlineDate.getDate() === day && tempDeadlineDate.getMonth() === dMonth && tempDeadlineDate.getFullYear() === dYear;
                          return (
                            <View key={day} className="w-[14.28%] items-center mb-2">
                              <TouchableOpacity className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : 'active:bg-[#eae8e7]'}`} onPress={() => { setTempDeadlineDate(new Date(dYear, dMonth, day)); setTempDeadlineQuick(''); }}>
                                <Text className={`text-[16px] ${isSelected ? 'text-[#ffffff] font-bold' : 'text-[#1b1c1c] font-medium'}`}>{day}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 border border-[#e2bfb8] py-3.5 rounded-xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Quay lại</Text></TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveDeadline} className="flex-1 bg-[#c89d7d] py-3.5 rounded-xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Xong</Text></TouchableOpacity>
                    </View>
                  </View>
                )}

                {activeSubPopup === 'priority' && (
                  <>
                    <Text className="text-[18px] font-bold text-[#1b1c1c] mb-6">Mức độ ưu tiên</Text>
                    <View className="flex-row justify-between mb-8">
                      {[
                        { val: 1, label: 'Cao', color: '#ba1a1a' },
                        { val: 2, label: 'Vừa', color: '#ff8c00' },
                        { val: 3, label: 'Thấp', color: '#c89d7d' },
                        { val: 4, label: 'Không', color: '#5a413c' }
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
                      <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 border border-[#e2bfb8] py-3.5 rounded-xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Quay lại</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => setActiveSubPopup(null)} className="flex-1 bg-[#c89d7d] py-3.5 rounded-xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Xong</Text></TouchableOpacity>
                    </View>
                  </>
                )}

                {activeSubPopup === 'reminder' && (
                  <View className="flex-col">
                    <Text className="text-[18px] font-bold text-[#1b1c1c] mb-4">Cài đặt nhắc nhở</Text>
                    
                    <View className="flex-row flex-wrap justify-between gap-y-2 mb-4">
                        <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === 'At time' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('At time')}>
                        <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === 'At time' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Đúng giờ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === '5 min' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('5 min')}>
                        <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === '5 min' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trước 5p</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className={`flex-row items-center justify-center gap-2 px-3 py-2 rounded-xl w-[31%] ${tempReminderQuick === '10 min' ? 'bg-[#c89d7d] shadow-sm' : 'bg-[#f5f3f3] border border-[#e2bfb8]/30 active:bg-[#eae8e7]'}`} onPress={() => handleReminderQuickSelect('10 min')}>
                        <Text className={`text-[12px] font-bold text-center ${tempReminderQuick === '10 min' ? 'text-[#ffffff]' : 'text-[#1b1c1c]'}`}>Trước 10p</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Giờ Nhắc Nhở</Text>
                        <View className="flex-row items-center gap-1">
                        <WheelPicker items={HOURS} selectedValue={tempReminderHour} onValueChange={setTempReminderHour} />
                        <Text className="text-[20px] font-bold text-[#1b1c1c] pb-1">:</Text>
                        <WheelPicker items={MINUTES} selectedValue={tempReminderMinute} onValueChange={setTempReminderMinute} />
                        </View>
                    </View>

                    <View className="flex-col gap-2 mb-6">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[14px] font-bold text-[#c89d7d] uppercase tracking-wider">Tháng {rMonth + 1}, {rYear}</Text>
                          <View className="flex-row gap-2">
                            <TouchableOpacity onPress={handlePrevReminderMonth} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-left" size={20} color="#c89d7d" /></TouchableOpacity>
                            <TouchableOpacity onPress={handleNextReminderMonth} className="w-8 h-8 rounded-full border border-[#e2bfb8] items-center justify-center active:bg-[#f5f3f3]"><MaterialIcons name="chevron-right" size={20} color="#c89d7d" /></TouchableOpacity>
                          </View>
                        </View>
                        <View className="flex-row flex-wrap px-1">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (<View key={i} className="w-[14.28%] items-center mb-2"><Text className="text-[12px] font-bold text-[#5a413c]/70">{day}</Text></View>))}
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
                                  className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d7d] shadow-md' : isDisabled ? 'opacity-30' : 'active:bg-[#eae8e7]'}`} 
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
                         <TouchableOpacity onPress={() => { setTempReminderDate(new Date()); setFinalReminder(null); setActiveSubPopup(null); }} className="flex-1 border border-[#e2bfb8] py-3.5 rounded-xl items-center"><Text className="text-[#1b1c1c] font-bold text-[16px]">Quay lại / Xóa</Text></TouchableOpacity>
                         <TouchableOpacity onPress={handleSaveReminder} className="flex-1 bg-[#c89d7d] py-3.5 rounded-xl items-center shadow-sm"><Text className="text-white font-bold text-[16px]">Lưu</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
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
              <Text className="text-[20px] font-bold text-[#1b1c1c]">Tạo Sự kiện</Text>
              <View className="bg-[#ba1a1a]/10 px-3 py-1 rounded-full">
                <Text className="text-[12px] font-bold text-[#ba1a1a]">
                  {contextMenu.time ? `${String(contextMenu.time.getHours()).padStart(2,'0')}:${String(contextMenu.time.getMinutes()).padStart(2,'0')} - ${String(new Date(contextMenu.time.getTime() + newEventDuration * 60000).getHours()).padStart(2,'0')}:${String(new Date(contextMenu.time.getTime() + newEventDuration * 60000).getMinutes()).padStart(2,'0')}` : ''}
                </Text>
              </View>
            </View>

            <View>
              <Text className="text-[12px] font-bold text-[#5a413c] mb-2 uppercase tracking-wider">Tên Sự kiện</Text>
              <TextInput 
                className="w-full bg-[#f5f3f3] rounded-xl px-4 py-3 text-[16px] text-[#1b1c1c]" 
                placeholder="Sự kiện gì sắp diễn ra?" 
                placeholderTextColor="#e2bfb8" 
                value={newEventTitle} 
                onChangeText={setNewEventTitle} 
              />
            </View>

            <View className="flex-row items-center justify-between bg-[#fbf9f8] p-3 rounded-xl border border-[#e4e2e2] mt-4">
              <Text className="text-[14px] font-medium text-[#5a413c]">Thời lượng (phút)</Text>
              <View className="flex-row items-center bg-[#ffffff] rounded-full p-1 border border-[#e4e2e2]">
                <TouchableOpacity className="w-8 h-8 rounded-full bg-[#f5f3f3] items-center justify-center active:bg-[#e4e2e2]" onPress={() => setNewEventDuration(p => Math.max(15, p - 15))}><MaterialIcons name="remove" size={16} color="#1b1c1c" /></TouchableOpacity>
                <Text className="w-12 text-center text-[16px] font-bold text-[#ba1a1a]">{newEventDuration}</Text>
                <TouchableOpacity className="w-8 h-8 rounded-full bg-[#ba1a1a] items-center justify-center active:bg-[#a01616]" onPress={() => setNewEventDuration(p => Math.min(240, p + 15))}><MaterialIcons name="add" size={16} color="#ffffff" /></TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              className={`w-full rounded-xl py-3.5 flex-row justify-center items-center mt-6 ${newEventTitle.trim() ? 'bg-[#ba1a1a]' : 'bg-[#e4e2e2]'}`} 
              onPress={handleQuickCreateEvent} 
              disabled={!newEventTitle.trim()}
            >
              <Text className={`text-[16px] font-bold ${newEventTitle.trim() ? 'text-white' : 'text-[#8e706b]'}`}>Lưu Sự Kiện</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}