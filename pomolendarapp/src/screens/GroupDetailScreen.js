import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Share, Image, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const { width } = Dimensions.get('window');
const POLL_INTERVAL_MS = 15000;

export default function GroupDetailScreen({ navigation, route }) {
  const { groupId, groupName } = route.params;

  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const loop1Ref = useRef(null);
  const loop2Ref = useRef(null);

  const pollRef = useRef(null);

  const fetchGroupDetail = async () => {
    try {
      const res = await api.get(`/teams/groups/${groupId}/`);
      setGroup(res.data);
    } catch (e) {
    }
  };

  const fetchLeaderboard = async (selectedPeriod) => {
    try {
      const res = await api.get(`/teams/groups/${groupId}/leaderboard/?period=${selectedPeriod}`);
      setLeaderboard(res.data.leaderboard || []);
    } catch (e) {
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

  const fetchAll = async (selectedPeriod = period) => {
    await Promise.all([fetchGroupDetail(), fetchLeaderboard(selectedPeriod)]);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      checkTimerState();
      pollRef.current = setInterval(() => fetchAll(), POLL_INTERVAL_MS);
      return () => clearInterval(pollRef.current);
    }, [period])
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
    Animated.timing(expandAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => { expandAnim.setValue(0); });
    setTimeout(() => { navigation.navigate('Home'); }, 200);
  };

  const handleChangePeriod = (p) => {
    setPeriod(p);
    fetchLeaderboard(p);
  };

  const handleShareInvite = () => {
    if (!group) return;
    Share.share({
      message: `Join my study group "${group.name}" on Pomolendar using the invite code: ${group.invite_code}`,
    });
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await api.delete(`/teams/groups/${groupId}/`);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Unable to leave group, please try again.');
            } finally {
              setIsLeaving(false);
            }
          }
        }
      ]
    );
  };

  const periodLabels = { today: 'Today', week: 'This Week', month: 'This Month' };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fbf9f8', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#c89d7d" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 mt-7 py-2">
          <TouchableOpacity className="w-10 h-10 items-center justify-center" onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="#c89d7d" />
          </TouchableOpacity>
          <Text className="text-[18px] font-bold text-[#1b1c1c]" numberOfLines={1}>{group?.name || groupName}</Text>
          <TouchableOpacity className="w-10 h-10 items-center justify-center" onPress={handleShareInvite}>
            <MaterialIcons name="person-add-alt" size={22} color="#c89d7d" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 pt-2" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          <View className="bg-white rounded-xl p-4 border border-[#e4e2e2] mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] font-bold text-[#a09b95] uppercase tracking-wider">Invite Code</Text>
              <Text className="text-[20px] font-bold text-[#c89d7d] tracking-widest mt-1">{group?.invite_code}</Text>
            </View>
            <TouchableOpacity onPress={handleShareInvite} className="bg-[#c89d7d]/10 px-4 py-2 rounded-full flex-row items-center">
              <MaterialIcons name="share" size={16} color="#c89d7d" />
              <Text className="text-[12px] font-bold text-[#c89d7d] ml-1.5">Share</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-[13px] font-bold text-[#5a413c] uppercase mb-3 ml-5 tracking-widest">
            Members ({group?.members?.length || 0})
          </Text>
          <View className="bg-white rounded-xl border border-[#e4e2e2] mb-4 overflow-hidden">
            {(group?.members || []).map((m, idx) => (
              <View
                key={m.user_id}
                className={`flex-row items-center px-4 py-3 ${idx < group.members.length - 1 ? 'border-b border-[#f5f3f3]' : ''}`}
              >
                {m.avatar ? (
                  <Image
                    source={{ uri: m.avatar }}
                    className="w-12 h-12 rounded-xl mr-3"
                    style={{ backgroundColor: '#c89d7d1a' }}
                  />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-[#c89d7d]/10 items-center justify-center mr-3">
                    <MaterialIcons name="person" size={20} color="#c89d7d" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-[#1b1c1c]" numberOfLines={1}>{m.name || m.email}</Text>
                  {m.is_focusing ? (
                    <Text className="text-[12px] text-[#4caf50] font-medium mt-0.5" numberOfLines={1}>
                      Focusing{m.current_task_title ? `: ${m.current_task_title}` : ''}
                    </Text>
                  ) : (
                    <Text className="text-[12px] text-[#a09b95] mt-0.5">Inactive</Text>
                  )}
                </View>
                <View
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: m.is_focusing ? '#4caf50' : '#e4e2e2' }}
                />
              </View>
            ))}
          </View>

          <View className="flex-row items-center justify-between mb-3 ml-5">
            <Text className="text-[13px] font-bold text-[#5a413c] uppercase tracking-widest">Leaderboard</Text>
          </View>
          <View className="flex-row bg-white rounded-xl p-1 mb-3 border border-[#e4e2e2]">
            {['today', 'week', 'month'].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => handleChangePeriod(p)}
                className={`flex-1 py-2 rounded-lg items-center ${period === p ? 'bg-[#c89d7d]' : ''}`}
              >
                <Text className={`text-[12px] font-bold ${period === p ? 'text-white' : 'text-[#5a413c]'}`}>
                  {periodLabels[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="bg-white rounded-xl border border-[#e4e2e2] mb-8 overflow-hidden">
            {leaderboard.length === 0 ? (
              <View className="items-center justify-center py-8">
                <Text className="text-[#a09b95] text-[13px] font-medium">No data available for this period</Text>
              </View>
            ) : (
              leaderboard.map((entry, idx) => (
                <View
                  key={entry.user_id}
                  className={`flex-row items-center px-4 py-3 ${idx < leaderboard.length - 1 ? 'border-b border-[#f5f3f3]' : ''}`}
                >
                  <View className="w-7 items-center">
                    <Text className={`text-[14px] font-bold ${idx === 0 ? 'text-[#c89d7d]' : 'text-[#a09b95]'}`}>{idx + 1}</Text>
                  </View>
                  <View className="flex-1 ml-2">
                    <Text className="text-[15px] font-bold text-[#1b1c1c]" numberOfLines={1}>{entry.name}</Text>
                    <Text className="text-[11px] text-[#8e706b] mt-0.5">
                      {entry.current_streak} day streak · {entry.knowledge_points} pts
                    </Text>
                  </View>
                  <Text className="text-[15px] font-bold text-[#c89d7d]">{entry.total_minutes} min</Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            onPress={handleLeaveGroup}
            disabled={isLeaving}
            className="py-2 rounded-3xl border border-[#ba1a1a]/30 items-center flex-row justify-center bg-white mx-12"
          >
            {isLeaving ? (
              <ActivityIndicator color="#ba1a1a" size="small" />
            ) : (
              <>
                <MaterialIcons name="logout" size={16} color="#ba1a1a" />
                <Text className="text-[14px] font-bold text-[#ba1a1a] ml-2">Leave Group</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>

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

      </SafeAreaView>
    </View>
  );
}