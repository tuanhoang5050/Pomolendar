import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, FlatList, Image, ActivityIndicator, ImageBackground } from 'react-native';
import { MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api'; 

const CURRENT_USER_CARD_HEIGHT = 104;

export default function LeaderboardScreen({ navigation }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await api.get('/gamification/leaderboard/');
      if (response.data) {
        setLeaderboard(response.data.leaderboard);
        setCurrentUser(response.data.current_user);
      }
    } catch (error) {
      console.error("Error when loading leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1: return { color: '#e0a721', bg: 'bg-[#fdf3dd]' };
      case 2: return { color: '#9a9a9a', bg: 'bg-[#f2f2f0]' };
      case 3: return { color: '#c17a4d', bg: 'bg-[#fbeee4]' };
      default: return { color: '#8e706b', bg: 'bg-transparent' };
    }
  };

  const renderItem = ({ item }) => {
    const rankStyle = getRankStyle(item.rank);
    const isTop3 = item.rank <= 3;

    return (
      <View className={`flex-row items-center mb-2 px-2 py-2 rounded-xl ${isTop3 ? rankStyle.bg : 'bg-white'} border border-[#efeced]`}>
        <View className="w-9 items-center justify-center mr-3">
          {isTop3 ? (
            <FontAwesome5 name="medal" size={19} color={rankStyle.color} />
          ) : (
            <Text className="text-[15px] font-bold text-[#a89e99]">{item.rank}</Text>
          )}
        </View>

        <View
          className="w-12 h-12 rounded-full overflow-hidden bg-[#e4e2e2] mr-3"
          style={{ borderWidth: 2, borderColor: isTop3 ? rankStyle.color : '#ffffff' }}
        >
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center bg-[#c89d7d]/20">
              <MaterialIcons name="person" size={22} color="#c89d7d" />
            </View>
          )}
        </View>

        <View className="flex-1 pr-2">
          <Text className="text-[15px] font-bold text-[#1b1c1c] mb-1" numberOfLines={1}>{item.name}</Text>
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="owl" size={13} color="#eda87a" />
            <Text className="text-[12px] font-medium text-[#8e706b] ml-1">{item.knowledge_points} pts</Text>
          </View>
        </View>

        <View className="flex-row items-center px-2.5 py-1.5 rounded-xl">
          <MaterialIcons name="menu-book" size={15} color="#c89d7d" />
          <Text className="text-[14px] font-bold text-[#c89d7d] ml-1.5">{item.books_collected}</Text>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground 
      source={require('../../assets/image/background.png')} 
      style={{ flex: 1 }}
      resizeMode="cover" 
    >
      <SafeAreaView className="flex-1 mt-8">
        <View className="flex-row items-center px-5 py-4 border-b border-[#e4e2e2]/40 bg-white/60">
          <TouchableOpacity 
            className="w-10 h-10 items-center justify-center active:opacity-80"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#c89d7d" />
          </TouchableOpacity>
          <Text className="text-[20px] font-bold text-[#1b1c1c] ml-4">Leaderboard</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#c89d7d" />
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: 14,
              paddingBottom: currentUser ? CURRENT_USER_CARD_HEIGHT + 24 : 24,
            }}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-[#5a413c] font-medium">No data available</Text>
              </View>
            }
          />
        )}

        {!loading && currentUser && (
          <View
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              paddingBottom: 20, paddingTop: 12, paddingHorizontal: 16,
              backgroundColor: '#f6ead9', 
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
              borderTopWidth: 1, borderColor: '#eeddc4',
              shadowColor: '#5a413c', shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12, shadowRadius: 12, elevation: 12,
            }}
          >
            <Text
              style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 1,
                color: '#b8895a', marginBottom: 8, marginLeft: 4,
              }}
            >
              YOUR RANKING
            </Text>

            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#ffffff', borderRadius: 18,
                paddingVertical: 10, paddingHorizontal: 12,
                borderWidth: 1.5, borderColor: '#c89d7d',
              }}
            >
              <View className="w-9 items-center justify-center mr-3">
                {currentUser.rank <= 3 ? (
                  <FontAwesome5 name="medal" size={19} color={getRankStyle(currentUser.rank).color} />
                ) : (
                  <Text className="text-[15px] font-bold text-[#c89d7d]">{currentUser.rank}</Text>
                )}
              </View>

              <View
                className="w-12 h-12 rounded-full overflow-hidden bg-[#e4e2e2] mr-3"
                style={{ borderWidth: 2, borderColor: '#c89d7d' }}
              >
                {currentUser.avatar ? (
                  <Image source={{ uri: currentUser.avatar }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <View className="w-full h-full items-center justify-center bg-[#c89d7d]/20">
                    <MaterialIcons name="person" size={22} color="#c89d7d" />
                  </View>
                )}
              </View>

              <View className="flex-1 pr-2">
                <Text className="text-[15px] font-bold text-[#1b1c1c] mb-1" numberOfLines={1}>{currentUser.name}</Text>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="owl" size={13} color="#eda87a" />
                  <Text className="text-[12px] font-medium text-[#8e706b] ml-1">{currentUser.knowledge_points} pts</Text>
                </View>
              </View>

              <View className="flex-row items-center px-2.5 py-1.5 rounded-xl">
                <MaterialIcons name="menu-book" size={15} color="#c89d7d" />
                <Text className="text-[14px] font-bold text-[#c89d7d] ml-1.5">{currentUser.books_collected}</Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}