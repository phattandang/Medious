import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors } from '../../lib/theme';

interface LoadingFooterProps {
  loading: boolean;
  hasMore?: boolean;
  noMoreText?: string;
}

export function LoadingFooter({
  loading,
  hasMore = true,
  noMoreText = "You're all caught up!",
}: LoadingFooterProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!hasMore) {
    return (
      <View style={styles.container}>
        <Text style={styles.noMoreText}>{noMoreText}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noMoreText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

export default LoadingFooter;
