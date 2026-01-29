import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import { locationApi, usersApi } from '../../lib/api';
import type { NearbyUser } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INITIAL_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export default function MapScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(
    user?.location_sharing_enabled || false
  );

  const {
    location,
    loading: locationLoading,
    error: locationError,
    permissionStatus,
    requestPermission,
    refreshLocation,
  } = useLocation({ token, enabled: locationSharingEnabled });

  // Fetch nearby users when location is available
  const fetchNearbyUsers = useCallback(async () => {
    if (!token || !location) return;

    try {
      setLoading(true);
      const users = await locationApi.getNearbyUsers(
        token,
        location.latitude,
        location.longitude,
        10, // 10km radius
        50 // limit
      );
      setNearbyUsers(users);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    } finally {
      setLoading(false);
    }
  }, [token, location]);

  // Update server location when we have a location
  useEffect(() => {
    if (location && token && locationSharingEnabled) {
      locationApi.updateLocation(token, location.latitude, location.longitude).catch(console.error);
    }
  }, [location, token, locationSharingEnabled]);

  // Fetch nearby users when location changes
  useEffect(() => {
    if (location && locationSharingEnabled) {
      fetchNearbyUsers();
    }
  }, [location, locationSharingEnabled, fetchNearbyUsers]);

  // Center map on user's location
  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [location]);

  const handleEnableLocationSharing = async () => {
    try {
      // First request location permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to show nearby users.'
        );
        return;
      }

      // Enable location sharing in backend
      if (token) {
        await locationApi.toggleLocationSharing(token, true);
        setLocationSharingEnabled(true);
      }
    } catch (error: any) {
      console.error('Error enabling location sharing:', error);
      Alert.alert('Error', error.message || 'Failed to enable location sharing.');
    }
  };

  const handleDisableLocationSharing = async () => {
    try {
      if (token) {
        await locationApi.toggleLocationSharing(token, false);
        setLocationSharingEnabled(false);
        setNearbyUsers([]);
      }
    } catch (error: any) {
      console.error('Error disabling location sharing:', error);
    }
  };

  const handleUserPress = (nearbyUser: NearbyUser) => {
    setSelectedUser(nearbyUser);
  };

  const handleViewProfile = (userId: string) => {
    setSelectedUser(null);
    router.push(`/profile/${userId}`);
  };

  const handleFollow = async (userId: string) => {
    if (!token) return;
    try {
      await usersApi.followUser(token, userId);
      // Optionally refresh or show feedback
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  const handleRefresh = () => {
    refreshLocation();
    fetchNearbyUsers();
  };

  // Show enable location sharing screen
  if (!locationSharingEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.enableContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={64} color="#6366F1" />
          </View>
          <Text style={styles.enableTitle}>Discover People Nearby</Text>
          <Text style={styles.enableText}>
            Enable location sharing to see other users near you and let them
            discover you too.
          </Text>
          <Text style={styles.privacyText}>
            Your location is only shared while using the app and you can disable
            it anytime.
          </Text>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={handleEnableLocationSharing}
          >
            <Ionicons name="location" size={20} color="#FFFFFF" />
            <Text style={styles.enableButtonText}>Enable Location Sharing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading while getting initial location
  if (locationLoading && !location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={
          location
            ? {
                ...location,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : INITIAL_REGION
        }
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapDarkStyle}
      >
        {/* Nearby User Markers */}
        {nearbyUsers.map((nearbyUser) => (
          <Marker
            key={nearbyUser.id}
            coordinate={{
              latitude: nearbyUser.location.latitude,
              longitude: nearbyUser.location.longitude,
            }}
            onPress={() => handleUserPress(nearbyUser)}
          >
            <View style={styles.markerContainer}>
              {nearbyUser.avatar ? (
                <Image
                  source={{ uri: nearbyUser.avatar }}
                  style={styles.markerAvatar}
                />
              ) : (
                <View style={styles.markerAvatarPlaceholder}>
                  <Ionicons name="person" size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nearby Users</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleDisableLocationSharing}
            >
              <Ionicons name="location-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Stats Overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.statBadge}>
          <Ionicons name="people" size={16} color="#6366F1" />
          <Text style={styles.statText}>{nearbyUsers.length} nearby</Text>
        </View>
      </View>

      {/* Selected User Card */}
      {selectedUser && (
        <View style={styles.userCardContainer}>
          <View style={styles.userCard}>
            <TouchableOpacity
              style={styles.closeCardButton}
              onPress={() => setSelectedUser(null)}
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.userCardContent}>
              {selectedUser.avatar ? (
                <Image
                  source={{ uri: selectedUser.avatar }}
                  style={styles.userCardAvatar}
                />
              ) : (
                <View style={styles.userCardAvatarPlaceholder}>
                  <Ionicons name="person" size={32} color="#94A3B8" />
                </View>
              )}

              <View style={styles.userCardInfo}>
                <Text style={styles.userCardName}>{selectedUser.name}</Text>
                {selectedUser.bio && (
                  <Text style={styles.userCardBio} numberOfLines={2}>
                    {selectedUser.bio}
                  </Text>
                )}
                <View style={styles.userCardDistance}>
                  <Ionicons name="location" size={14} color="#6366F1" />
                  <Text style={styles.userCardDistanceText}>
                    {selectedUser.distance_km} km away
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.userCardActions}>
              <TouchableOpacity
                style={styles.viewProfileButton}
                onPress={() => handleViewProfile(selectedUser.id)}
              >
                <Text style={styles.viewProfileButtonText}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.followButton}
                onPress={() => handleFollow(selectedUser.id)}
              >
                <Ionicons name="person-add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      )}
    </View>
  );
}

// Dark mode map style
const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64779e' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4b6878' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334e87' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6f9ba5' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3C7680' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6675' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#255763' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b0d5ce' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#023e58' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#98a5be' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d2c4d' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry.fill',
    stylers: [{ color: '#283d6a' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#3a4762' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4e6d70' }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    flex: 1,
  },
  enableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  enableTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  enableText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  privacyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    top: 100,
    left: 16,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  markerContainer: {
    padding: 2,
    backgroundColor: '#6366F1',
    borderRadius: 20,
  },
  markerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userCardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  userCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  closeCardButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  userCardContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userCardAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  userCardAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userCardBio: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  userCardDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCardDistanceText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  userCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewProfileButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followButton: {
    width: 48,
    height: 48,
    backgroundColor: '#334155',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
