import React, { useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, 
  ActivityIndicator, StyleSheet, LayoutAnimation, Platform, UIManager, Modal, Dimensions 
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-gifted-charts'; // Đã import thư viện
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const getLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function StatisticsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ sessions: 0, duration: 0 });
  const [extraStats, setExtraStats] = useState({
    completedTasks: 0, streak: 0, books: 0, points: 0
  });
  const [chartData, setChartData] = useState([]);

  const fetchAnalyticsData = async (date, tab) => {
    setLoading(true);
    try {
      let daysParam = 7;
      if (tab === 'Monthly') daysParam = 30;
      if (tab === 'Yearly') daysParam = 365;

      const response = await api.get(`/planner/analytics/?days=${daysParam}`);
      const dailyStats = response.data.daily_stats || [];
      
      const targetDateStr = getLocalDateStr(date);

      if (tab === 'Daily') {
        const todayData = dailyStats.find(item => item.date === targetDateStr);
        if (todayData) {
          setStats({ duration: todayData.total_minutes, sessions: Math.ceil(todayData.total_minutes / 25) });
        } else {
          setStats({ sessions: 0, duration: 0 });
        }
      } else {
        setStats({
          duration: response.data.total_period_minutes || 0,
          sessions: Math.ceil((response.data.total_period_minutes || 0) / 25)
        });
      }

      setExtraStats({
        completedTasks: response.data.completed_tasks || 0,
        streak: response.data.current_streak || 0,
        books: response.data.books_collected || 0,
        points: response.data.knowledge_points || 0
      });

      // --- FORMAT DỮ LIỆU CHO THƯ VIỆN GIFTED CHARTS ---
      const generatedChart = [];
      const today = new Date();

      if (tab === 'Yearly') {
        const months = Array(12).fill(0);
        dailyStats.forEach(item => {
          const m = new Date(item.date).getMonth();
          months[m] += item.total_minutes;
        });
        months.forEach((val, i) => {
          generatedChart.push({ 
            label: `T${i+1}`, 
            value: val, 
            frontColor: '#c89d81',
            labelTextStyle: { color: '#3d3b38', fontSize: 10, fontWeight: 'bold' }
          });
        });
      } 
      else if (tab === 'Monthly') {
        for(let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = getLocalDateStr(d);
          const found = dailyStats.find(x => x.date === dateStr);
          const dayNum = d.getDate();
          
          generatedChart.push({
            label: (dayNum === 1 || dayNum % 5 === 0) ? dayNum.toString() : '',
            value: found ? found.total_minutes : 0,
            frontColor: '#c89d81',
            labelTextStyle: { color: '#a09b95', fontSize: 10 }
          });
        }
      } 
      else {
        // Daily & Weekly (7 ngày)
        for(let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = getLocalDateStr(d);
          const found = dailyStats.find(x => x.date === dateStr);
          const dayStr = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
          
          const isSelected = tab === 'Daily' ? (dateStr === targetDateStr) : true;

          generatedChart.push({
            label: dayStr,
            value: found ? found.total_minutes : 0,
            frontColor: isSelected ? '#c89d81' : '#e6d3c5', // Cột chọn đậm màu hơn
            labelTextStyle: { 
              color: isSelected ? '#3d3b38' : '#a09b95', 
              fontWeight: isSelected ? 'bold' : 'normal',
              fontSize: 12
            }
          });
        }
      }

      setChartData(generatedChart);

    } catch (error) {
      setStats({ sessions: 0, duration: 0 });
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAnalyticsData(selectedDate, activeTab);
    }, [selectedDate, activeTab])
  );

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
      const day = startOfWeek.getDay() || 7; 
      startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

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
            <Text className="text-center text-[18px] font-bold text-[#3d3b38] mb-6">Tháng {month + 1}, {year}</Text>
            <View className="flex-row mb-2">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
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
              <Text className="font-bold text-[#a09b95]">Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f6f4' }}>
      
      <View className="pt-14 px-6 pb-4 bg-white/90 z-20 flex-row justify-between items-center" style={styles.headerShadow}>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setIsDrawerOpen(true)} activeOpacity={0.7}>
            <MaterialIcons name="menu" size={28} color="#3d3b38" />
          </TouchableOpacity>
          <Text className="text-[24px] font-bold text-[#3d3b38]">History</Text>
        </View>
        <View className="flex-row items-center gap-5">
          <TouchableOpacity activeOpacity={0.7}><Feather name="list" size={22} color="#c89d81" /></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}><Feather name="tag" size={22} color="#c89d81" style={{ transform: [{ rotate: '90deg' }] }} /></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}><Feather name="share" size={22} color="#c89d81" /></TouchableOpacity>
        </View>
      </View>

      <View className="flex-row justify-between items-center px-4 py-2.5 bg-white z-10 rounded-b-2xl" style={styles.tabShadow}>
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

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        
        <View className="bg-white rounded-[24px] px-4 pt-4 pb-2 flex-col mb-4" style={styles.cardShadow}>
          
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

          {isExpanded && (
            <View className="mt-8 flex-col gap-8 pb-4">
              <View className="flex-row justify-around items-center relative">
                <View className="items-center flex-1">
                  <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Task Đã Xong</Text>
                  <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.completedTasks} <Text className="text-[14px] font-semibold">Task</Text></Text>
                </View>
                <View className="w-[1px] h-12 bg-gray-100" />
                <View className="items-center flex-1">
                  <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Chuỗi kỷ luật</Text>
                  <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.streak} <Text className="text-[14px] font-semibold">Ngày</Text></Text>
                </View>
              </View>

              <View className="flex-row justify-around items-center relative">
                <View className="items-center flex-1">
                  <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Sách đã nhận</Text>
                  <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.books} <Text className="text-[14px] font-semibold">Quyển</Text></Text>
                </View>
                <View className="w-[1px] h-12 bg-gray-100" />
                <View className="items-center flex-1">
                  <Text className="text-[12px] text-[#a09b95] font-semibold mb-1 uppercase tracking-wider">Điểm tri thức</Text>
                  <Text className="text-[24px] font-bold text-[#3d3b38]">{extraStats.points} <Text className="text-[14px] font-semibold">Điểm</Text></Text>
                </View>
              </View>
            </View>
          )}

          <View className="w-full items-center justify-center mt-3">
            <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7} className="p-1 items-center justify-center">
              <MaterialIcons name={isExpanded ? "expand-less" : "expand-more"} size={26} color="#a09b95" />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- KHU VỰC HIỂN THỊ BIỂU ĐỒ BẰNG THƯ VIỆN GIFTED CHARTS --- */}
        <View className="bg-white rounded-[24px] px-2 py-6 mb-12" style={styles.cardShadow}>
          {loading ? (
            <ActivityIndicator size="large" color="#c89d81" style={{ height: 160 }} />
          ) : chartData.length > 0 ? (
            <View style={{ height: 200, marginTop: 10, alignItems: 'center' }}>
              <BarChart
                data={chartData}
                barWidth={activeTab === 'Monthly' ? 6 : 22}
                spacing={activeTab === 'Monthly' ? 4 : (activeTab === 'Yearly' ? 12 : 20)}
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                hideYAxisText
                noOfSections={3}
                isAnimated
                animationDuration={600}
                initialSpacing={10}
              />
            </View>
          ) : (
            <View className="items-center justify-center h-40">
              <Text className="text-[#a09b95] text-[14px] font-medium">No data</Text>
            </View>
          )}
        </View>

      </ScrollView>

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