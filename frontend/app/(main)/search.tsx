import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { searchApi } from '../../lib/api';
import { colors } from '../../lib/theme';
import type { SearchResults } from '../../types';

type SearchType = 'all' | 'users' | 'events';

interface UserResult {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  followers_count: number;
  following_count: number;
}

interface EventResult {
  id: string;
  title: string;
  category: string;
  location_name: string;
  start_date: string;
  host: {
    id: string;
    name: string;
    avatar?: string;
  };
  attendees_count: number;
}

export default function SearchScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !token) {
      setResults(null);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await searchApi.search(token, query.trim(), searchType);
        setResults(data);
        setHasSearched(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchType, token]);

  const handleUserPress = (userId: string) => {
    router.push(`/profile/${userId}` as any);
  };

  const handleEventPress = (eventId: string) => {
    router.push(`/events/${eventId}` as any);
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setHasSearched(false);
  };

  const renderFilterTab = (type: SearchType, label: string) => (
    <TouchableOpacity
      style={[styles.filterTab, searchType === type && styles.filterTabActive]}
      onPress={() => setSearchType(type)}
    >
      <Text
        style={[
          styles.filterTabText,
          searchType === type && styles.filterTabTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleUserPress(item.id)}
      activeOpacity={0.7}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        {item.bio ? (
          <Text style={styles.resultSubtext} numberOfLines={1}>
            {item.bio}
          </Text>
        ) : (
          <Text style={styles.resultSubtext}>
            {item.followers_count} followers
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderEventItem = ({ item }: { item: EventResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleEventPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.eventIcon}>
        <Ionicons name="calendar" size={24} color={colors.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.title}</Text>
        <Text style={styles.resultSubtext}>
          {item.category} • {item.location_name}
        </Text>
        <Text style={styles.resultMeta}>
          {new Date(item.start_date).toLocaleDateString()} •{' '}
          {item.attendees_count} attending
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={64} color={colors.border} />
          <Text style={styles.placeholderTitle}>Search Medious</Text>
          <Text style={styles.placeholderText}>
            Find users and events by typing in the search bar above
          </Text>
        </View>
      );
    }

    const users = results?.users || [];
    const events = results?.events || [];
    const hasResults = users.length > 0 || events.length > 0;

    if (!hasResults) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={64} color={colors.border} />
          <Text style={styles.placeholderTitle}>No results found</Text>
          <Text style={styles.placeholderText}>
            Try different keywords or filters
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={[
          ...(searchType !== 'events' ? users.map((u) => ({ type: 'user' as const, data: u })) : []),
          ...(searchType !== 'users' ? events.map((e) => ({ type: 'event' as const, data: e })) : []),
        ]}
        keyExtractor={(item) =>
          item.type === 'user' ? `user-${item.data.id}` : `event-${item.data.id}`
        }
        renderItem={({ item }) =>
          item.type === 'user'
            ? renderUserItem({ item: item.data as UserResult })
            : renderEventItem({ item: item.data as EventResult })
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {searchType !== 'events' && users.length > 0 && (
              <Text style={styles.sectionTitle}>
                Users ({users.length})
              </Text>
            )}
          </>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, events..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterTab('all', 'All')}
        {renderFilterTab('users', 'Users')}
        {renderFilterTab('events', 'Events')}
      </View>

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.textInverse,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  resultSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  separator: {
    height: 8,
  },
});
