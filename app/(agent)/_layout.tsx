import { Tabs } from 'expo-router';

export default function AgentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Available Tickets',
          tabBarLabel: 'Feed',
        }}
      />
      <Tabs.Screen
        name="my-bids"
        options={{
          title: 'My Bids',
          tabBarLabel: 'Bids',
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          tabBarLabel: 'Jobs',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}
