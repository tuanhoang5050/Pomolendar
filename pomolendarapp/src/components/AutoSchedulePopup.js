import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AnimatedPopup from './AnimatedPopup';
import CustomDropdown from './CustomDropdown';

export default function AutoSchedulePopup({ visible, onClose, onConfirm, isScheduling }) {
  const [scheduleOpts, setScheduleOptions] = useState({
    priority_strategy: 'balanced', 
    preferred_time: 'any',         
    pacing: 'hustle',              
    distribution: 'front_load',    
    allow_split: true,             
  });

  const [showAutoScheduleInfo, setShowAutoScheduleInfo] = useState(false);
  const infoAnim = useRef(new Animated.Value(0)).current; 

  const showInfoPanel = () => {
    setShowAutoScheduleInfo(true);
    Animated.timing(infoAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const hideInfoPanel = () => {
    Animated.timing(infoAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowAutoScheduleInfo(false);
    });
  };

  const handleStart = () => {
    onConfirm(scheduleOpts);
  };

  return (
    <AnimatedPopup visible={visible} onClose={onClose}>
      <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#fbf9f8', borderRadius: 12, overflow: 'hidden' }}>
        
        <View className="px-5 py-4 border-b border-[#e4e2e2]/50 bg-white flex-row items-start justify-between" style={{ position: 'relative' }}>
          <View className="flex-1 pr-3">
            <Text className="text-[20px] font-bold font-sans text-[#1b1c1c]">Auto-Schedule</Text>
            <Text className="text-[13px] font-sans text-[#8e706b] mt-1">Configure your preferences</Text>
          </View>

          <TouchableOpacity
            onPressIn={showInfoPanel}
            onPressOut={hideInfoPanel}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="p-1 mt-0.5"
          >
            <MaterialIcons name="info-outline" size={22} color="#8e706b" />
          </TouchableOpacity>

          {showAutoScheduleInfo && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 44,
                right: 12,
                width: 270,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 12,
                zIndex: 999,
                elevation: 12,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 10,
                opacity: infoAnim,
                transform: [
                  { scale: infoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  { translateY: infoAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                ],
              }}
            >
              <Text className="font-sans" style={{ color: '#A9B388', fontSize: 12, marginBottom: 6 }}>
                About Auto-Schedule
              </Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16, marginBottom: 6 }}>
                Automatically organizes unscheduled tasks into your free slots based on the preferences below.
              </Text>

              <Text className="font-sans" style={{ color: '#C27664', fontSize: 11 }}>Priority</Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
                Determines which tasks are scheduled first: balanced approach, approaching deadlines, or high importance.
              </Text>

              <Text className="font-sans" style={{ color: '#6da7e2', fontSize: 11 }}>Time</Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
                Your preferred time of day for scheduling tasks (Morning, Afternoon, Evening, or Anytime).
              </Text>

              <Text className="font-sans" style={{ color: '#a28d92', fontSize: 11 }}>Pacing</Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
                Hustle: dense scheduling, short breaks. Chill: relaxed scheduling, more buffer time between tasks.
              </Text>

              <Text className="font-sans" style={{ color: '#eda87a', fontSize: 11 }}>Distribution</Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
                Front-load: packs tasks early in the week/day. Spread evenly: limits daily load to prevent burnout.
              </Text>

              <Text className="font-sans" style={{ color: '#a5b56c', fontSize: 11 }}>Task Splitting</Text>
              <Text className="font-sans" style={{ color: '#8b8b8b', fontSize: 11, lineHeight: 16 }}>
                Allows the system to break a long task into multiple shorter sessions if no single large time slot is available.
              </Text>
            </Animated.View>
          )}
        </View>

        <ScrollView className="max-h-[60vh] px-5 pt-5 pb-2" showsVerticalScrollIndicator={false}>
          
          <CustomDropdown 
            label="Priority"
            selectedValue={scheduleOpts.priority_strategy}
            onSelect={(val) => setScheduleOptions({...scheduleOpts, priority_strategy: val})}
            options={[
              { val: 'balanced', label: 'Balanced' },
              { val: 'deadline', label: 'Deadline First' },
              { val: 'importance', label: 'Priority First' }
            ]}
          />

          <CustomDropdown 
            label="Time"
            selectedValue={scheduleOpts.preferred_time}
            onSelect={(val) => setScheduleOptions({...scheduleOpts, preferred_time: val})}
            options={[
              { val: 'any', label: 'Anytime' },
              { val: 'morning', label: 'Morning (07:00 - 12:00)' },
              { val: 'afternoon', label: 'Afternoon (13:00 - 18:00)' },
              { val: 'evening', label: 'Evening (19:00 - 23:00)' }
            ]}
          />

          <CustomDropdown 
            label="Pacing"
            selectedValue={scheduleOpts.pacing}
            onSelect={(val) => setScheduleOptions({...scheduleOpts, pacing: val})}
            options={[
              { val: 'hustle', label: 'Hustle' },
              { val: 'chill', label: 'Chill' }
            ]}
          />

          <CustomDropdown 
            label="Distribution"
            selectedValue={scheduleOpts.distribution}
            onSelect={(val) => setScheduleOptions({...scheduleOpts, distribution: val})}
            options={[
              { val: 'front_load', label: 'Front-load' },
              { val: 'spread', label: 'Spread evenly' }
            ]}
          />

          <View className="mb-6 mt-2 border-t border-[#e4e2e2]/50 pt-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 pr-4">
                <Text className="text-[14px] font-bold font-sans text-[#5a413c]">Task Splitting</Text>
                <Text className="text-[11px] font-sans text-[#8e706b] mt-0.5">Allow dividing large tasks</Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setScheduleOptions({...scheduleOpts, allow_split: !scheduleOpts.allow_split})}
              >
                <MaterialIcons name={scheduleOpts.allow_split ? "toggle-on" : "toggle-off"} size={42} color={scheduleOpts.allow_split ? "#c89d7d" : "#e4e2e2"} />
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>

        <View className="px-5 py-4 border-t border-[#e4e2e2]/50 bg-white flex-row gap-3">
          <TouchableOpacity 
            onPress={handleStart} 
            className={`flex-[1.5] py-2 rounded-3xl items-center justify-center flex-row ${isScheduling ? 'bg-[#e4e2e2]' : 'bg-[#c89d7d] shadow-sm'}`}
            disabled={isScheduling}
          >
            {isScheduling ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-bold font-sans text-[15px]">Start Schedule</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedPopup>
  );
}