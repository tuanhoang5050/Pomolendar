// src/services/notifications.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const configureNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c89d7d',
    });
  }
};

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

const reminderIdentifier = (taskId) => `task-reminder-${taskId}`;

export const scheduleTaskReminder = async (task) => {
  if (!task || !task.id) return;
  const identifier = reminderIdentifier(task.id);

  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

  if (!task.reminder || task.is_completed) return;

  const triggerDate = new Date(task.reminder);
  if (isNaN(triggerDate.getTime()) || triggerDate.getTime() <= Date.now()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '⏰ Task Reminder',
        body: task.title || 'You have a task to complete',
        data: { taskId: task.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
      },
    });
  } catch (e) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '⏰ Task Reminder',
        body: task.title || 'You have a task to complete',
        data: { taskId: task.id },
        sound: true,
      },
      trigger: { date: triggerDate, channelId: Platform.OS === 'android' ? 'task-reminders' : undefined },
    });
  }
};

export const cancelTaskReminder = async (taskId) => {
  await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(taskId)).catch(() => {});
};

export const rescheduleAllTaskReminders = async (tasks) => {
  if (!Array.isArray(tasks)) return;
  await Promise.all(tasks.map(t => scheduleTaskReminder(t)));
};