import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AnimatedPopup from './AnimatedPopup';

export default function TimerModals({ 
  completionModal, setCompletionModal, 
  breakDoneModal, setBreakDoneModal 
}) {
  return (
    <>
      <AnimatedPopup visible={completionModal.visible} onClose={() => setCompletionModal(prev => ({ ...prev, visible: false }))}>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: '#fffdf9', borderRadius: 12, paddingTop: 28, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center' }}>
          <View className="w-16 h-16 rounded-full bg-[#c89d7d]/15 items-center justify-center mb-3">
            <MaterialIcons name="celebration" size={32} color="#c89d7d" />
          </View>
          <Text className="text-[22px] font-bold font-sans text-[#1b1c1c] mb-1">Congratulations!</Text>
          <Text className="text-[15px] font-sans text-[#5a413c] text-center leading-5 mb-4">
            You have focused for <Text className="font-bold text-[#c89d7d]">{completionModal.minutes} minutes</Text>
          </Text>

          {completionModal.taskTitle && (
            <View className="w-full bg-[#f7f2ea] rounded-2xl px-4 py-3 mb-4">
              <Text className="text-[14px] font-bold font-sans text-[#1b1c1c] mb-2" numberOfLines={1}>{completionModal.taskTitle}</Text>
              <View className="flex-row items-center flex-wrap">
                {Array.from({ length: Math.max(completionModal.estimated, completionModal.completed, 1) }).map((_, i) => (
                  <MaterialIcons
                    key={i}
                    name="timer"
                    size={18}
                    color={i < completionModal.completed ? '#c89d7d' : '#e4e2e2'}
                    style={{ marginRight: 4, marginBottom: 4 }}
                  />
                ))}
              </View>
              <Text className="text-[12px] font-bold font-sans text-[#8e706b] mt-1">
                {completionModal.completed}/{Math.max(completionModal.estimated, completionModal.completed)} sessions completed
              </Text>
            </View>
          )}

          {!completionModal.isGuest && completionModal.points > 0 && (
            <View className="flex-row items-center px-4 py-2 mb-2">
              <MaterialIcons name="auto-awesome" size={16} color="#c89d7d" />
              <Text className="text-[13px] font-bold font-sans text-[#c89d7d] ml-1">+{completionModal.points} knowledge points</Text>
            </View>
          )}

          {completionModal.leveledUp && (
            <Text className="text-[13px] font-bold font-sans text-[#c89d7d] text-center mb-2">🎉 You just received a new book!</Text>
          )}

          <TouchableOpacity onPress={() => setCompletionModal(prev => ({ ...prev, visible: false }))} className="w-full bg-[#c89d7d] py-1.5 rounded-3xl items-center mt-2">
            <Text className="text-white font-bold font-sans text-[15px]">Great!</Text>
          </TouchableOpacity>
        </View>
      </AnimatedPopup>

      <AnimatedPopup visible={breakDoneModal} onClose={() => setBreakDoneModal(false)}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fffdf9', borderRadius: 18, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center' }}>
          <View className="w-16 h-16 rounded-full bg-[#c89d7d]/15 items-center justify-center mb-3">
            <MaterialIcons name="wb-sunny" size={30} color="#c89d7d" />
          </View>
          <Text className="text-[20px] font-bold font-sans text-[#1b1c1c] mb-1 text-center">Break is over!</Text>
          <Text className="text-[14px] font-sans text-[#5a413c] text-center leading-5 mb-5">Ready for the next focus session?</Text>
          <TouchableOpacity onPress={() => setBreakDoneModal(false)} className="w-full bg-[#c89d7d] py-2 rounded-[20px] items-center">
            <Text className="text-white font-bold font-sans text-[15px]">Start Now</Text>
          </TouchableOpacity>
        </View>
      </AnimatedPopup>
    </>
  );
}