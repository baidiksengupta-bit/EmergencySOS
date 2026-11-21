import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/constants/Colors';

export default function RootIndex() {
  const [checkingOnboarded, setCheckingOnboarded] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    const checkOnboardStatus = async () => {
      try {
        const onboarded = await AsyncStorage.getItem('@emergencysos_onboarded');
        setIsOnboarded(onboarded === 'true');
      } catch {
        setIsOnboarded(false);
      } finally {
        setCheckingOnboarded(false);
      }
    };

    checkOnboardStatus();
  }, []);

  if (checkingOnboarded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.emergency.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <Redirect href="/welcome" />;
  }

  // Once onboarded, direct immediately to the primary EmergencySOS Home Screen
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.navy[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
