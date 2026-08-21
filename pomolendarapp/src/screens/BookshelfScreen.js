import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Animated, TouchableWithoutFeedback, Dimensions, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

const { width, height } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function BookshelfScreen({ navigation }) {
  const [particles, setParticles] = useState([]);
  const [activeBookId, setActiveBookId] = useState(null);
  const [profileData, setProfileData] = useState({ knowledge_points: 0, books_collected: 0, current_streak: 0 });
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [isDailyTasksOpen, setIsDailyTasksOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const particleIdCounter = useRef(0);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const dailyTasksAnim = useRef(new Animated.Value(height)).current;
  const guideAnim = useRef(new Animated.Value(height)).current;

  const fetchBookshelfData = async () => {
    try {
      const [profileRes, analyticsRes] = await Promise.all([
        api.get('/gamification/profile/'),
        api.get('/planner/analytics/?days=1')
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
    } catch (error) {}
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookshelfData();
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

  const clearActiveBook = () => {
    if (activeBookId !== null) setActiveBookId(null);
  };

  const handleBookPress = (event, bookId) => {
    const { pageX, pageY } = event.nativeEvent;
    setActiveBookId(bookId);
    
    const numParticles = 8 + Math.floor(Math.random() * 5);
    const newParticles = [];
    const colors = ['#FFD700', '#008B8C', '#FF6347', '#FF69B4', '#87CEEB'];

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
    if (books < 5) return 'Tân binh';
    if (books < 15) return 'Học giả';
    if (books < 30) return 'Triết gia';
    return 'Bậc thầy';
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
        className={`border-2 rounded-[4px] justify-center items-center ${w} ${h} ${bg} ${glowBorder && !isActive && isUnlocked ? 'border-[#ffd700]' : 'border-[#5a413c]'}`}
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
              borderColor: '#FFEA00',
              borderRadius: 8,
              backgroundColor: 'rgba(255, 215, 0, 0.35)',
              shadowColor: '#FFD700',
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

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 mt-7 py-4 z-10 bg-[#fbf9f8]">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-[#efeded] items-center justify-center active:opacity-80"
            onPress={() => setIsDrawerOpen(true)}
          >
            <MaterialIcons name="menu" size={26} color="#008B8C" />
          </TouchableOpacity>
          <View className="flex-row gap-2">
            <TouchableOpacity className="w-10 h-10 rounded-full bg-[#efeded] items-center justify-center active:opacity-80">
              <MaterialIcons name="leaderboard" size={22} color="#008B8C" />
            </TouchableOpacity>
            <TouchableOpacity className="w-10 h-10 rounded-full bg-[#efeded] items-center justify-center active:opacity-80" onPress={openDailyTasks}>
              <MaterialIcons name="assignment" size={22} color="#008B8C" />
            </TouchableOpacity>
            <TouchableOpacity className="w-10 h-10 rounded-full bg-[#efeded] items-center justify-center active:opacity-80" onPress={openGuide}>
              <MaterialIcons name="help-outline" size={22} color="#008B8C" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={clearActiveBook}
        >
          <TouchableWithoutFeedback onPress={clearActiveBook}>
            <View className="flex-1 px-3 pt-2 pb-10">
              
              <View className="flex-row items-stretch mb-6">
                <View className="flex-1 bg-[#ffffff] p-4 pl-5 rounded-xl border border-[#e4e2e2] shadow-sm overflow-hidden relative justify-between mr-1.5">
                  <View className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#008B8C]" />
                  <View className="absolute top-0 right-0 w-16 h-16 bg-[#008B8C]/10 rounded-bl-full" style={{ transform: [{ translateX: 16 }, { translateY: -16 }] }} />
                  <View>
                    <View className="flex-row items-center gap-2 mb-2">
                      <MaterialIcons name="book" size={20} color="#008B8C" />
                      <Text className="text-[14px] font-bold text-[#5a413c]">Điểm tri thức</Text>
                    </View>
                    <Text className="text-[28px] font-bold text-[#1b1c1c]">{profileData.knowledge_points + (profileData.books_collected * 100)}</Text>
                  </View>
                  <View className="mt-2">
                    <View className="w-full h-1.5 bg-[#dbd9d9] rounded-full overflow-hidden mb-1.5">
                      <View className="h-full bg-[#008B8C] rounded-full" style={{ width: `${profileData.knowledge_points}%` }} />
                    </View>
                    <Text className="text-[12px] font-bold text-[#5a413c]">{100 - profileData.knowledge_points} điểm tới Cấp {profileData.books_collected + 1}</Text>
                  </View>
                </View>

                <View className="flex-1 flex-col ml-1.5">
                  <View className="flex-1 bg-[#ffffff] p-3 pl-4 rounded-xl border border-[#e4e2e2] shadow-sm flex-row items-center justify-between overflow-hidden relative mb-1.5">
                    <View className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#008B8C]" />
                    <View>
                      <Text className="text-[12px] font-bold text-[#5a413c] mb-1">Chuỗi ngày</Text>
                      <View className="flex-row items-end">
                        <Text className="text-[20px] font-bold text-[#1b1c1c]">{profileData.current_streak}</Text>
                        <Text className="text-[12px] font-medium text-[#1b1c1c] ml-1 mb-1">ngày</Text>
                      </View>
                    </View>
                    <View className="w-10 h-10 rounded-full items-center justify-center">
                      <MaterialIcons name="local-fire-department" size={24} color="#008B8C" />
                    </View>
                  </View>

                  <View className="flex-1 bg-[#ffffff] p-3 pl-4 rounded-xl border border-[#e4e2e2] shadow-sm flex-row items-center justify-between overflow-hidden relative mt-1.5">
                    <View className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#008B8C]" />
                    <View>
                      <Text className="text-[12px] font-bold text-[#5a413c] mb-1">Hạng</Text>
                      <Text className="text-[16px] font-bold text-[#1b1c1c]">{getRank(profileData.books_collected)}</Text>
                    </View>
                    <View className="w-10 h-10 rounded-full items-center justify-center">
                      <MaterialIcons name="workspace-premium" size={24} color="#008B8C" />
                    </View>
                  </View>
                </View>
              </View>

              <View className="mb-8 items-center z-20 px-2">
                <Text className="text-[24px] font-bold text-[#1b1c1c] mb-4">Tủ sách trí tuệ</Text>
                
                <View className="w-full bg-[#f5eedf] border-[4px] border-[#8e706b] rounded-[12px] p-2 flex-col gap-4">
                  <View className="flex-row items-end justify-around border-b-[6px] border-[#a68a85] rounded-b-[4px] h-[90px] px-1 pb-[2px]">
                    <Book id={1} w="w-7" h="h-16" bg="bg-[#008B8C]" skew="-2deg"><View className="absolute top-1 bottom-1 left-[6px] w-0.5 bg-[#ffffff50]" /><View className="absolute top-2 w-2 h-4 bg-[#ffffff50] rounded-sm" /></Book>
                    <Book id={2} w="w-6" h="h-14" bg="bg-[#ffb4a5]" skew="1deg"><View className="absolute bottom-2 left-1 right-1 h-0.5 bg-[#00000020]" /><View className="absolute bottom-4 left-1 right-1 h-0.5 bg-[#00000020]" /></Book>
                    <Book id={3} w="w-9" h="h-18" bg="bg-[#7cf8dd]" glowBorder><View className="absolute top-1 bottom-1 left-1 right-1 border border-[#ffffff80] rounded-[2px]" /><Text className="absolute top-1 text-[8px] text-[#ffffff80]">★</Text></Book>
                    <Book id={4} w="w-5" h="h-12" bg="bg-[#fbf9f8]" skew="5deg"><View className="absolute top-0 bottom-0 left-1.5 w-1 bg-[#00000010]" /></Book>
                    <Book id={5} w="w-8" h="h-16" bg="bg-[#e2bfb8]"><View className="absolute top-3 w-4 h-5 bg-[#00000015] rounded-sm" /><View className="absolute bottom-2 w-4 h-0.5 bg-[#00000020]" /></Book>
                    <Book id={6} w="w-6" h="h-[68px]" bg="bg-[#ff6347]" skew="-3deg"><View className="absolute top-0 left-1.5 w-1 h-4 bg-[#ffd700]" /><View className="absolute bottom-3 left-1 right-1 h-[1px] bg-[#ffffff60]" /></Book>
                    <Book id={7} w="w-7" h="h-[76px]" bg="bg-[#008B8C]" glowBorder><View className="absolute top-3"><MaterialIcons name="workspace-premium" size={12} color="rgba(255,255,255,0.7)" /></View><View className="absolute bottom-4 left-1.5 right-1.5 h-0.5 bg-[#ffffff50]" /></Book>
                    <Book id={8} w="w-6" h="h-[60px]" bg="bg-[#ffb4a5]" skew="-1deg"><View className="absolute top-2 bottom-2 left-[5px] right-[5px] border border-[#00000020]" /></Book>
                    <Book id={9} w="w-10" h="h-[72px]" bg="bg-[#fbf9f8]"><View className="absolute top-0 bottom-0 right-2 w-1 bg-[#00000008]" /><View className="absolute top-4 w-5 h-6 bg-[#00000015] rounded-[2px]" /></Book>
                  </View>

                  <View className="flex-row items-end justify-around border-b-[6px] border-[#a68a85] rounded-b-[4px] h-[90px] px-2 pb-[2px]">
                    <Book id={10} w="w-8" h="h-14" bg="bg-[#fbf9f8]"><View className="absolute top-2 left-1.5 right-1.5 h-[2px] bg-[#00000015]" /><View className="absolute top-4 left-1.5 right-1.5 h-[2px] bg-[#00000015]" /></Book>
                    <Book id={11} w="w-7" h="h-[68px]" bg="bg-[#008B8C]" skew="2deg" glowBorder><View className="absolute top-2 left-1.5 w-3 h-0.5 bg-[#ffffff60]" /><View className="absolute top-4 left-1.5 w-2 h-0.5 bg-[#ffffff60]" /><View className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[#ffffff60]" /></Book>
                    <Book id={12} w="w-6" h="h-[52px]" bg="bg-[#ffb4a5]" skew="3deg"><View className="absolute inset-y-1 left-2 w-0.5 bg-[#00000020]" /></Book>
                    <Book id={13} w="w-9" h="h-16" bg="bg-[#e2bfb8]"><View className="absolute top-2 bottom-2 left-2 right-2 border-y-[3px] border-[#00000015]" /></Book>
                    <Book id={14} w="w-7" h="h-[72px]" bg="bg-[#7cf8dd]"><View className="absolute top-1 bottom-1 left-1.5 right-1.5 border border-[#00000020] rounded-full" /></Book>
                    <Book id={15} w="w-6" h="h-12" bg="bg-[#ff6347]" skew="-4deg"><View className="absolute top-0 left-[6px] w-1.5 h-3 bg-[#ffffff60]" /></Book>
                    <Book id={16} w="w-8" h="h-[60px]" bg="bg-[#008B8C]" glowBorder><View className="absolute bottom-2"><Text className="text-[10px] text-[#ffffff80]">★</Text></View></Book>
                    <Book id={17} w="w-6" h="h-[68px]" bg="bg-[#fbf9f8]" skew="-3deg"><View className="absolute top-2 w-2 h-2 rounded-full bg-[#00000015]" /><View className="absolute top-5 w-2 h-2 rounded-full bg-[#00000015]" /></Book>
                  </View>

                  <View className="flex-row items-end justify-around border-b-[6px] border-[#a68a85] rounded-b-[4px] h-[90px] px-1 pb-[2px]">
                    <Book id={18} w="w-8" h="h-16" bg="bg-[#e2bfb8]"><View className="absolute top-3 bottom-3 left-1.5 right-1.5 bg-[#00000010] rounded-sm" /></Book>
                    <Book id={19} w="w-6" h="h-14" bg="bg-[#fbf9f8]" skew="4deg"><View className="absolute top-0 bottom-0 left-0 w-2 bg-[#00000008]" /></Book>
                    <Book id={20} w="w-9" h="h-[76px]" bg="bg-[#ffb4a5]"><View className="absolute top-2 left-1 right-1 h-[2px] bg-[#00000020]" /><View className="absolute bottom-2 left-1 right-1 h-[2px] bg-[#00000020]" /><View className="w-4 h-4 rounded-full border border-[#00000020]" /></Book>
                    <Book id={21} w="w-7" h="h-[52px]" bg="bg-[#008B8C]"><View className="absolute top-1.5 bottom-1.5 left-1.5 w-[1px] bg-[#ffffff60]" /><View className="absolute top-1.5 bottom-1.5 right-1.5 w-[1px] bg-[#ffffff60]" /></Book>
                    <Book id={22} w="w-6" h="h-[68px]" bg="bg-[#ff6347]" glowBorder><View className="absolute inset-1 border border-[#ffffff50]" /></Book>
                    <Book id={23} w="w-10" h="h-[60px]" bg="bg-[#e2bfb8]" skew="-2deg"><View className="absolute top-2 bottom-2 left-2 right-2 border-[2px] border-[#00000010] rounded-sm" /><View className="w-2 h-2 bg-[#00000015] rounded-full" /></Book>
                    <Book id={24} w="w-5" h="h-12" bg="bg-[#7cf8dd]"><View className="absolute top-2 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /><View className="absolute top-4 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /><View className="absolute top-6 left-[3px] right-[3px] h-[1px] bg-[#00000020]" /></Book>
                    <Book id={25} w="w-8" h="h-16" bg="bg-[#008B8C]" skew="1deg"><View className="absolute top-3 w-4 h-6 bg-[#ffffff30] rounded-[2px]" /></Book>
                    <Book id={26} w="w-7" h="h-14" bg="bg-[#fbf9f8]"><View className="absolute top-0 bottom-0 left-1.5 w-1 bg-[#00000008]" /><View className="absolute bottom-2 w-3 h-[2px] bg-[#00000020]" /></Book>
                  </View>
                </View>
                
                <Text className="text-[12px] font-bold text-[#5a413c] mt-3 text-center opacity-70">
                  Bộ sưu tập 50 cuốn sách hành trình tri thức của bạn
                </Text>
              </View>

              <View className="mb-10">
                <Text className="text-[20px] font-bold text-[#1b1c1c] mb-4">Hoạt động gần đây</Text>
                <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-xl overflow-hidden shadow-sm relative">
                  <View className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#008B8C] z-10" />

                  <View className="flex-row items-center py-4 pr-4 pl-5 border-b border-[#f5f3f3]">
                    <View className="w-10 h-10 rounded-full bg-[#008B8C]/10 items-center justify-center mr-4">
                      <MaterialIcons name="login" size={20} color="#008B8C" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-medium text-[#1b1c1c]">Đăng nhập hàng ngày</Text>
                      <View className="flex-row items-center mt-1 gap-2">
                        <Text className="text-[12px] font-medium text-[#5a413c]">5 giờ trước</Text>
                        <View className="bg-[#008B8C]/10 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-[#008B8C]">+30 điểm tri thức</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center py-4 pr-4 pl-5 border-b border-[#f5f3f3]">
                    <View className="w-10 h-10 rounded-full bg-[#008B8C]/10 items-center justify-center mr-4">
                      <MaterialIcons name="timer" size={20} color="#008B8C" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-medium text-[#1b1c1c]">Hoàn thành 1 phiên Pomodoro</Text>
                      <View className="flex-row items-center mt-1 gap-2">
                        <Text className="text-[12px] font-medium text-[#5a413c]">3 giờ trước</Text>
                        <View className="bg-[#008B8C]/10 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-[#008B8C]">+30 điểm tri thức</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center py-4 pr-4 pl-5 border-b border-[#f5f3f3]">
                    <View className="w-10 h-10 rounded-full bg-[#008B8C]/10 items-center justify-center mr-4">
                      <MaterialIcons name="auto-stories" size={20} color="#008B8C" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-medium text-[#1b1c1c]">Mở khóa sách mới</Text>
                      <View className="flex-row items-center mt-1 gap-2">
                        <Text className="text-[12px] font-medium text-[#5a413c]">Hôm qua</Text>
                        <View className="bg-[#008B8C]/10 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-[#008B8C]">+30 điểm tri thức</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center py-4 pr-4 pl-5 border-b border-[#f5f3f3]">
                    <View className="w-10 h-10 rounded-full bg-[#008B8C]/10 items-center justify-center mr-4">
                      <MaterialIcons name="local-fire-department" size={20} color="#008B8C" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-medium text-[#1b1c1c]">Đạt chuỗi {profileData.current_streak} ngày</Text>
                      <View className="flex-row items-center mt-1 gap-2">
                        <Text className="text-[12px] font-medium text-[#5a413c]">Hôm nay</Text>
                        <View className="bg-[#008B8C]/10 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-[#008B8C]">+30 điểm tri thức</Text>
                        </View>
                      </View>
                    </View>
                  </View>

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
            <Text className="text-[24px] font-bold text-[#1b1c1c]">Nhiệm vụ hàng ngày</Text>
            <TouchableOpacity className="w-8 h-8 rounded-full items-center justify-center bg-[#f5f3f3] active:bg-[#eae8e7]" onPress={closeDailyTasks}>
              <MaterialIcons name="close" size={20} color="#008b8c" />
            </TouchableOpacity>
          </View>
          <View className="px-6 py-6 pb-12 flex-col gap-4">
            <View className="bg-[#ffffff] border border-[#e4e2e2] rounded-xl p-4 shadow-sm flex-row items-center justify-between">
              <View className="flex-row items-center gap-4 flex-1 pr-4">
                <View className="w-12 h-12 rounded-full bg-[#008b8c]/10 items-center justify-center">
                  <MaterialIcons name="center-focus-strong" size={24} color="#008b8c" />
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-bold text-[#1b1c1c] mb-1">Tập trung 3 giờ</Text>
                  <View className="w-full bg-[#e4e2e2] h-2 rounded-full overflow-hidden mt-1">
                    <View className="bg-[#008b8c] h-full rounded-full" style={{ width: `${Math.min((todayFocusMinutes / 180) * 100, 100)}%` }} />
                  </View>
                  <Text className="text-[12px] font-bold text-[#5a413c] mt-1">{todayFocusMinutes} / 180 phút</Text>
                </View>
              </View>
              <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${todayFocusMinutes >= 180 ? 'bg-[#008b8c] border-[#008b8c]' : 'border-[#e4e2e2]'}`}>
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
              <MaterialIcons name="close" size={20} color="#008b8c" />
            </TouchableOpacity>
          </View>
          <ScrollView className="px-6 py-6 pb-12 flex-col gap-6" showsVerticalScrollIndicator={false}>
            <View>
              <Text className="text-[18px] font-bold text-[#008b8c] mb-2">Basic Rule</Text>
              <Text className="text-[15px] text-[#5a413c] leading-6">Focus on work and study, generate knowledge point for your bookshelf, and grow with it.</Text>
            </View>
            <View>
              <Text className="text-[18px] font-bold text-[#008b8c] mb-3">How to generate knowledge point</Text>
              <View className="flex-col gap-3">
                <View className="flex-row items-start">
                  <MaterialIcons name="timer" size={20} color="#008B8C" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Complete a 25-minute pomodoro: <Text className="font-bold text-[#1b1c1c]">+25 point</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="check-circle" size={20} color="#008B8C" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Complete a task: <Text className="font-bold text-[#1b1c1c]">+5 point</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="wb-sunny" size={20} color="#008B8C" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">First daily login: <Text className="font-bold text-[#1b1c1c]">+30 point</Text></Text>
                </View>
                <View className="flex-row items-start">
                  <MaterialIcons name="local-fire-department" size={20} color="#008B8C" style={{ marginTop: 2, marginRight: 8 }} />
                  <Text className="text-[15px] text-[#5a413c] leading-6 flex-1">Log in for N consecutive days: <Text className="font-bold text-[#1b1c1c]">+(N x 6) point</Text>, capped at 80 days</Text>
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

        <CustomDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
          navigation={navigation} 
          currentScreen="Bookshelf" 
        />

      </SafeAreaView>
    </View>
  );
}