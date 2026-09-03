import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ImageBackground, ScrollView, Animated, TouchableWithoutFeedback, Dimensions, StyleSheet, Platform } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

const { width, height } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const ACTIVITY_COLLAPSED_COUNT = 4;

const formatRelativeTime = (isoString) => {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hr ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay} days ago`;
};

const getActivityMeta = (type) => {
  switch (type) {
    case 'login': return { icon: 'login', label: 'Daily Login', color: '#D1BB9E' };
    case 'pomodoro': return { icon: 'timer', label: 'Completed Pomodoro', color: '#6bbda7' };
    case 'task_complete': return { icon: 'check-circle', label: 'Completed Task', color: '#6da7e2' };
    case 'level_up': return { icon: 'auto-stories', label: 'Unlocked New Book', color: '#eda87a' };
    default: return { icon: 'star', label: 'Activity', color: '#c89d7d' };
  }
};

export default function BookshelfScreen({ navigation }) {
  const [particles, setParticles] = useState([]);
  const [activeBookId, setActiveBookId] = useState(null);
  const [profileData, setProfileData] = useState({ knowledge_points: 0, books_collected: 0, current_streak: 0 });
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [activities, setActivities] = useState([]);
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  const [isDailyTasksOpen, setIsDailyTasksOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const loop1Ref = useRef(null);
  const loop2Ref = useRef(null);

  const particleIdCounter = useRef(0);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const dailyTasksAnim = useRef(new Animated.Value(height)).current;
  const guideAnim = useRef(new Animated.Value(height)).current;

  const fetchBookshelfData = async () => {
    try {
      const [profileRes, analyticsRes, activitiesRes] = await Promise.all([
        api.get('/gamification/profile/'),
        api.get('/planner/analytics/?days=1'),
        api.get('/gamification/activities/')
      ]);
      
      if (profileRes.data) {
        setProfileData(profileRes.data);
      }

      if (analyticsRes.data && analyticsRes.data.daily_stats) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayStat = analyticsRes.data.daily_stats.find(s => s.date === todayStr);
        setTodayFocusMinutes(todayStat ? todayStat.total_minutes : 0);
      }

      if (activitiesRes.data) {
        setActivities(activitiesRes.data);
      }
    } catch (error) {}
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
      fetchBookshelfData();
      checkTimerState();
    }, [])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        })
      ])
    ).start();
  }, [floatAnim]);

  useEffect(() => {
    let timeoutId;
    if (isTimerRunning) {
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);

      loop1Ref.current = Animated.loop(Animated.timing(pulseAnim1, { toValue: 1, duration: 2000, useNativeDriver: true }));
      loop1Ref.current.start();

      timeoutId = setTimeout(() => {
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
      if (timeoutId) clearTimeout(timeoutId);
      if (loop1Ref.current) loop1Ref.current.stop();
      if (loop2Ref.current) loop2Ref.current.stop();
    };
  }, [isTimerRunning]);

  const handleStartTimer = async () => {
    Animated.timing(expandAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => { expandAnim.setValue(0); });
    setTimeout(() => { navigation.navigate('Home'); }, 200);
  };

  const clearActiveBook = () => {
    if (activeBookId !== null) setActiveBookId(null);
  };

  const handleBookPress = (event, bookId) => {
    const { pageX, pageY } = event.nativeEvent;
    setActiveBookId(bookId);
    
    const numParticles = 8 + Math.floor(Math.random() * 5);
    const newParticles = [];
    const colors = ['#C9A94E', '#6E93AC', '#C17F5B', '#B98F93', '#5E8177'];

    for (let i = 0; i < numParticles; i++) {
      const id = particleIdCounter.current++;
      const angle = Math.random() * Math.PI * 2;
      const distance = 35 + Math.random() * 45;
      
      newParticles.push({
        id,
        x: pageX - 10, 
        y: pageY - 30, 
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        color: colors[Math.floor(Math.random() * colors.length)],
        anim: new Animated.Value(0)
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    newParticles.forEach(p => {
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setParticles(prev => prev.filter(item => item.id !== p.id));
      });
    });
  };

  const openDailyTasks = () => {
    setIsDailyTasksOpen(true);
    Animated.timing(dailyTasksAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeDailyTasks = () => {
    Animated.timing(dailyTasksAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsDailyTasksOpen(false));
  };

  const openGuide = () => {
    setIsGuideOpen(true);
    Animated.timing(guideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  const closeGuide = () => {
    Animated.timing(guideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(() => setIsGuideOpen(false));
  };

  const getRank = (books) => {
    if (books < 5) return 'Novice';
    if (books < 15) return 'Scholar';
    if (books < 30) return 'Philosopher';
    return 'Master';
  };

  const Book = ({ id, w, h, bg, skew, glowBorder, children }) => {
    const isUnlocked = profileData.books_collected >= id;
    const isActive = activeBookId === id && isUnlocked;
    const baseTransform = skew ? [{ skewX: skew }] : [];
    
    const dynamicTransform = isActive 
      ? [
          { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, -18] }) },
          { rotate: floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
          { scale: 1.15 }
        ]
      : [];

    return (
      <AnimatedTouchable 
        activeOpacity={isUnlocked ? 1 : 0.8} 
        onPress={(e) => isUnlocked && handleBookPress(e, id)} 
        className={`border-2 rounded-[4px] justify-center items-center ${w} ${h} ${bg} ${glowBorder && !isActive && isUnlocked ? 'border-[#C9A94E]' : 'border-[#5C4E3A]/55'}`}
        style={{ transform: [...baseTransform, ...dynamicTransform], zIndex: isActive ? 50 : 1, opacity: isUnlocked ? 1 : 0.25 }}
      >
        {children}
        {isActive && (
          <Animated.View 
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -5, bottom: -5, left: -5, right: -5,
              borderWidth: 3,
              borderColor: '#E0C060',
              borderRadius: 8,
              backgroundColor: 'rgba(201, 169, 78, 0.3)',
              shadowColor: '#C9A94E',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 15,
              elevation: 15,
              opacity: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] })
            }}
          />
        )}
      </AnimatedTouchable>
    );
  };

  const pointsToNextBook = 1000 - (profileData.knowledge_points % 1000);
  const visibleActivities = isActivityExpanded ? activities : activities.slice(0, ACTIVITY_COLLAPSED_COUNT);

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover" 
    >
          <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 mt-7 py-4 z-10">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity 
              className="w-10 h-10 items-center justify-center active:opacity-80"
              onPress={() => setIsDrawerOpen(true)}
            >
              <MaterialIcons name="menu" size={26} color="#c89d7d" />
            </TouchableOpacity>
            <View className="flex-row items-center px-3 py-1.5 rounded-full">
              <MaterialIcons name="workspace-premium" size={16} color="#5c8a8a" />
              <Text className="text-[12px] font-bold text-[#c89d7d] ml-1">Lv {profileData.books_collected} · {getRank(profileData.books_collected)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80">
              <MaterialIcons name="leaderboard" size={22} color="#eda87a" />
            </TouchableOpacity>
            <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={openDailyTasks}>
              <MaterialIcons name="assignment" size={22} color="#6bbda7" />
            </TouchableOpacity>
            <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={openGuide}>
              <MaterialIcons name="help-outline" size={22} color="#6da7e2" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={clearActiveBook}
        >
          <TouchableWithoutFeedback onPress={clearActiveBook}>
            <View className="flex-1 px-3 pt-1 pb-10">

              <View className="items-center z-20 px-2 mb-3">
                <Text className="text-[24px] font-bold text-[#1b1c1c] mb-4">Bookshelf of Wisdom</Text>
                
                <View className="w-full bg-[#EFE6D2] rounded-[16px] p-2 flex-col gap-4 shadow-md border border-[#B3A084]">
                  <View className="flex-row items-end justify-around border-b-[6px] border-[#C9B899] rounded-b-[4px] h-[90px] px-1 pb-[2px]">
                    <Book id={1} w="w-7" h="h-16" bg="bg-[#3E6D91]" skew="-2deg"><View className="absolute top-1 bottom-1 left-[6px] w-0.5 bg-[#ffffff55]" /><View className="absolute top-2 w-2 h-4 bg-[#ffffff55] rounded-sm" /></Book>
                    <Book id={2} w="w-6" h="h-14" bg="bg-[#A85A67]" skew="1deg"><View className="absolute bottom-2 left-1 right-1 h-0.5 bg-[#00000020]" /><View className="absolute bottom-4 left-1 right-1 h-0.5 bg-[#00000020]" /></Book>
                    <Book id={3} w="w-9" h="h-18" bg="bg-[#3D6459]" glowBorder><View className="absolute top-1 bottom-1 left-1 right-1 border border-[#ffffff70] rounded-[2px]" /><Text className="absolute top-1 text-[8px] text-[#ffffff80]">★</Text></Book>
                    <Book id={4} w="w-5" h="h-12" bg="bg-[#D9B94A]" skew="5deg"><View className="absolute top-0 bottom-0 left-1.5 w-1 bg-[#00000012]" /></Book>
                    <Book id={5} w="w-8" h="h-16" bg="bg-[#7C6748]" skew="0deg"><View className="absolute top-3 w-4 h-5 bg-[#00000018] rounded-sm" /><View className="absolute bottom-2 w-4 h-0.5 bg-[#00000020]" /></Book>
                    <Book id={6} w="w-6" h="h-[68px]" bg="bg-[#B2623A]" skew="-3deg"><View className="absolute top-0 left-1.5 w-1 h-4 bg-[#E0C060]" /><View className="absolute bottom-3 left-1 right-1 h-[1px] bg-[#ffffff55]" /></Book>
                    <Book id={7} w="w-7" h="h-[76px]" bg="bg-[#588048]" glowBorder><View className="absolute top-3"><MaterialIcons name="workspace-premium" size={12} color="rgba(255,255,255,0.75)" /></View><View className="absolute bottom-4 left-1.5 right-1.5 h-0.5 bg-[#ffffff50]" /></Book>
                    <Book id={8} w="w-6" h="h-[60px]" bg="bg-[#B8932E]" skew="-1deg"><View className="absolute top-2 bottom-2 left-[5px] right-[5px] border border-[#00000020]" /></Book>
                    <Book id={9} w="w-10" h="h-[72px]" bg="bg-[#D9B94A]"><View className="absolute top-0 bottom-0 right-2 w-1 bg-[#00000010]" /><View className="absolute top-4 w-5 h-6 bg-[#00000015] rounded-[2px]" /></Book>
                  </View>

                  <View className="flex-row items-end justify-around border-b-[6px] border-[#C9B899] rounded-b-[4px] h-[90px] px-2 pb-[2px]">
                    <Book id={10} w="w-8" h="h-14" bg="bg-[#D9B94A]"><View className="absolute top-2 left-1.5 right-1.5 h-[2px] bg-[#00000018]" /><View className="absolute top-4 left-1.5 right-1.5 h-[2px] bg-[#00000018]" /></Book>
                    <Book id={11} w="w-7" h="h-[68px]" bg="bg-[#3E6D91]" skew="2deg" glowBorder><View className="absolute top-2 left-1.5 w-3 h-0.5 bg-[#ffffff60]" /><View className="absolute top-4 left-1.5 w-2 h-0.5 bg-[#ffffff60]" /><View className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[#ffffff60]" /></Book>
                    <Book id={12} w="w-6" h="h-[52px]" bg="bg-[#A85A67]" skew="3deg"><View className="absolute inset-y-1 left-2 w-0.5 bg-[#00000020]" /></Book>
                    <Book id={13} w="w-9" h="h-16" bg="bg-[#7C6748]"><View className="absolute top-2 bottom-2 left-2 right-2 border-y-[3px] border-[#00000018]" /></Book>
                    <Book id={14} w="w-7" h="h-[72px]" bg="bg-[#3D6459]"><View className="absolute top-1 bottom-1 left-1.5 right-1.5 border border-[#00000020] rounded-full" /></Book>
                    <Book id={15} w="w-6" h="h-12" bg="bg-[#B2623A]" skew="-4deg"><View className="absolute top-0 left-[6px] w-1.5 h-3 bg-[#ffffff60]" /></Book>
                    <Book id={16} w="w-8" h="h-[60px]" bg="bg-[#B8932E]" glowBorder><View className="absolute bottom-2"><Text className="text-[10px] text-[#ffffff80]">★</Text></View></Book>
                    <Book id={17} w="w-6" h="h-[68px]" bg="bg-[#D9B94A]" skew="-3deg"><View className="absolute top-2 w-2 h-2 rounded-full bg-[#00000018]" /><View className="absolute top-5 w-2 h-2 rounded-full bg-[#00000018]" /></Book>
                  </View>

                  <View className="flex-row items-end justify-around border-b-[6px] border-[#C9B899] rounded-b-[4px] h-[90px] px-1 pb-[2px]">
                    <Book id={18} w="w-8" h="h-16" bg="bg-[#7C6748]"><View className="absolute top-3 bottom-3 left-1.5 right-1.5 bg-[#00000012] rounded-sm" /></Book>
                    <Book id={19} w="w-6" h="h-14" bg="bg-[#D9B94A]" skew="4deg"><View className="absolute top-0 bottom-0 left-0 w-2 bg-[#00000010]" /></Book>
                    <Book id={20} w="w-9" h="h-[76px]" bg="bg-[#A85A67]"><View className="absolute top-2 left-1 right-1 h-[2px] bg-[#00000020]" /><View className="absolute bottom-2 left-1 right-1 h-[2px] bg-[#00000020]" /><View className="w-4 h-4 rounded-full border border-[#00000020]" /></Book>
                    <Book id={21} w="w-7" h="h-[52px]" bg="bg-[#3E6D91]"><View className="absolute top-1.5 bottom-1.5 left-1.5 w-[1px] bg-[#ffffff60]" /><View className="absolute top-1.5 bottom-1.5 right-1.5 w-[1px] bg-[#ffffff60]" /></Book>
                    <Book id={22} w="w-6" h="h-[68px]" bg="bg-[#B2623A]" glowBorder><View className="absolute inset-1 border border-[#ffffff50]" /></Book>
                    <Book id={23} w="w-10" h="h-[60px]" bg="bg-[#3D6459]" skew="-2deg"><View className="absolute top-2 bottom-2 left-2 right-2 border-[2px] border-[#00000012] rounded-sm" /><View className="w-2 h-2 bg-[#00000018] rounded-full" /></Book>
                    <Book id={24} w="w-5" h="h-12" bg="bg-[#D9B94A]"><View className="absolute top-2 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /><View className="absolute top-4 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /><View className="absolute top-6 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /></Book>
                    <Book id={25} w="w-8" h="h-16" bg="bg-[#588048]" skew="1deg"><View className="absolute top-3 w-4 h-6 bg-[#ffffff35] rounded-[2px]" /></Book>
                    <Book id={26} w="w-7" h="h-14" bg="bg-[#B8932E]"><View className="absolute top-0 bottom-0 left-1.5 w-1 bg-[#00000015]" /><View className="absolute bottom-2 w-3 h-[2px] bg-[#00000020]" /></Book>
                  </View>
                </View>

                <View className="flex-row items-center mt-3">
                  <MaterialCommunityIcons name="owl" size={14} color="#c89d7d" />
                  <Text className="text-[12px] font-bold text-[#5a413c] ml-1 text-center">
                    {pointsToNextBook} points left to unlock the next book
                  </Text>
                </View>
              </View>

              <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-xl px-4 py-3 shadow-sm mb-6">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 items-center">
                    <Text className="text-[11px] font-bold text-[#8e706b] uppercase tracking-wider mb-1">Knowledge Pts</Text>
                    <Text className="text-[18px] font-bold text-[#1b1c1c]">{profileData.knowledge_points}</Text>
                  </View>
                  <View className="w-[1px] h-8 bg-[#e4e2e2]" />
                  <View className="flex-1 items-center">
                    <Text className="text-[11px] font-bold text-[#8e706b] uppercase tracking-wider mb-1">Streak</Text>
                    <Text className="text-[18px] font-bold text-[#1b1c1c]">{profileData.current_streak} <Text className="text-[12px] font-medium">days</Text></Text>
                  </View>
                  <View className="w-[1px] h-8 bg-[#e4e2e2]" />
                  <View className="flex-1 items-center">
                    <Text className="text-[11px] font-bold text-[#8e706b] uppercase tracking-wider mb-1">Rank</Text>
                    <Text className="text-[15px] font-bold text-[#1b1c1c]">{getRank(profileData.books_collected)}</Text>
                  </View>
                </View>
                <View className="w-full h-1.5 bg-[#efeded] rounded-full overflow-hidden mt-3">
                  <View className="h-full bg-[#c89d7d] rounded-full" style={{ width: `${(profileData.knowledge_points % 1000) / 10}%` }} />
                </View>
              </View>

              <View className="mb-20">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[20px] font-bold text-[#1b1c1c]">Recent Activity</Text>
                  {activities.length > ACTIVITY_COLLAPSED_COUNT && (
                    <TouchableOpacity onPress={() => setIsActivityExpanded(!isActivityExpanded)} className="flex-row items-center">
                      <Text className="text-[12px] font-bold text-[#c89d7d] mr-1">{isActivityExpanded ? 'Show less' : 'See more'}</Text>
                      <MaterialIcons name={isActivityExpanded ? 'expand-less' : 'expand-more'} size={16} color="#c89d7d" />
                    </TouchableOpacity>
                  )}
                </View>
                <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-xl overflow-hidden shadow-sm relative">
                  <View className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#c89d7d] z-10" />

                  {visibleActivities.length > 0 ? (
                    visibleActivities.map((item, index) => {
                      const meta = getActivityMeta(item.activity_type);
                      const isLast = index === visibleActivities.length - 1;
                      return (
                        <View key={item.id} className={`flex-row items-center py-4 pr-4 pl-5 ${isLast ? '' : 'border-b border-[#f5f3f3]'}`}>
                          <View className="w-10 h-10 rounded-full bg-[#c89d7d]/10 items-center justify-center mr-4">
                            <MaterialIcons name={meta.icon} size={20} color={meta.color} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[16px] font-medium text-[#1b1c1c]">{meta.label}</Text>
                            <View className="flex-row items-center mt-1 gap-2">
                              <Text className="text-[12px] font-medium text-[#5a413c]">{formatRelativeTime(item.created_at)}</Text>
                              {item.points > 0 && (
                                <View className="bg-[#c89d7d]/10 px-2 py-0.5 rounded-full">
                                  <Text className="text-[10px] font-bold text-[#c89d7d]">+{item.points} pts</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View className="items-center justify-center py-10">
                      <Text className="text-[#5a413c] font-medium text-[14px]">No activity yet</Text>
                    </View>
                  )}
                </View>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {(isDailyTasksOpen || isGuideOpen) && (
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents="auto">
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => {
                if (isDailyTasksOpen) closeDailyTasks();
                if (isGuideOpen) closeGuide();
              }} 
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
            />
          </View>
        )}

        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: dailyTasksAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
          <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[24px] font-bold text-[#1b1c1c]">Daily Tasks</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeDailyTasks}>
              <MaterialIcons name="close" size={20} color="#c89d7d" />
            </TouchableOpacity>
          </View>
          <View className="px-6 py-6 pb-12 flex-col gap-4">
            <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-xl p-4 shadow-sm flex-row items-center justify-between">
              <View className="flex-row items-center gap-4 flex-1 pr-4">
                <View className="w-12 h-12 items-center justify-center">
                  <MaterialIcons name="light" size={38} color="#c89d7d" />
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-bold text-[#1b1c1c] mb-1">Focus for 3 hours</Text>
                  <View className="w-full bg-[#e4e2e2] h-2 rounded-full overflow-hidden mt-1">
                    <View className="bg-[#c89d7d] h-full rounded-full" style={{ width: `${Math.min((todayFocusMinutes / 180) * 100, 100)}%` }} />
                  </View>
                  <Text className="text-[12px] font-bold text-[#5a413c] mt-1">{todayFocusMinutes} / 180 min</Text>
                </View>
              </View>
              <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${todayFocusMinutes >= 180 ? 'bg-[#c89d7d] border-[#c89d7d]' : 'border-[#e4e2e2]'}`}>
                {todayFocusMinutes >= 180 && <MaterialIcons name="check" size={16} color="#ffffff" />}
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fbf9f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 0, zIndex: 101, transform: [{ translateY: guideAnim }], shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 }}>
          <View className="w-full items-center pt-3 pb-1"><View className="w-12 h-1.5 bg-[#e4e2e2] rounded-full" /></View>
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#e4e2e2]/50">
            <Text className="text-[24px] font-bold text-[#1b1c1c]">Guide</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeGuide}>
              <MaterialIcons name="close" size={20} color="#c89d7d" />
            </TouchableOpacity>
          </View>
          <ScrollView className="px-6 py-6 pb-12 flex-col gap-6" showsVerticalScrollIndicator={false}>
            <View>
              <Text className="text-[18px] font-bold text-[#c89d7d] mb-2">Basic Rule</Text>
              <Text className="text-[15px] text-[#5a413c] leading-6">Focus on work and study, generate knowledge points for your bookshelf, and grow with it.</Text>
            </View>
            <View>
              <Text className="text-[18px] font-bold text-[#c89d7d] mb-3">How to generate knowledge points</Text>
              <View className="flex-col gap-3">
                <View className="flex-row items-start">
                  <MaterialIcons name="timer" size={20} color="#c89d7d" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Complete a 25-minute pomodoro: <Text className="font-bold text-[#1b1c1c]">+25 points</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="check-circle" size={20} color="#c89d7d" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Complete a task: <Text className="font-bold text-[#1b1c1c]">+5 points</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="wb-sunny" size={20} color="#c89d7d" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">First daily login: <Text className="font-bold text-[#1b1c1c]">+30 points</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="local-fire-department" size={20} color="#c89d7d" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Log in for N consecutive days: <Text className="font-bold text-[#1b1c1c]">+(N x 6) points</Text>, capped at 80 days</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>

        {particles.map(p => {
          return (
            <Animated.Text
              key={p.id}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                color: p.color,
                fontSize: 16,
                fontWeight: 'bold',
                textShadowColor: p.color,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 5,
                zIndex: 999,
                opacity: p.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.9, 0]
                }),
                transform: [
                  { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.tx] }) },
                  { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.ty] }) },
                  { scale: p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0] }) },
                  { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
                ]
              }}
            >
              ✦
            </Animated.Text>
          );
        })}

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
          onPress={handleStartTimer}
          activeOpacity={0.9}
        >
          <MaterialIcons name="play-arrow" size={32} color="#ffffff" />
        </TouchableOpacity>

        <CustomDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
          navigation={navigation} 
          currentScreen="Bookshelf" 
        />

      </SafeAreaView>
    </ImageBackground>
  );
}