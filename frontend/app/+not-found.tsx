import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../src/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ title: 'Page Not Found' }} />
      <View style={styles.content}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.emergency.primary} />
        <Text style={styles.title}>Screen Not Found</Text>
        <Text style={styles.desc}>This route does not exist or has been relocated.</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Return to SOS Dashboard</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy[900],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.white,
    marginTop: 16,
  },
  desc: {
    fontSize: 14,
    color: Colors.slate400,
    marginTop: 6,
    textAlign: 'center',
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.navy[800],
    borderRadius: 12,
  },
  linkText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '700',
  },
});
