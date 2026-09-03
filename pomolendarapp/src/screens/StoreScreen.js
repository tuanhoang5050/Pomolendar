import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Image, ImageBackground } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';
import AnimatedPopup from '../components/AnimatedPopup';
import { ANIMATION_ASSETS } from '../constants/Assets'; 

export default function StoreScreen({ navigation }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('animation');

  const [selectedAnimItem, setSelectedAnimItem] = useState(null);
  const [isBuying, setIsBuying] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const fetchStoreData = async () => {
    try {
      const response = await api.get('/gamification/store/');
      setPoints(response.data.current_points);
      setItems(response.data.items);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchStoreData(); }, []));

  const handleBuyConfirm = async () => {
    if (!selectedAnimItem) return;
    setIsBuying(true);
    try {
      const res = await api.post('/gamification/store/', { item_id: selectedAnimItem.id });
      setPoints(res.data.current_points);
      
      setSelectedAnimItem(null);
      setShowSuccessPopup(true);
      fetchStoreData(); 
    } catch (e) {
      alert("Not enough points or already owned.");
    } finally {
      setIsBuying(false);
    }
  };

  const filteredAnimations = items.filter(i => i.category === 'animation');
  const filteredSounds = items.filter(i => i.category === 'sound');

  return (
    <ImageBackground source={require('../../assets/image/background.png')} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 mt-7 py-4">
          <TouchableOpacity className="w-10 h-10 items-center justify-center active:opacity-80" onPress={() => setIsDrawerOpen(true)}>
            <MaterialIcons name="menu" size={22} color="#c89d7d" />
          </TouchableOpacity>
          <View className="flex-row items-center bg-[#c89d7d]/10 px-4 py-1 rounded-full border border-[#c89d7d]/30">
            <MaterialCommunityIcons name="owl" size={16} color="#c89d7d" />
            <Text className="text-[15px] font-bold text-[#c89d7d] ml-2">{points} Pts</Text>
          </View>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-[28px] font-bold text-[#1b1c1c]">Store</Text>
          <Text className="text-[14px] text-[#5a413c]">Spend knowledge points to customize your experience.</Text>
        </View>

        <View className="flex-row mx-5 bg-[#f5f3f3] p-1 rounded-xl mb-4">
          <TouchableOpacity onPress={() => setActiveTab('animation')} className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'animation' ? 'bg-[#c89d7d] shadow-sm' : ''}`}>
            <Text className={`font-bold ${activeTab === 'animation' ? 'text-white' : 'text-[#5a413c]'}`}>Animations</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('sound')} className={`flex-1 py-2.5 items-center rounded-lg ${activeTab === 'sound' ? 'bg-[#c89d7d] shadow-sm' : ''}`}>
            <Text className={`font-bold ${activeTab === 'sound' ? 'text-white' : 'text-[#5a413c]'}`}>Sounds</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#c89d7d" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            
            {activeTab === 'animation' && (
              <View className="flex-row flex-wrap justify-between">
                {filteredAnimations.map(item => {
                  const asset = ANIMATION_ASSETS[item.file_identifier] || ANIMATION_ASSETS['reading'];
                  return (
                    <TouchableOpacity 
                      key={item.id} 
                      className="bg-white p-3 rounded-2xl mb-4 border border-[#e4e2e2] shadow-sm w-[48%] items-center"
                      onPress={() => setSelectedAnimItem(item)}
                      activeOpacity={0.8}
                    >
                      <View className="w-full aspect-square bg-[#fbf9f8] rounded-xl mb-3 items-center justify-center overflow-hidden border border-[#f5f3f3]">
                        {asset?.preview ? (
                          <Image source={asset.preview} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                        ) : (
                          <MaterialIcons name="image" size={40} color="#e4e2e2" />
                        )}
                      </View>
                      
                      <Text className="text-[15px] font-bold text-[#1b1c1c] mb-2 text-center" numberOfLines={1}>{item.name}</Text>
                      
                      <View className={`px-6 py-1 rounded-full ${item.is_owned ? 'bg-[#c89d7d]/20 border border-[#c89d7d]' : 'bg-[#e4e2e2]'}`}>
                        <Text className={`text-[12px] font-bold ${item.is_owned ? 'text-[#c89d7d]' : 'text-[#5a413c]'}`}>
                          {item.is_owned ? 'Unlocked' : `${item.price} Pts`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {activeTab === 'sound' && (
              filteredSounds.map(item => (
                <View key={item.id} className="bg-white p-4 rounded-xl mb-4 border border-[#e4e2e2] shadow-sm flex-row items-center">
                  <View className="w-16 h-16 bg-[#f5f3f3] rounded-3xl items-center justify-center mr-4">
                    <MaterialIcons name="audiotrack" size={32} color="#c89d7d" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[18px] font-bold text-[#1b1c1c]">{item.name}</Text>
                    <Text className="text-[12px] text-[#8e706b] mb-2">{item.description}</Text>
                    <View className={`px-3 py-1 rounded-3xl self-start ${item.is_owned ? 'bg-[#c89d7d]/20 border border-[#c89d7d]' : 'bg-[#e4e2e2]'}`}>
                      <Text className={`font-bold text-[12px] ${item.is_owned ? 'text-[#c89d7d]' : 'text-[#5a413c]'}`}>
                        {item.is_owned ? 'Unlocked' : `${item.price} Pts`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <CustomDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} navigation={navigation} currentScreen="Store" />

      <AnimatedPopup visible={!!selectedAnimItem} onClose={() => !isBuying && setSelectedAnimItem(null)}>
        {selectedAnimItem && (
          <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text className="text-[20px] font-bold text-[#1b1c1c] mb-4 text-center">{selectedAnimItem.name}</Text>
            
            <View className="w-full aspect-square bg-[#fbf9f8] rounded-2xl items-center justify-center mb-4 border border-[#e4e2e2]">
              <LottieView 
                source={(ANIMATION_ASSETS[selectedAnimItem.file_identifier] || ANIMATION_ASSETS['reading']).lottie}
                autoPlay 
                loop 
                style={{ width: '90%', height: '90%' }} 
              />
            </View>
            
            <Text className="text-[14px] text-[#5a413c] text-center mb-6">{selectedAnimItem.description || 'A beautiful focus animation.'}</Text>
            
            <View className="flex-row w-full gap-3">
              <TouchableOpacity onPress={() => setSelectedAnimItem(null)} className="flex-1 py-1.5 rounded-3xl border border-[#e2bfb8] items-center">
                <Text className="text-[#1b1c1c] font-bold">Close</Text>
              </TouchableOpacity>
              
              {!selectedAnimItem.is_owned ? (
                <TouchableOpacity 
                  onPress={handleBuyConfirm} 
                  disabled={isBuying || points < selectedAnimItem.price}
                  className={`flex-1 py-1.5 rounded-3xl flex-row items-center justify-center shadow-sm ${points < selectedAnimItem.price ? 'bg-[#e4e2e2]' : 'bg-[#c89d7d]'}`}
                >
                  {isBuying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="auto-awesome" size={16} color={points < selectedAnimItem.price ? "#8e706b" : "#fff"} />
                      <Text className={`font-bold ml-1 ${points < selectedAnimItem.price ? 'text-[#8e706b]' : 'text-white'}`}>{selectedAnimItem.price} Pts</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View className="flex-1 py-1.5 rounded-3xl bg-[#c89d7d]/20 border border-[#c89d7d] items-center justify-center">
                  <Text className="text-[#c89d7d] font-bold">Unlocked</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </AnimatedPopup>

      <AnimatedPopup visible={showSuccessPopup} onClose={() => setShowSuccessPopup(false)}>
        <View style={{ width: '100%', maxWidth: 300, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' }}>
          <View className="w-16 h-16 rounded-full bg-[#c89d7d]/20 items-center justify-center mb-4">
            <MaterialIcons name="check-circle" size={36} color="#c89d7d" />
          </View>
          <Text className="text-[20px] font-bold text-[#1b1c1c] mb-2">Purchase Successful!</Text>
          <Text className="text-[14px] text-[#5a413c] text-center mb-6">You have unlocked a new item. You can equip it now.</Text>
          <TouchableOpacity onPress={() => setShowSuccessPopup(false)} className="w-full bg-[#c89d7d] py-2 rounded-[28px] items-center">
            <Text className="text-white font-bold text-[15px]">Awesome!</Text>
          </TouchableOpacity>
        </View>
      </AnimatedPopup>

    </ImageBackground>
  );
}