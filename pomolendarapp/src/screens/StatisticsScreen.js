import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, 
  ActivityIndicator, StyleSheet, ImageBackground, Modal, Dimensions, Animated 
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

const { width } = Dimensions.get('window');

const getLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDateRangeParams = (date, tab) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (tab === 'Daily') {
    const d = getLocalDateStr(date);
    return { start_date: d, end_date: d };
  }

  if (tab === 'Weekly') {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return { start_date: getLocalDateStr(startOfWeek), end_date: getLocalDateStr(endOfWeek) };
  }

  if (tab === 'Monthly') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start_date: getLocalDateStr(start), end_date: getLocalDateStr(end) };
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { start_date: getLocalDateStr(start), end_date: getLocalDateStr(end) };
};

export default function StatisticsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tagStats, setTagStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ sessions: 0, duration: 0 });
  const [extraStats, setExtraStats] = useState({
    completedTasks: 0, streak: 0, books: 0, points: 0
  });
  const [chartData, setChartData] = useState([]);

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim2 = useRef(new Animated.Value(0)).current;
  const loop1Ref = useRef(null);
  const loop2Ref = useRef(null);

  const [expandedContentHeight, setExpandedContentHeight] = useState(0);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const fetchAnalyticsData = async (date, tab) => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateRangeParams(date, tab);
      const response = await api.get(`/planner/analytics/?start_date=${start_date}&end_date=${end_date}`);
      const dailyStats = response.data.daily_stats || [];
      
      const targetDateStr = getLocalDateStr(date);

      if (tab === 'Daily') {
        const todayData = dailyStats.find(item => item.date === targetDateStr);
        if (todayData) {
          setStats({ duration: todayData.total_minutes, sessions: todayData.session_count || 0 });
        } else {
          setStats({ sessions: 0, duration: 0 });
        }
      } else {
        setStats({
          duration: response.data.total_period_minutes || 0,
          sessions: response.data.total_period_sessions || 0
        });
      }

      setExtraStats({
        completedTasks: response.data.completed_tasks || 0,
        streak: response.data.current_streak || 0,
        books: response.data.books_collected || 0,
        points: response.data.knowledge_points || 0
      });

      setTagStats(response.data.tag_stats || []);
      const generatedChart = [];

      if (tab === 'Yearly') {
        const months = Array(12).fill(0);
        dailyStats.forEach(item => {
          if (new Date(item.date).getFullYear() === selectedDate.getFullYear()) {
            const m = new Date(item.date).getMonth();
            months[m] += item.total_minutes;
          }
        });
        months.forEach((val, i) => {
          const isSelected = selectedDate.getMonth() === i;
          generatedChart.push({ 
            value: val, 
            label: `M${i+1}`, 
            frontColor: isSelected ? '#c89d7d' : '#e4e2e2',
            labelTextStyle: { 
              color: isSelected ? '#3d3b38' : '#a09b95', 
              fontSize: 10, 
              fontWeight: isSelected ? 'bold' : 'normal',
              textAlign: 'center'
            },
            topLabelComponent: () => (
              <View style={{ width: 14, alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: isSelected ? '#c89d7d' : '#a09b95', fontSize: 10, fontWeight: 'bold' }}>
                  {val > 0 ? val : ''}
                </Text>
              </View>
            )
          });
        });
      } 
      else if (tab === 'Monthly') {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthStr = String(month + 1).padStart(2, '0');
        const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
        
        let currentWeekStart = 1;
        const weeks = [];
        
        while (currentWeekStart <= lastDateOfMonth) {
            const d = new Date(year, month, currentWeekStart);
            const dayOfWeek = d.getDay();
            let daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
            let currentWeekEnd = currentWeekStart + daysToSunday;
            if (currentWeekEnd > lastDateOfMonth) currentWeekEnd = lastDateOfMonth;
            weeks.push({ start: currentWeekStart, end: currentWeekEnd });
            currentWeekStart = currentWeekEnd + 1;
        }

        weeks.forEach(week => {
            let weekSum = 0;
            const startStr = String(week.start).padStart(2, '0');
            const endStr = String(week.end).padStart(2, '0');
            const label = `${monthStr}/${startStr}\n${monthStr}/${endStr}`;
            
            for (let day = week.start; day <= week.end; day++) {
                const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
                const found = dailyStats.find(x => x.date === dateStr);
                if (found) weekSum += found.total_minutes;
            }

            const isSelected = selectedDate.getDate() >= week.start && selectedDate.getDate() <= week.end;
            
            generatedChart.push({
                value: weekSum,
                label: label,
                frontColor: isSelected ? '#c89d7d' : '#e4e2e2',
                labelTextStyle: { 
                  color: isSelected ? '#3d3b38' : '#a09b95', 
                  fontSize: 9, 
                  fontWeight: isSelected ? 'bold' : 'normal', 
                  textAlign: 'center'
                },
                topLabelComponent: () => (
                  <View style={{ width: 20, alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: isSelected ? '#c89d7d' : '#a09b95', fontSize: 10, fontWeight: 'bold' }}>
                      {weekSum > 0 ? weekSum : ''}
                    </Text>
                  </View>
                )
            });
        });
      } 
      else {
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

        for(let i = 0; i <= 6; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          
          const dateStr = getLocalDateStr(d);
          const found = dailyStats.find(x => x.date === dateStr);
          const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
          const val = found ? found.total_minutes : 0;
          
          const isSelected = dateStr === targetDateStr;

          generatedChart.push({
            value: val,
            label: dayStr,
            frontColor: isSelected ? '#c89d7d' : '#e4e2e2',
            labelTextStyle: { 
              color: isSelected ? '#3d3b38' : '#a09b95', 
              fontWeight: isSelected ? 'bold' : 'normal',
              fontSize: 11,
              textAlign: 'center'
            },
            topLabelComponent: () => (
              <View style={{ width: 16, alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: isSelected ? '#c89d7d' : '#a09b95', fontSize: 10, fontWeight: 'bold' }}>
                  {val > 0 ? val : ''}
                </Text>
              </View>
            )
          });
        }
      }

      setChartData(generatedChart);

    } catch (error) {
      setStats({ sessions: 0, duration: 0 });
      setChartData([]);
      setTagStats([]);
    } finally {
      setLoading(false);
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
      fetchAnalyticsData(selectedDate, activeTab);
      checkTimerState();
    }, [selectedDate, activeTab])
  );

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
    Animated.timing(expandAnim2, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => { expandAnim2.setValue(0); });
    setTimeout(() => { navigation.navigate('Home'); }, 200);
  };

  const handlePrevDate = () => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'Daily') newDate.setDate(newDate.getDate() - 1);
    if (activeTab === 'Weekly') newDate.setDate(newDate.getDate() - 7);
    if (activeTab === 'Monthly') newDate.setMonth(newDate.getMonth() - 1);
    if (activeTab === 'Yearly') newDate.setFullYear(newDate.getFullYear() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDate = () => {
    const newDate = new Date(selectedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (activeTab === 'Daily') newDate.setDate(newDate.getDate() + 1);
    if (activeTab === 'Weekly') newDate.setDate(newDate.getDate() + 7);
    if (activeTab === 'Monthly') newDate.setMonth(newDate.getMonth() + 1);
    if (activeTab === 'Yearly') newDate.setFullYear(newDate.getFullYear() + 1);
    
    if (newDate <= today) setSelectedDate(newDate);
  };

  const formatDateLabel = () => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    
    if (activeTab === 'Daily') return `${yyyy}/${mm}/${dd}`;
    
    if (activeTab === 'Weekly') {
      const startOfWeek = new Date(selectedDate);
      const day = startOfWeek.getDay(); 
      startOfWeek.setDate(startOfWeek.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      const formatStr = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      return `${formatStr(startOfWeek)} - ${formatStr(endOfWeek)}`;
    }
    
    if (activeTab === 'Monthly') {
      const lastDay = new Date(yyyy, selectedDate.getMonth() + 1, 0).getDate();
      return `${yyyy}/${mm}/01 - ${yyyy}/${mm}/${String(lastDay).padStart(2,'0')}`;
    }
    
    if (activeTab === 'Yearly') return `${yyyy}/01/01 - ${yyyy}/12/31`;
  };

  const toggleExpand = () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    Animated.timing(expandAnim, {
      toValue: willExpand ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleExpandedContentLayout = (e) => {
    const measuredHeight = e.nativeEvent.layout.height;
    if (measuredHeight > 0 && Math.round(measuredHeight) !== Math.round(expandedContentHeight)) {
      setExpandedContentHeight(measuredHeight);
    }
  };

  const expandedStatsContent = (
    <View className="flex-col gap-2 pb-4 pt-2">
      <View className="flex-row justify-around items-center relative">
        <View className="items-center flex-1">
          <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Completed Tasks</Text>
          <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.completedTasks} <Text className="text-[14px] font-semibold">Tasks</Text></Text>
        </View>
        <View className="w-[1px] h-12 bg-gray-100" />
        <View className="items-center flex-1">
          <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Current Streak</Text>
          <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.streak} <Text className="text-[14px] font-semibold">Days</Text></Text>
        </View>
      </View>

      <View className="flex-row justify-around items-center relative">
        <View className="items-center flex-1">
          <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Books Collected</Text>
          <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.books} <Text className="text-[14px] font-semibold">Books</Text></Text>
        </View>
        <View className="w-[1px] h-12 bg-gray-100" />
        <View className="items-center flex-1">
          <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Knowledge Points</Text>
          <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.points} <Text className="text-[14px] font-semibold">Points</Text></Text>
        </View>
      </View>
    </View>
  );

  const renderCalendarPopup = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

    return (
      <Modal transparent visible={isCalendarOpen} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setIsCalendarOpen(false)}
        >
          <View style={{ width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 20 }} onStartShouldSetResponder={() => true}>
            <Text className="text-center text-[18px] font-bold text-[#3d3b38] mb-6">Month {month + 1}, {year}</Text>
            <View className="flex-row mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <View key={d} className="w-[14.28%] items-center"><Text className="text-[12px] font-bold text-[#a09b95]">{d}</Text></View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {Array(adjustedFirstDay).fill(null).map((_, i) => <View key={`b-${i}`} className="w-[14.28%] h-10 mb-1" />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                const currentDateObj = new Date(year, month, d);
                const isSelected = d === selectedDate.getDate();
                const isFuture = currentDateObj > today;

                return (
                  <View key={d} className="w-[14.28%] items-center mb-1">
                    <TouchableOpacity 
                      disabled={isFuture}
                      onPress={() => { setSelectedDate(currentDateObj); setIsCalendarOpen(false); }} 
                      className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-[#c89d81]' : ''}`}
                    >
                      <Text className={`text-[15px] ${isSelected ? 'text-white font-bold' : isFuture ? 'text-[#e0e0e0] font-medium' : 'text-[#3d3b38] font-medium'}`}>{d}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity onPress={() => setIsCalendarOpen(false)} className="mt-6 bg-[#f5f3f3] py-3 rounded-xl items-center">
              <Text className="font-bold text-[#a09b95]">Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const barWidthVal = activeTab === 'Monthly' ? 24 : (activeTab === 'Yearly' ? 14 : 16);
  const dataCount = chartData.length || 1;
  const chartAvailableWidth = width - 64; 
  const initSpace = 16;
  const dynamicSpacing = dataCount > 1 
    ? Math.max(4, (chartAvailableWidth - initSpace * 2 - (barWidthVal * dataCount)) / (dataCount - 1))
    : 20;

  const maxChartValue = chartData.length > 0 && chartData.every(item => item.value === 0) ? 10 : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f6f4' }}>
      
      <View className="pt-14 px-6 pb-4 bg-white/90 z-20 flex-row justify-between items-center" style={styles.headerShadow}>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7}>
            <MaterialIcons name="menu" size={26} color="#c89d81" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-5">
          <TouchableOpacity activeOpacity={0.7}><Feather name="list" size={22} color="#c89d81" /></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}><Feather name="tag" size={22} color="#c89d81" style={{ transform: [{ rotate: '90deg' }] }} /></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}><Feather name="share" size={22} color="#c89d81" /></TouchableOpacity>
        </View>
      </View>

      <View className="flex-row justify-between items-center px-4 py-2.5 bg-white z-10 rounded-b-xl" style={styles.tabShadow}>
        {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(tab => (
          <TouchableOpacity 
            key={tab} activeOpacity={0.8}
            onPress={() => { setActiveTab(tab); setSelectedDate(new Date()); }}
            className={`py-1.5 px-4 rounded-2xl ${activeTab === tab ? 'bg-[#c89d81]' : 'bg-transparent'}`}
          >
            <Text className={`font-medium text-[14px] ${activeTab === tab ? 'text-white' : 'text-[#a09b95]'}`}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 pt-4" showsVerticalScrollIndicator={false}>
        
        <View className="bg-white rounded-[12px] px-4 pt-4 pb-2 flex-col mb-4" style={styles.cardShadow}>
          
          <View className="flex-row justify-between items-center px-2 mb-4">
            <TouchableOpacity onPress={handlePrevDate} className="p-1" activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={26} color="#c89d81" />
            </TouchableOpacity>
            
            <Text className="text-[#3d3b38] font-semibold text-[16px]">{formatDateLabel()}</Text>
            
            <View className="flex-row gap-1 items-center">
              <TouchableOpacity onPress={handleNextDate} className="p-1" activeOpacity={0.7}>
                <MaterialIcons name="chevron-right" size={26} color="#c89d81" />
              </TouchableOpacity>
              
              {activeTab === 'Daily' && (
                <TouchableOpacity onPress={() => setIsCalendarOpen(true)} className="p-1 pl-2 border-l border-gray-100" activeOpacity={0.7}>
                  <MaterialIcons name="calendar-today" size={20} color="#c89d81" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="flex-row justify-around items-center relative">
            <View className="items-center flex-1">
              <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Focus sessions</Text>
              <Text className="text-[24px] font-bold text-[#3d3b38]">{stats.sessions} <Text className="text-[14px] font-semibold">Time</Text></Text>
            </View>
            <View className="w-[1px] h-12 bg-gray-100" />
            <View className="items-center flex-1">
              <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Focus duration</Text>
              <Text className="text-[24px] font-bold text-[#3d3b38]">{stats.duration} <Text className="text-[14px] font-semibold">Min</Text></Text>
            </View>
          </View>

          <View
            style={{ position: 'absolute', opacity: 0, left: 0, right: 0, top: 0, zIndex: -1 }}
            pointerEvents="none"
            onLayout={handleExpandedContentLayout}
          >
            {expandedStatsContent}
          </View>

          <Animated.View
            style={{
              height: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, expandedContentHeight],
              }),
              opacity: expandAnim,
              overflow: 'hidden',
            }}
          >
            {expandedStatsContent}
          </Animated.View>

          <View className="w-full items-center justify-center mt-3">
            <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7} className="p-1 items-center justify-center">
              <Animated.View
                style={{
                  transform: [{
                    rotate: expandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  }],
                }}
              >
                <MaterialIcons name="expand-more" size={26} color="#a09b95" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white rounded-[12px] px-2 py-8 mb-4" style={styles.cardShadow}>
          {loading ? (
            <ActivityIndicator size="large" color="#c89d81" style={{ height: 160 }} />
          ) : chartData.length > 0 ? (
            <View style={{ height: 220, marginTop: 10, alignItems: 'center' }}>
              <BarChart
                data={chartData}
                barWidth={barWidthVal}
                spacing={dynamicSpacing}
                initialSpacing={initSpace}
                maxValue={maxChartValue}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                hideYAxisText
                disableScroll={true}
              />
            </View>
          ) : (
            <View className="items-center justify-center h-40">
              <Text className="text-[#a09b95] text-[14px] font-medium">No data</Text>
            </View>
          )}
        </View>

        <View className="bg-white rounded-[12px] px-4 py-6 mb-32" style={styles.cardShadow}>
          {loading ? (
            <ActivityIndicator size="large" color="#c89d81" style={{ height: 160 }} />
          ) : tagStats.length > 0 ? (
            <>
              <View className="items-center justify-center mb-6">
                <PieChart
                  data={tagStats.map(t => ({ value: t.total_minutes, color: t.color }))}
                  donut
                  radius={90}
                  innerRadius={55}
                  innerCircleColor={'#ffffff'}
                  centerLabelComponent={() => (
                    <View className="items-center justify-center">
                      <Text className="text-[20px] font-bold text-[#3d3b38]">
                        {tagStats.reduce((sum, t) => sum + t.total_minutes, 0)}
                      </Text>
                      <Text className="text-[11px] text-[#a09b95] font-semibold">Min</Text>
                    </View>
                  )}
                />
              </View>

              <View className="flex-col gap-3">
                {tagStats.map(tag => (
                  <View key={tag.tag_id} className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2">
                      <View style={{ backgroundColor: tag.color }} className="w-3 h-3 rounded-full mr-2" />
                      <Text className="text-[14px] font-medium text-[#3d3b38] flex-1" numberOfLines={1}>
                        {tag.name}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-[12px] font-bold text-[#a09b95]">{tag.completion_rate}% completed</Text>
                      <Text className="text-[13px] font-bold text-[#c89d81]">{tag.total_minutes} min</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View className="items-center justify-center h-32">
              <Text className="text-[#a09b95] text-[14px] font-medium">No tag data available for this period</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {isTimerRunning && (
        <>
          <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
          <Animated.View style={{ position: 'absolute', bottom: 40, left: width / 2 - 32, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c89d7d', transform: [{ scale: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }], opacity: pulseAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), zIndex: 40, pointerEvents: 'none' }} />
        </>
      )}
      <Animated.View style={{ position: 'absolute', bottom: 72, left: width / 2, width: 2, height: 2, borderRadius: 1, backgroundColor: '#c89d7d', transform: [{ translateX: -1 }, { scale: expandAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 1500] }) }], zIndex: 60, pointerEvents: 'none' }} />
      <TouchableOpacity
        className="absolute bottom-10 left-1/2 w-16 h-16 bg-[#c89d7d] rounded-full items-center justify-center shadow-lg z-50 border border-white/30"
        style={{ elevation: 8, transform: [{ translateX: -32 }] }}
        onPress={handleStartTimer}
        activeOpacity={0.9}
      >
        <MaterialIcons name="play-arrow" size={32} color="#ffffff" />
      </TouchableOpacity>

      {renderCalendarPopup()}

      <CustomDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        navigation={navigation} 
        currentScreen="Statistics" 
      />

    </View>
  );
}

const styles = StyleSheet.create({
  headerShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  tabShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 3,
  },
  cardShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 4,
  }
});