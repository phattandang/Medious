import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function CreateEventScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="add-circle-outline" size={64} color="#6366F1" />
        <Text style={styles.title}>Create Event</Text>
        <Text style={styles.subtitle}>Event creation form will be displayed here</Text>
        <Text style={styles.info}>Coming Soon: Create and host your own events!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
  },
  info: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 24,
    textAlign: 'center',
  },
});