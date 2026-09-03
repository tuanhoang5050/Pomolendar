import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform, Image, Animated, Dimensions
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import CustomDrawer from '../components/CustomDrawer';
import AnimatedPopup from '../components/AnimatedPopup';

const { width } = Dimensions.get('window');

export default function GroupsScreen({ navigation }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [groupAvatarUri, setGroupAvatarUri] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const loop1Ref = useRef(null);
  const loop2Ref = useRef(null);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/teams/groups/');
      setGroups(res.data || []);
    } catch (e) {}
  };

  const fetchPublicGroups = async () => {
    try {
      const res = await api.get('/teams/groups/discover/');
      setPublicGroups(res.data || []);
    } catch (e) {}
  };

  const checkTimerState = async () => {
    try {
      const state = await AsyncStorage.getItem('timer_state');
      setIsTimerRunning(state === 'running');
    } catch (e) {
      setIsTimerRunning(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchPublicGroups()]);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      checkTimerState();
    }, [])
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

  const openModal = (m) => {
    setMode(m);
    setGroupName('');
    setGroupDescription('');
    setIsPublic(false);
    setGroupAvatarUri(null);
    setInviteCode('');
    setIsModalOpen(true);
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to set a group avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setGroupAvatarUri(result.assets[0].uri);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', groupName.trim());
      formData.append('description', groupDescription.trim());
      formData.append('is_public', isPublic ? 'True' : 'False');

      if (groupAvatarUri) {
        let localUri = groupAvatarUri;
        if (Platform.OS === 'ios' && !localUri.startsWith('file://')) {
          localUri = 'file://' + localUri;
        }

        const filename = localUri.split('/').pop() || 'group_avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('avatar', { 
            uri: localUri, 
            name: filename, 
            type: type 
        });
      }

      await api.post('/teams/groups/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000 
      });
      
      setIsModalOpen(false);
      fetchAll();
    } catch (error) {
      if (error.message === 'Network Error') {
         Alert.alert('Network Error', 'Cannot connect to server. Please check if your image is valid or try without avatar first.');
      } else {
         Alert.alert('Error', error.response?.data?.error || 'Could not create group.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/teams/groups/join/', { invite_code: inviteCode.trim() });
      setIsModalOpen(false);
      fetchAll();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Could not join group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinPublicGroup = async (group) => {
    setJoiningGroupId(group.id);
    try {
      await api.post(`/teams/groups/${group.id}/join-public/`);
      fetchAll();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Could not join group.');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const GroupAvatar = ({ avatar, size = 56 }) => (
    <View
      style={{ width: size, height: size, borderRadius: 10 }}
      className="bg-[#c89d7d]/10 items-center justify-center mr-3 overflow-hidden border border-[#e4e2e2]/50"
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <MaterialIcons name="groups" size={size * 0.6} color="#c89d7d" />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fbf9f8' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between px-5 mt-7 py-2">
          <TouchableOpacity className="w-10 h-10 items-center justify-center" onPress={() => setIsDrawerOpen(true)}>
            <MaterialIcons name="menu" size={26} color="#c89d7d" />
          </TouchableOpacity>
          <Text className="text-[20px] font-bold text-[#1b1c1c]">Study Groups</Text>
          <TouchableOpacity className="w-10 h-10 items-center justify-center" onPress={() => openModal('create')}>
            <MaterialIcons name="add" size={26} color="#c89d7d" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#c89d7d" style={{ marginTop: 60 }} />
        ) : (
          <ScrollView className="flex-1 pt-2" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

            <Text className="text-[13px] font-bold text-[#8e706b] uppercase tracking-widest mb-2 mt-1 ml-5">My Groups</Text>
            {groups.length === 0 ? (
              <View className="items-center justify-center py-10 px-8 bg-white rounded-xl border border-[#e4e2e2] mb-3 mx-4">
                <MaterialIcons name="groups" size={44} color="#e4e2e2" />
                <Text className="text-[#8e706b] font-medium mt-3 text-center text-[13px]">
                  You haven't joined any groups yet.
                </Text>
              </View>
            ) : (
              groups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  className="bg-white rounded-xl p-2 border border-[#e4e2e2] mb-1 flex-row items-center justify-between"
                  onPress={() => navigation.navigate('GroupDetail', { groupId: group.id, groupName: group.name })}
                  activeOpacity={0.8}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <GroupAvatar avatar={group.avatar} />
                    <View className="flex-1">
                      <Text className="text-[16px] font-bold text-[#1b1c1c]" numberOfLines={1}>{group.name}</Text>
                      <Text className="text-[12px] text-[#8e706b] mt-0.5">
                        {group.member_count} members · {group.total_focus_minutes} min focused
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color="#a09b95" />
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              onPress={() => openModal('join')}
              className="flex-row items-center justify-center py-1.5 rounded-3xl border border-dashed border-[#c89d7d] ml-10 mr-10 bg-white mt-2"
            >
              <MaterialIcons name="key" size={18} color="#c89d7d" />
              <Text className="text-[14px] font-bold text-[#c89d7d] ml-2">Join with invite code</Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-bold text-[#8e706b] uppercase tracking-widest mb-3 mt-4 ml-5">Discover Public Groups</Text>
            {publicGroups.length === 0 ? (
              <View className="items-center justify-center py-8 px-8 bg-white rounded-2xl border border-[#e4e2e2] mx-4">
                <Text className="text-[#a09b95] font-medium text-center text-[13px]">
                  No public groups to join right now.
                </Text>
              </View>
            ) : (
              publicGroups.map(group => (
                <View key={group.id} className="bg-white rounded-xl p-2 border border-[#e4e2e2] mb-1">
                  <View className="flex-row items-center">
                    
                    <GroupAvatar avatar={group.avatar} />
                    
                    <View className="flex-1 pr-3 justify-center">
                      
                      <View className="flex-row items-baseline mb-0.5">
                        <Text className="text-[15px] font-bold text-[#1b1c1c] mr-1 flex-shrink-0" numberOfLines={1}>
                          {group.name}
                        </Text>
                        
                        {!!group.description && (
                          <Text className="text-[12px] font-medium text-[#8e706b] flex-shrink flex-1" numberOfLines={1}>
                            - {group.description}
                          </Text>
                        )}
                      </View>

                      <Text className="text-[11px] text-[#a09b95]">
                        {group.member_count} members · {group.total_focus_minutes} min focused
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleJoinPublicGroup(group)}
                      disabled={joiningGroupId === group.id}
                      className="bg-[#c89d7d] px-3 py-1.5 rounded-full items-center justify-center flex-row shadow-sm flex-shrink-0"
                      style={{ opacity: joiningGroupId === group.id ? 0.7 : 1 }}
                    >
                      {joiningGroupId === group.id ? (
                        <ActivityIndicator color="#ffffff" size="small" style={{ width: 14, height: 14 }} />
                      ) : (
                        <>
                          <Text className="text-[12px] font-bold text-white ml-0.5">Join</Text>
                        </>
                      )}
                    </TouchableOpacity>

                  </View>
                </View>
              ))
            )}

          </ScrollView>
        )}

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

      <CustomDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navigation={navigation}
        currentScreen="Groups"
      />

      <AnimatedPopup visible={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="w-[100%] max-w-[360px]">
          <View className="bg-[#fbf9f8] rounded-[16px] p-6 w-full">
            <View className="flex-row bg-[#e4e2e2]/40 rounded-xl p-1 mb-6">
              <TouchableOpacity
                onPress={() => setMode('create')}
                className={`flex-1 py-2 rounded-lg items-center ${mode === 'create' ? 'bg-[#c89d7d] shadow-sm' : ''}`}
              >
                <Text className={`font-bold text-[13px] ${mode === 'create' ? 'text-white' : 'text-[#5a413c]'}`}>Create Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('join')}
                className={`flex-1 py-2 rounded-lg items-center ${mode === 'join' ? 'bg-[#c89d7d] shadow-sm' : ''}`}
              >
                <Text className={`font-bold text-[13px] ${mode === 'join' ? 'text-white' : 'text-[#5a413c]'}`}>Join Group</Text>
              </TouchableOpacity>
            </View>

            {mode === 'create' ? (
              <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7} className="items-center mb-5">
                  <View className="w-20 h-20 bg-white rounded-full items-center justify-center overflow-hidden border-2 border-[#e4e2e2]">
                    {groupAvatarUri ? (
                      <Image source={{ uri: groupAvatarUri }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Feather name="camera" size={22} color="#a09b95" />
                    )}
                  </View>
                  <Text className="text-[12px] font-medium text-[#c89d7d] mt-2">Set group avatar</Text>
                </TouchableOpacity>

                <Text className="text-[13px] font-bold text-[#8e706b] mb-1 ml-1">Group Name</Text>
                <TextInput
                  className="bg-white border border-[#e4e2e2] rounded-xl px-4 py-3 text-[16px] text-[#1b1c1c] font-medium mb-4"
                  placeholder="e.g. Study Group DSA"
                  placeholderTextColor="#a09b95"
                  value={groupName}
                  onChangeText={setGroupName}
                />

                <Text className="text-[13px] font-bold text-[#8e706b] mb-1 ml-1">Description (optional)</Text>
                <TextInput
                  className="bg-white border border-[#e4e2e2] rounded-xl px-4 py-3 text-[14px] text-[#1b1c1c] mb-4"
                  placeholder="What is this group about?"
                  placeholderTextColor="#a09b95"
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={{ minHeight: 70 }}
                />

                <TouchableOpacity
                  onPress={() => setIsPublic(!isPublic)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-between bg-white border border-[#e4e2e2] rounded-xl px-4 py-3 mb-6"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[14px] font-bold text-[#1b1c1c]">Public group</Text>
                    <Text className="text-[11px] text-[#8e706b] mt-0.5">
                      {isPublic ? 'Anyone can find and join this group' : 'Only joinable via invite code'}
                    </Text>
                  </View>
                  <View className={`w-12 h-7 rounded-full justify-center px-1 ${isPublic ? 'bg-[#c89d7d]' : 'bg-[#e4e2e2]'}`}>
                    <View
                      className="w-5 h-5 rounded-full bg-white shadow-sm"
                      style={{ transform: [{ translateX: isPublic ? 20 : 0 }] }}
                    />
                  </View>
                </TouchableOpacity>

                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setIsModalOpen(false)} className="flex-1 py-1.5 rounded-3xl border border-[#e4e2e2] items-center bg-white">
                    <Text className="text-[15px] font-bold text-[#8e706b]">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateGroup}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  >
                    {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[15px] font-bold text-white">Create</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <>
                <Text className="text-[13px] font-bold text-[#8e706b] mb-1 ml-1">Invite Code</Text>
                <TextInput
                  className="bg-white border border-[#e4e2e2] rounded-xl px-4 py-3 text-[16px] text-[#1b1c1c] font-bold tracking-widest mb-6"
                  placeholder="ABC123"
                  placeholderTextColor="#a09b95"
                  autoCapitalize="characters"
                  maxLength={8}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                />

                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setIsModalOpen(false)} className="flex-1 py-1.5 rounded-3xl border border-[#e4e2e2] items-center bg-white">
                    <Text className="text-[15px] font-bold text-[#8e706b]">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleJoinGroup}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#c89d7d] py-1.5 rounded-3xl items-center shadow-sm"
                    style={{ opacity: isSubmitting ? 0.7 : 1 }}
                  >
                    {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[15px] font-bold text-white">Join</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </AnimatedPopup>

    </View>
  );
}