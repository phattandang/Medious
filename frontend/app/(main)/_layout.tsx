import React from 'react';
import { Platform, Pressable, View, GestureResponderEvent } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Brand palette (unique, modern, still “social”)
const COLORS = {
  bg: '#0B1220',          // deeper than your current header
  surface: '#0F172A',     // cards/headers
  glassBorder: '#22314A',
  text: '#E5E7EB',
  muted: '#94A3B8',
  primary: '#7C3AED',     // violet (your indigo-ish vibe, slightly punchier)
  primary2: '#22D3EE',    // cyan accent for “innovation” vibe (unique vs IG)
  danger: '#FB7185',
};

function CreateTabButton(props: BottomTabBarButtonProps) {
  const { ref, ...restProps } = props;
  return (
    <Pressable
      {...restProps}
      style={({ pressed }) => ({
        top: -18,
        alignItems: 'center',
        justifyContent: 'center',
        width: 62,
        height: 62,
        borderRadius: 31,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <LinearGradient
        colors={[COLORS.primary, COLORS.primary2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
        }}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,

        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.muted,

        // “Floating pill” bar
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.select({ ios: 26, android: 18 }),
          height: Platform.select({ ios: 72, android: 68 }),
          borderRadius: 22,
          backgroundColor: 'transparent', // we’ll render blur behind it
          borderTopWidth: 0,
          overflow: 'hidden',
          elevation: 0,
        },

        tabBarBackground: () => (
          <BlurView
            intensity={35}
            tint="dark"
            style={{
              flex: 1,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(15,23,42,0.55)',
            }}
          />
        ),

        tabBarItemStyle: {
          borderRadius: 18,
          marginVertical: 10,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
              {/* subtle active indicator = “premium” feel */}
              {focused ? (
                <View
                  style={{
                    marginTop: 6,
                    width: 18,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: COLORS.primary2,
                    opacity: 0.9,
                  }}
                />
              ) : null}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="create-event"
        options={{
          title: 'Create',
          headerShown: false,
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="my-events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Hidden routes (open them via buttons/links from other screens) */}
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
} 