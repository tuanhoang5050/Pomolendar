import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AnimatedPopup from './AnimatedPopup';

export default function DeepFocusModals({ 
  showDeepFocusPrompt, setShowDeepFocusPrompt, handleSetupDeepFocus,
  showAllowListModal, setShowAllowListModal, installedApps, 
  allowedAppPackages, toggleAllowApp, startDeepFocusMode 
}) {
  return (
    <>
<AnimatedPopup visible={showDeepFocusPrompt} onClose={() => setShowDeepFocusPrompt(false)}>
        <View className="bg-[#fbf9f8] w-full rounded-2xl p-4 items-center">
          <Text className="text-[#1b1c1c] font-bold font-sans text-[22px] mb-2 text-center">Enable Deep Focus?</Text>
          <Text className="text-[#5a413c] font-sans text-center mb-4 leading-5 px-2">
            When you leave the app, you will be blocked and brought back.
          </Text>

          <View className="w-full bg-[#f5f3f3] rounded-xl p-3.5 mb-6 border border-[#e4e2e2]">
            <Text className="text-[#1b1c1c] font-bold text-[13px] mb-2">Required Android permissions:</Text>
            
            <View className="flex-row items-start mb-2">
              <Text className="text-[#5a413c] text-[12px] leading-4 flex-1">
                <Text className="font-bold">Usage Data Access: </Text>
                To detect when you open a distracting app.
              </Text>
            </View>

            <View className="flex-row items-start mb-2">
              <Text className="text-[#5a413c] text-[12px] leading-4 flex-1">
                <Text className="font-bold">Display over apps: </Text>
                To show the warning screen over other apps.
              </Text>
            </View>

            <View className="flex-row items-start">
              <Text className="text-[#5a413c] text-[12px] leading-4 flex-1">
                <Text className="font-bold">Installed Apps List: </Text>
                To build your allowed apps list.
              </Text>
            </View>
          </View>

          <View className="flex-row w-full justify-between gap-4 py-2">
            <TouchableOpacity onPress={() => setShowDeepFocusPrompt(false)} className="flex-1 py-2 items-center justify-center rounded-[20px] bg-[#e4e2e2] active:opacity-80">
              <Text className="text-[#5a413c] font-bold font-sans text-[14px]">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSetupDeepFocus} className="flex-1 py-2 items-center rounded-[20px] bg-[#ce9d7d] active:opacity-80 shadow-sm">
              <Text className="text-white font-bold font-sans text-[14px]">Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedPopup>

      {showAllowListModal && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 400, justifyContent: 'flex-end' }]}>
          <View className="bg-[#fbf9f8] rounded-t-xl h-[80%] p-6 pb-10">
            <Text className="text-[20px] font-bold font-sans text-[#1b1c1c] mb-2">Allow List</Text>
            <Text className="text-[14px] font-sans text-[#5a413c] mb-4">Marked apps will NOT be blocked during Deep Focus.</Text>
            
            <FlatList
              data={installedApps}
              keyExtractor={item => item.packageName}
              renderItem={({ item }) => {
                const isAllowed = allowedAppPackages.includes(item.packageName);
                return (
                  <TouchableOpacity 
                    onPress={() => toggleAllowApp(item.packageName)}
                    className="flex-row items-center justify-between py-3 border-b border-[#e4e2e2]"
                  >
                    <Text className="text-[16px] font-sans text-[#1b1c1c] flex-1 mr-4" numberOfLines={1}>{item.appName}</Text>
                    <MaterialIcons 
                      name={isAllowed ? "check-box" : "check-box-outline-blank"} 
                      size={24} color={isAllowed ? "#c89d7d" : "#e4e2e2"} 
                    />
                  </TouchableOpacity>
                )
              }}
            />
            <View className="flex-row gap-2 mt-2 mb-2">
              <TouchableOpacity onPress={() => setShowAllowListModal(false)} className="flex-1 py-2 items-center rounded-[20px] bg-[#e4e2e2]">
                <Text className="text-[#5a413c] font-bold font-sans text-[14px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startDeepFocusMode} className="flex-1 py-2 items-center rounded-[20px] bg-[#c89d7d]">
                <Text className="text-white font-bold font-sans text-[14px]">Start Deep Focus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}