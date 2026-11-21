export const notificationService = {
  /**
   * Register push notifications token placeholder.
   */
  registerForPushNotificationsAsync: async (): Promise<string | null> => {
    // Scaffold ready for Firebase Cloud Messaging (FCM) / Expo Push Token
    return 'mock-device-fcm-token';
  },
};
